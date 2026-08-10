"""
recipe_db.py - Shared SQLite storage for MachineControllerOS recipes.

Used by both recipes.py (command-line) and dashboard.py (web UI), so the
two never disagree about schema or validation.

A recipe is a name plus an ordered list of (ingredient, grams, speed)
lines. Ingredients are just names ("rice", "chicken") - which physical
device/actuator serves that ingredient is resolved at run time from live
MQTT status, not stored here. That way recipes keep working even if you
move an ingredient to a different ESP32 or actuator later.
"""

import sqlite3
from datetime import datetime
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent / "recipes.db"
DEFAULT_SPEED = 1000


def get_db(path=DEFAULT_DB):
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            ingredient TEXT NOT NULL,
            grams REAL NOT NULL,
            speed INTEGER NOT NULL
        )
    """)
    conn.commit()
    return conn


def list_recipes(path=DEFAULT_DB):
    """All recipes with their ingredients, ordered by name.

    Returns: [{"name", "created_at", "ingredients": [{"ingredient", "grams", "speed"}, ...]}, ...]
    """
    conn = get_db(path)
    recipe_rows = conn.execute("SELECT id, name, created_at FROM recipes ORDER BY name").fetchall()

    result = []
    for recipe_id, name, created_at in recipe_rows:
        ingredient_rows = conn.execute(
            "SELECT ingredient, grams, speed FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position",
            (recipe_id,),
        ).fetchall()
        result.append({
            "name": name,
            "created_at": created_at,
            "ingredients": [
                {"ingredient": ingredient, "grams": grams, "speed": speed}
                for ingredient, grams, speed in ingredient_rows
            ],
        })

    conn.close()
    return result


def load_recipe(name, path=DEFAULT_DB):
    """Returns [(ingredient, grams, speed), ...] in dispense order, or None if the recipe doesn't exist."""
    conn = get_db(path)
    recipe_row = conn.execute("SELECT id FROM recipes WHERE name = ?", (name,)).fetchone()
    if recipe_row is None:
        conn.close()
        return None

    rows = conn.execute(
        "SELECT ingredient, grams, speed FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position",
        (recipe_row[0],),
    ).fetchall()
    conn.close()
    return rows


def save_recipe(name, ingredients, path=DEFAULT_DB):
    """Creates a new recipe, or fully replaces the ingredient list of an existing one.

    ingredients: list of (ingredient_name, grams, speed) tuples, in dispense order.
    Returns "created" or "updated". Raises ValueError on invalid input.
    """
    name = (name or "").strip()
    if not name:
        raise ValueError("Recipe name cannot be empty")

    if not ingredients:
        raise ValueError("A recipe needs at least one ingredient")

    clean = []
    for ingredient, grams, speed in ingredients:
        ingredient = (ingredient or "").strip()
        if not ingredient:
            raise ValueError("Ingredient name cannot be empty")
        try:
            grams = float(grams)
        except (TypeError, ValueError):
            raise ValueError(f"'{ingredient}' needs a numeric weight in grams")
        if grams <= 0:
            raise ValueError(f"'{ingredient}' weight must be greater than 0")
        try:
            speed = int(speed)
        except (TypeError, ValueError):
            speed = DEFAULT_SPEED
        if speed <= 0:
            speed = DEFAULT_SPEED
        clean.append((ingredient, grams, speed))

    conn = get_db(path)
    existing = conn.execute("SELECT id FROM recipes WHERE name = ?", (name,)).fetchone()

    if existing:
        recipe_id = existing[0]
        conn.execute("DELETE FROM recipe_ingredients WHERE recipe_id = ?", (recipe_id,))
        action = "updated"
    else:
        cur = conn.execute(
            "INSERT INTO recipes (name, created_at) VALUES (?, ?)",
            (name, datetime.now().isoformat(timespec="seconds")),
        )
        recipe_id = cur.lastrowid
        action = "created"

    for position, (ingredient, grams, speed) in enumerate(clean):
        conn.execute(
            "INSERT INTO recipe_ingredients (recipe_id, position, ingredient, grams, speed) VALUES (?, ?, ?, ?, ?)",
            (recipe_id, position, ingredient, grams, speed),
        )

    conn.commit()
    conn.close()
    return action


def delete_recipe(name, path=DEFAULT_DB):
    """Returns True if a recipe was deleted, False if no recipe had that name."""
    conn = get_db(path)
    cur = conn.execute("DELETE FROM recipes WHERE name = ?", (name,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0
