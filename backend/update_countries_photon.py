import sqlite3
import requests
import time

DB_PATH = "jobs.db"

def clean_location(loc):
    return loc.replace("locations\n", "").replace("locations", "").strip() if loc else ""

def get_country(location):
    # Photon API (Komoot's OSM geocoder - different server)
    url = "https://photon.komoot.io/api/"
    params = {"q": location, "limit": 1}
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if data.get('features'):
            props = data['features'][0].get('properties', {})
            return props.get('countrycode', '').upper()
    except Exception as e:
        print(f"    Error: {e}")
    return None

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("Testing Photon API...\n")
cursor.execute("SELECT id, location FROM jobs LIMIT 5")
for i, (job_id, location) in enumerate(cursor.fetchall(), 1):
    cleaned = clean_location(location)
    country = get_country(cleaned)
    print(f"[{i}] {cleaned[:40]:40} -> {country or 'FAIL'}")
    time.sleep(1)

conn.close()
