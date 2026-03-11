from flask import Flask, jsonify, request
from flask_cors import CORS
from scraper import run_scraper

app = Flask(__name__)
# Enable CORS so the frontend (Live Server) can access the backend
CORS(app)

@app.route("/")
def home():
    return "ScrapeDash Backend Running"

@app.route("/scrape", methods=["POST"])
def scrape():
    data = request.get_json(silent=True) or {}

    # Extract URL and pages from request
    url = data.get("url")
    try:
        pages = int(data.get("pages", 3))
    except (TypeError, ValueError):
        pages = 3

    # Validate URL
    if not url:
        return jsonify({
            "status": "error",
            "message": "URL is required"
        }), 200

    # Run the scraper using the provided start URL
    df = run_scraper(start_url=url, max_pages=pages)

    if df.empty:
        return jsonify({
            "status": "error",
            "message": "No products scraped"
        }), 200

    # Convert DataFrame to list of plain dicts
    products = df.to_dict(orient="records")

    # Normalize types (ensure native Python types)
    for p in products:
        if "Price (£)" in p:
            try:
                p["Price (£)"] = float(p["Price (£)"])
            except Exception:
                p["Price (£)"] = 0.0
        if "Rating" in p:
            try:
                p["Rating"] = int(p["Rating"])
            except Exception:
                p["Rating"] = 0

    return jsonify({
        "status": "success",
        "count": len(products),
        "products": products
    }), 200

if __name__ == "__main__":
    # Listen on localhost:5000 by default
    app.run(debug=True)
