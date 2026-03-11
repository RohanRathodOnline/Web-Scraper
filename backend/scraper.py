# ============================================================
#   ScrapeDash — E-Commerce Product Web Scraper
#   scraper.py — Main Scraper using Requests + BeautifulSoup
# ============================================================

import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import os
from urllib.parse import urljoin

# ============================================================
#   CONFIGURATION
# ============================================================
BASE_URL   = "https://books.toscrape.com/catalogue/"
START_URL  = "https://books.toscrape.com/catalogue/page-1.html"
OUTPUT_FILE = "products.csv"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# Star rating words used on the website
RATING_MAP = {
    "One":   1,
    "Two":   2,
    "Three": 3,
    "Four":  4,
    "Five":  5
}

# ============================================================
#   FETCH A SINGLE PAGE
# ============================================================
def fetch_page(url):
    """
    Send HTTP GET request to the URL.
    Returns BeautifulSoup object or None if failed.
    """
    try:
        print(f"  → Fetching: {url}")
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()  # Raise error for 4xx/5xx status
        soup = BeautifulSoup(response.text, "html.parser")
        print(f"  ✓ Page fetched successfully ({len(response.text)} bytes)")
        return soup
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Error fetching page: {e}")
        return None


# ============================================================
#   EXTRACT PRODUCTS FROM A PAGE
# ============================================================
def extract_products(soup):
    """
    Parse the HTML and extract product data:
    - Product Name
    - Price
    - Rating (converted from words to numbers)
    Returns a list of product dictionaries.
    """
    products = []

    # 1) Preferred extraction for books.toscrape (existing logic)
    articles = soup.find_all("article", class_="product_pod")

    if articles:
        for article in articles:
            # --- Product Name ---
            name_tag = article.find("h3")
            name_a = name_tag.find("a") if name_tag else None
            name = name_a["title"] if name_a and name_a.has_attr("title") else (name_a.text.strip() if name_a else "Unknown")

            # --- Price ---
            price_tag = article.find("p", class_="price_color")
            price_text = price_tag.text.strip() if price_tag else "£0.00"
            # Remove currency symbols and convert to float
            try:
                price = float(price_text.replace("£", "").replace("Â", "").strip())
            except Exception:
                price = 0.0

            # --- Rating ---
            rating_tag = article.find("p", class_="star-rating")
            rating_word = None
            if rating_tag and rating_tag.has_attr("class") and len(rating_tag["class"]) > 1:
                rating_word = rating_tag["class"][1]
            rating = RATING_MAP.get(rating_word, 1)

            products.append({
                "Product Name": name,
                "Price (£)":    round(price, 2),
                "Rating":       rating
            })

        print(f"  ✓ Extracted {len(products)} products from this page")
        return products

    # 2) Fallback extraction for other websites
    # Common container selectors to try
    fallback_selectors = ["div.product", "div.product-card", "div.item", "li.product", "article.product", "div.card", ".product-item"]

    seen = set()
    for sel in fallback_selectors:
        elems = soup.select(sel)
        for el in elems:
            # avoid duplicates by element position
            try:
                key = (el.name, el.get('class') and ' '.join(el.get('class')) or '', str(el.sourceline) if el and hasattr(el, 'sourceline') else '')
            except Exception:
                key = str(el)[:100]
            if key in seen:
                continue
            seen.add(key)

            # Name: try h2, h3, or a inside the container
            name = "Unknown"
            for tag in ['h2', 'h3', 'a']:
                t = el.find(tag)
                if t:
                    # Use title attribute if present, else text
                    name = t.get('title') or t.text.strip()
                    if name:
                        break

            # Price: find elements whose class/id/text contains 'price' or contains currency symbols
            price = 0.0
            price_found = False
            # search descendants for likely price nodes
            for desc in el.find_all(True):
                cls = ' '.join(desc.get('class') or [])
                ident = (desc.get('id') or '')
                txt = (desc.text or '').strip()
                combined = f"{cls} {ident} {txt}".lower()
                if 'price' in combined or '£' in txt or '$' in txt or '€' in txt:
                    # extract number from text
                    import re
                    m = re.search(r"[\d,.]+", txt.replace('\xa0',''))
                    if m:
                        num = m.group(0).replace(',', '')
                        try:
                            price = float(num)
                            price_found = True
                            break
                        except Exception:
                            continue

            if not price_found:
                # try container text as last resort
                import re
                m = re.search(r"[\d,.]+", el.text)
                if m:
                    try:
                        price = float(m.group(0).replace(',', ''))
                    except Exception:
                        price = 0.0

            # Rating: attempt to find numeric rating or star classes
            rating = 0
            # look for star-rating classes
            star = el.find(class_=lambda x: x and 'star' in ' '.join(x).lower()) if hasattr(el, 'find') else None
            if star and hasattr(star, 'get'):
                cls = ' '.join(star.get('class') or [])
                for word, val in RATING_MAP.items():
                    if word.lower() in cls.lower():
                        rating = val
                        break

            # look for data-rating attribute or text like '4.5' or '4/5'
            if rating == 0:
                # data-rating
                try:
                    dr = el.get('data-rating') or el.get('data-score')
                    if dr:
                        rating = int(float(dr))
                except Exception:
                    pass
            if rating == 0:
                import re
                m = re.search(r"(\d(?:\.\d)?)\s*(?:/|out of)?\s*5", el.text)
                if m:
                    try:
                        rating = int(float(m.group(1)))
                    except Exception:
                        rating = 0

            products.append({
                "Product Name": name or "Unknown",
                "Price (£)":    round(price, 2),
                "Rating":       rating
            })

    print(f"  ✓ Extracted {len(products)} products from this page (fallback)")
    return products


