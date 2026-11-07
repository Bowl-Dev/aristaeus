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

# Recipe runs - multiple can be active at once now, keyed by an incrementing
# run id. Everything below is guarded by state_lock except the Event objects
# themselves (safe to wait()/set() unlocked).
recipe_runs = {}            # run_id -> {id, name, status, steps, current_step, message}
recipe_run_controls = {}    # run_id -> {"cancel": Event, "next": Event}
next_recipe_run_id = 1
MAX_FINISHED_RUNS = 20      # cap on done/error/cancelled runs kept around, oldest pruned first

# Per-(device, actuator) arbitration so only one recipe's dispense is ever
# in-flight on a given physical dispenser at a time, while different
# actuators run fully in parallel across different recipes.
actuator_locks = {}             # (device, actuator) -> threading.Lock()
actuator_locks_meta_lock = threading.Lock()   # guards creation of new entries above
actuator_waiters = {}           # (device, actuator) -> queue.Queue(), guarded by state_lock


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

            # Hand the event to whichever recipe run is currently waiting on
            # this exact (device, actuator) - at most one run ever holds that
            # actuator's lock (and therefore is registered as its waiter) at
            # a time, so this can never be stolen by the wrong recipe even
            # with several running concurrently.
            waiter = actuator_waiters.get((device_id, actuator))
            if waiter is not None:
                waiter.put({
                    "device": device_id,
                    "actuator": actuator,
                    "event": event_name,
                })


# --------------------------------------------------------------------------
# Recipe runner - resolves ingredients against currently known devices, then
# dispenses one ingredient at a time WITHIN a given recipe, in recipe order.
# Multiple recipes can run at once: each gets its own worker thread and its
# own cancel/next Events, and they only ever serialize against each other on
# a shared actuator (via the per-(device, actuator) lock below) - two
# recipes needing different dispensers run fully in parallel.
# --------------------------------------------------------------------------

def get_actuator_lock(device, actuator):
    key = (device, actuator)
    with actuator_locks_meta_lock:
        lock = actuator_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            actuator_locks[key] = lock
        return lock


def acquire_actuator(device, actuator, cancel_event):
    """Blocks until this actuator is free, polling so a queued-up recipe can
    still be Cancelled while waiting its turn behind another recipe using
    the same dispenser. Returns False if cancelled before it became free."""
    lock = get_actuator_lock(device, actuator)
    while True:
        if cancel_event.is_set():
            return False
        if lock.acquire(timeout=0.2):
            return True


def release_actuator(device, actuator):
    get_actuator_lock(device, actuator).release()


def register_waiter(device, actuator):
    """Creates a fresh, dedicated queue for this actuator's next terminal
    event. Safe to register even with other recipes active, because the
    caller only ever does this after acquire_actuator() succeeded - only one
    run is ever registered for a given (device, actuator) at a time."""
    q = queue.Queue()
    with state_lock:
        actuator_waiters[(device, actuator)] = q
    return q


def unregister_waiter(device, actuator):
    with state_lock:
        actuator_waiters.pop((device, actuator), None)


# esp32_03 and esp32_04 are flashed with the synchronized-flush firmware
# config (see MachineController::synchronizeFlush() in the firmware) and are
# meant to be operated as one bundled unit: whenever a recipe calls for
# ingredients on these two devices back-to-back, dispense all of them in
# parallel - one shared "Dispense" command starts every motor in the group
# at once - instead of one at a time. Every other device keeps the strictly
# sequential, one-ingredient-per-click behavior.
PARALLEL_DEVICES = {"esp32-03", "esp32-04"}


def build_step_groups(steps):
    """Splits a resolved step list into groups to execute in recipe order.

    A group is either a single ordinary step, or a run of *consecutive*
    steps that are all on PARALLEL_DEVICES - those get bundled to start
    together. Non-adjacent esp32-03/esp32-04 ingredients (something else
    in the recipe between them) are NOT merged - only consecutive ones are,
    matching how a recipe author would naturally list ingredients they want
    dispensed as one round.

    Returns a list of lists of indices into `steps`.
    """
    groups = []
    i = 0
    while i < len(steps):
        if steps[i]["device"] in PARALLEL_DEVICES:
            j = i
            while j < len(steps) and steps[j]["device"] in PARALLEL_DEVICES:
                j += 1
            groups.append(list(range(i, j)))
            i = j
        else:
            groups.append([i])
            i += 1
    return groups


