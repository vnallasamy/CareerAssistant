import https from 'https';
import { searchAmazon } from './amazon-jobs.js';
import { searchLinkedIn } from './linkedin-jobs.js';
import { searchIndeed } from './indeed-jobs.js';
import { searchGlassdoor } from './glassdoor-jobs.js';

let apiKeys = [];
let currentKeyIndex = 0;

function initializeKeys() {
  const keysJson = process.env.GOOGLE_API_KEYS || '[]';
  try {
    apiKeys = JSON.parse(keysJson);
    console.log(`✅ Loaded ${apiKeys.length} Google API keys`);
  } catch {
    console.error('Failed to parse GOOGLE_API_KEYS');
    apiKeys = [];
  }
}

function getNextKey() {
  if (apiKeys.length === 0) {
    throw new Error('No API keys configured');
  }
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function extractCompany(snippet) {
  const patterns = [
    /at\s+([A-Z][A-Za-z0-9\s&.,-]+?)(?:\s+in|\s+\||\s+-|\.)/,
    /by\s+([A-Z][A-Za-z0-9\s&.,-]+?)(?:\s+in|\s+\||\s+-|\.)/,
    /^([A-Z][A-Za-z0-9\s&.,-]+?)\s+is\s+hiring/
  ];
  
  for (const pattern of patterns) {
    const match = snippet.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return 'Unknown Company';
}

async function searchGoogle(query) {
  console.log(`   🌐 Searching Google Custom Search API for: ${query}`);
  
  const jobs = [];
  const domains = [
    'myworkdayjobs.com'
  ];
  
  const resultsPerPage = parseInt(process.env.RESULTS_PER_PAGE) || 10;
  const maxPages = 10;
  
  try {
    for (const domain of domains) {
      console.log(`      🔎 Searching ${domain}...`);
      
      const keyPair = getNextKey();
      console.log(`      🔑 Using API key for entire search`);
      
      for (let page = 0; page < maxPages; page++) {
        const startIndex = (page * resultsPerPage) + 1;
        const searchQuery = `${query} site:${domain}`;
        
        const url = `https://www.googleapis.com/customsearch/v1?key=${keyPair.apiKey}&cx=${keyPair.cseId}&q=${encodeURIComponent(searchQuery)}&num=${resultsPerPage}&start=${startIndex}&dateRestrict=d1`;
        
        try {
          const data = await httpsGet(url);
          const results = JSON.parse(data);
          
          if (results.error) {
            console.log(`      ⚠️  API error on page ${page + 1}: ${results.error.message}`);
            break;
          }
          
          if (results.items && results.items.length > 0) {
            for (const item of results.items) {
              jobs.push({
                title: item.title,
                company: extractCompany(item.snippet),
                url: item.link,
                description: item.snippet,
                source: `Company Career Site (${domain})`,
                applicationType: 'direct',
                experience_level: null,
                job_type: null,
                location: null
              });
            }
            console.log(`      📄 Page ${page + 1}: Found ${results.items.length} jobs (Total so far: ${jobs.length})`);
          } else {
            console.log(`      ✓ No more results at page ${page + 1}`);
            break;
          }
          
          await delay(1000);
        } catch (pageErr) {
          console.error(`      ❌ Error on page ${page + 1}: ${pageErr.message}`);
          break;
        }
      }
      
      console.log(`      ✅ Found ${jobs.length} total jobs on ${domain}`);
    }
    
    console.log(`   📊 Total company career site jobs: ${jobs.length}`);
  } catch (err) {
    console.error(`   ❌ Google search error: ${err.message}`);
  }
  
  return jobs;
}

export async function searchJobs(roles) {
  if (!apiKeys.length) {
    initializeKeys();
  }
  
  const allJobs = [];
  
  for (const role of roles) {
    console.log(`\n🔍 Searching for: ${role}`);
    
    const googleJobs = await searchGoogle(role);
    
    console.log(`   📊 Found ${googleJobs.length} jobs from Company Career Sites`);
    
    allJobs.push(...googleJobs);
  }
  
  return allJobs;
}

export async function saveCustomSite(url, selector) {
  console.log(`Custom site feature: ${url} - ${selector}`);
  return true;
}