# ============================================================
#   GET NEXT PAGE URL
# ============================================================
def get_next_page(soup, current_url=None):
    """
    Find the 'next' button on the page and return the absolute next page URL.
    If current_url is provided, resolve the next href relative to it.
    Returns None if there is no next page.
    """
    next_btn = soup.find("li", class_="next")
    if next_btn:
        next_href = next_btn.find("a")["href"]
        # Resolve relative hrefs against the current page (preferred) or BASE_URL
        base = current_url if current_url else BASE_URL
        return urljoin(base, next_href)
    return None


# ============================================================
#   MAIN SCRAPER FUNCTION
# ============================================================
def run_scraper(start_url, max_pages=5):
    """
    Main scraper function.
    Scrapes multiple pages and collects all product data

    Args:
        start_url (str): URL of the first page to start scraping from
        max_pages (int): Maximum number of pages to scrape (default: 5)

    Returns:
        pandas DataFrame of all scraped products
    """
    print("=" * 55)
    print("   ScrapeDash — Web Scraper Started")
    print("=" * 55)
    print(f"  Target : {start_url}")
    print(f"  Pages  : {max_pages}")
    print("=" * 55)

    all_products = []
    current_url  = start_url
    page_number  = 1

    while current_url and page_number <= max_pages:
        print(f"\n📄 Scraping Page {page_number}/{max_pages}...")
        print(f"   URL: {current_url}")

        # Fetch the page HTML
        soup = fetch_page(current_url)
        if soup is None:
            print("  ✗ Failed to fetch page. Stopping.")
            break

        # Extract products from HTML
        products = extract_products(soup)
        all_products.extend(products)

        print(f"  📦 Total products collected so far: {len(all_products)}")

        # Get next page URL (resolved relative to the current page)
        current_url = get_next_page(soup, current_url)
        page_number += 1

        # Polite delay to avoid overloading the server
        if current_url and page_number <= max_pages:
            print("  ⏳ Waiting 1 second before next page...")
            time.sleep(1)

    # ---- Build DataFrame ----
    print("\n" + "=" * 55)
    print("  ✅ Scraping Complete!")
    print(f"  📦 Total Products: {len(all_products)}")
    print("=" * 55)

    if not all_products:
        print("  ⚠ No products were scraped.")
        return pd.DataFrame()

    df = pd.DataFrame(all_products)
    df.index = df.index + 1  # Start index from 1
    df.index.name = "ID"

    return df


# ============================================================
#   SAVE TO CSV
# ============================================================
def save_to_csv(df, filename=OUTPUT_FILE):
    """
    Save the DataFrame to a CSV file.
    """
    if df.empty:
        print("  ⚠ Nothing to save — DataFrame is empty.")
        return

    df.to_csv(filename)
    file_size = os.path.getsize(filename)
    print(f"\n  💾 Dataset saved to: {filename}")
    print(f"  📁 File size       : {file_size} bytes")
    print(f"  📊 Total records   : {len(df)}")


# ============================================================
#   DISPLAY SUMMARY
# ============================================================
def display_summary(df):
    """
    Print a summary of the scraped dataset.
    """
    if df.empty:
        return

    print("\n" + "=" * 55)
    print("   📊 DATASET SUMMARY")
    print("=" * 55)
    print(f"  Total Products : {len(df)}")
    print(f"  Avg Price      : £{df['Price (£)'].mean():.2f}")
    print(f"  Min Price      : £{df['Price (£)'].min():.2f}")
    print(f"  Max Price      : £{df['Price (£)'].max():.2f}")
    print(f"  Avg Rating     : {df['Rating'].mean():.1f} / 5")
    print(f"  5-Star Books   : {len(df[df['Rating'] == 5])}")
    print("=" * 55)
    print("\n  📋 First 5 Records:")
    print(df.head().to_string())
    print("\n  📋 Last 5 Records:")
    print(df.tail().to_string())
    print("=" * 55)


# ============================================================
#   RUN
# ============================================================
if __name__ == "__main__":
    # Change max_pages to scrape more or fewer pages
    # Each page has ~20 products
    # max_pages=5  → ~100 products
    # max_pages=10 → ~200 products
    # max_pages=50 → all 1000 products

    df = run_scraper(START_URL, max_pages=5)

    if not df.empty:
        display_summary(df)
        save_to_csv(df, OUTPUT_FILE)
        print(f"\n  ✅ Done! Open '{OUTPUT_FILE}' to see your data.\n")
