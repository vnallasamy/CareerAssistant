import sqlite3
import requests
import time

DB_PATH = "jobs.db"

def clean_location(loc):
    return loc.replace("locations\n", "").replace("locations", "").strip() if loc else ""

def get_country(location):
    # Using ipgeolocation.io free tier (30k/month)
    url = f"https://api.opencagedata.com/geocode/v1/json"
    params = {"q": location, "key": "demo", "limit": 1}  # Demo key for testing
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if data.get('results'):
            return data['results'][0]['components'].get('country_code', '').upper()
    except:
        pass
    return None

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT id, location FROM jobs LIMIT 5")
for i, (job_id, location) in enumerate(cursor.fetchall(), 1):
    cleaned = clean_location(location)
    country = get_country(cleaned)
    print(f"[{i}] {cleaned[:40]:40} -> {country or 'FAIL'}")
    time.sleep(1)

conn.close()
