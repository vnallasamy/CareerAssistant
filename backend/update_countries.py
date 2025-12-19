import sqlite3
import requests
import time
import json

DB_PATH = "jobs.db"
USER_AGENT = "CareerAssistant/1.0 (contact@example.com)"

def clean_location(location):
    """Remove 'locations' prefix and clean up"""
    if not location:
        return ""
    cleaned = location.replace("locations\n", "").replace("locations", "").strip()
    return cleaned

def get_country(location):
    if not location or len(location.strip()) < 2:
        return None, "Empty"
    
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location.strip(),
        "format": "json",
        "addressdetails": 1,
        "limit": 1
    }
    headers = {"User-Agent": USER_AGENT}
    
    try:
        # Add verify=False to bypass SSL if needed
        resp = requests.get(url, params=params, headers=headers, timeout=15, verify=True)
        resp.raise_for_status()
        data = resp.json()
        
        if data and len(data) > 0:
            address = data[0].get("address", {})
            country_code = address.get("country_code", "").upper()
            if country_code:
                return country_code, None
        return None, "No match"
        
    except Exception as e:
        return None, f"Error: {str(e)}"

# Test connectivity first
print("Testing API connectivity...")
test_country, test_error = get_country("London")
if test_country:
    print(f"✓ API working: London -> {test_country}\n")
else:
    print(f"✗ API ERROR: {test_error}")
    print("\nTrying without SSL verification...")
    # Retry with SSL disabled
    try:
        resp = requests.get("https://nominatim.openstreetmap.org/search?q=London&format=json&limit=1", 
                          headers={"User-Agent": USER_AGENT}, verify=False, timeout=15)
        print(f"SSL bypass result: {resp.status_code}")
    except Exception as e:
        print(f"Still failing: {e}")
    exit(1)

# Process records
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT id, location FROM jobs LIMIT 10")
records = cursor.fetchall()

print("\n=== PROCESSING 10 RECORDS ===\n")
for i, (job_id, location) in enumerate(records, 1):
    cleaned = clean_location(location)
    country, error = get_country(cleaned)
    if country:
        print(f"[{i}] ✓ {cleaned[:40]:40} -> {country}")
    else:
        print(f"[{i}] ✗ {cleaned[:40]:40} -> {error}")
    time.sleep(1.5)

conn.close()
