import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from scraper import run_scraper

app = Flask(__name__)

# Enable CORS for all origins (frontend on GitHub Pages can access backend)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route("/")
def home():
    return "ScrapeDash Backend Running ✅"

@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200

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
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
```

---

### ✅ What Changed & Why

| Change | Reason |
|--------|--------|
| `import os` | Needed to read Render's `PORT` variable |
| `host="0.0.0.0"` | **Critical** — makes app accessible publicly, not just localhost |
| `port = int(os.environ.get("PORT", 5000))` | Render assigns its own port dynamically |
| `debug=False` | Never run debug mode in production |
| Added `/health` route | UptimeRobot will ping this to keep Render awake 24/7 |
| Stronger CORS config | Ensures GitHub Pages frontend can always connect |

---

### 🔧 Also update `requirements.txt`

Make sure it has all dependencies:
```
flask
flask-cors
requests
beautifulsoup4
pandas
gunicorn

