import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBARCHIVES_DIR = path.join(__dirname, 'webarchives');

if (!fs.existsSync(WEBARCHIVES_DIR)) {
    fs.mkdirSync(WEBARCHIVES_DIR, { recursive: true });
}

let progressStats = {
    total: 0,
    completed: 0,
    failed: 0,
    startTime: null
};

export async function scrapeJobs(jobs, updateCallback) {
    progressStats = {
        total: jobs.length,
        completed: 0,
        failed: 0,
        startTime: Date.now()
    };
    
    const results = {
        scraped: 0,
        failed: 0,
        details: []
    };
    
    console.log(`\n🚀 Starting HYBRID scraper for ${jobs.length} jobs...`);
    console.log(`⚡ Using: Jina Reader + llama3.1:8b + Parallel Processing\n`);
    
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(job => processJob(job, updateCallback));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, idx) => {
            if (result.status === 'fulfilled' && result.value) {
                results.scraped++;
                results.details.push(result.value);
            } else {
                results.failed++;
                const job = batch[idx];
                results.details.push({
                    id: job.id,
                    status: 'failed',
                    error: result.reason?.message || 'Unknown error'
                });
            }
            
            progressStats.completed++;
            printProgress();
        });
    }
    
    const totalTime = ((Date.now() - progressStats.startTime) / 1000).toFixed(1);
    
    console.log(`\n📊 Scraping Complete!`);
    console.log(`   ✅ Scraped: ${results.scraped}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   ⏱️  Total Time: ${totalTime}s`);
    console.log(`   ⚡ Avg Speed: ${(totalTime / jobs.length).toFixed(1)}s per job\n`);
    
    return results;
}

async function processJob(job, updateCallback) {
    const jobNumber = progressStats.completed + 1;
    console.log(`\n[${jobNumber}/${progressStats.total}] 🔍 Scraping: ${job.title}`);
    console.log(`   🔗 ${job.url}`);
    
    try {
        console.log(`   📡 Fetching via Jina Reader...`);
        const content = await fetchWithJina(job.url);
        
        const filename = `job_${job.id}_${Date.now()}.md`;
        const filepath = path.join(WEBARCHIVES_DIR, filename);
        fs.writeFileSync(filepath, content);
        
        console.log(`   🤖 Analyzing with llama3.1:8b...`);
        const extractedData = await extractWithOllama(content, job);
        
        if (!extractedData) {
            throw new Error('Failed to extract data from Ollama');
        }
        
        console.log(`   ✅ Success!`);
        console.log(`   📍 ${extractedData.location} | ${extractedData.work_type}`);
        console.log(`   💰 ${extractedData.salary}`);
        
        const result = {
            id: job.id,
            status: 'scraped',
             extractedData,
            webarchive: filepath
        };
        
        if (updateCallback) {
            await updateCallback(result);
        }
        
        return result;
        
    } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        throw err;
    }
}

function fetchWithJina(url) {
    return new Promise((resolve, reject) => {
        const jinaUrl = `https://r.jina.ai/${url}`;
        
        https.get(jinaUrl, {
            headers: { 'Accept': 'text/plain' },
            timeout: 30000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`Jina Reader returned ${res.statusCode}`));
                }
            });
        }).on('error', reject).on('timeout', () => {
            reject(new Error('Jina Reader timeout'));
        });
    });
}

async function extractWithOllama(content, job) {
    const prompt = `Extract job information from this posting. Return ONLY a JSON object with these exact fields. Do not add any markdown, explanations, or extra text.

{
  "job_title": "exact job title from posting",
  "company": "company name",
  "location": "city, state, country format",
  "work_type": "Remote OR Hybrid OR Onsite OR Not specified",
  "salary": "salary range or Not specified",
  "summary": "2-3 sentence job summary max 300 chars",
  "mandatory_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill1", "skill2"],
  "posted_date": "date or Not specified"
}

Job content:
${content.substring(0, 6000)}

Return only valid JSON:`;

    try {
        const response = await callOllama(prompt);
        let jsonStr = response.trim();
        jsonStr = jsonStr.replace(/``````\s*/g, '');
        
        const firstBrace = jsonStr.indexOf('{');
        if (firstBrace > 0) jsonStr = jsonStr.substring(firstBrace);
        
        const lastBrace = jsonStr.lastIndexOf('}');
        if (lastBrace > 0 && lastBrace < jsonStr.length - 1) {
            jsonStr = jsonStr.substring(0, lastBrace + 1);
        }
        
        const data = JSON.parse(jsonStr);
        
        if (!data.job_title || !data.location) {
            throw new Error('Missing required fields');
        }
        
        data.work_type = data.work_type || 'Not specified';
        data.salary = data.salary || 'Not specified';
        data.summary = data.summary || '';
        data.mandatory_skills = Array.isArray(data.mandatory_skills) ? data.mandatory_skills : [];
        data.preferred_skills = Array.isArray(data.preferred_skills) ? data.preferred_skills : [];
        data.posted_date = data.posted_date || 'Not specified';
        
        return data;
    } catch (err) {
        console.error(`   ⚠️  Ollama error: ${err.message}`);
        return null;
    }
}

function callOllama(prompt) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: 'llama3.1:8b',
            prompt: prompt,
            stream: false,
            options: { temperature: 0.1, top_p: 0.9 }
        });
        
        const options = {
            hostname: 'localhost',
            port: 11434,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 60000
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.response);
                } catch (err) {
                    reject(err);
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Ollama timeout'));
        });
        req.write(postData);
        req.end();
    });
}

function printProgress() {
    const elapsed = ((Date.now() - progressStats.startTime) / 1000).toFixed(0);
    const percent = ((progressStats.completed / progressStats.total) * 100).toFixed(1);
    const avgTime = elapsed / progressStats.completed;
    const remaining = Math.ceil((progressStats.total - progressStats.completed) * avgTime);
    
    console.log(`\n📊 Progress: ${progressStats.completed}/${progressStats.total} (${percent}%) | ⏱️  ${elapsed}s elapsed | 🕒 ~${remaining}s remaining`);
}
