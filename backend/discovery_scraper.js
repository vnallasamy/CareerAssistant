import { chromium } from 'playwright';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'jobs.db');
const SITES_FILE = path.join(__dirname, 'config', 'job_sites.txt');

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

function insertJob(title, company, url) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.run(
      `INSERT INTO jobs (id, title, company, url, status, scraped_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'discovered', datetime('now'))`,
      [title, company, url],
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

  // Find search box
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

  // Try to sort by date / recent
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
  } else {
    console.log('⚠️ No sort-by-date control detected.');
  }

  let totalNew = 0;
  let pageIndex = 1;
  let stopForDuplicates = false;

  while (!stopForDuplicates && pageIndex < 50) {
    console.log(`📄 Results page ${pageIndex}`);

    // Collect candidate job links
    // Collect all anchor links
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

    // Filter for likely job detail pages
    const jobLinks = links.filter((l) => {
      const url = l.href.split('?')[0];

      // Drop obvious non-job / nav pages
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
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await newPage.waitForTimeout(2000);

        // Basic captcha detection
        const captcha = await newPage
          .locator('text=/captcha|recaptcha|verify you are human/i')
          .count();
        if (captcha > 0) {
          console.log(`🤖 CAPTCHA detected, skipping: ${jobUrl}`);
          await newPage.close();
          await page.waitForTimeout(3000);
          continue;
        }

        const title =
          (await newPage.locator('h1').first().textContent()) ||
          job.text ||
          'Unknown';
        const trimmedTitle = title.trim().slice(0, 200);
        const company = new URL(jobUrl).hostname.split('.')[0];

        await insertJob(trimmedTitle, company, jobUrl);
        totalNew += 1;
        console.log(`✅ New job: ${trimmedTitle} | ${jobUrl}`);

        await newPage.close();
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log(`❌ Error visiting job link: ${jobUrl} → ${e.message}`);
        try {
          await newPage.close();
        } catch {}
      }
    }

    if (stopForDuplicates) break;

    // Pagination: try to click "Next" if available
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
  console.log(`🚀 Discovery-only scraper starting`);
  console.log(`🔍 Search term: "${searchTerm}"`);
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
