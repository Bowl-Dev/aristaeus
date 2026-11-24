#!/usr/bin/env python3
"""
recipes.py - Command-line recipe management and runner for MachineControllerOS.

Most people should use the "Recipes" tab in dashboard.py instead - this is
the scriptable/power-user path for the same recipe database (recipes.db,
shared with the dashboard via recipe_db.py).

A recipe is a named, ordered list of (ingredient, grams[, speed]) lines.
Running a recipe resolves each ingredient to whichever device/actuator is
currently reporting it over MQTT status, then dispenses them strictly one
at a time, in the order you defined - waiting for each ingredient to fully
finish (including its flush) before starting the next, even if the next
ingredient lives on a different actuator or a different ESP32 that's
sitting idle. This keeps the mental model simple: one motor moves at a
time, in recipe order.

Usage examples:

    # Create (or replace) a recipe - ingredients dispense in the order given
    python recipes.py add fried_rice --ingredient rice:250 --ingredient chicken:150 --ingredient carrot:50

    # Per-ingredient stepper speed override (steps/sec), default is 1000
    python recipes.py add fried_rice --ingredient rice:250:1500 --ingredient chicken:150

    # List all recipes
    python recipes.py list

    # Show one recipe's ingredients in order
    python recipes.py show fried_rice

    # Delete a recipe
    python recipes.py delete fried_rice

    # Preview which device/actuator each ingredient would use - sends nothing
    python recipes.py run fried_rice --dry-run

    # Actually run it
    python recipes.py run fried_rice

Requires: pip install paho-mqtt
"""

import argparse
import json
import queue
import sys
import threading
import time
from datetime import datetime

import paho.mqtt.client as mqtt

import recipe_db

DEFAULT_BROKER = "192.168.2.8"   # matches MQTT_SERVER in lib/Core/Config.h
DEFAULT_PORT = 1883
DISCOVER_TIMEOUT = 3.0     # seconds to listen for device status before resolving ingredients
DEFAULT_JOB_TIMEOUT = 120  # seconds to wait for one ingredient to finish dispensing

# Event types that end a dispense job, one way or another.
TERMINAL_EVENTS = {"JobFinished", "JobRejected", "Error"}


def timestamp():
    return datetime.now().strftime("%H:%M:%S")


def parse_ingredient_arg(raw):
    """Parse 'name:grams' or 'name:grams:speed' into (name, grams, speed)."""
    parts = raw.split(":")
    if len(parts) not in (2, 3):
        raise ValueError(f"invalid --ingredient '{raw}', expected name:grams or name:grams:speed")

    name = parts[0].strip()
    if not name:
        raise ValueError(f"invalid --ingredient '{raw}', ingredient name is empty")

    try:
        grams = float(parts[1])
    except ValueError:
        raise ValueError(f"invalid --ingredient '{raw}', grams must be a number")
    if grams <= 0:
        raise ValueError(f"invalid --ingredient '{raw}', grams must be > 0")

    speed = recipe_db.DEFAULT_SPEED
    if len(parts) == 3:
        try:
            speed = int(parts[2])
        except ValueError:
            raise ValueError(f"invalid --ingredient '{raw}', speed must be an integer")
        if speed <= 0:
            raise ValueError(f"invalid --ingredient '{raw}', speed must be > 0")

    return name, grams, speed


def cmd_add(args):
    try:
        lines = [parse_ingredient_arg(raw) for raw in args.ingredient]
        action = recipe_db.save_recipe(args.name, lines, path=args.db)
    except ValueError as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    print(f"{action.capitalize()} recipe '{args.name}' with {len(lines)} ingredient(s), in dispense order:")
    for i, (ingredient, grams, speed) in enumerate(lines, start=1):
        print(f"  {i}. {ingredient}: {grams:g}g @ speed {speed}")


def cmd_list(args):
    recipes = recipe_db.list_recipes(path=args.db)

    if not recipes:
        print("No recipes yet. Create one with 'recipes.py add <name> --ingredient ...'.")
        return

    for recipe in recipes:
        count = len(recipe["ingredients"])
        plural = "s" if count != 1 else ""
        print(f"{recipe['name']}  ({count} ingredient{plural}, created {recipe['created_at']})")


def cmd_show(args):
    recipe = recipe_db.load_recipe(args.name, path=args.db)
    if recipe is None:
        print(f"No recipe named '{args.name}'")
        sys.exit(1)

    print(f"{args.name}:")
    for i, (ingredient, grams, speed) in enumerate(recipe, start=1):
        print(f"  {i}. {ingredient}: {grams:g}g @ speed {speed}")


def cmd_delete(args):
    if not recipe_db.delete_recipe(args.name, path=args.db):
        print(f"No recipe named '{args.name}'")
        sys.exit(1)

    print(f"Deleted recipe '{args.name}'")


# --------------------------------------------------------------------------
# Runner - resolves ingredients to live devices/actuators over MQTT, then
# dispenses the recipe strictly sequentially.
# --------------------------------------------------------------------------

