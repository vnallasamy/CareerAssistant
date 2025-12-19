import sqlite3
import time
import requests
import re
from datetime import datetime

DB_PATH = 'jobs.db'
OLLAMA_URL = 'http://localhost:11434/api/generate'
MODEL = 'llama3.2'
SLEEP_BETWEEN_JOBS = 3

def get_pending_jobs():
    """Get jobs that need enrichment"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, company, url, source 
        FROM jobs 
        WHERE status = 'new' 
        LIMIT 10
    """)
    jobs = cursor.fetchall()
    conn.close()
    return jobs

def scrape_job_description(url):
    """Scrape job description from URL"""
    try:
        response = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        if response.status_code != 200:
            print(f"   ❌ HTTP {response.status_code} for {url}")
            return None
        text = response.text
        
        # Extract text content (simple approach)
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Limit to first 3000 chars to avoid huge context
        return text[:3000]
    except Exception as e:
        print(f"   ❌ Scrape error: {e}")
        return None

def analyze_with_ollama(title, company, description):
    """Use Ollama to analyze job for visa requirements"""
    
    prompt = f"""Analyze this job posting and extract key information.

Job Title: {title}
Company: {company}
Description: {description}

Answer these questions in JSON format:
1. Is this actually a job posting? (true/false)
2. Does it require US citizenship or green card? Look for: "USC", "US Citizen", "Green Card", "GC", "security clearance", "must be authorized to work"
3. Does it mention "no visa sponsorship" or similar?
4. Location (city, state/province, country)
5. Brief summary (20 words max)

Respond ONLY with valid JSON:
{{
  "is_real_job": true/false,
  "requires_citizenship": true/false,
  "no_visa_sponsorship": true/false,
  "location": "City, State, Country",
  "summary": "brief summary"
}}"""

    try:
        response = requests.post(OLLAMA_URL, json={
            'model': MODEL,
            'prompt': prompt,
            'stream': False,
            'temperature': 0.1
        }, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            return result.get('response', '')
        else:
            print(f"   ❌ Ollama error: {response.status_code}")
            return None
    except Exception as e:
        print(f"   ❌ Ollama request error: {e}")
        return None

def parse_analysis(analysis_text):
    """Parse Ollama response to extract structured data"""
    try:
        # Try to extract JSON from response
        import json
        
        # Find JSON block
        match = re.search(r'\{[^}]+\}', analysis_text, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return data
        else:
            print(f"   ⚠️  No JSON found in response")
            return None
    except Exception as e:
        print(f"   ⚠️  Parse error: {e}")
        return None

def update_job(job_id, analysis, description=None):
    """Update job with enrichment data"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if analysis:
        # Always mark as enriched; let user decide validity
        status = 'enriched'
        
        cursor.execute("""
            UPDATE jobs 
            SET status = ?,
                location = ?,
                description = ?,
                summary = ?,
                requires_citizenship = ?,
                no_visa_sponsorship = ?,
                enriched_at = ?
            WHERE id = ?
        """, (
            status,
            analysis.get('location', 'Unknown'),
            description,  # full scraped text
            analysis.get('summary', ''),  # AI summary
            1 if analysis.get('requires_citizenship') else 0,
            1 if analysis.get('no_visa_sponsorship') else 0,
            datetime.now().isoformat(),
            job_id
        ))
    else:
        # Mark as enriched but with no data
        cursor.execute("""
            UPDATE jobs 
            SET status = 'enriched',
                enriched_at = ?
            WHERE id = ?
        """, (datetime.now().isoformat(), job_id))
    
    conn.commit()
    conn.close()

def main():
    print("🧠 Job Enricher with Ollama Started")
    print(f"📊 Model: {MODEL}")
    print(f"⏱️  Sleep: {SLEEP_BETWEEN_JOBS}s between jobs\n")
    
    while True:
        jobs = get_pending_jobs()
        
        if not jobs:
            print("😴 No pending jobs, waiting 30s...")
            time.sleep(30)
            continue
        
        print(f"\n📋 Processing {len(jobs)} jobs\n")
        
        for job in jobs:
            job_id, title, company, url, source = job
            
            print(f"🔍 {title[:60]}")
            print(f"   🏢 {company} ({source})")
            
            # Scrape job description
            description = scrape_job_description(url)
            
            if not description:
                print(f"   ⚠️  Could not fetch description")
                update_job(job_id, None)
                continue
            
            print(f"   📄 Scraped {len(description)} chars")
            
            # Analyze with Ollama
            print(f"   🧠 Analyzing with Ollama...")
            analysis_text = analyze_with_ollama(title, company, description)
            
            if analysis_text:
                analysis = parse_analysis(analysis_text)
                
                if analysis:
                    print(f"   ✅ Real job: {analysis.get('is_real_job')}")
                    print(f"   🌍 Location: {analysis.get('location')}")
                    print(f"   🛂 Citizenship req: {analysis.get('requires_citizenship')}")
                    print(f"   ✈️  No visa: {analysis.get('no_visa_sponsorship')}")
                    update_job(job_id, analysis, description)
                else:
                    print(f"   ⚠️  Could not parse analysis")
                    update_job(job_id, None, description)
            else:
                print(f"   ⚠️  Ollama analysis failed")
                update_job(job_id, None, description)
            
            print()
            time.sleep(SLEEP_BETWEEN_JOBS)
        
        print("✅ Batch complete\n")

if __name__ == '__main__':
    main()
