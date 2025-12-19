import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node playwright_fetch_job.js <job_url>');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'webarchives');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const safeName = url.replace(/[^a-z0-9]+/gi, '_').slice(0, 120);
  const htmlPath = path.join(outDir, safeName + '.html');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Heuristic waits for Workday job content
    await page.waitForTimeout(5000);

    const html = await page.content();
    fs.writeFileSync(htmlPath, html, 'utf-8');

    // Try to extract visible job description text
    const description = await page.evaluate(() => {
      function getText(el) {
        return el ? el.innerText || el.textContent || '' : '';
      }

      const candidates = [
        '[data-automation-id*="jobPostingDescription"]',
        '[data-automation-id*="jobPostingDescription"] div',
        'section[data-automation-id*="job"]',
        'div[data-automation-id*="job"]',
        'main',
        'body'
      ];

      let text = '';
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el) {
          text = getText(el).trim();
          if (text && text.length > 200) break;
        }
      }

      if (!text) {
        text = getText(document.body).trim();
      }

      text = text.replace(/\s+/g, ' ').trim();
      return text.slice(0, 8000);
    });

    const result = {
      ok: !!description,
      description,
      webarchive_path: htmlPath
    };

    console.log(JSON.stringify(result));
  } catch (err) {
    console.error('Playwright error:', err.message || err);
    console.log(JSON.stringify({ ok: false, description: '', webarchive_path: htmlPath }));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
