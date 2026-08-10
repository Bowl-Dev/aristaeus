#!/usr/bin/env python3
"""
mqtt_test.py - Command-line test tool for MachineControllerOS.

Sends dispense/tare/reset jobs to a specific ESP32 unit over MQTT, and
monitors status and event messages published by every unit on the broker.

Usage examples:

    # Watch every unit's status/event stream (sends nothing)
    python mqtt_test.py monitor

    # Send a dispense job to esp32-01, then watch its progress
    python mqtt_test.py dispense --device esp32-01 --actuator 0 --weight 250 --speed 1500

    # Tare load cell 1 on esp32-02
    python mqtt_test.py tare --device esp32-02 --actuator 1

    # Reset actuator 0 on esp32-01, abandoning whatever job was active on it
    python mqtt_test.py reset --device esp32-01 --actuator 0

    # Resume esp32-01's actuator 1 stalled dispense job instead of abandoning it
    python mqtt_test.py resume --device esp32-01 --actuator 1

    # Point at a different broker
    python mqtt_test.py monitor --broker 192.168.2.8 --port 1883

Requires: pip install paho-mqtt
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime

import paho.mqtt.client as mqtt

DEFAULT_BROKER = "192.168.2.8"   # matches MQTT_SERVER in lib/Core/Config.h
DEFAULT_PORT = 1883


def timestamp():
    return datetime.now().strftime("%H:%M:%S")


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f"[{timestamp()}] Connected to broker")
        client.subscribe("machine/+/status")
        client.subscribe("machine/+/event")
    else:
        print(f"[{timestamp()}] Connect failed: {reason_code}")


def on_message(client, userdata, msg):
    parts = msg.topic.split("/")
    device = parts[1] if len(parts) > 1 else "?"
    kind = "STATUS" if msg.topic.endswith("/status") else "EVENT"

    try:
        payload = json.loads(msg.payload.decode())
        pretty = json.dumps(payload)
    except (ValueError, UnicodeDecodeError):
        pretty = msg.payload.decode(errors="replace")

    print(f"[{timestamp()}] [{device}] {kind}: {pretty}")


def build_command(args):
    if args.action == "dispense":
        return {
            "command": "dispense",
            "actuator": args.actuator,
            "targetWeight": args.weight,
            "speed": args.speed,
        }
    if args.action == "tare":
        return {
            "command": "tare",
            "actuator": args.actuator,
        }
    if args.action == "reset":
        return {
            "command": "reset",
            "actuator": args.actuator,
        }
    if args.action == "resume":
        return {
            "command": "resume",
            "actuator": args.actuator,
        }
    return None


def main():
    parser = argparse.ArgumentParser(description="MachineControllerOS MQTT test tool")
    parser.add_argument("--broker", default=DEFAULT_BROKER, help="MQTT broker address")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="MQTT broker port")

    sub = parser.add_subparsers(dest="action", required=True)

    sub.add_parser("monitor", help="Watch status/event messages from all units, send nothing")

    p_dispense = sub.add_parser("dispense", help="Send a dispense job")
    p_dispense.add_argument("--device", required=True, help="Target device ID, e.g. esp32-01")
    p_dispense.add_argument("--actuator", type=int, required=True, help="Actuator index (0 or 1)")
    p_dispense.add_argument("--weight", type=float, required=True, help="Target weight in grams")
    p_dispense.add_argument("--speed", type=int, default=1000, help="Stepper speed (steps/sec)")

    p_tare = sub.add_parser("tare", help="Tare a load cell")
    p_tare.add_argument("--device", required=True, help="Target device ID, e.g. esp32-01")
    p_tare.add_argument("--actuator", type=int, required=True, help="Actuator index (0 or 1)")

    p_reset = sub.add_parser("reset", help="Reset an actuator out of Error state, abandoning its active job")
    p_reset.add_argument("--device", required=True, help="Target device ID, e.g. esp32-01")
    p_reset.add_argument("--actuator", type=int, required=True, help="Actuator index (0 or 1)")

    p_resume = sub.add_parser("resume", help="Resume an actuator's stalled dispense job instead of abandoning it")
    p_resume.add_argument("--device", required=True, help="Target device ID, e.g. esp32-01")
    p_resume.add_argument("--actuator", type=int, required=True, help="Actuator index (0 or 1)")

    args = parser.parse_args()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"mqtt_test-{os.getpid()}")
    client.on_connect = on_connect
    client.on_message = on_message

    print(f"[{timestamp()}] Connecting to {args.broker}:{args.port} ...")

    try:
        client.connect(args.broker, args.port, keepalive=30)
    except OSError as exc:
        print(f"Could not reach broker at {args.broker}:{args.port} ({exc})")
        sys.exit(1)

    client.loop_start()

    if args.action != "monitor":
        command = build_command(args)
        topic = f"machine/{args.device}/command"
        payload = json.dumps(command)

        # Give the subscribe a moment to land before publishing, so we don't
        # miss the immediate JobAccepted/JobRejected event.
        time.sleep(0.5)

        print(f"[{timestamp()}] Publishing to {topic}: {payload}")
        client.publish(topic, payload)

    print("Listening for status/event messages. Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