class RecipeRunner:
    def __init__(self, broker, port):
        self.broker = broker
        self.port = port
        self.ingredient_map = {}   # lowercase ingredient -> (device, actuator)
        self.map_lock = threading.Lock()
        self.events = queue.Queue()
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"recipe_runner-{int(time.time())}")
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            client.subscribe("machine/+/status")
            client.subscribe("machine/+/event")
        else:
            print(f"[{timestamp()}] Connect failed: {reason_code}")

    def _on_message(self, client, userdata, msg):
        parts = msg.topic.split("/")
        device = parts[1] if len(parts) > 1 else "?"

        try:
            payload = json.loads(msg.payload.decode())
        except (ValueError, UnicodeDecodeError):
            return

        if msg.topic.endswith("/status"):
            with self.map_lock:
                for actuator in (0, 1):
                    ingredient = payload.get(f"ingredient{actuator}")
                    if ingredient:
                        self.ingredient_map[ingredient.lower()] = (device, actuator)
        else:
            self.events.put({
                "device": device,
                "actuator": payload.get("actuator", 0),
                "event": payload.get("event", "Unknown"),
            })

    def connect(self, discover_timeout):
        print(f"[{timestamp()}] Connecting to {self.broker}:{self.port} ...")
        try:
            self.client.connect(self.broker, self.port, keepalive=30)
        except OSError as exc:
            print(f"Could not reach broker at {self.broker}:{self.port} ({exc})")
            sys.exit(1)

        self.client.loop_start()

        print(f"[{timestamp()}] Listening {discover_timeout:.0f}s to discover which device/actuator serves each ingredient...")
        time.sleep(discover_timeout)

    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()

    def resolve(self, ingredient):
        with self.map_lock:
            return self.ingredient_map.get(ingredient.lower())

    def dispense(self, device, actuator, grams, speed):
        command = {
            "command": "dispense",
            "actuator": actuator,
            "targetWeight": grams,
            "speed": speed,
        }
        topic = f"machine/{device}/command"
        payload = json.dumps(command)
        print(f"[{timestamp()}] Publishing to {topic}: {payload}")
        self.client.publish(topic, payload)

    def wait_for_result(self, device, actuator, timeout):
        """Blocks until a terminal event arrives for this device/actuator, or timeout."""
        deadline = time.monotonic() + timeout

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return "Timeout"

            try:
                event = self.events.get(timeout=remaining)
            except queue.Empty:
                return "Timeout"

            if event["device"] != device or event["actuator"] != actuator:
                continue

            print(f"[{timestamp()}] [{device}] actuator {actuator}: {event['event']}")

            if event["event"] in TERMINAL_EVENTS:
                return event["event"]


def cmd_run(args):
    recipe = recipe_db.load_recipe(args.name, path=args.db)
    if recipe is None:
        print(f"No recipe named '{args.name}'")
        sys.exit(1)

    runner = RecipeRunner(args.broker, args.port)
    runner.connect(args.discover_timeout)

    try:
        print(f"\nResolving {len(recipe)} ingredient(s) against currently connected devices...")
        resolved = []
        for ingredient, grams, speed in recipe:
            target = runner.resolve(ingredient)
            if target is None:
                print(f"Error: no connected device is currently reporting ingredient '{ingredient}'. Aborting - nothing was sent.")
                sys.exit(1)
            device, actuator = target
            resolved.append((ingredient, grams, speed, device, actuator))
            print(f"  {ingredient} ({grams:g}g) -> {device} actuator {actuator}")

        if args.dry_run:
            print("\nDry run only - nothing was sent.")
            return

        print(f"\nRunning '{args.name}' sequentially, one ingredient at a time...\n")

        for step, (ingredient, grams, speed, device, actuator) in enumerate(resolved, start=1):
            print(f"[{step}/{len(resolved)}] Dispensing {grams:g}g of {ingredient} on {device} actuator {actuator}")
            runner.dispense(device, actuator, grams, speed)

            result = runner.wait_for_result(device, actuator, args.job_timeout)

            if result == "JobFinished":
                print("  Done.\n")
            elif result == "Timeout":
                print(f"  Timed out after {args.job_timeout:.0f}s waiting for {device} actuator {actuator}. Aborting recipe.")
                sys.exit(1)
            else:
                print(f"  {device} actuator {actuator} reported '{result}'. Aborting recipe.")
                print("  Check the device (dashboard.py or 'mqtt_test.py monitor') - it may need a 'resume' or 'reset'.")
                sys.exit(1)

        print(f"Recipe '{args.name}' complete.")
    finally:
        runner.disconnect()


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="MachineControllerOS recipe database and runner")
    parser.add_argument("--db", default=str(recipe_db.DEFAULT_DB), help="Path to the recipes SQLite database")

    sub = parser.add_subparsers(dest="action", required=True)

    p_add = sub.add_parser("add", help="Create or replace a recipe")
    p_add.add_argument("name", help="Recipe name")
    p_add.add_argument(
        "--ingredient", action="append", required=True,
        help="Ingredient line: name:grams or name:grams:speed. Repeat in dispense order.",
    )

    sub.add_parser("list", help="List all recipes")

    p_show = sub.add_parser("show", help="Show one recipe's ingredients in order")
    p_show.add_argument("name", help="Recipe name")

    p_delete = sub.add_parser("delete", help="Delete a recipe")
    p_delete.add_argument("name", help="Recipe name")

    p_run = sub.add_parser("run", help="Run a recipe: dispense each ingredient in order, one at a time")
    p_run.add_argument("name", help="Recipe name")
    p_run.add_argument("--broker", default=DEFAULT_BROKER, help="MQTT broker address")
    p_run.add_argument("--port", type=int, default=DEFAULT_PORT, help="MQTT broker port")
    p_run.add_argument(
        "--discover-timeout", type=float, default=DISCOVER_TIMEOUT,
        help="Seconds to listen for device status before resolving ingredients",
    )
    p_run.add_argument(
        "--job-timeout", type=float, default=DEFAULT_JOB_TIMEOUT,
        help="Seconds to wait for each ingredient to finish before aborting",
    )
    p_run.add_argument("--dry-run", action="store_true", help="Resolve and print the plan, but send nothing")

    args = parser.parse_args()

    handlers = {
        "add": cmd_add,
        "list": cmd_list,
        "show": cmd_show,
        "delete": cmd_delete,
        "run": cmd_run,
    }
    handlers[args.action](args)


if __name__ == "__main__":
    main()