def describe_failure(step, result):
    if result == "Timeout":
        return f"Timed out waiting for {step['ingredient']} on {step['device']} actuator {step['actuator']}"
    return (
        f"{step['device']} actuator {step['actuator']} reported '{result}' "
        f"while dispensing {step['ingredient']}"
    )


def run_group_member(run, name, run_id, step, cancel_event, results, idx, total_steps, group_size):
    """Dispenses one member of a (possibly multi-member) group, in its own
    thread when group_size > 1 so every member's publish+wait happens
    concurrently - one member's full wait blocking the next from even
    starting would defeat the point of dispensing them in parallel. Writes
    its outcome into results[idx]; safe without a lock since every thread
    in a group writes a distinct key."""
    device, actuator = step["device"], step["actuator"]

    event_queue = register_waiter(device, actuator)
    try:
        command = {
            "command": "dispense",
            "actuator": actuator,
            "targetWeight": step["grams"],
            "speed": step["speed"],
        }
        mqtt_client.publish(f"machine/{device}/command", json.dumps(command))
        parallel_note = f" (parallel x{group_size})" if group_size > 1 else ""
        print(f"[{now_str()}] Recipe '{name}' (run {run_id}) step {idx + 1}/{total_steps}{parallel_note}: "
              f"{step['grams']}g {step['ingredient']} on {device} actuator {actuator}")

        result = wait_for_step_result(run, step, cancel_event, event_queue)
    finally:
        unregister_waiter(device, actuator)

    # Update this member's own step status the moment ITS result is known,
    # rather than waiting for every other group member to also finish - so
    # in the UI, a group member that finishes early correctly shows "Done"
    # right away even while a sibling is still dispensing.
    with state_lock:
        if result == "JobFinished":
            step["status"] = "done"
        elif result == "Cancelled":
            step["status"] = "cancelled"
        elif result == "Timeout":
            step["status"] = "timeout"
        else:
            step["status"] = "failed"

    results[idx] = result


def finish_recipe_run(run_id):
    """Called once a run reaches a terminal state (done/error/cancelled).
    Prunes the oldest finished runs once there are more than
    MAX_FINISHED_RUNS of them, so recipe_runs doesn't grow unbounded over a
    long dashboard uptime. Active runs are never touched."""
    with state_lock:
        terminal_ids = sorted(
            rid for rid, r in recipe_runs.items()
            if r.get("status") in ("done", "error", "cancelled")
        )
        if len(terminal_ids) > MAX_FINISHED_RUNS:
            for rid in terminal_ids[:len(terminal_ids) - MAX_FINISHED_RUNS]:
                recipe_runs.pop(rid, None)
                recipe_run_controls.pop(rid, None)


def wait_for_step_result(run, step, cancel_event, event_queue):
    """Blocks until this step's job reaches a terminal outcome.

    A stall (Error event) is NOT treated as terminal here - the ESP32 is
    still talking to us, it's just jammed. Instead of aborting the recipe,
    this marks the step "stalled" and switches to waiting indefinitely
    (bounded only by Cancel), so that once the operator fixes the actuator
    (Resume or Reset from the Send Command panel) and the job actually
    finishes, the recipe picks back up right where it left off. Only
    JobRejected, or a full RECIPE_JOB_TIMEOUT with no response at all
    (device never even acknowledged the job), aborts the run.

    event_queue is a fresh queue dedicated to this exact (device, actuator)
    for the duration of this step, so no device/actuator filtering is
    needed here - everything that arrives on it is ours.

    Returns "JobFinished", "JobRejected", "Timeout", or "Cancelled".
    """
    deadline = time.monotonic() + RECIPE_JOB_TIMEOUT
    stalled = False

    while True:
        if cancel_event.is_set():
            return "Cancelled"

        if stalled:
            poll_timeout = 0.5
        else:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return "Timeout"
            poll_timeout = min(remaining, 0.5)

        try:
            event = event_queue.get(timeout=poll_timeout)
        except queue.Empty:
            continue

        if event["event"] == "JobFinished":
            return "JobFinished"

        if event["event"] == "JobRejected":
            return "JobRejected"

        if event["event"] == "Error":
            stalled = True
            with state_lock:
                step["status"] = "stalled"
                run["status"] = "stalled"
                run["message"] = (
                    f"{step['device']} actuator {step['actuator']} stalled while dispensing "
                    f"{step['ingredient']}. Fix it from the Send Command panel below (select this "
                    f"dispenser, then Resume or Reset) - this recipe will continue automatically "
                    f"once it finishes."
                )
            continue


