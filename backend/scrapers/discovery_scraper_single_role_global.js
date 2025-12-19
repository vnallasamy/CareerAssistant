import { chromium } from 'playwright';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'jobs.db');
const SITES_FILE = path.join(__dirname, '..', 'config', 'job_sites.txt');
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const LOCATIONIQ_KEY = 'pk.bfc262eefb0672ba1f6daf84bbf3b08b';
const LOCATIONIQ_URL = 'https://us1.locationiq.com/v1/search';
const MODEL = 'llama3.2';

// Load sites from job_sites.txt
let siteUrls = [];
try {
  const raw = fs.readFileSync(SITES_FILE, 'utf-8');
  siteUrls = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  console.log('🌐 Loaded sites:', siteUrls.length);
} catch (e) {
  console.error('❌ Could not read job_sites.txt:', e.message);
  process.exit(1);
}

function openDb() {
  return new sqlite3.Database(DB_PATH);
}

function urlExists(url) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.get('SELECT id FROM jobs WHERE url = ? LIMIT 1', [url], (err, row) => {
      db.close();
      if (err) return reject(err);
      resolve(!!row);
    });
  });
}

async function validateLocationWithLocationIQ(city, state, country) {
  if (!city) return null;
  
  const queries = [];
  if (city && state && country) {
    queries.push(`${city}, ${state}, ${country}`);
  }
  if (city && country) {
    queries.push(`${city}, ${country}`);
  }
  if (city) {
    queries.push(city);
  }

  for (const q of queries) {
    try {
      const params = new URLSearchParams({
        key: LOCATIONIQ_KEY,
        q: q,
        format: 'json',
        addressdetails: '1',
        limit: '1'
      });

      const response = await fetch(`${LOCATIONIQ_URL}?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const addr = data[0].address || {};
          return {
            city: addr.city || addr.town || addr.village || city,
            state: addr.state || state,
            country: addr.country || country,
            country_code: (addr.country_code || '').toUpperCase()
          };
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log(`   ⚠️ LocationIQ error for "${q}": ${e.message}`);
    }
  }
  
  return null;
}

async function enrichWithOllama(rawTitle, company, pageText) {
  const prompt = `Analyze this job posting and extract structured information.

Extracted Title (may be wrong): ${rawTitle}
Company: ${company}
Page Content: ${pageText.substring(0, 4000)}

CRITICAL: For location, you MUST extract in this EXACT format:
- City name (required) - e.g., "Pune", "Chennai", "London", "New York"
- State/Province name (if mentioned) - e.g., "Maharashtra", "Tamil Nadu", "England", "New York"
- Country name (required) - FULL country name like "India", "United Kingdom", "United States", "Canada"

Examples of CORRECT location format:
- "Pune, Maharashtra, India"
- "Chennai, Tamil Nadu, India"
- "London, England, United Kingdom"
- "Toronto, Ontario, Canada"
- "New York, New York, United States"
- "Remote" (ONLY if explicitly remote-only position)

Extract the following in JSON format:
1. actual_job_title: The REAL job title from the posting (not website name)
2. location_city: City name ONLY (e.g., "Pune", "Chennai", "London")
3. location_state: State/Province ONLY (e.g., "Maharashtra", "Ontario")
4. location_country: FULL country name (e.g., "India", "United Kingdom", "United States")
5. description: Full job description (150-250 words)
6. mandatory_skills: Array of REQUIRED/MUST-HAVE skills only
7. preferred_skills: Array of NICE-TO-HAVE skills only
8. requires_citizenship: true ONLY if explicitly requires citizenship/green card/security clearance
9. no_visa_sponsorship: true ONLY if explicitly states no visa sponsorship
10. remote_option: Must be one of: "remote", "hybrid", "onsite", or "unknown"
11. summary: One-sentence summary (maximum 25 words)

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "actual_job_title": "Senior Data Analyst",
  "location_city": "Pune",
  "location_state": "Maharashtra",
  "location_country": "India",
  "description": "detailed description...",
  "mandatory_skills": ["SQL", "Python"],
  "preferred_skills": ["Tableau", "AWS"],
  "requires_citizenship": false,
  "no_visa_sponsorship": false,
  "remote_option": "onsite",
  "summary": "Senior analyst role focusing on data analysis and reporting."
}`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.1
      })
    });

    if (response.ok) {
      const result = await response.json();
      const text = result.response || '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.log(`   ⚠️ Ollama error: ${err.message}`);
  }
  
  return null;
}

function insertJob(enrichedData) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    
    const title = enrichedData.title || 'Unknown';
    const company = enrichedData.company || 'Unknown';
    const url = enrichedData.url;
    const status = enrichedData.enriched ? 'enriched' : 'discovered';
    const location = enrichedData.location || null;
    const country = enrichedData.country || null;
    const work_type = enrichedData.work_type || null;
    const posted_date = enrichedData.posted_date || null;
    const description = enrichedData.description || null;
    const summary = enrichedData.summary || null;
    const mandatory_skills = enrichedData.mandatory_skills ? JSON.stringify(enrichedData.mandatory_skills) : null;
    const preferred_skills = enrichedData.preferred_skills ? JSON.stringify(enrichedData.preferred_skills) : null;
    const remote_option = enrichedData.remote_option || null;
    const requires_citizenship = enrichedData.requires_citizenship ? 1 : 0;
    const no_visa_sponsorship = enrichedData.no_visa_sponsorship ? 1 : 0;
    
    db.run(
      `INSERT INTO jobs (
        id, title, company, url, status, scraped_at,
        location, country, work_type, posted_date, description, summary, 
        mandatory_skills, preferred_skills,
        remote_option, requires_citizenship, no_visa_sponsorship, enriched_at
      ) VALUES (
        lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'),
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ${enrichedData.enriched ? "datetime('now')" : 'NULL'}
      )`,
      [
        title, company, url, status,
        location, country, work_type, posted_date, description, summary,
        mandatory_skills, preferred_skills,
        remote_option, requires_citizenship, no_visa_sponsorship
      ],
      function (err) {
        db.close();
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

async function intelligentSearchAndCollect(page, siteUrl, searchTerm) {
  console.log(`\n============================================================`);
  console.log(`🔍 Opening site: ${siteUrl}`);
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);

  const searchBox = await page
    .locator(
      'input[type="search"], input[placeholder*="search" i], input[placeholder*="keyword" i], input[aria-label*="search" i], input[type="text"]'
    )
    .first();

  if (await searchBox.count()) {
    console.log('🔎 Search box found, typing criteria...');
    await searchBox.fill(searchTerm);
    await searchBox.press('Enter');
    await page.waitForTimeout(5000);
  } else {
    console.log('⚠️ No obvious search box found; skipping site.');
    return 0;
  }

  const sortSelector =
    'button:has-text("Date"), button:has-text("Recent"), button:has-text("Newest"), select option:has-text("Date"), [aria-label*="sort" i]';
  const sortCandidate = page.locator(sortSelector).first();
  if (await sortCandidate.count()) {
    try {
      console.log('📅 Attempting to sort by date...');
      await sortCandidate.click({ timeout: 3000 });
      await page.waitForTimeout(3000);
    } catch {
      console.log('⚠️ Could not click sort control.');
    }
  }

  let totalNew = 0;
  let pageIndex = 1;
  let stopForDuplicates = false;

  while (!stopForDuplicates && pageIndex < 50) {
    console.log(`📄 Results page ${pageIndex}`);

    const links = await page.$$eval(
      'a[href]',
      (as) =>
        as
          .map((a) => ({
            href: a.href,
            text: (a.textContent || '').trim(),
          }))
          .filter(
            (a) =>
              a.href &&
              a.text &&
              a.text.length > 5 &&
              !a.href.startsWith('mailto:') &&
              !a.href.startsWith('tel:')
          )
    );

    const baseSearchUrl = siteUrl.split('?')[0];

    const jobLinks = links.filter((l) => {
      const url = l.href.split('?')[0];
      if (
        url === baseSearchUrl ||
        /skip to main content/i.test(l.text) ||
        /cookies|privacy|terms|accessibility/i.test(l.text)
      ) {
        return false;
      }

      const pathPart = url.toLowerCase();
      const looksLikeJobUrl =
        /\/job\//.test(pathPart) ||
        /_jr\d|_jr-|_jr0/i.test(pathPart) ||
        /jobid=|jobs\/details|opportunityid/i.test(pathPart);

      const looksLikeJobText =
        /manager|engineer|analyst|director|lead|specialist|associate|vice president|avp|svp|vp|officer|consultant|designer|developer|architect/i.test(
          l.text
        );

      return looksLikeJobUrl || looksLikeJobText;
    });

    console.log(`🔗 Candidate job links: ${jobLinks.length}`);

    let consecutiveDuplicates = 0;
    const DUP_LIMIT = 5;

    for (const job of jobLinks) {
      const jobUrl = job.href;

      if (await urlExists(jobUrl)) {
        console.log(`🔁 Existing job in DB, skipping: ${jobUrl}`);
        consecutiveDuplicates += 1;
        if (consecutiveDuplicates >= DUP_LIMIT) {
          console.log(`🛑 ${DUP_LIMIT} consecutive duplicates, stopping for this site.`);
          stopForDuplicates = true;
          break;
        }
        continue;
      } else {
        consecutiveDuplicates = 0;
      }

      const newPage = await page.context().newPage();
      try {
        await newPage.goto(jobUrl, {
          waitUntil: 'networkidle',
          timeout: 60000,
        });

        try {
          await newPage.waitForSelector('[data-automation-id="jobPostingDescription"]', { timeout: 10000 });
        } catch {
          console.log(`   ⚠️ Job description not loaded in time`);
        }
        await newPage.waitForTimeout(3000);

        const captcha = await newPage
          .locator('text=/captcha|recaptcha|verify you are human/i')
          .count();
        if (captcha > 0) {
          console.log(`   🤖 CAPTCHA detected, skipping: ${jobUrl}`);
          await newPage.close();
          await page.waitForTimeout(3000);
          continue;
        }

        const pageData = await newPage.evaluate(() => {
          const title = document.querySelector('h1')?.innerText || '';
          const location = document.querySelector('[data-automation-id="locations"]')?.innerText || '';
          const workType = document.querySelector('[data-automation-id="time-type"]')?.innerText || '';
          const postedDate = document.querySelector('[data-automation-id="postedOn"]')?.innerText || '';
          const description = document.querySelector('[data-automation-id="jobPostingDescription"]')?.innerText || '';
          const fullText = document.body.innerText || document.body.textContent;
          
          return { title, location, workType, postedDate, description, fullText };
        });

        const company = new URL(jobUrl).hostname.split('.')[0];

        console.log(`   🧠 Enriching with Ollama...`);
        const enrichedData = await enrichWithOllama(pageData.title, company, pageData.fullText);

        if (enrichedData && enrichedData.actual_job_title) {
          // Validate location with LocationIQ
          console.log(`   🌍 Validating location with LocationIQ...`);
          const validatedLocation = await validateLocationWithLocationIQ(
            enrichedData.location_city,
            enrichedData.location_state,
            enrichedData.location_country
          );

          let finalLocation, finalCountry;
          if (validatedLocation && validatedLocation.country_code) {
            const parts = [
              validatedLocation.city,
              validatedLocation.state,
              validatedLocation.country
            ].filter(p => p);
            finalLocation = parts.join(', ');
            finalCountry = validatedLocation.country_code;
            console.log(`   ✓ Location validated: ${finalLocation} (${finalCountry})`);
          } else {
            // Fallback to Ollama data
            const parts = [
              enrichedData.location_city,
              enrichedData.location_state,
              enrichedData.location_country
            ].filter(p => p);
            finalLocation = parts.join(', ') || pageData.location;
            finalCountry = '';
            console.log(`   ⚠️ Location not validated, using Ollama  ${finalLocation}`);
          }

          await insertJob({
            title: enrichedData.actual_job_title,
            company: company,
            url: jobUrl,
            enriched: true,
            location: finalLocation,
            country: finalCountry,
            work_type: pageData.workType,
            posted_date: pageData.postedDate,
            description: pageData.description || enrichedData.description,
            summary: enrichedData.summary,
            mandatory_skills: enrichedData.mandatory_skills,
            preferred_skills: enrichedData.preferred_skills,
            remote_option: enrichedData.remote_option,
            requires_citizenship: enrichedData.requires_citizenship,
            no_visa_sponsorship: enrichedData.no_visa_sponsorship
          });

          totalNew += 1;
          console.log(`   ✅ ${enrichedData.actual_job_title}`);
          console.log(`      📍 ${finalLocation} | ${pageData.workType}`);
          console.log(`      🌐 Country: ${finalCountry || 'Not validated'}`);
          console.log(`      📅 Posted: ${pageData.postedDate}`);
          console.log(`      🔧 ${enrichedData.mandatory_skills?.length || 0} required, ${enrichedData.preferred_skills?.length || 0} preferred skills`);
        } else {
          await insertJob({
            title: pageData.title.trim().slice(0, 200),
            company: company,
            url: jobUrl,
            enriched: false,
            location: pageData.location,
            country: '',
            work_type: pageData.workType,
            posted_date: pageData.postedDate,
            description: pageData.description
          });
          totalNew += 1;
          console.log(`   ⚠️ Saved without Ollama: ${pageData.title}`);
        }

        await newPage.close();
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
        try {
          await newPage.close();
        } catch {}
      }
    }

    if (stopForDuplicates) break;

    const nextButton = page.locator(
      'a:has-text("Next"), button:has-text("Next"), a[aria-label*="Next" i], button[aria-label*="Next" i]'
    );
    if (await nextButton.count()) {
      try {
        console.log('➡️ Going to next results page...');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
          nextButton.first().click(),
        ]);
        await page.waitForTimeout(3000);
        pageIndex += 1;
      } catch {
        console.log('⚠️ Could not paginate, stopping site.');
        break;
      }
    } else {
      console.log('⏹ No next-page control, ending this site.');
      break;
    }
  }

  console.log(`🏁 Site complete: ${totalNew} new jobs discovered.`);
  return totalNew;
}

(async () => {
  const searchTerm = process.argv[2] || 'software engineer';
  console.log(`🚀 Discovery scraper with Ollama + LocationIQ validation starting`);
  console.log(`🔍 Search term: "${searchTerm}"`);
  console.log(`🧠 Using Ollama model: ${MODEL}`);
  console.log(`🌐 Sites: ${siteUrls.length}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  const page = await context.newPage();
  let total = 0;

  for (const site of siteUrls) {
    try {
      total += await intelligentSearchAndCollect(page, site, searchTerm);
    } catch (e) {
      console.log(`❌ Error on site ${site}: ${e.message}`);
    }
    await page.waitForTimeout(3000);
  }

  await browser.close();
  console.log(`\n✅ Discovery complete: ${total} new jobs added.`);
})();
