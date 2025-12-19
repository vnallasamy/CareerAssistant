import sqlite3
import subprocess
import requests
import time
import json

DB_PATH = "jobs.db"
LOCATIONIQ_KEY = "pk.bfc262eefb0672ba1f6daf84bbf3b08b"
API_URL = "https://us1.locationiq.com/v1/search"

def clean_location(loc):
    if not loc:
        return ""
    return loc.replace("locations\n", "").replace("locations", "").strip()

def ask_ollama_extract_location(raw_location):
    prompt = f"""Extract city, state/province, and country from this job location string.

Location: "{raw_location}"

Output ONLY valid JSON in this exact format (no markdown, no explanation):
{{"city": "CityName", "state": "StateName", "country": "CountryName"}}

If any field is unknown, use empty string.
"""
    try:
        result = subprocess.run(
            ["ollama", "run", "llama3.2:3b"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=40,
        )
        text = result.stdout.strip()
        if "{" in text and "}" in text:
            s = text.index("{")
            e = text.rindex("}") + 1
            return json.loads(text[s:e])
        return None
    except Exception as e:
        print("    Ollama error:", e)
        return None

def query_locationiq(city, state, country):
    queries = []
    if city and state and country:
        queries.append(f"{city}, {state}, {country}")
    if city and country:
        queries.append(f"{city}, {country}")
    if city:
        queries.append(city)

    for q in queries:
        try:
            params = {
                "key": LOCATIONIQ_KEY,
                "q": q,
                "format": "json",
                "addressdetails": 1,
                "limit": 1
            }
            resp = requests.get(API_URL, params=params, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    addr = data[0].get("address", {})
                    return {
                        "query_used": q,
                        "city": addr.get("city") or addr.get("town") or addr.get("village"),
                        "state": addr.get("state"),
                        "country": addr.get("country"),
                        "country_code": (addr.get("country_code") or "").upper()
                    }
            time.sleep(1)
        except Exception as e:
            print(f"      LocationIQ error for '{q}': {e}")
    return None

def format_location(city, state, country):
    parts = [p for p in [city, state, country] if p]
    return ", ".join(parts) if parts else ""

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, location
        FROM jobs
        WHERE location IS NOT NULL AND location != ''
    """)
    jobs = cursor.fetchall()
    total = len(jobs)

    print("=" * 80)
    print(f"UPDATING {total} JOBS WITH OLLAMA + LOCATIONIQ")
    print("=" * 80)

    updated = 0
    failed = 0

    for idx, (job_id, raw_loc) in enumerate(jobs, 1):
        cleaned = clean_location(raw_loc)
        print(f"\n[{idx}/{total}] Job {job_id[:8]}...")
        print("  Original:", raw_loc)
        print("  Cleaned :", cleaned)

        extracted = ask_ollama_extract_location(cleaned)
        if not extracted:
            print("    ✗ Ollama failed, skipping")
            failed += 1
            continue

        city = (extracted.get("city") or "").strip()
        state = (extracted.get("state") or "").strip()
        country_name = (extracted.get("country") or "").strip()

        print(f"    Ollama -> City: {city or 'EMPTY'}, State: {state or 'EMPTY'}, Country: {country_name or 'EMPTY'}")

        liq = query_locationiq(city, state, country_name) if city else None
        if liq:
            country_code = liq["country_code"]
            final_city = liq["city"] or city
            final_state = liq["state"] or state
            final_country = liq["country"] or country_name
            print(f"    LocationIQ -> {final_city}, {final_state}, {final_country} ({country_code})")
        else:
            country_code = ""
            final_city = city
            final_state = state
            final_country = country_name
            print("    LocationIQ -> no match, using Ollama values only")

        new_location = format_location(final_city, final_state, final_country)

        cursor.execute(
            "UPDATE jobs SET country = ?, location = ? WHERE id = ?",
            (country_code, new_location or cleaned, job_id),
        )
        updated += 1
        print(f"    ✓ UPDATED -> country: {country_code or 'EMPTY'}, location: {new_location or cleaned}")

        if idx % 10 == 0:
            conn.commit()
            print(f"\n--- Progress saved ({updated} updates so far) ---")

        time.sleep(2)  # gentle on LocationIQ

    conn.commit()
    conn.close()

    print("\n" + "=" * 80)
    print(f"DONE. Updated rows: {updated}, Failed: {failed}")
    print("=" * 80)

if __name__ == "__main__":
    main()