def run_recipe_worker(run_id, name):
    with state_lock:
        run = recipe_runs[run_id]
        controls = recipe_run_controls[run_id]
    cancel_event = controls["cancel"]
    next_event = controls["next"]

    recipe = recipe_db.load_recipe(name)
    if recipe is None:
        with state_lock:
            run["status"] = "error"
            run["message"] = f"Recipe '{name}' no longer exists"
        finish_recipe_run(run_id)
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

        run["steps"] = steps

        if unresolved:
            run["status"] = "error"
            run["message"] = (
                "No connected dispenser currently reports: " + ", ".join(unresolved)
            )
            unresolved_error = True
        else:
            unresolved_error = False

    if unresolved_error:
        finish_recipe_run(run_id)
        return

    groups = build_step_groups(steps)

    for group in groups:
        first = group[0]

        if cancel_event.is_set():
            with state_lock:
                for remaining in steps[first:]:
                    remaining["status"] = "cancelled"
                run["status"] = "cancelled"
                run["message"] = "Cancelled by user"
            finish_recipe_run(run_id)
            return

        # Every group - including the very first one - waits here for an
        # explicit "Dispense Ingredient" click before anything starts. For a
        # bundled esp32-03/esp32-04 group, one click starts every member at
        # once; the full step list (already populated above) shows what's
        # coming up automatically either way.
        with state_lock:
            run["current_step"] = first
            run["current_group"] = list(group)
            run["status"] = "waiting_next"

        next_event.clear()
        while True:
            if cancel_event.is_set():
                with state_lock:
                    for remaining in steps[first:]:
                        remaining["status"] = "cancelled"
                    run["status"] = "cancelled"
                    run["message"] = "Cancelled by user"
                finish_recipe_run(run_id)
                return
            if next_event.wait(timeout=0.2):
                next_event.clear()
                break

        # Another recipe may currently be using one of this group's
        # actuators - wait for every member to be free before starting ANY
        # of them, so "parallel" means a simultaneous start rather than
        # staggered as locks happen to free up. This never blocks actuators
        # outside the group, so every other recipe keeps going normally.
        members = [(steps[idx]["device"], steps[idx]["actuator"]) for idx in group]
        with state_lock:
            run["status"] = "queued"
            run["message"] = "Waiting for " + ", ".join(
                f"{d} actuator {a}" for d, a in members
            ) + " to be free..."

        acquired = []
        ok = True
        for device, actuator in members:
            if not acquire_actuator(device, actuator, cancel_event):
                ok = False
                break
            acquired.append((device, actuator))

        if not ok:
            for device, actuator in acquired:
                release_actuator(device, actuator)
            with state_lock:
                for remaining in steps[first:]:
                    remaining["status"] = "cancelled"
                run["status"] = "cancelled"
                run["message"] = "Cancelled by user"
            finish_recipe_run(run_id)
            return

        with state_lock:
            for idx in group:
                steps[idx]["status"] = "running"
            run["current_step"] = first
            run["status"] = "running"
            run["message"] = ""

        results = {}
        if len(group) == 1:
            # Common case (every non-esp32-03/04 step) - no thread overhead
            # needed for a single member.
            idx = group[0]
            run_group_member(run, name, run_id, steps[idx], cancel_event, results, idx, len(steps), 1)
        else:
            threads = [
                threading.Thread(
                    target=run_group_member,
                    args=(run, name, run_id, steps[idx], cancel_event, results, idx, len(steps), len(group)),
                    daemon=True,
                )
                for idx in group
            ]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        for device, actuator in members:
            # Free every actuator in the group the instant it's done,
            # regardless of outcome - a different recipe queued up behind
            # any of them should never wait longer than necessary.
            release_actuator(device, actuator)

        # Each thread already updated its own step's status the moment its
        # own result was known (see run_group_member) - this just derives
        # the group's overall outcome from what they found.
        terminal = any(results[idx] != "JobFinished" for idx in group)
        any_cancelled = any(results[idx] == "Cancelled" for idx in group)

        if terminal:
            with state_lock:
                for remaining in steps[max(group) + 1:]:
                    if remaining["status"] == "pending":
                        remaining["status"] = "cancelled"

                if any_cancelled:
                    run["status"] = "cancelled"
                    run["message"] = "Cancelled by user"
                else:
                    run["status"] = "error"
                    run["message"] = "; ".join(
                        describe_failure(steps[idx], results[idx])
                        for idx in group
                        if results[idx] not in ("JobFinished", "Cancelled")
                    )

        if terminal:
            finish_recipe_run(run_id)
            return

        # Group dispensed successfully - loop back around. The next group
        # (if any) starts with its own "waiting_next" gate above, so nothing
        # dispenses automatically from here.

    with state_lock:
        run["status"] = "done"
        run["current_step"] = len(steps)
        run["current_group"] = []

    finish_recipe_run(run_id)


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
  tr.mode-waitingtoflush { background: #2b2a1c; }
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
  #controls, #calibrateControls { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
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

  #recipeList { display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; gap: 16px; }
  .recipe-card { display: flex; flex-direction: column; gap: 10px; width: 260px; flex: 0 0 260px; padding: 14px 16px; background: #26272e; border: 1px solid #3a3b42; border-radius: 6px; }
  .recipe-card-image { width: 100%; height: 120px; background: #1e1f24; border: 1px dashed #3a3b42; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #5a5b62; flex: 0 0 auto; }
  .recipe-name { font-size: 25px; font-weight: 700; text-transform: capitalize; }
  .recipe-ingredients { color: #9aa0aa; font-size: 20px; }
  .recipe-card-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
  .recipe-card-buttons button { padding: 8px 14px; font-size: 20px; }
  #recipeEmpty { color: #9aa0aa; font-size: 22px; margin-bottom: 16px; }
  #btnToggleNewRecipe, #btnToggleCalibrate { margin-bottom: 16px; }

  #ingredientRows { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
  .ingredient-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .ingredient-row select { flex: 2; min-width: 140px; }
  .ingredient-row input { flex: 1; width: 110px; }
  .ingredient-row button { padding: 6px 12px; font-size: 18px; }
  #recipeFormActions { display: flex; gap: 10px; margin-top: 10px; align-items: center; }
  #recipeFormStatus { margin-top: 8px; font-size: 20px; }
  #recipeNoIngredients { color: #ffb300; font-size: 20px; margin: 8px 0; }

  #queuedRecipesList { display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; gap: 16px; }
  .recipe-run-card { width: 340px; flex: 0 0 340px; margin-bottom: 0; }
  .recipe-run-card ol { list-style: none; padding: 0; margin: 0 0 14px 0; }
  .recipe-run-card li { padding: 8px 12px; font-size: 21px; border-left: 4px solid #3a3b42; margin-bottom: 6px; background: #1e1f24; border-radius: 0 4px 4px 0; }
  .recipe-run-card li.step-running { border-left-color: #1976d2; }
  .recipe-run-card li.step-done { border-left-color: #4caf50; color: #9aa0aa; }
  .recipe-run-card li.step-failed, .recipe-run-card li.step-timeout, .recipe-run-card li.step-unresolved { border-left-color: #f44336; }
  .recipe-run-card li.step-cancelled { border-left-color: #ffb300; color: #9aa0aa; }
  .recipe-run-card li.step-stalled { border-left-color: #ffb300; }
  .recipe-run-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .recipe-run-message { font-size: 21px; }
  .recipe-run-message.bad { color: #f44336; }
  .recipe-run-message.ok { color: #4caf50; }
  .recipe-run-message.warn { color: #ffb300; }
  #queuedRecipesEmpty { color: #9aa0aa; font-size: 22px; margin-bottom: 16px; }
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

<div id="recipeList"></div>
<div id="recipeEmpty" style="display:none;">No recipes yet - create one above.</div>

<h2>Queued Recipes</h2>
<div id="queuedRecipesList"></div>
<div id="queuedRecipesEmpty" style="display:none;">Nothing queued right now - hit Run on a recipe above to add it here. You can queue the same recipe more than once.</div>

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
      <th data-key="calibration">Calibration</th>
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
  <button id="btnOpenGate" class="btn-run">Open Gate</button>
  <button id="btnCloseGate" class="btn-danger">Close Gate</button>
  <span id="commandStatus"></span>
</div>

<h2>Calibrate a Load Cell</h2>
<button id="btnToggleCalibrate" type="button" class="btn-primary">+ Calibrate a Load Cell</button>
<div id="calibrateControls" class="panel" style="display:none;">
  <label>Dispenser
    <select id="calibrateDispenserSelect"></select>
  </label>
  <label>Known weight on the tray now (g)
    <input type="number" id="calibrateWeightInput" value="100" min="1" step="1">
  </label>
  <button id="btnCalibrate" class="btn-run">Calibrate</button>
  <span id="calibrateStatus"></span>
</div>

<h2>Events</h2>
<div id="events"></div>

<script>
let lastDevices = {};
let lastEvents = [];
let lastRecipes = [];
let lastRecipeRuns = [];
let sortKey = "device";
let sortAsc = true;
let editingRecipeName = null;   // null = creating a new recipe
let dismissedRunIds = new Set();   // ids of finished run cards the user dismissed
let ingredientRowSeq = 0;
const ACTIVE_RUN_STATUSES = ["running", "queued", "waiting_next", "stalled"];

function dispenserRows() {
  const rows = [];
  for (const [id, d] of Object.entries(lastDevices)) {
    for (let actuator = 0; actuator < 2; actuator++) {
      const job = d["job" + actuator] || {};
      const weight = d["loadCell" + actuator];
      const calibration = d["calibration" + actuator];
      const queued = d["queuedJobs" + actuator];
      rows.push({
        ingredient: d["ingredient" + actuator] || "unknown",
        device: id,
        actuator: actuator,
        mode: d["mode" + actuator] || "",
        progress: job.active ? (job.progress + "%") : "-",
        weight: (weight !== undefined) ? Number(weight).toFixed(1) : "-",
        calibration: (calibration !== undefined) ? Number(calibration).toFixed(1) : "-",
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
      <td>${r.calibration}</td>
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

function populateDispenserSelect(selectId) {
  const sel = document.getElementById(selectId);
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

function updateDispenserOptions() {
  populateDispenserSelect("dispenserSelect");
  populateDispenserSelect("calibrateDispenserSelect");
}

function selectedFromSelect(selectId) {
  const raw = document.getElementById(selectId).value;
  if (!raw) return null;
  const [device, actuatorStr] = raw.split("|");
  return { device, actuator: parseInt(actuatorStr, 10) };
}

function selectedDispenser() {
  return selectedFromSelect("dispenserSelect");
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
  if (action === "openGate" && !confirm(`Open the gate on ${ingredient} (${device} #${actuator})? Keep hands and tools clear of the mechanism.`)) {
    return;
  }
  if (action === "closeGate" && !confirm(`Close the gate on ${ingredient} (${device} #${actuator})? Make sure hands and tools are clear before it moves.`)) {
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

function setCalibrateStatus(msg, isError) {
  const el = document.getElementById("calibrateStatus");
  el.textContent = msg;
  el.className = isError ? "bad" : "ok";
}

async function sendCalibrate() {
  const target = selectedFromSelect("calibrateDispenserSelect");
  if (!target) {
    setCalibrateStatus("No dispenser known yet", true);
    return;
  }
  const { device, actuator } = target;
  const ingredient = (lastDevices[device] && lastDevices[device]["ingredient" + actuator]) || "unknown";
  const knownWeight = parseFloat(document.getElementById("calibrateWeightInput").value);

  if (!(knownWeight > 0)) {
    setCalibrateStatus("Enter the known weight currently on the tray", true);
    return;
  }

  if (!confirm(
    `Calibrate ${ingredient} (${device} #${actuator})?\n\n` +
    `Make sure you already Tared this dispenser with the tray empty, and that exactly ` +
    `${knownWeight}g is on it right now. This replaces its saved calibration.`
  )) {
    return;
  }

  setCalibrateStatus("Calibrating...", false);

  try {
    const res = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device, action: "calibrate", actuator, knownWeight }),
    });
    const data = await res.json();
    if (data.ok) {
      setCalibrateStatus(`Calibrated ${ingredient} (${device} #${actuator})`, false);
    } else {
      setCalibrateStatus(`Failed: ${data.error || "unknown error"}`, true);
    }
  } catch (err) {
    setCalibrateStatus(`Request failed: ${err}`, true);
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

  if (!confirm(`Run '${name}'?\\n\\nThis will operate the dispensing motors for: ${summary}\\n\\nEach dispenser only handles one recipe at a time - if another recipe is already using one, this run will simply wait its turn on that dispenser while continuing normally on the others. Continue?`)) {
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

async function cancelRecipe(runId) {
  if (!confirm("Stop this recipe after the ingredient currently dispensing finishes?")) return;

  try {
    const res = await fetch("/api/recipe/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId }),
    });
    const data = await res.json();
    if (!data.ok) alert(`Could not cancel: ${data.error || "unknown error"}`);
  } catch (err) {
    alert(`Request failed: ${err}`);
  }
}

async function nextIngredient(runId) {
  try {
    const res = await fetch("/api/recipe/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId }),
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
    // Recipes can be queued more than once at a time (e.g. two batches of
    // the same dish) - Run is always clickable, each click adds another
    // card to Queued Recipes.
    card.innerHTML = `
      <div class="recipe-card-image">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <path d="M21 15l-5-5-4 4-3-3-6 6"></path>
        </svg>
      </div>
      <span class="recipe-name">${recipe.name}</span>
      <div class="recipe-ingredients">${summary}</div>
      <div class="recipe-card-buttons">
        <button class="btn-run btnRunRecipe">Run</button>
        <button class="btnEditRecipe">Edit</button>
        <button class="btn-danger btnDeleteRecipe">Delete</button>
      </div>
    `;
    card.querySelector(".btnRunRecipe").addEventListener("click", () => runRecipe(recipe.name));
    card.querySelector(".btnEditRecipe").addEventListener("click", () => startEditRecipe(recipe.name));
    card.querySelector(".btnDeleteRecipe").addEventListener("click", () => deleteRecipe(recipe.name));
    list.appendChild(card);
  }
}

function renderQueuedRecipes() {
  const list = document.getElementById("queuedRecipesList");
  const empty = document.getElementById("queuedRecipesEmpty");

  const visible = lastRecipeRuns.filter((run) => {
    const active = ACTIVE_RUN_STATUSES.includes(run.status);
    return active || !dismissedRunIds.has(run.id);
  });

  // Oldest first, left to right - queued recipes stack out to the right as
  // a row, with each newly-added card taking its place at the end rather
  // than pushing existing cards down.
  visible.sort((a, b) => a.id - b.id);

  empty.style.display = visible.length === 0 ? "block" : "none";

  list.innerHTML = "";
  for (const run of visible) {
    const active = ACTIVE_RUN_STATUSES.includes(run.status);

    const stepsHtml = (run.steps || []).map((s) => {
      const label = s.device
        ? `${s.grams}g ${s.ingredient} - ${s.device} #${s.actuator}`
        : `${s.grams}g ${s.ingredient}`;
      const statusText = {
        pending: "Waiting", running: "Dispensing...", done: "Done",
        stalled: "Stalled - waiting for you to fix it",
        failed: "Failed", timeout: "Timed out", cancelled: "Cancelled",
        unresolved: "No dispenser found for this ingredient",
      }[s.status] || s.status;
      return `<li class="step-${s.status}">${label} - ${statusText}</li>`;
    }).join("");

    // Bottom row: current status on the left, the relevant action button(s)
    // right next to it on the same line.
    let messageHtml = `<div class="recipe-run-message"></div>`;
    if (run.status === "done") {
      messageHtml = `<div class="recipe-run-message ok">Finished.</div>`;
    } else if (run.status === "error") {
      messageHtml = `<div class="recipe-run-message bad">${run.message}</div>`;
    } else if (run.status === "cancelled") {
      messageHtml = `<div class="recipe-run-message bad">Cancelled.</div>`;
    } else if (run.status === "stalled" || run.status === "queued") {
      messageHtml = `<div class="recipe-run-message warn">${run.message}</div>`;
    } else if (run.status === "running") {
      messageHtml = `<div class="recipe-run-message">Dispensing...</div>`;
    } else if (run.status === "waiting_next") {
      // A bundled esp32-03/esp32-04 group has more than one index in
      // current_group - list every member so the operator knows one click
      // starts all of them together, instead of just naming the first.
      const group = (run.current_group && run.current_group.length > 1) ? run.current_group : null;
      let nextLabel;
      if (group) {
        const members = group.map((idx) => (run.steps || [])[idx]).filter(Boolean);
        nextLabel = members.map((s) => `${s.ingredient} (${s.grams}g)`).join(" + ") + " - together";
      } else {
        const next = (run.steps || []).find((s) => s.status === "pending");
        nextLabel = next ? `${next.ingredient} (${next.grams}g)` : "the next ingredient";
      }
      messageHtml = `<div class="recipe-run-message ok">Up next: ${nextLabel}.</div>`;
    }

    let buttonsHtml;
    if (run.status === "waiting_next") {
      const groupSize = (run.current_group && run.current_group.length) || 1;
      const dispenseLabel = groupSize > 1 ? "Dispense Ingredients" : "Dispense Ingredient";
      buttonsHtml = `<button class="btn-run btnNextIngredient">${dispenseLabel}</button> <button class="btn-danger btnCancelRecipe">Cancel</button>`;
    } else if (run.status === "running" || run.status === "stalled" || run.status === "queued") {
      buttonsHtml = `<button class="btn-danger btnCancelRecipe">Cancel</button>`;
    } else {
      buttonsHtml = `<button class="btnDismissRecipeRun">Dismiss</button>`;
    }

    const card = document.createElement("div");
    card.className = "panel recipe-run-card";
    card.innerHTML = `<h3>${active ? "Running" : "Last run"}: ${run.name} (#${run.id})</h3><ol>${stepsHtml}</ol><div class="recipe-run-footer">${messageHtml}${buttonsHtml}</div>`;

    const nextBtn = card.querySelector(".btnNextIngredient");
    if (nextBtn) nextBtn.addEventListener("click", () => nextIngredient(run.id));
    const cancelBtn = card.querySelector(".btnCancelRecipe");
    if (cancelBtn) cancelBtn.addEventListener("click", () => cancelRecipe(run.id));
    const dismissBtn = card.querySelector(".btnDismissRecipeRun");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        dismissedRunIds.add(run.id);
        renderQueuedRecipes();
      });
    }

    list.appendChild(card);
  }
}

async function poll() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    lastDevices = data.devices;
    lastEvents = data.events;
    lastRecipes = data.recipes;
    lastRecipeRuns = data.recipe_runs || [];
    updateDispenserOptions();
    renderTable();
    renderEvents();
    renderRecipes();
    renderQueuedRecipes();
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
document.getElementById("btnOpenGate").addEventListener("click", () => sendCommand("openGate"));
document.getElementById("btnCloseGate").addEventListener("click", () => sendCommand("closeGate"));
document.getElementById("btnCalibrate").addEventListener("click", sendCalibrate);
document.getElementById("btnToggleCalibrate").addEventListener("click", () => {
  const wrap = document.getElementById("calibrateControls");
  const btn = document.getElementById("btnToggleCalibrate");
  const opening = wrap.style.display === "none";
  wrap.style.display = opening ? "flex" : "none";
  btn.textContent = opening ? "Close" : "+ Calibrate a Load Cell";
});

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
                    "recipe_runs": list(recipe_runs.values()),
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
            elif action == "openGate":
                command = {
                    "command": "gate",
                    "actuator": int(body.get("actuator", 0)),
                    "open": True,
                }
            elif action == "closeGate":
                command = {
                    "command": "gate",
                    "actuator": int(body.get("actuator", 0)),
                    "open": False,
                }
            elif action == "calibrate":
                known_weight = float(body.get("knownWeight", 0))
                if known_weight <= 0:
                    self._send_json(400, {"ok": False, "error": "Known weight must be > 0"})
                    return
                command = {
                    "command": "calibrate",
                    "actuator": int(body.get("actuator", 0)),
                    "knownWeight": known_weight,
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
        global next_recipe_run_id

        name = body.get("name", "")
        recipe = recipe_db.load_recipe(name)
        if recipe is None:
            self._send_json(404, {"ok": False, "error": f"No recipe named '{name}'"})
            return

        if mqtt_client is None or not mqtt_client.is_connected():
            self._send_json(503, {"ok": False, "error": "Not connected to broker"})
            return

        # Every click on Run queues another instance of this recipe, even if
        # one (or several) are already active - e.g. two batches of the same
        # dish. Each gets its own run id/card; they only ever serialize
        # against each other on a shared actuator, same as different recipes
        # do.
        with state_lock:
            run_id = next_recipe_run_id
            next_recipe_run_id += 1
            recipe_runs[run_id] = {
                "id": run_id,
                "name": name,
                # Waits for an explicit "Dispense Ingredient" click before
                # the *first* ingredient too, not just the ones after it -
                # run_recipe_worker's per-step gate handles every index
                # uniformly now.
                "status": "waiting_next",
                "steps": [],
                "current_step": 0,
                "current_group": [],
                "message": "",
            }
            recipe_run_controls[run_id] = {
                "cancel": threading.Event(),
                "next": threading.Event(),
            }

        threading.Thread(target=run_recipe_worker, args=(run_id, name), daemon=True).start()

        print(f"[{now_str()}] Recipe '{name}' run {run_id} started via dashboard")
        self._send_json(200, {"ok": True, "run_id": run_id})

    def _handle_recipe_next(self, body):
        run_id = body.get("run_id")
        with state_lock:
            run = recipe_runs.get(run_id)
            waiting = run is not None and run.get("status") == "waiting_next"
            controls = recipe_run_controls.get(run_id)
            targets = []
            if waiting:
                group = run.get("current_group") or [run.get("current_step", 0)]
                for idx in group:
                    if 0 <= idx < len(run["steps"]):
                        step = run["steps"][idx]
                        if step.get("device") is not None:
                            targets.append((step["device"], step["actuator"]))

        if not waiting:
            self._send_json(400, {"ok": False, "error": "That recipe run isn't waiting for the next ingredient"})
            return

        # Tare every load cell about to be dispensed right as the operator
        # commits to it - the tray's current contents (leftover residue, a
        # bowl someone placed on it, etc.) become the new zero point before
        # the motor starts, same as pressing Tare from Send Command
        # manually, just automatic here. For a bundled esp32-03/esp32-04
        # group this tares every member, not just one.
        if mqtt_client is not None and mqtt_client.is_connected():
            for device, actuator in targets:
                tare_command = {"command": "tare", "actuator": actuator}
                mqtt_client.publish(f"machine/{device}/command", json.dumps(tare_command))
                print(f"[{now_str()}] Recipe run {run_id}: tared {device} actuator {actuator} before dispensing")

        controls["next"].set()
        print(f"[{now_str()}] Recipe run {run_id} 'next ingredient' requested via dashboard")
        self._send_json(200, {"ok": True})

    def _handle_recipe_cancel(self, body):
        run_id = body.get("run_id")
        with state_lock:
            run = recipe_runs.get(run_id)
            active = run is not None and run.get("status") in ("running", "queued", "waiting_next", "stalled")
            controls = recipe_run_controls.get(run_id)

        if not active:
            self._send_json(400, {"ok": False, "error": "That recipe run isn't currently active"})
            return

        controls["cancel"].set()
        print(f"[{now_str()}] Recipe run {run_id} cancel requested via dashboard")
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
