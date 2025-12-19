import sqlite3
import requests
import time
import re

DB_PATH = "jobs.db"
LOCATIONIQ_KEY = "pk.bfc262eefb0672ba1f6daf84bbf3b08b"
API_URL = "https://us1.locationiq.com/v1/search"

def clean_location(loc):
    if not loc:
        return ""
    return loc.replace("locations\n", "").replace("locations", "").strip()

def extract_city_from_location(location):
    """Extract likely city name from complex location string"""
    # Remove common prefixes
    cleaned = re.sub(r'^(locations|at|in)\s+', '', location, flags=re.IGNORECASE)
    
    # Split by common delimiters and take last part (usually city)
    for delimiter in [',', '|', '-']:
        if delimiter in cleaned:
            parts = [p.strip() for p in cleaned.split(delimiter) if p.strip()]
            if parts:
                return parts[-1]
    
    # Try to extract city from patterns like "Building Name, City"
    words = cleaned.split()
    if len(words) >= 2:
        return words[-1]
    
    return cleaned

def get_country_from_locationiq(location):
    """
    Try to geocode location and return country code.
    Tries full location first, then simplified queries.
    """
    if not location or len(location.strip()) < 2:
        return None
    
    # Strategy: try multiple query variants
    queries = [
        location,  # Full location
        extract_city_from_location(location),  # Just city
    ]
    
    # Remove duplicates while preserving order
    seen = set()
    queries = [q for q in queries if q and not (q in seen or seen.add(q))]
    
    for query in queries:
        try:
            params = {
                "key": LOCATIONIQ_KEY,
                "q": query,
                "format": "json",
                "addressdetails": 1,
                "limit": 1
            }
            
            response = requests.get(API_URL, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    address = data[0].get("address", {})
                    country_code = address.get("country_code", "").upper()
                    if country_code:
                        return country_code
            
            time.sleep(1)  # Rate limit: 1 req/sec to be safe
            
        except Exception as e:
            print(f"      Error with query '{query}': {str(e)[:50]}")
            continue
    
    return None

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get all jobs with locations
    cursor.execute("""
        SELECT id, location 
        FROM jobs 
        WHERE location IS NOT NULL AND location != ''
    """)
    jobs = cursor.fetchall()
    total = len(jobs)
    
    print(f"Starting batch update for {total} jobs\n")
    print("=" * 70)
    
    updated = 0
    failed = 0
    skipped = 0
    
    for idx, (job_id, raw_location) in enumerate(jobs, 1):
        cleaned = clean_location(raw_location)
        
        if not cleaned:
            skipped += 1
            continue
        
        print(f"\n[{idx}/{total}] Job {job_id[:8]}...")
        print(f"  Location: {cleaned[:60]}")
        
        country = get_country_from_locationiq(cleaned)
        
        if country:
            cursor.execute("UPDATE jobs SET country = ? WHERE id = ?", (country, job_id))
            updated += 1
            print(f"  ✓ Country: {country}")
        else:
            failed += 1
            print(f"  ✗ Could not resolve")
        
        # Commit every 10 records
        if idx % 10 == 0:
            conn.commit()
            print(f"\n--- Progress saved: {updated} updated, {failed} failed ---")
        
        # Respect rate limits
        time.sleep(1.2)
    
    # Final commit
    conn.commit()
    conn.close()
    
    print("\n" + "=" * 70)
    print(f"BATCH UPDATE COMPLETE")
    print(f"  ✓ Updated: {updated}/{total}")
    print(f"  ✗ Failed:  {failed}/{total}")
    print(f"  - Skipped: {skipped}/{total}")
    print("=" * 70)

if __name__ == "__main__":
    main()
