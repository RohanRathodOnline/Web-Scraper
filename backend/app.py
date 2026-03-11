import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from scraper import run_scraper

# ============================================================
# Create Flask App
# ============================================================

app = Flask(__name__)

# Enable CORS so frontend (GitHub Pages / localhost) can call API
CORS(app, resources={r"/*": {"origins": "*"}})


# ============================================================
# Home Route
# ============================================================

@app.route("/")
def home():
    return jsonify({
        "message": "ScrapeDash Backend Running",
        "status": "ok"
    })


# ============================================================
# Health Check Route (for uptime monitoring)
# ============================================================

@app.route("/health")
def health():
    return jsonify({
        "status": "ok"
    }), 200


# ============================================================
# Scrape API
# ============================================================

@app.route("/scrape", methods=["POST"])
def scrape():

    # Get JSON data from request
    data = request.get_json(silent=True) or {}

    # Extract URL
    url = data.get("url")

    # Extract pages value safely
    try:
        pages = int(data.get("pages", 3))
    except (TypeError, ValueError):
        pages = 3

    # Validate URL
    if not url:
        return jsonify({
            "status": "error",
            "message": "URL is required"
        }), 400

    try:
        # Run scraper
        df = run_scraper(start_url=url, max_pages=pages)

        # Check if scraper returned data
        if df.empty:
            return jsonify({
                "status": "error",
                "message": "No products scraped"
            }), 200

        # Convert dataframe → JSON list
        products = df.to_dict(orient="records")

        # Normalize types
        for p in products:

            if "Price (£)" in p:
                try:
                    p["Price (£)"] = float(p["Price (£)"])
                except:
                    p["Price (£)"] = 0.0

            if "Rating" in p:
                try:
                    p["Rating"] = int(p["Rating"])
                except:
                    p["Rating"] = 0

        return jsonify({
            "status": "success",
            "count": len(products),
            "products": products
        }), 200

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ============================================================
# Run Flask Server (Render Compatible)
# ============================================================

if __name__ == "__main__":

    # Render provides PORT automatically
    port = int(os.environ.get("PORT", 5000))

    # host="0.0.0.0" allows public access
    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
