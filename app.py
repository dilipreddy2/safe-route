
from flask import Flask, render_template, request, jsonify
import sqlite3
import os
import math

app = Flask(__name__)

# Project folders
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_FOLDER = os.path.join(BASE_DIR, "database")
DATABASE_PATH = os.path.join(DATABASE_FOLDER, "safe_route.db")

os.makedirs(DATABASE_FOLDER, exist_ok=True)


# ======================================
# DATABASE CONNECTION
# ======================================

def get_db_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


# ======================================
# CREATE DATABASE TABLE
# ======================================

def init_db():
    connection = get_db_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_location TEXT NOT NULL,
            destination TEXT NOT NULL,
            distance REAL NOT NULL,
            duration REAL NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.commit()
    connection.close()


# ======================================
# HOME PAGE
# ======================================

@app.route("/")
def home():
    return render_template("index.html")


# ======================================
# API STATUS
# ======================================

@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({
        "status": "online",
        "message": "Safe Route server is running"
    })


# ======================================
# SAVE ROUTE
# ======================================

@app.route("/api/routes", methods=["POST"])
def save_route():
    data = request.get_json(silent=True) or {}

    start = str(data.get("start_location", "")).strip()
    destination = str(data.get("destination", "")).strip()

    if not start or not destination:
        return jsonify({
            "success": False,
            "message": "Start and destination are required"
        }), 400

    try:
        distance = float(data.get("distance"))
        duration = float(data.get("duration"))

        if not math.isfinite(distance) or not math.isfinite(duration):
            raise ValueError("Invalid route values")

        if distance < 0 or duration < 0:
            raise ValueError("Route values cannot be negative")

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Invalid distance or duration"
        }), 400

    connection = get_db_connection()

    cursor = connection.execute("""
        INSERT INTO routes (
            start_location,
            destination,
            distance,
            duration
        )
        VALUES (?, ?, ?, ?)
    """, (start, destination, distance, duration))

    connection.commit()
    route_id = cursor.lastrowid
    connection.close()

    return jsonify({
        "success": True,
        "message": "Route saved successfully",
        "id": route_id
    }), 201


# ======================================
# GET ROUTE HISTORY
# ======================================

@app.route("/api/routes", methods=["GET"])
def get_routes():
    connection = get_db_connection()

    routes = connection.execute("""
        SELECT id, start_location, destination,
               distance, duration, created_at
        FROM routes
        ORDER BY id DESC
        LIMIT 50
    """).fetchall()

    connection.close()

    return jsonify([dict(route) for route in routes])


# ======================================
# CLEAR ROUTE HISTORY
# ======================================

@app.route("/api/routes", methods=["DELETE"])
def clear_routes():
    connection = get_db_connection()

    connection.execute("DELETE FROM routes")

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "Route history cleared"
    })


# ======================================
# START APPLICATION
# ======================================

if __name__ == "__main__":
    init_db()

    print("================================")
    print("SAFE ROUTE APPLICATION RUNNING")
    print("Open http://127.0.0.1:5000")
    print("================================")

    app.run(debug=True)
