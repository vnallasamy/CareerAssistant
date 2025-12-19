import subprocess
import json
import requests

OLLAMA_URL = 'http://localhost:11434/api/generate'
MODEL = 'llama3.2'

def analyze_with_ollama(title, company, description):
    prompt = """Analyze this job posting and extract key information.

Job Title: {title}
Company: {company}
Description: {description}

Answer these questions in JSON format:

1. Is this actually a job posting? (true/false)
2. Does it require US citizenship or green card? Look for: "USC", "US Citizen", "Green Card", "GC", "security clearance", "must be authorized to work"
3. Does it mention "no visa sponsorship" or similar?
4. Location (city, state/province, country)
5. Brief summary (20 words max)
6. Salary or compensation range. If present, extract numeric min and max and currency. If not present, leave null.
7. Work type: one of ["onsite","remote","hybrid","unknown"].
8. Employment type / job_type: e.g. "full-time", "part-time", "contract", "internship", or "other".
9. Experience level: e.g. "junior", "mid", "senior", "lead", or a short phrase.
10. Posted date in ISO format (YYYY-MM-DD) if available, else null.
11. Mandatory skills: list of 3-10 key required skills/technologies/competencies (array of strings).
12. Preferred skills: list of 3-10 nice-to-have skills/technologies/competencies (array of strings).

Respond ONLY with valid JSON:
{
  "is_real_job": true/false,
  "requires_citizenship": true/false,
  "no_visa_sponsorship": true/false,
  "location": "City, State, Country",
  "summary": "brief summary",
  "salary_min": number or null,
  "salary_max": number or null,
  "currency": "USD" or "EUR" or "MXN" or null,
  "work_type": "onsite" or "remote" or "hybrid" or "unknown",
  "job_type": "full-time" or "part-time" or "contract" or "internship" or "other",
  "experience_level": "junior" or "mid" or "senior" or "lead" or string,
  "posted_date": "YYYY-MM-DD" or null,
  "mandatory_skills": [ "skill1", "skill2", "..." ],
  "preferred_skills": [ "skill1", "skill2", "..." ]
}
""".format(title=title, company=company, description=description)


    resp = requests.post(OLLAMA_URL, json={
        'model': MODEL,
        'prompt': prompt,
        'stream': False,
        'temperature': 0.1
    }, timeout=120)

    resp.raise_for_status()
    data = resp.json()
    return data.get('response', '')

def parse_analysis(text):
    import re
    try:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if not m:
            return None
        return json.loads(m.group(0))
    except Exception as e:
        print("Parse error:", e)
        return None

def main():
    url = "https://bbva.wd3.myworkdayjobs.com/en-US/BBVA/job/PATRIMONIAL-VERACRUZ-6397/Banquero-a-Patrimonial--Divisin-SUR-_JR00056335"
    title = "Banquero/a Patrimonial (Veracruz)"
    company = "bbva"

    print("Fetching via Playwright...")
    pw = fetch_with_playwright(url)
    print("Playwright ok:", pw.get('ok'))
    print("Webarchive path:", pw.get('webarchive_path'))
    print("Description sample:\n", pw.get('description', '')[:400], "\n")

    if not pw.get('description'):
        print("No description from Playwright, aborting Ollama.")
        return

    print("Calling Ollama...")
    analysis_text = analyze_with_ollama(title, company, pw['description'])
    print("Raw Ollama response (first 400 chars):\n", analysis_text[:400], "\n")

    analysis = parse_analysis(analysis_text)
    print("Parsed analysis:\n", json.dumps(analysis, indent=2))
    print("\n========== ENRICHED FIELDS ONLY ==========")
    print(json.dumps(analysis, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
