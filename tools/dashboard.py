#!/usr/bin/env python3
"""
dashboard.py - Live web dashboard for MachineControllerOS.

Subscribes to every unit's MQTT status/event topics and serves a local web
page showing current state per device (sortable, click any column header),
a Recipes tab for non-technical operators to run pre-defined recipes with
one click, and a running event log - no more scrolling through PowerShell
output.

Usage:
    python dashboard.py
    python dashboard.py --broker 192.168.2.8 --port 1883 --http-port 8000

Then open http://localhost:8000 in a browser and leave it open.

Requires: pip install paho-mqtt
"""

import argparse
import json
import queue
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import paho.mqtt.client as mqtt

import recipe_db

DEFAULT_BROKER = "192.168.2.9"   # matches MQTT_SERVER in lib/Core/Config.h
DEFAULT_MQTT_PORT = 1883
DEFAULT_HTTP_PORT = 8000
MAX_EVENTS = 200
RECIPE_JOB_TIMEOUT = 120   # seconds to wait for one ingredient before failing a recipe run

state_lock = threading.Lock()
devices = {}   # device_id -> latest status payload (+ _lastSeen)
events = []    # list of {time, device, actuator, event}, newest first
mqtt_client = None   # set in main(), used by the HTTP handler to publish commands

# Recipe run state, all guarded by state_lock.
recipe_run_state = None            # dict describing the in-progress/last recipe run, or None
recipe_cancel_event = threading.Event()
recipe_next_event = threading.Event()   # set when the user clicks "Next Ingredient"
recipe_event_queue = queue.Queue()  # terminal job events, consumed only while a recipe is running


def now_str():
    return datetime.now().strftime("%H:%M:%S")


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f"[{now_str()}] Connected to broker, subscribing...")
        client.subscribe("machine/+/status")
        client.subscribe("machine/+/event")
    else:
        print(f"[{now_str()}] Connect failed: {reason_code}")


def on_message(client, userdata, msg):
    parts = msg.topic.split("/")
    device_id = parts[1] if len(parts) > 1 else "unknown"

    try:
        payload = json.loads(msg.payload.decode())
    except (ValueError, UnicodeDecodeError):
        payload = {"raw": msg.payload.decode(errors="replace")}

    with state_lock:
        if msg.topic.endswith("/status"):
            payload["_lastSeen"] = now_str()
            devices[device_id] = payload
        else:
            actuator = payload.get("actuator", 0)
            event_name = payload.get("event", "Unknown")

            events.insert(0, {
                "time": now_str(),
                "device": device_id,
                "actuator": actuator,
                "event": event_name,
            })
            del events[MAX_EVENTS:]

            # Feed the recipe runner only while it's actually waiting on
            # something, so this queue doesn't grow unbounded between runs.
            if recipe_run_state is not None and recipe_run_state.get("status") == "running":
                recipe_event_queue.put({
                    "device": device_id,
                    "actuator": actuator,
                    "event": event_name,
                })


# --------------------------------------------------------------------------
# Recipe runner - resolves ingredients against currently known devices, then
# dispenses strictly one ingredient at a time, in recipe order, waiting for
# each one to fully finish before starting the next.
# --------------------------------------------------------------------------

def wait_for_recipe_event(device, actuator, timeout):
    deadline = time.monotonic() + timeout

    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return "Timeout"

        try:
            event = recipe_event_queue.get(timeout=remaining)
        except queue.Empty:
            return "Timeout"

        if event["device"] != device or event["actuator"] != actuator:
            continue

        if event["event"] in ("JobFinished", "JobRejected", "Error"):
            return event["event"]


