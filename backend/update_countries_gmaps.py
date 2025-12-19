import sqlite3
from playwright.sync_api import sync_playwright
import time

DB_PATH = "jobs.db"

def clean_location(loc):
    return loc.replace("locations\n", "").replace("locations", "").strip() if loc else ""

COUNTRY_NAMES = {
    "India": "IN",
    "Tamil Nadu": "IN",
    "Maharashtra": "IN",
    "Uttar Pradesh": "IN",
    "United Kingdom": "GB",
    "UK": "GB",
    "England": "GB",
    "Scotland": "GB",
    "United States": "US",
    "USA": "US",
    "Canada": "CA",
    "Mexico": "MX",
    "Singapore": "SG",
    "Japan": "JP",
    "Indonesia": "ID",
    "Philippines": "PH",
    "Hong Kong": "HK",
    "Luxembourg": "LU",
    "Switzerland": "CH",
}

def map_country_name_to_code(name):
    name = name.strip()
    for country, code in COUNTRY_NAMES.items():
        if country.lower() == name.lower():
            return code
    return None

def get_country_from_gmaps(page, location):
    try:
        page.goto("https://www.google.com/maps", timeout=20000)
        page.wait_for_timeout(2000)

        page.fill("input#searchboxinput", location)
        page.click("button#searchbox-searchbutton")
        page.wait_for_timeout(4000)

        country_name = None

        # Try 1: address button
        try:
            addr_btn = page.locator('button[data-item-id="address"]')
            if addr_btn.count() > 0:
                addr_text = addr_btn.first.inner_text()
                parts = [p.strip() for p in addr_text.split(",") if p.strip()]
                if parts:
                    country_name = parts[-1]
        except:
            pass

        # Try 2: side panel subtitle
        if not country_name:
            try:
                subtitle = page.locator('div[role="region"] div[aria-label] div[aria-level="3"]').first.inner_text()
                parts = [p.strip() for p in subtitle.split(",") if p.strip()]
                if parts:
                    country_name = parts[-1]
            except:
                pass

        # Fallback: city-name heuristics
        if not country_name:
            lowered = location.lower()
            if "chennai" in lowered or "pune" in lowered or "noida" in lowered:
                return "IN"
            if "glasgow" in lowered or "knutsford" in lowered or "london" in lowered:
                return "GB"

        if not country_name:
            return None

        return map_country_name_to_code(country_name)

    except Exception as e:
        print(f"      Error: {str(e)[:80]}")
        return None

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT COUNT(*) FROM jobs WHERE location IS NOT NULL AND location != ''")
total = cursor.fetchone()[0]
print(f"Found {total} records to process\n")

# Start with small batch for testing
cursor.execute("SELECT id, location FROM jobs WHERE location IS NOT NULL AND location != '' LIMIT 10")
records = cursor.fetchall()

updated = 0
failed = 0

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # set True for silent
    page = browser.new_page()

    for i, (job_id, location) in enumerate(records, 1):
        cleaned = clean_location(location)
        if not cleaned:
            continue

        print(f"[{i}/{len(records)}] Processing: {cleaned[:50]}")
        country = get_country_from_gmaps(page, cleaned)

        if country:
            cursor.execute("UPDATE jobs SET country = ? WHERE id = ?", (country, job_id))
            updated += 1
            print(f"          ✓ {country}")
        else:
            failed += 1
            print(f"          ✗ NO MATCH")

        if i % 5 == 0:
            conn.commit()
            print(f"\n--- Saved progress: {updated} updated ---\n")

        time.sleep(2)

    browser.close()

conn.commit()
conn.close()

print(f"\n{'='*60}")
print(f"DONE: {updated} updated, {failed} failed out of {len(records)}")
