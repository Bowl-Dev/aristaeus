# firmware/ - Dispenser robots (MachineControllerOS)

ESP32 firmware for the ingredient dispensers plus the operator dashboard that drives them.
Imported from `juanqr7/MachineControllerOS` (develop) on 2026-11-24 with history. **Work happens
here now**; the old repo is frozen. Not an npm workspace: PlatformIO + plain Python.

## Physical setup

- Each ESP32 ("device", `esp32-01`..`esp32-04`) runs **2 actuators**. An actuator = stepper
  (auger/feeder) + HX711 load cell + servo gate. The bowl sits on the load cell (esp32-01/02).
- **One ingredient per actuator, one actuator per ingredient - always 1:1 in a kitchen.** The
  name is compiled in per env (`INGREDIENT_ACTUATOR_0/1` in `platformio.ini`) and reported in
  status as `ingredient0/1`; the dashboard maps ingredient → (device, actuator) from that.
- Bowls are moved **by hand** from actuator to actuator. Machines dispense part of the bowl; the
  kitchen tops it off.
- Broker (mosquitto) + `tools/dashboard.py` run on **Juan's PC, the only host in the kitchen**.
  Boards find it via mDNS (`MQTT_BROKER_HOSTNAME` in `platformio.ini`).

## Layout

```
platformio.ini        envs esp32_01..04 (extend [esp32]) + native (host tests)
src/main.cpp          wiring + loop(): wifi, mqtt.update, controller.update, status
lib/MachineController per-actuator state machine: Ready → Dispensing → (WaitingToFlush) → Flushing → Ready, or Error
lib/Jobs              DispenseJob (slow at 90%, stop at target-3g, open gate), JobQueue (ring, 8)
lib/MQTTManager       network task on core 0; FreeRTOS queues to/from loop() on core 1
lib/Protocol          MQTT command JSON → JobRequest (unit-tested)
lib/StatusManager     1 Hz status JSON
lib/{Stepper,LoadCell,Servo,Wifi}Manager  hardware
lib/Core              Config.h, Pins.h (pins + timing knobs), shared structs; secrets.h (gitignored)
tools/dashboard.py    web UI + recipe runner (http://localhost:8000); recipe_db.py = SQLite
test/test_protocol    Unity tests, run on the host
```

## Commands (run inside firmware/)

```bash
cp lib/Core/secrets.example.h lib/Core/secrets.h   # once; kitchen WiFi goes here, never committed
pio run                                            # build esp32_01 + esp32_02 (default_envs)
pio run -e esp32_03 -e esp32_04                    # the synchronized-flush units
pio test -e native                                 # host-side unit tests, no board needed
pio run -e esp32_01 -t upload && pio device monitor  # flash: only with the board on the bench
pip install -r tools/requirements.txt && python tools/dashboard.py
mosquitto_sub -t 'machine/#' -v                    # raw traffic
```

Install PlatformIO with `uv tool install platformio` (or `pip install platformio`).

## MQTT contract (the integration surface - keep it stable)

Topics: `machine/<device>/command` (in), `machine/<device>/status` (1 Hz), `machine/<device>/event`.

| command     | fields                                                         |
| ----------- | -------------------------------------------------------------- |
| `dispense`  | `actuator`, `targetWeight` g, `speed` (1000), `holdFlush`, `id` |
| `tare`      | `actuator`                                                     |
| `calibrate` | `actuator`, `knownWeight` g (tare first, then place weight)    |
| `gate`      | `actuator`, `open` bool                                        |
| `flush`     | `actuator` (only from WaitingToFlush)                          |
| `reset`     | `actuator` - abandon job, motor off, back to Ready             |
| `resume`    | `actuator` - continue a stalled job from Error                 |

Event: `{device, actuator, event, timestamp}`, event ∈ JobAccepted, JobStarted, JobFinished,
JobRejected, Error, ErrorCleared.

Status: `device uptime wifi mqtt proto reset mac rssi heap wifiDrops mqttDrops maxLoopMs` plus
per actuator n ∈ {0,1}: `mode<n> lastError<n> queuedJobs<n> loadCell<n> calibration<n>
ingredient<n> job<n>{id active targetWeight currentWeight progress}`. Must stay < 900 bytes.

## Invariants - break these and the robots misbehave

- **Never block `loop()`.** HX711 reads only when `is_ready()`; tare/calibrate are time-boxed.
  A stalled loop means stalled gates and weight monitoring. Network I/O lives on the core-0 task;
  only that task touches the `PubSubClient`.
- **Dispense ids are idempotent.** The dashboard re-sends a dispense until it sees JobStarted or
  its id in status; the firmware acks a repeated id without queueing it again. Keep both halves.
- **Changing a status/event key or command field = changing the contract.** Update
  `tools/dashboard.py` in the same change (it reads `mode<n>`, `job<n>.id`, `loadCell<n>`,
  `ingredient<n>`, `proto`, ...) and the bridge/shared types once they exist.
- **Platform is pinned to espressif32 6.x (Arduino core 2.x).** 8.x/core 3.x removed the timer
  API `StepperManager` uses. Upgrading is a deliberate port, not a version bump.
- **Calibration knobs are real.** `FLUSH_DURATION_MS`, `SERVO_*` in `Pins.h`, the 90%/-3 g
  thresholds in `DispenseJob.cpp`, `STALL_TIMEOUT_MS` were tuned on the hardware. Don't
  "simplify" them away; changing one needs a bench test.
- Include headers with exact case (`Arduino.h`, `WifiManager.h`) - CI builds on Linux.
- You cannot test motion here. Anything touching steppers/servos/load cells/timing: build, run
  native tests, and say plainly that it still needs a bench test on the machine.
