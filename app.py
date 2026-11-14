
import os
import traceback

from flask import Flask, jsonify, request, render_template
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = None

# Initialize Supabase
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client initialized.")
    except Exception:
        print("Supabase initialization failed:")
        traceback.print_exc()
else:
    print("ERROR: Supabase credentials are missing.")


def get_supabase():
    if supabase is None:
        raise RuntimeError("Supabase connection is not initialized.")
    return supabase


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/status")
def status():
    return jsonify({"status": "ok"})


# Save a route
@app.route("/api/routes", methods=["POST"])
def save_route():
    try:
        data = request.get_json(silent=True)

        if not data:
            return jsonify({"error": "No route data provided"}), 400

        route = {
            "start_location": data.get("start_location"),
            "destination": data.get("destination"),
            "distance": float(data.get("distance", 0)),
            "duration": float(data.get("duration", 0))
        }

        if not route["start_location"] or not route["destination"]:
            return jsonify({
                "error": "Start and destination are required"
            }), 400

        result = (
            get_supabase()
            .table("routes")
            .insert(route)
            .execute()
        )

        return jsonify({
            "message": "Route saved successfully",
            "route": result.data[0] if result.data else route
        }), 201

    except Exception:
        print("\nDATABASE SAVE ERROR:")
        traceback.print_exc()

        return jsonify({
            "error": "Could not save route. Check Flask terminal."
        }), 500


# Load route history
@app.route("/api/routes", methods=["GET"])
def get_routes():
    try:
        result = (
            get_supabase()
            .table("routes")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )

        return jsonify({
            "routes": result.data
        })

    except Exception:
        print("\nDATABASE HISTORY ERROR:")
        traceback.print_exc()

        return jsonify({
            "error": "Could not load route history. Check Flask terminal."
        }), 500


# Clear route history
@app.route("/api/routes", methods=["DELETE"])
def clear_routes():
    try:
        (
            get_supabase()
            .table("routes")
            .delete()
            .gte("id", 0)
            .execute()
        )

        return jsonify({
            "message": "Route history cleared successfully"
        })

    except Exception:
        print("\nDATABASE DELETE ERROR:")
        traceback.print_exc()

        return jsonify({
            "error": "Could not clear route history."
        }), 500


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