def run_recipe_worker(name):
    global recipe_run_state

    recipe = recipe_db.load_recipe(name)
    if recipe is None:
        with state_lock:
            recipe_run_state["status"] = "error"
            recipe_run_state["message"] = f"Recipe '{name}' no longer exists"
        return

    with state_lock:
        ingredient_map = {}
        for device_id, d in devices.items():
            for actuator in (0, 1):
                ingredient = d.get(f"ingredient{actuator}")
                if ingredient:
                    ingredient_map[ingredient.lower()] = (device_id, actuator)

        steps = []
        unresolved = []
        for ingredient, grams, speed in recipe:
            target = ingredient_map.get(ingredient.lower())
            if target is None:
                unresolved.append(ingredient)
                steps.append({
                    "ingredient": ingredient, "grams": grams, "speed": speed,
                    "device": None, "actuator": None, "status": "unresolved",
                })
            else:
                device_id, actuator = target
                steps.append({
                    "ingredient": ingredient, "grams": grams, "speed": speed,
                    "device": device_id, "actuator": actuator, "status": "pending",
                })

        recipe_run_state["steps"] = steps

        if unresolved:
            recipe_run_state["status"] = "error"
            recipe_run_state["message"] = (
                "No connected dispenser currently reports: " + ", ".join(unresolved)
            )
            return

    # Drain any stale terminal events left over from a previous run.
    while not recipe_event_queue.empty():
        try:
            recipe_event_queue.get_nowait()
        except queue.Empty:
            break

    for i, step in enumerate(steps):
        if recipe_cancel_event.is_set():
            with state_lock:
                for remaining in steps[i:]:
                    remaining["status"] = "cancelled"
                recipe_run_state["status"] = "cancelled"
                recipe_run_state["message"] = "Cancelled by user"
            return

        with state_lock:
            step["status"] = "running"
            recipe_run_state["current_step"] = i
            recipe_run_state["status"] = "running"

        command = {
            "command": "dispense",
            "actuator": step["actuator"],
            "targetWeight": step["grams"],
            "speed": step["speed"],
        }
        topic = f"machine/{step['device']}/command"
        mqtt_client.publish(topic, json.dumps(command))
        print(f"[{now_str()}] Recipe '{name}' step {i + 1}/{len(steps)}: "
              f"{step['grams']}g {step['ingredient']} on {step['device']} actuator {step['actuator']}")

        result = wait_for_recipe_event(step["device"], step["actuator"], RECIPE_JOB_TIMEOUT)

        with state_lock:
            if result == "JobFinished":
                step["status"] = "done"
            elif result == "Timeout":
                step["status"] = "timeout"
                recipe_run_state["status"] = "error"
                recipe_run_state["message"] = (
                    f"Timed out waiting for {step['ingredient']} on {step['device']} actuator {step['actuator']}"
                )
                return
            else:
                step["status"] = "failed"
                recipe_run_state["status"] = "error"
                recipe_run_state["message"] = (
                    f"{step['device']} actuator {step['actuator']} reported '{result}' "
                    f"while dispensing {step['ingredient']}"
                )
                return

        # Ingredient dispensed successfully. Unless this was the last one,
        # pause here and wait for the operator to click "Next Ingredient"
        # before starting the next dispense - don't just plow ahead.
        if i < len(steps) - 1:
            with state_lock:
                recipe_run_state["status"] = "waiting_next"

            recipe_next_event.clear()
            while True:
                if recipe_cancel_event.is_set():
                    with state_lock:
                        for remaining in steps[i + 1:]:
                            remaining["status"] = "cancelled"
                        recipe_run_state["status"] = "cancelled"
                        recipe_run_state["message"] = "Cancelled by user"
                    return
                if recipe_next_event.wait(timeout=0.2):
                    recipe_next_event.clear()
                    break

    with state_lock:
        recipe_run_state["status"] = "done"
        recipe_run_state["current_step"] = len(steps)


