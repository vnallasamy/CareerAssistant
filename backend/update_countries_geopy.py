import sqlite3
from geopy.geocoders import Nominatim
import time

DB_PATH = "jobs.db"

def clean_location(loc):
    return loc.replace("locations\n", "").replace("locations", "").strip() if loc else ""

geolocator = Nominatim(user_agent="CareerAssistant/1.0")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("Testing connectivity...")
try:
    test = geolocator.geocode("London", addressdetails=True, timeout=10)
    print(f"✓ API works: {test.raw['address'].get('country_code', '').upper()}\n")
except Exception as e:
    print(f"✗ Still blocked: {e}\n")
    exit(1)

cursor.execute("SELECT id, location FROM jobs LIMIT 10")
for i, (job_id, location) in enumerate(cursor.fetchall(), 1):
    cleaned = clean_location(location)
    try:
        result = geolocator.geocode(cleaned, addressdetails=True, timeout=10)
        if result:
            country = result.raw['address'].get('country_code', '').upper()
            print(f"[{i}] ✓ {cleaned[:40]:40} -> {country}")
        else:
            print(f"[{i}] ✗ {cleaned[:40]:40} -> No match")
    except:
        print(f"[{i}] ✗ {cleaned[:40]:40} -> Error")
    time.sleep(1.5)

conn.close()
