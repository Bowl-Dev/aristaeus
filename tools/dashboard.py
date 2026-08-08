#!/usr/bin/env python3
"""
dashboard.py - Live web dashboard for MachineControllerOS.

Subscribes to every unit's MQTT status/event topics and serves a local web
page showing current state per device (sortable, click any column header)
plus a running event log - no more scrolling through PowerShell output.

Usage:
    python dashboard.py
    python dashboard.py --broker 192.168.2.8 --port 1883 --http-port 8000

Then open http://localhost:8000 in a browser and leave it open.

Requires: pip install paho-mqtt
"""

import argparse
import json
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import paho.mqtt.client as mqtt

DEFAULT_BROKER = "192.168.2.8"   # matches MQTT_SERVER in lib/Core/Config.h
DEFAULT_MQTT_PORT = 1883
DEFAULT_HTTP_PORT = 8000
MAX_EVENTS = 200

state_lock = threading.Lock()
devices = {}   # device_id -> latest status payload (+ _lastSeen)
events = []    # list of {time, device, event}, newest first
mqtt_client = None   # set in main(), used by the HTTP handler to publish commands


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
            events.insert(0, {
                "time": now_str(),
                "device": device_id,
                "event": payload.get("event", "Unknown"),
            })
            del events[MAX_EVENTS:]


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
  tr.mode-ready { background: transparent; }
  .cell-ok { color: #4caf50; }
  .cell-bad { color: #f44336; }
  #events { max-height: 300px; overflow-y: auto; border: 1px solid #3a3b42; border-radius: 4px; }
  .event { padding: 6px 12px; font-size: 22px; border-bottom: 1px solid #2a2b30; font-family: Consolas, monospace; }
  .event-jobaccepted, .event-jobstarted { color: #64b5f6; }
  .event-jobfinished { color: #4caf50; }
  .event-jobrejected, .event-error { color: #f44336; }
  .event-emergencystop { color: #ff1744; font-weight: 700; }
  .event-errorcleared { color: #ffb300; }
  h2 { font-size: 24px; color: #9aa0aa; margin: 0 0 8px 0; }
  #controls { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 14px; margin-bottom: 24px; background: #26272e; border: 1px solid #3a3b42; border-radius: 6px; }
  #controls label { font-size: 22px; color: #9aa0aa; display: flex; flex-direction: column; gap: 4px; }
  #controls select, #controls input { background: #1e1f24; color: #e6e6e6; border: 1px solid #3a3b42; border-radius: 4px; padding: 6px 8px; font-size: 23px; }
  #controls input[type=number] { width: 90px; }
  button { background: #3a3b42; color: #e6e6e6; border: 1px solid #4a4b52; border-radius: 4px; padding: 8px 16px; font-size: 23px; cursor: pointer; }
  button:hover { background: #4a4b52; }
  #btnDispense { background: #1565c0; border-color: #1976d2; }
  #btnDispense:hover { background: #1976d2; }
  #btnReset { background: #6a1b1b; border-color: #8a2424; }
  #btnReset:hover { background: #8a2424; }
  #commandStatus { font-size: 12px; }
</style>
</head>
<body>

<h1>MachineControllerOS Dashboard</h1>
<div id="status" class="bad">Connecting...</div>

<h2>Units</h2>
<table>
  <thead>
    <tr>
      <th data-key="device">Device</th>
      <th data-key="mode">Mode</th>
      <th data-key="progress">Progress</th>
      <th data-key="lc0">Load Cell 0 (g)</th>
      <th data-key="lc1">Load Cell 1 (g)</th>
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
<div id="controls">
  <label>Device
    <select id="deviceSelect"></select>
  </label>
  <label>Actuator
    <select id="actuatorSelect">
      <option value="0">0</option>
      <option value="1">1</option>
    </select>
  </label>
  <label>Target weight (g)
    <input type="number" id="weightInput" value="50" min="0" step="1">
  </label>
  <label>Speed
    <input type="number" id="speedInput" value="1000" min="1" step="50">
  </label>
  <button id="btnDispense">Dispense</button>
  <button id="btnTare">Tare</button>
  <button id="btnReset">Reset</button>
  <span id="commandStatus"></span>
</div>

<h2>Events</h2>
<div id="events"></div>

<script>
let lastDevices = {};
let lastEvents = [];
let sortKey = "device";
let sortAsc = true;

function renderTable() {
  const rows = Object.entries(lastDevices).map(([id, d]) => ({
    device: id,
    mode: d.mode || "",
    progress: (d.job && d.job.active) ? (d.job.progress + "%") : "-",
    lc0: (d.loadCell0 !== undefined) ? Number(d.loadCell0).toFixed(1) : "-",
    lc1: (d.loadCell1 !== undefined) ? Number(d.loadCell1).toFixed(1) : "-",
    queued: (d.queuedJobs !== undefined) ? d.queuedJobs : "-",
    wifi: d.wifi ? "up" : "down",
    mqtt: d.mqtt ? "up" : "down",
    error: d.lastError || "",
    lastSeen: d._lastSeen || "",
  }));

  rows.sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  const tbody = document.getElementById("tbody");
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.className = "mode-" + (r.mode || "unknown").toLowerCase();
    tr.innerHTML = `
      <td>${r.device}</td>
      <td>${r.mode}</td>
      <td>${r.progress}</td>
      <td>${r.lc0}</td>
      <td>${r.lc1}</td>
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
    div.textContent = `[${e.time}] ${e.device}: ${e.event}`;
    list.appendChild(div);
  }
}

function setStatus(ok) {
  const el = document.getElementById("status");
  el.textContent = ok ? "Connected" : "Disconnected from dashboard server";
  el.className = ok ? "ok" : "bad";
}

function updateDeviceOptions() {
  const sel = document.getElementById("deviceSelect");
  const current = sel.value;
  const ids = Object.keys(lastDevices).sort();
  const existing = Array.from(sel.options).map((o) => o.value);
  if (existing.join(",") !== ids.join(",")) {
    sel.innerHTML = "";
    for (const id of ids) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      sel.appendChild(opt);
    }
    if (ids.includes(current)) sel.value = current;
  }
}

function setCommandStatus(msg, isError) {
  const el = document.getElementById("commandStatus");
  el.textContent = msg;
  el.className = isError ? "bad" : "ok";
}

async function sendCommand(action) {
  const device = document.getElementById("deviceSelect").value;
  if (!device) {
    setCommandStatus("No device known yet", true);
    return;
  }

  if (action === "dispense" && !confirm(`Send dispense to ${device}? This will run the motor and open the gate.`)) {
    return;
  }

  const body = { device, action };
  if (action === "dispense") {
    body.actuator = parseInt(document.getElementById("actuatorSelect").value, 10);
    body.weight = parseFloat(document.getElementById("weightInput").value);
    body.speed = parseInt(document.getElementById("speedInput").value, 10);
  } else if (action === "tare") {
    body.actuator = parseInt(document.getElementById("actuatorSelect").value, 10);
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
      setCommandStatus(`Sent ${action} to ${device}`, false);
    } else {
      setCommandStatus(`Failed: ${data.error || "unknown error"}`, true);
    }
  } catch (err) {
    setCommandStatus(`Request failed: ${err}`, true);
  }
}

async function poll() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    lastDevices = data.devices;
    lastEvents = data.events;
    updateDeviceOptions();
    renderTable();
    renderEvents();
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
document.getElementById("btnReset").addEventListener("click", () => sendCommand("reset"));

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
            with state_lock:
                body = json.dumps({"devices": devices, "events": events}).encode("utf-8")
            self._send(200, "application/json", body)
        else:
            self._send(404, "text/plain", b"Not found")

    def do_POST(self):
        if self.path != "/api/command":
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)

        try:
            body = json.loads(raw.decode())
        except (ValueError, UnicodeDecodeError):
            self._send_json(400, {"ok": False, "error": "Invalid JSON body"})
            return

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
                command = {"command": "reset"}
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
        print("\nStopping.")
    finally:
        server.shutdown()
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