PAGE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>MachineControllerOS Dashboard</title>
<style>
  body { font-family: Segoe UI, Arial, sans-serif; background: #1e1f24; color: #e6e6e6; margin: 0; padding: 20px; }
  h1 { font-size: 28px; font-weight: 600; margin: 0 0 4px 0; }
  #status { font-size: 20px; margin-bottom: 16px; }
  .ok { color: #4caf50; }
  .bad { color: #f44336; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 24px; font-size: 23px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #3a3b42; }
  th { cursor: pointer; color: #9aa0aa; font-weight: 600; user-select: none; }
  th:hover { color: #fff; }
  tr.mode-dispensing, tr.mode-flushing { background: #1c2b3a; }
  tr.mode-error, tr.mode-emergencystop { background: #3a1c1c; }
  tr.mode-ready, tr.mode-idle { background: transparent; }
  td.ingredient { font-weight: 700; text-transform: capitalize; }
  .cell-ok { color: #4caf50; }
  .cell-bad { color: #f44336; }
  #events { max-height: 300px; overflow-y: auto; border: 1px solid #3a3b42; border-radius: 4px; }
  .event { padding: 6px 12px; font-size: 22px; border-bottom: 1px solid #2a2b30; font-family: Consolas, monospace; }
  .event-jobaccepted, .event-jobstarted { color: #64b5f6; }
  .event-jobfinished { color: #4caf50; }
  .event-jobrejected, .event-error { color: #f44336; }
  .event-emergencystop { color: #ff1744; font-weight: 700; }
  .event-errorcleared { color: #ffb300; }
  h2 { font-size: 24px; color: #9aa0aa; margin: 28px 0 8px 0; }
  h2:first-of-type { margin-top: 0; }
  h3 { font-size: 22px; color: #cfd3da; margin: 0 0 10px 0; }
  .panel { padding: 14px; margin-bottom: 24px; background: #26272e; border: 1px solid #3a3b42; border-radius: 6px; }
  #controls { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
  #controls label, .panel label { font-size: 22px; color: #9aa0aa; display: flex; flex-direction: column; gap: 4px; }
  #controls select, #controls input, .panel select, .panel input[type=text], .panel input[type=number] {
    background: #1e1f24; color: #e6e6e6; border: 1px solid #3a3b42; border-radius: 4px; padding: 8px 10px; font-size: 23px;
  }
  #controls input[type=number] { width: 90px; }
  button { background: #3a3b42; color: #e6e6e6; border: 1px solid #4a4b52; border-radius: 4px; padding: 10px 18px; font-size: 23px; cursor: pointer; }
  button:hover { background: #4a4b52; }
  button:disabled { opacity: 0.5; cursor: default; }
  #btnDispense, .btn-primary { background: #1565c0; border-color: #1976d2; }
  #btnDispense:hover, .btn-primary:hover { background: #1976d2; }
  #btnResume, .btn-run { background: #2e7d32; border-color: #388e3c; }
  #btnResume:hover, .btn-run:hover { background: #388e3c; }
  #btnReset, .btn-danger { background: #6a1b1b; border-color: #8a2424; }
  #btnReset:hover, .btn-danger:hover { background: #8a2424; }
  #commandStatus { font-size: 12px; }

  .recipe-card { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 16px; background: #26272e; border: 1px solid #3a3b42; border-radius: 6px; margin-bottom: 10px; flex-wrap: wrap; }
  .recipe-name { font-size: 25px; font-weight: 700; text-transform: capitalize; margin-right: 14px; }
  .recipe-ingredients { color: #9aa0aa; font-size: 20px; flex-basis: 100%; margin-top: 4px; }
  .recipe-card-buttons { display: flex; gap: 8px; }
  .recipe-card-buttons button { padding: 8px 14px; font-size: 20px; }
  #recipeEmpty { color: #9aa0aa; font-size: 22px; margin-bottom: 16px; }
  #btnToggleNewRecipe { margin-bottom: 16px; }

  #ingredientRows { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
  .ingredient-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .ingredient-row select { flex: 2; min-width: 140px; }
  .ingredient-row input { flex: 1; width: 110px; }
  .ingredient-row button { padding: 6px 12px; font-size: 18px; }
  #recipeFormActions { display: flex; gap: 10px; margin-top: 10px; align-items: center; }
  #recipeFormStatus { margin-top: 8px; font-size: 20px; }
  #recipeNoIngredients { color: #ffb300; font-size: 20px; margin: 8px 0; }

  #recipeRunPanel ol { list-style: none; padding: 0; margin: 0 0 14px 0; }
  #recipeRunPanel li { padding: 8px 12px; font-size: 21px; border-left: 4px solid #3a3b42; margin-bottom: 6px; background: #1e1f24; border-radius: 0 4px 4px 0; }
  #recipeRunPanel li.step-running { border-left-color: #1976d2; }
  #recipeRunPanel li.step-done { border-left-color: #4caf50; color: #9aa0aa; }
  #recipeRunPanel li.step-failed, #recipeRunPanel li.step-timeout, #recipeRunPanel li.step-unresolved { border-left-color: #f44336; }
  #recipeRunPanel li.step-cancelled { border-left-color: #ffb300; color: #9aa0aa; }
  #recipeRunMessage { font-size: 21px; margin-top: 8px; }
  #recipeRunMessage.bad { color: #f44336; }
  #recipeRunMessage.ok { color: #4caf50; }
</style>
</head>
<body>

<h1>MachineControllerOS Dashboard</h1>
<div id="status" class="bad">Connecting...</div>

<h2>Recipes</h2>

<button id="btnToggleNewRecipe" type="button" class="btn-primary">+ New Recipe</button>

<div id="recipeFormWrap" class="panel" style="display:none;">
  <h3 id="recipeFormTitle">New Recipe</h3>
  <label>Recipe name
    <input type="text" id="recipeNameInput" placeholder="e.g. Fried Rice">
  </label>

  <div id="ingredientRows"></div>
  <div id="recipeNoIngredients" style="display:none;">No dispensers detected yet - power them on, then reload this page.</div>
  <button id="btnAddIngredientRow" type="button">+ Add ingredient</button>

  <div id="recipeFormActions">
    <button id="btnSaveRecipe" type="button" class="btn-primary">Save Recipe</button>
    <button id="btnCancelEditRecipe" type="button">Cancel</button>
  </div>
  <div id="recipeFormStatus"></div>
</div>

<div id="recipeRunPanel" class="panel" style="display:none;"></div>

<div id="recipeList"></div>
<div id="recipeEmpty" style="display:none;">No recipes yet - create one above.</div>

<h2>Dispensers</h2>
<table>
  <thead>
    <tr>
      <th data-key="ingredient">Ingredient</th>
      <th data-key="device">Device</th>
      <th data-key="actuator">Actuator</th>
      <th data-key="mode">Mode</th>
      <th data-key="progress">Progress</th>
      <th data-key="weight">Weight (g)</th>
      <th data-key="queued">Queued</th>
      <th data-key="wifi">WiFi</th>
      <th data-key="mqtt">MQTT</th>
      <th data-key="error">Last Error</th>
      <th data-key="lastSeen">Last Seen</th>
    </tr>
  </thead>
  <tbody id="tbody"></tbody>
</table>

<h2>Send Command</h2>
<div id="controls" class="panel">
  <label>Dispenser
    <select id="dispenserSelect"></select>
  </label>
  <label>Target weight (g)
    <input type="number" id="weightInput" value="50" min="0" step="1">
  </label>
  <label>Speed
    <input type="number" id="speedInput" value="1000" min="1" step="50">
  </label>
  <button id="btnDispense">Dispense</button>
  <button id="btnTare">Tare</button>
  <button id="btnResume">Resume</button>
  <button id="btnReset">Reset</button>
  <span id="commandStatus"></span>
</div>

<h2>Events</h2>
<div id="events"></div>

<script>
let lastDevices = {};
let lastEvents = [];
let lastRecipes = [];
let lastRecipeRun = null;
let sortKey = "device";
let sortAsc = true;
let editingRecipeName = null;   // null = creating a new recipe
let dismissedRunKey = null;     // "name@currentStep" of the last run panel the user dismissed
let ingredientRowSeq = 0;

function dispenserRows() {
  const rows = [];
  for (const [id, d] of Object.entries(lastDevices)) {
    for (let actuator = 0; actuator < 2; actuator++) {
      const job = d["job" + actuator] || {};
      const weight = d["loadCell" + actuator];
      const queued = d["queuedJobs" + actuator];
      rows.push({
        ingredient: d["ingredient" + actuator] || "unknown",
        device: id,
        actuator: actuator,
        mode: d["mode" + actuator] || "",
        progress: job.active ? (job.progress + "%") : "-",
        weight: (weight !== undefined) ? Number(weight).toFixed(1) : "-",
        queued: (queued !== undefined) ? queued : "-",
        wifi: d.wifi ? "up" : "down",
        mqtt: d.mqtt ? "up" : "down",
        error: d["lastError" + actuator] || "",
        lastSeen: d._lastSeen || "",
      });
    }
  }
  return rows;
}

function renderTable() {
  const rows = dispenserRows();

  // Natural sort (numeric-aware) so esp32-2 sorts before esp32-10, and ties
  // (e.g. same device, different actuator) keep their original push order -
  // Array.sort is stable, and rows are pushed actuator 0 then 1 per device,
  // so actuator 0 always lands above actuator 1 within a device by default.
  rows.sort((a, b) => {
    const av = String(a[sortKey]), bv = String(b[sortKey]);
    const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
    return sortAsc ? cmp : -cmp;
  });

  const tbody = document.getElementById("tbody");
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.className = "mode-" + (r.mode || "unknown").toLowerCase();
    tr.innerHTML = `
      <td class="ingredient">${r.ingredient}</td>
      <td>${r.device}</td>
      <td>${r.actuator}</td>
      <td>${r.mode}</td>
      <td>${r.progress}</td>
      <td>${r.weight}</td>
      <td>${r.queued}</td>
      <td class="${r.wifi === "up" ? "cell-ok" : "cell-bad"}">${r.wifi}</td>
      <td class="${r.mqtt === "up" ? "cell-ok" : "cell-bad"}">${r.mqtt}</td>
      <td>${r.error}</td>
      <td>${r.lastSeen}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderEvents() {
  const list = document.getElementById("events");
  list.innerHTML = "";
  for (const e of lastEvents.slice(0, 50)) {
    const div = document.createElement("div");
    div.className = "event event-" + (e.event || "unknown").toLowerCase();
    div.textContent = `[${e.time}] ${e.device} #${e.actuator}: ${e.event}`;
    list.appendChild(div);
  }
}

function setStatus(ok) {
  const el = document.getElementById("status");
  el.textContent = ok ? "Connected" : "Disconnected from dashboard server";
  el.className = ok ? "ok" : "bad";
}

function updateDispenserOptions() {
  const sel = document.getElementById("dispenserSelect");
  const current = sel.value;

  const options = [];
  for (const [id, d] of Object.entries(lastDevices)) {
    for (let actuator = 0; actuator < 2; actuator++) {
      const ingredient = d["ingredient" + actuator] || "unknown";
      options.push({
        value: `${id}|${actuator}`,
        label: `${ingredient} (${id} #${actuator})`,
      });
    }
  }
  options.sort((a, b) => a.label.localeCompare(b.label));

  const values = options.map((o) => o.value);
  const existing = Array.from(sel.options).map((o) => o.value);
  if (existing.join(",") !== values.join(",")) {
    sel.innerHTML = "";
    for (const opt of options) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      sel.appendChild(el);
    }
    if (values.includes(current)) sel.value = current;
  }
}

function selectedDispenser() {
  const raw = document.getElementById("dispenserSelect").value;
  if (!raw) return null;
  const [device, actuatorStr] = raw.split("|");
  return { device, actuator: parseInt(actuatorStr, 10) };
}

function setCommandStatus(msg, isError) {
  const el = document.getElementById("commandStatus");
  el.textContent = msg;
  el.className = isError ? "bad" : "ok";
}

async function sendCommand(action) {
  const target = selectedDispenser();
  if (!target) {
    setCommandStatus("No dispenser known yet", true);
    return;
  }
  const { device, actuator } = target;
  const ingredient = (lastDevices[device] && lastDevices[device]["ingredient" + actuator]) || "unknown";

  if (action === "dispense" && !confirm(`Send dispense to ${ingredient} (${device} #${actuator})? This will run the motor and open the gate.`)) {
    return;
  }
  if (action === "resume" && !confirm(`Resume ${ingredient} (${device} #${actuator})? This will restart the motor from where it stalled.`)) {
    return;
  }

  const body = { device, action, actuator };
  if (action === "dispense") {
    body.weight = parseFloat(document.getElementById("weightInput").value);
    body.speed = parseInt(document.getElementById("speedInput").value, 10);
  }

  setCommandStatus("Sending...", false);

  try {
    const res = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) {
      setCommandStatus(`Sent ${action} to ${ingredient} (${device} #${actuator})`, false);
    } else {
      setCommandStatus(`Failed: ${data.error || "unknown error"}`, true);
    }
  } catch (err) {
    setCommandStatus(`Request failed: ${err}`, true);
  }
}

// --------------------------------------------------------------------------
// Recipes
// --------------------------------------------------------------------------

function knownIngredients() {
  const set = new Set();
  for (const d of Object.values(lastDevices)) {
    for (let actuator = 0; actuator < 2; actuator++) {
      const ingredient = d["ingredient" + actuator];
      if (ingredient) set.add(ingredient);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function addIngredientRow(prefill) {
  const known = knownIngredients();
  const container = document.getElementById("ingredientRows");

  if (known.length === 0 && !prefill) {
    refreshIngredientAvailability();
    return;
  }

  const rowId = ingredientRowSeq++;
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.dataset.rowId = rowId;

  const select = document.createElement("select");
  select.className = "ingredientSelect";

  const options = new Set(known);
  if (prefill && prefill.ingredient) options.add(prefill.ingredient);
  for (const name of Array.from(options).sort((a, b) => a.localeCompare(b))) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
  if (prefill && prefill.ingredient) select.value = prefill.ingredient;

  const gramsInput = document.createElement("input");
  gramsInput.type = "number";
  gramsInput.className = "gramsInput";
  gramsInput.placeholder = "grams";
  gramsInput.min = "1";
  gramsInput.step = "1";
  if (prefill && prefill.grams !== undefined) gramsInput.value = prefill.grams;

  const speedInput = document.createElement("input");
  speedInput.type = "number";
  speedInput.className = "speedInput";
  speedInput.placeholder = "speed";
  speedInput.title = "Dispensing speed for this ingredient (steps/second). Leave as-is unless this ingredient needs to run slower or faster.";
  speedInput.min = "1";
  speedInput.step = "50";
  speedInput.value = (prefill && prefill.speed !== undefined) ? prefill.speed : 1000;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    row.remove();
    refreshIngredientAvailability();
  });

  row.appendChild(select);
  row.appendChild(gramsInput);
  row.appendChild(speedInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
  refreshIngredientAvailability();
}

// Called on page load and on every poll tick, since ingredients only become
// known once a device's status message arrives - the form may start out
// empty and needs to pick up ingredients as they show up, not just once.
function refreshIngredientAvailability() {
  const container = document.getElementById("ingredientRows");
  const noIngredients = document.getElementById("recipeNoIngredients");
  const addBtn = document.getElementById("btnAddIngredientRow");
  const known = knownIngredients();

  if (known.length === 0) {
    noIngredients.style.display = container.children.length === 0 ? "block" : "none";
    addBtn.disabled = true;
    return;
  }

  noIngredients.style.display = "none";
  addBtn.disabled = false;

  // The form was empty because no ingredients were available yet - now that
  // devices have reported in, seed it with one row automatically. Don't do
  // this while editing an existing recipe or if the user deliberately has
  // rows already.
  if (container.children.length === 0 && editingRecipeName === null) {
    addIngredientRow();
  }
}

function showRecipeForm() {
  document.getElementById("recipeFormWrap").style.display = "block";
  document.getElementById("btnToggleNewRecipe").textContent = "Close";
}

function hideRecipeForm() {
  document.getElementById("recipeFormWrap").style.display = "none";
  document.getElementById("btnToggleNewRecipe").textContent = "+ New Recipe";
}

function toggleRecipeForm() {
  const wrap = document.getElementById("recipeFormWrap");
  if (wrap.style.display === "none") {
    resetRecipeForm();
    showRecipeForm();
  } else {
    hideRecipeForm();
  }
}

function resetRecipeForm() {
  editingRecipeName = null;
  document.getElementById("recipeFormTitle").textContent = "New Recipe";
  document.getElementById("recipeNameInput").value = "";
  document.getElementById("recipeNameInput").disabled = false;
  document.getElementById("ingredientRows").innerHTML = "";
  document.getElementById("recipeFormStatus").textContent = "";
  addIngredientRow();
}

function startEditRecipe(name) {
  const recipe = lastRecipes.find((r) => r.name === name);
  if (!recipe) return;

  editingRecipeName = name;
  document.getElementById("recipeFormTitle").textContent = `Editing: ${name}`;
  const nameInput = document.getElementById("recipeNameInput");
  nameInput.value = name;
  nameInput.disabled = true;
  document.getElementById("ingredientRows").innerHTML = "";
  for (const ing of recipe.ingredients) {
    addIngredientRow(ing);
  }
  document.getElementById("recipeFormStatus").textContent = "";
  showRecipeForm();
  window.scrollTo({ top: document.getElementById("recipeFormTitle").offsetTop - 20, behavior: "smooth" });
}

function collectIngredients() {
  const rows = document.querySelectorAll("#ingredientRows .ingredient-row");
  const result = [];
  for (const row of rows) {
    const ingredient = row.querySelector(".ingredientSelect").value;
    const grams = parseFloat(row.querySelector(".gramsInput").value);
    const speedRaw = row.querySelector(".speedInput").value;
    const speed = speedRaw === "" ? 1000 : parseInt(speedRaw, 10);
    result.push({ ingredient, grams, speed });
  }
  return result;
}

function setRecipeFormStatus(msg, isError) {
  const el = document.getElementById("recipeFormStatus");
  el.textContent = msg;
  el.className = isError ? "bad" : "ok";
}

async function saveRecipe() {
  const name = document.getElementById("recipeNameInput").value.trim();
  if (!name) {
    setRecipeFormStatus("Give the recipe a name", true);
    return;
  }

  const ingredients = collectIngredients();
  if (ingredients.length === 0) {
    setRecipeFormStatus("Add at least one ingredient", true);
    return;
  }
  for (const i of ingredients) {
    if (!i.ingredient || !(i.grams > 0)) {
      setRecipeFormStatus("Every ingredient needs a weight greater than 0", true);
      return;
    }
    if (!(i.speed > 0)) {
      setRecipeFormStatus(`Speed for ${i.ingredient} must be greater than 0`, true);
      return;
    }
  }

  setRecipeFormStatus("Saving...", false);

  try {
    const res = await fetch("/api/recipes/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ingredients }),
    });
    const data = await res.json();
    if (data.ok) {
      resetRecipeForm();
      setRecipeFormStatus(`Saved '${name}'`, false);
    } else {
      setRecipeFormStatus(`Failed: ${data.error || "unknown error"}`, true);
    }
  } catch (err) {
    setRecipeFormStatus(`Request failed: ${err}`, true);
  }
}

async function deleteRecipe(name) {
  if (!confirm(`Delete recipe '${name}'? This cannot be undone.`)) return;

  try {
    const res = await fetch("/api/recipes/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!data.ok) alert(`Failed to delete: ${data.error || "unknown error"}`);
    if (editingRecipeName === name) {
      resetRecipeForm();
      hideRecipeForm();
    }
  } catch (err) {
    alert(`Request failed: ${err}`);
  }
}

async function runRecipe(name) {
  const recipe = lastRecipes.find((r) => r.name === name);
  const summary = recipe ? recipe.ingredients.map((i) => `${i.ingredient} ${i.grams}g`).join(", ") : "";

  if (!confirm(`Run '${name}'?\\n\\nThis will operate the dispensing motors for: ${summary}\\n\\nIngredients dispense one at a time. Continue?`)) {
    return;
  }

  try {
    const res = await fetch("/api/recipe/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!data.ok) alert(`Could not start recipe: ${data.error || "unknown error"}`);
  } catch (err) {
    alert(`Request failed: ${err}`);
  }
}

async function cancelRecipe() {
  if (!confirm("Stop the recipe after the ingredient currently dispensing finishes?")) return;

  try {
    const res = await fetch("/api/recipe/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.ok) alert(`Could not cancel: ${data.error || "unknown error"}`);
  } catch (err) {
    alert(`Request failed: ${err}`);
  }
}

async function nextIngredient() {
  try {
    const res = await fetch("/api/recipe/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.ok) alert(`Could not continue: ${data.error || "unknown error"}`);
  } catch (err) {
    alert(`Request failed: ${err}`);
  }
}

function renderRecipes() {
  const list = document.getElementById("recipeList");
  const empty = document.getElementById("recipeEmpty");

  if (lastRecipes.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.innerHTML = "";
  for (const recipe of lastRecipes) {
    const card = document.createElement("div");
    card.className = "recipe-card";
    const summary = recipe.ingredients.map((i) => {
      // Only call out speed when it's been customized - most ingredients
      // use the default, and showing "@1000" on every line just adds noise.
      const speedNote = i.speed && i.speed !== 1000 ? ` @${i.speed}` : "";
      return `${i.ingredient} ${i.grams}g${speedNote}`;
    }).join(", ");
    const running = lastRecipeRun && (lastRecipeRun.status === "running" || lastRecipeRun.status === "waiting_next");

    card.innerHTML = `
      <span class="recipe-name">${recipe.name}</span>
      <div class="recipe-card-buttons">
        <button class="btn-run btnRunRecipe" ${running ? "disabled" : ""}>Run</button>
        <button class="btnEditRecipe">Edit</button>
        <button class="btn-danger btnDeleteRecipe">Delete</button>
      </div>
      <div class="recipe-ingredients">${summary}</div>
    `;
    card.querySelector(".btnRunRecipe").addEventListener("click", () => runRecipe(recipe.name));
    card.querySelector(".btnEditRecipe").addEventListener("click", () => startEditRecipe(recipe.name));
    card.querySelector(".btnDeleteRecipe").addEventListener("click", () => deleteRecipe(recipe.name));
    list.appendChild(card);
  }
}

function renderRecipeRun() {
  const panel = document.getElementById("recipeRunPanel");

  if (!lastRecipeRun) {
    panel.style.display = "none";
    return;
  }

  const run = lastRecipeRun;
  const active = run.status === "running" || run.status === "waiting_next";
  if (!active && dismissedRunKey === `${run.name}@dismissed`) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";

  const stepsHtml = (run.steps || []).map((s) => {
    const label = s.device
      ? `${s.grams}g ${s.ingredient} - ${s.device} #${s.actuator}`
      : `${s.grams}g ${s.ingredient}`;
    const statusText = {
      pending: "Waiting", running: "Dispensing...", done: "Done",
      failed: "Failed", timeout: "Timed out", cancelled: "Cancelled",
      unresolved: "No dispenser found for this ingredient",
    }[s.status] || s.status;
    return `<li class="step-${s.status}">${label} - ${statusText}</li>`;
  }).join("");

  let messageHtml = "";
  if (run.status === "done") {
    messageHtml = `<div id="recipeRunMessage" class="ok">Recipe '${run.name}' finished.</div>`;
  } else if (run.status === "error") {
    messageHtml = `<div id="recipeRunMessage" class="bad">${run.message}</div>`;
  } else if (run.status === "cancelled") {
    messageHtml = `<div id="recipeRunMessage" class="bad">Recipe '${run.name}' was cancelled.</div>`;
  } else if (run.status === "waiting_next") {
    const next = (run.steps || []).find((s) => s.status === "pending");
    const nextLabel = next ? `${next.ingredient} (${next.grams}g)` : "the next ingredient";
    messageHtml = `<div id="recipeRunMessage" class="ok">Ready for ${nextLabel}. Click "Next Ingredient" when you're ready.</div>`;
  }

  let buttonsHtml;
  if (run.status === "waiting_next") {
    buttonsHtml = `<button class="btn-run" id="btnNextIngredient">Next Ingredient</button> <button class="btn-danger" id="btnCancelRecipe">Cancel remaining steps</button>`;
  } else if (run.status === "running") {
    buttonsHtml = `<button class="btn-danger" id="btnCancelRecipe">Cancel remaining steps</button>`;
  } else {
    buttonsHtml = `<button id="btnDismissRecipeRun">Dismiss</button>`;
  }

  panel.innerHTML = `<h3>${active ? "Running" : "Last run"}: ${run.name}</h3><ol>${stepsHtml}</ol>${messageHtml}${buttonsHtml}`;

  if (run.status === "waiting_next") {
    document.getElementById("btnNextIngredient").addEventListener("click", nextIngredient);
    document.getElementById("btnCancelRecipe").addEventListener("click", cancelRecipe);
  } else if (run.status === "running") {
    document.getElementById("btnCancelRecipe").addEventListener("click", cancelRecipe);
  } else {
    document.getElementById("btnDismissRecipeRun").addEventListener("click", () => {
      dismissedRunKey = `${run.name}@dismissed`;
      panel.style.display = "none";
    });
  }
}

async function poll() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    lastDevices = data.devices;
    lastEvents = data.events;
    lastRecipes = data.recipes;
    lastRecipeRun = data.recipe_run;
    updateDispenserOptions();
    renderTable();
    renderEvents();
    renderRecipes();
    renderRecipeRun();
    refreshIngredientAvailability();
    setStatus(true);
  } catch (err) {
    setStatus(false);
  }
}

document.querySelectorAll("th[data-key]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-key");
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; }
    renderTable();
  });
});

document.getElementById("btnDispense").addEventListener("click", () => sendCommand("dispense"));
document.getElementById("btnTare").addEventListener("click", () => sendCommand("tare"));
document.getElementById("btnResume").addEventListener("click", () => sendCommand("resume"));
document.getElementById("btnReset").addEventListener("click", () => sendCommand("reset"));

document.getElementById("btnToggleNewRecipe").addEventListener("click", toggleRecipeForm);
document.getElementById("btnAddIngredientRow").addEventListener("click", () => addIngredientRow());
document.getElementById("btnSaveRecipe").addEventListener("click", saveRecipe);
document.getElementById("btnCancelEditRecipe").addEventListener("click", () => {
  resetRecipeForm();
  hideRecipeForm();
});

resetRecipeForm();
setInterval(poll, 1000);
poll();
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # keep the console quiet

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(200, "text/html; charset=utf-8", PAGE.encode("utf-8"))
        elif self.path == "/api/state":
            recipes = recipe_db.list_recipes()
            with state_lock:
                body = json.dumps({
                    "devices": devices,
                    "events": events,
                    "recipes": recipes,
                    "recipe_run": recipe_run_state,
                }).encode("utf-8")
            self._send(200, "application/json", body)
        else:
            self._send(404, "text/plain", b"Not found")

    def do_POST(self):
        routes = {
            "/api/command": self._handle_command,
            "/api/recipes/save": self._handle_recipe_save,
            "/api/recipes/delete": self._handle_recipe_delete,
            "/api/recipe/run": self._handle_recipe_run,
            "/api/recipe/next": self._handle_recipe_next,
            "/api/recipe/cancel": self._handle_recipe_cancel,
        }
        handler = routes.get(self.path)
        if handler is None:
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b""

        try:
            body = json.loads(raw.decode()) if raw else {}
        except (ValueError, UnicodeDecodeError):
            self._send_json(400, {"ok": False, "error": "Invalid JSON body"})
            return

        handler(body)

    def _handle_command(self, body):
        device = body.get("device")
        action = body.get("action")

        if not device:
            self._send_json(400, {"ok": False, "error": "Missing device"})
            return

        try:
            if action == "dispense":
                weight = float(body.get("weight", 0))
                if weight <= 0:
                    self._send_json(400, {"ok": False, "error": "Target weight must be > 0"})
                    return
                command = {
                    "command": "dispense",
                    "actuator": int(body.get("actuator", 0)),
                    "targetWeight": weight,
                    "speed": int(body.get("speed", 1000)),
                }
            elif action == "tare":
                command = {
                    "command": "tare",
                    "actuator": int(body.get("actuator", 0)),
                }
            elif action == "reset":
                command = {
                    "command": "reset",
                    "actuator": int(body.get("actuator", 0)),
                }
            elif action == "resume":
                command = {
                    "command": "resume",
                    "actuator": int(body.get("actuator", 0)),
                }
            else:
                self._send_json(400, {"ok": False, "error": f"Unknown action '{action}'"})
                return
        except (TypeError, ValueError):
            self._send_json(400, {"ok": False, "error": "Invalid actuator/weight/speed value"})
            return

        if mqtt_client is None or not mqtt_client.is_connected():
            self._send_json(503, {"ok": False, "error": "Not connected to broker"})
            return

        topic = f"machine/{device}/command"
        payload = json.dumps(command)
        mqtt_client.publish(topic, payload)

        print(f"[{now_str()}] Published to {topic}: {payload}")

        self._send_json(200, {"ok": True})

    def _handle_recipe_save(self, body):
        name = body.get("name", "")
        ingredients = body.get("ingredients", [])
        lines = [
            (i.get("ingredient", ""), i.get("grams"), i.get("speed", recipe_db.DEFAULT_SPEED))
            for i in ingredients
        ]

        try:
            action = recipe_db.save_recipe(name, lines)
        except ValueError as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
            return

        print(f"[{now_str()}] Recipe '{name}' {action} via dashboard")
        self._send_json(200, {"ok": True, "action": action})

    def _handle_recipe_delete(self, body):
        name = body.get("name", "")
        if recipe_db.delete_recipe(name):
            print(f"[{now_str()}] Recipe '{name}' deleted via dashboard")
            self._send_json(200, {"ok": True})
        else:
            self._send_json(404, {"ok": False, "error": f"No recipe named '{name}'"})

    def _handle_recipe_run(self, body):
        global recipe_run_state

        name = body.get("name", "")
        recipe = recipe_db.load_recipe(name)
        if recipe is None:
            self._send_json(404, {"ok": False, "error": f"No recipe named '{name}'"})
            return

        if mqtt_client is None or not mqtt_client.is_connected():
            self._send_json(503, {"ok": False, "error": "Not connected to broker"})
            return

        conflict = None
        with state_lock:
            if recipe_run_state is not None and recipe_run_state.get("status") in ("running", "waiting_next"):
                conflict = recipe_run_state["name"]
            else:
                recipe_run_state = {
                    "name": name,
                    "status": "running",
                    "steps": [],
                    "current_step": 0,
                    "message": "",
                }

        if conflict:
            self._send_json(409, {"ok": False, "error": f"Recipe '{conflict}' is already running"})
            return

        recipe_cancel_event.clear()
        recipe_next_event.clear()
        threading.Thread(target=run_recipe_worker, args=(name,), daemon=True).start()

        print(f"[{now_str()}] Recipe '{name}' run started via dashboard")
        self._send_json(200, {"ok": True})

    def _handle_recipe_next(self, body):
        with state_lock:
            waiting = recipe_run_state is not None and recipe_run_state.get("status") == "waiting_next"

        if not waiting:
            self._send_json(400, {"ok": False, "error": "No recipe is waiting for the next ingredient"})
            return

        recipe_next_event.set()
        print(f"[{now_str()}] Recipe 'next ingredient' requested via dashboard")
        self._send_json(200, {"ok": True})

    def _handle_recipe_cancel(self, body):
        with state_lock:
            running = recipe_run_state is not None and recipe_run_state.get("status") in ("running", "waiting_next")

        if not running:
            self._send_json(400, {"ok": False, "error": "No recipe is currently running"})
            return

        recipe_cancel_event.set()
        print(f"[{now_str()}] Recipe cancel requested via dashboard")
        self._send_json(200, {"ok": True})

    def _send(self, code, content_type, body):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, code, obj):
        self._send(code, "application/json", json.dumps(obj).encode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="MachineControllerOS live dashboard")
    parser.add_argument("--broker", default=DEFAULT_BROKER, help="MQTT broker address")
    parser.add_argument("--port", type=int, default=DEFAULT_MQTT_PORT, help="MQTT broker port")
    parser.add_argument("--http-port", type=int, default=DEFAULT_HTTP_PORT, help="Local web server port")
    parser.add_argument("--host", default="localhost", help="Web server bind address (use 0.0.0.0 to view from another device on your LAN)")
    args = parser.parse_args()

    global mqtt_client

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dashboard")
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"[{now_str()}] Connecting to {args.broker}:{args.port} ...")
    client.connect(args.broker, args.port, keepalive=30)
    client.loop_start()

    mqtt_client = client

    server = ThreadingHTTPServer((args.host, args.http_port), Handler)
    url = f"http://{args.host}:{args.http_port}"
    print(f"[{now_str()}] Dashboard running at {url}")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\nStopping.")
    finally:
        server.shutdown()
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
