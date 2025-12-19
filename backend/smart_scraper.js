import { chromium } from 'playwright';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'jobs.db');
const WEBARCHIVE_DIR = path.join(__dirname, '../webarchives');
const SITES_FILE = path.join(__dirname, 'config', 'job_sites.txt');
const OLLAMA_URL = 'http://localhost:11434/api/generate';

let siteUrls = [];
try {
  const rawSites = fs.readFileSync(SITES_FILE, 'utf-8');
  siteUrls = rawSites
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  console.log('🌐 Loaded sites:', siteUrls.length);
} catch (e) {
  console.error('❌ Could not read job_sites.txt:', e.message);
  siteUrls = [];
}

const OLLAMA_URL = 'http://localhost:11434/api/generate';

if (!fs.existsSync(WEBARCHIVE_DIR)) fs.mkdirSync(WEBARCHIVE_DIR, { recursive: true });

async function checkDuplicate(url) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.get("SELECT id FROM jobs WHERE url = ? LIMIT 1", [url], (err, row) => {
      db.close();
      resolve(!!row);
    });
  });
}

async function ollamaEnrich(title, company, html) {
  const prompt = `Extract job details from this HTML:
Title: ${title}
Company: ${company}
HTML: ${html.substring(0, 10000)}

Return ONLY valid JSON:
{
  "is_real_job": true,
  "requires_citizenship": false,
  "no_visa_sponsorship": false,
  "location": "City, State, Country",
  "summary": "brief 20 word summary",
  "salary_min": null,
  "salary_max": null,
  "currency": null,
  "work_type": "remote/hybrid/onsite/unknown",
  "job_type": "full-time/contract/etc",
  "experience_level": "junior/mid/senior",
  "posted_date": "YYYY-MM-DD or null",
  "mandatory_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill3"]
}`;

  try {
    const resp = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt,
        stream: false,
        temperature: 0.1
      })
    });
    const data = await resp.json();
    const match = data.response.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  } catch (e) {
    console.error('Ollama error:', e.message);
    return {};
  }
}

async function saveJob(data) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    const skills_m = JSON.stringify(data.mandatory_skills || []);
    const skills_p = JSON.stringify(data.preferred_skills || []);
    
    db.run(`INSERT INTO jobs (
      title, company, url, description, location, summary, work_type, job_type,
      experience_level, salary_min, salary_max, posted_date,
      requires_citizenship, no_visa_sponsorship, mandatory_skills, preferred_skills,
      status, scraped_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enriched', datetime('now'))`,
    [
      data.title, data.company, data.url, data.description, data.location,
      data.summary, data.work_type, data.job_type, data.experience_level,
      data.salary_min, data.salary_max, data.posted_date,
      data.requires_citizenship ? 1 : 0, data.no_visa_sponsorship ? 1 : 0,
      skills_m, skills_p
    ], function(err) {
      db.close();
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

async function intelligentScrape(page, searchUrl, searchTerm, maxJobs) {
  console.log(`🔍 Loading: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  
  // Intelligent search box detection
  const searchBox = await page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]').first();
  if (await searchBox.count() > 0) {
    console.log('🔎 Found search box, typing...');
    await searchBox.fill(searchTerm);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
  } else {
    console.log('⚠️  No search box, using URL with ?q= param');
    await page.goto(`${searchUrl}?q=${encodeURIComponent(searchTerm)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
  }
  
  // Intelligent sort by date detection
  const sortButtons = await page.locator('button:has-text("Date"), button:has-text("Recent"), select option:has-text("Date"), [data-automation-id*="date" i], [aria-label*="sort" i]').all();
  for (const btn of sortButtons) {
    try {
      await btn.click({ timeout: 2000 });
      console.log('📅 Sorted by date');
      await page.waitForTimeout(2000);
      break;
    } catch (e) {}
  }
  
  // Intelligent job link detection - look for repeating links
  const jobLinks = await page.$$eval('a[href*="/job"], a[href*="/careers"], a[data-automation-id*="job" i], li a, .job a', links => 
    links.map(a => ({ url: a.href, text: a.textContent.trim() }))
      .filter(l => l.url && l.text && l.text.length > 10)
      .slice(0, 50)
  );
  
  console.log(`📋 Found ${jobLinks.length} potential job links`);
  
  let processed = 0;
  for (const job of jobLinks.slice(0, maxJobs)) {
    if (await checkDuplicate(job.url)) {
      console.log(`🛑 Duplicate found, stopping scrape for this site`);
      break;
    }
    
    const newTab = await page.context().newPage();
    try {
      await newTab.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await newTab.waitForTimeout(3000);
      
      // CAPTCHA detection
      const captcha = await newTab.locator('text=/captcha|recaptcha|verify you are human/i').count();
      if (captcha > 0) {
        console.log(`🤖 CAPTCHA detected on ${job.url}, skipping`);
        await newTab.close();
        await page.waitForTimeout(5000);
        continue;
      }
      
      const title = (await newTab.title()) || job.text;
      const html = await newTab.content();
      const company = new URL(job.url).hostname.split('.')[0];
      
      console.log(`\n📄 [${processed + 1}/${maxJobs}] ${title.substring(0, 60)}`);
      
      // Temp webarchive
      const webPath = path.join(WEBARCHIVE_DIR, `temp_${Date.now()}.html`);
      fs.writeFileSync(webPath, html);
      
      // Ollama enrichment
      console.log('   🧠 Sending to Ollama...');
      const analysis = await ollamaEnrich(title, company, html);
      analysis.title = title.substring(0, 200);
      analysis.company = company;
      analysis.url = job.url;
      analysis.description = html.substring(0, 8000);
      
      // Save to DB
      const jobId = await saveJob(analysis);
      
      // Delete webarchive immediately
      fs.unlinkSync(webPath);
      
      console.log(`   ✅ Saved #${jobId} | ${analysis.location || 'N/A'} | ${analysis.work_type || 'N/A'}`);
      processed++;
      
    } catch (e) {
      console.error(`   ❌ ${e.message}`);
    } finally {
      await newTab.close();
      await page.waitForTimeout(2000); // Cooldown
    }
  }
  
  return processed;
}

(async () => {
  const searchTerm = process.argv[2] || 'software engineer';
  console.log(`🚀 Intelligent Scraper starting`);
  console.log(`🔍 Search term: "${searchTerm}"`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' }
  });

  const page = await context.newPage();

  while (true) {
    let totalJobs = 0;
    console.log(`
🌐 Sites this cycle: ${siteUrls.length}`);

    for (const siteUrl of siteUrls) {
      try {
        console.log(`
${'='.repeat(60)}`);
        const count = await intelligentScrape(page, siteUrl, searchTerm, 5);
        totalJobs += count;
        console.log(`✅ Site complete: ${count} jobs`);
      } catch (err) {
        console.error(`❌ Site failed: ${siteUrl}`, err.message);
      }
      await page.waitForTimeout(3000);
    }

    console.log(`
✅ Cycle done - ${totalJobs} jobs this cycle`);
    console.log('😴 Sleeping 10 minutes before next cycle...');
    await page.waitForTimeout(10 * 60 * 1000);
  }
})();
