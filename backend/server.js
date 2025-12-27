import http from 'node:http';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import * as db from './db.js';
import { spawn } from 'child_process';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_PATH = path.join(__dirname, '../frontend');
const CONFIG_FILE = path.join(__dirname, 'config/scraper_config.json');
const PORT = 3000;



let scraperStats = { running: false, paused: false };

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
};





async function handleRequest(req, res) {
    // Mark job as applied
    if (req.method === 'POST' && req.url === '/api/mark-applied') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const { id } = JSON.parse(body || '{}');
        const db = new sqlite3.Database(path.join(__dirname, 'jobs.db'));
        db.run("UPDATE jobs SET applied = 1 WHERE id = ?", [id], function (err) {
          db.close();
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'db error' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      });
      return;
    }

  // Mark job as applied
  if (req.method === 'POST' && req.url === '/api/mark-applied') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { id } = JSON.parse(body || '{}');
      const db = new sqlite3.Database(path.join(__dirname, 'jobs.db'));
      db.run("UPDATE jobs SET applied = 1 WHERE id = ?", [id], function (err) {
        db.close();
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'db error' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // Smart scraper API
  if (req.method === 'POST' && req.url === '/api/start-scrape') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { searchTerm, sites = ['workday'] } = JSON.parse(body);
      
      const scraper = spawn('node', ['smart_scraper.js', searchTerm], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      scraper.stdout.on('data', (data) => {
        console.log(`Scraper: ${data}`);
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'started', pid: scraper.pid, searchTerm }));
    });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    await new Promise(resolve => req.on('end', resolve));
    
    const data = body ? JSON.parse(body) : {};
    
    try {
      // Get scraper live status and logs
      if (pathname === '/api/scraper-status' && req.method === 'GET') {
        const jobs = db.getAllJobs();
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        
        // Read last 50 lines from log file
        const logPath = path.join(__dirname, 'scrapers/scraper.log');
        let recentLogs = [];
        try {
          if (fs.existsSync(logPath)) {
            const logContent = fs.readFileSync(logPath, 'utf-8');
            const lines = logContent.split('\n').filter(l => l.trim());
            recentLogs = lines.slice(-50).map((line, idx) => ({
              time: Date.now() - ((50 - idx) * 1000),
              message: line
            }));
          }
        } catch (err) {
          console.error('Log read error:', err);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          running: scraperStats.running,
          paused: scraperStats.paused,
          roles: config.roles,
          totalJobs: jobs.length,
          newJobs: jobs.filter(j => j.status === 'new').length,
          enrichedJobs: jobs.filter(j => j.status === 'enriched').length,
          recentLogs: recentLogs
        }));
        return;
      }
      
      // Update search roles
      if (pathname === '/api/scraper/roles' && req.method === 'POST') {
        const { roles } = data;
        const config = { roles, enabled: true };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, roles }));
        return;
      }
      
      if (pathname === '/api/scraper/pause' && req.method === 'POST') {
        scraperStats.paused = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, paused: true }));
        return;
      }
      
      if (pathname === '/api/scraper/resume' && req.method === 'POST') {
        scraperStats.paused = false;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, paused: false }));
        return;
      }
      
      if (pathname === '/api/jobs' && req.method === 'GET') {
        const jobs = db.getAllJobs();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, jobs }));
        return;
      }

      if (pathname === '/api/jobs/clear' && req.method === 'DELETE') {
        const count = db.clearAllJobs();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deleted: count }));
        return;
      }

      const statusMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/status$/);
      if (statusMatch && req.method === 'PATCH') {
        const jobId = statusMatch[1];
        const updated = db.updateJobStatus(jobId, data.status);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: updated }));
        return;
      }
      
      // ========== RESUME ENDPOINTS ==========
      if (pathname === '/api/resumes' && req.method === 'GET') {
        const resumes = db.getResumes();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resumes));
        return;
      }

      if (pathname === '/api/resumes' && req.method === 'POST') {
        const { name, text, isDefault } = data;
        const id = db.addResume(name, text, isDefault);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
        return;
      }

      const resumeIdMatch = pathname.match(/^\/api\/resumes\/(\d+)$/);
      if (resumeIdMatch && req.method === 'PUT') {
        const id = parseInt(resumeIdMatch[1]);
        const { name, text, isDefault } = data;
        const success = db.updateResume(id, name, text, isDefault);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      if (resumeIdMatch && req.method === 'DELETE') {
        const id = parseInt(resumeIdMatch[1]);
        const success = db.deleteResume(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      if (pathname === '/api/resumes/default' && req.method === 'GET') {
        const resume = db.getDefaultResume();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resume || {}));
        return;
      }

      // ========== USER PROFILE ENDPOINTS ==========
      if (pathname === '/api/profile' && req.method === 'GET') {
        const profile = db.getUserProfile();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(profile || {}));
        return;
      }

      if (pathname === '/api/profile' && req.method === 'POST') {
        const success = db.saveUserProfile(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      // ========== WORK EXPERIENCE ENDPOINTS ==========
      if (pathname === '/api/work-experience' && req.method === 'GET') {
        const experiences = db.getWorkExperience();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(experiences));
        return;
      }

      if (pathname === '/api/work-experience' && req.method === 'POST') {
        const id = db.addWorkExperience(data);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
        return;
      }

      const workExpIdMatch = pathname.match(/^\/api\/work-experience\/(\d+)$/);
      if (workExpIdMatch && req.method === 'PUT') {
        const id = parseInt(workExpIdMatch[1]);
        const success = db.updateWorkExperience(id, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      if (workExpIdMatch && req.method === 'DELETE') {
        const id = parseInt(workExpIdMatch[1]);
        const success = db.deleteWorkExperience(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      // ========== EDUCATION ENDPOINTS ==========
      if (pathname === '/api/education' && req.method === 'GET') {
        const education = db.getEducation();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(education));
        return;
      }

      if (pathname === '/api/education' && req.method === 'POST') {
        const id = db.addEducation(data);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
        return;
      }

      const educationIdMatch = pathname.match(/^\/api\/education\/(\d+)$/);
      if (educationIdMatch && req.method === 'PUT') {
        const id = parseInt(educationIdMatch[1]);
        const success = db.updateEducation(id, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      if (educationIdMatch && req.method === 'DELETE') {
        const id = parseInt(educationIdMatch[1]);
        const success = db.deleteEducation(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      // ========== CERTIFICATIONS ENDPOINTS ==========
      if (pathname === '/api/certifications' && req.method === 'GET') {
        const certifications = db.getCertifications();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(certifications));
        return;
      }

      if (pathname === '/api/certifications' && req.method === 'POST') {
        const id = db.addCertification(data);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
        return;
      }

      const certIdMatch = pathname.match(/^\/api\/certifications\/(\d+)$/);
      if (certIdMatch && req.method === 'PUT') {
        const id = parseInt(certIdMatch[1]);
        const success = db.updateCertification(id, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      if (certIdMatch && req.method === 'DELETE') {
        const id = parseInt(certIdMatch[1]);
        const success = db.deleteCertification(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      // ========== LANGUAGES ENDPOINTS ==========
      if (pathname === '/api/languages' && req.method === 'GET') {
        const languages = db.getLanguages();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(languages));
        return;
      }

      if (pathname === '/api/languages' && req.method === 'POST') {
        const id = db.addLanguage(data);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
        return;
      }

      const langIdMatch = pathname.match(/^\/api\/languages\/(\d+)$/);
      if (langIdMatch && req.method === 'PUT') {
        const id = parseInt(langIdMatch[1]);
        const success = db.updateLanguage(id, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      if (langIdMatch && req.method === 'DELETE') {
        const id = parseInt(langIdMatch[1]);
        const success = db.deleteLanguage(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      // ========== SKILLS ENDPOINTS ==========
      if (pathname === '/api/skills' && req.method === 'GET') {
        const skills = db.getSkills();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(skills));
        return;
      }

      if (pathname === '/api/skills' && req.method === 'POST') {
        const id = db.addSkill(data);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
        return;
      }

      const skillIdMatch = pathname.match(/^\/api\/skills\/(\d+)$/);
      if (skillIdMatch && req.method === 'PUT') {
        const id = parseInt(skillIdMatch[1]);
        const success = db.updateSkill(id, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      if (skillIdMatch && req.method === 'DELETE') {
        const id = parseInt(skillIdMatch[1]);
        const success = db.deleteSkill(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      // ========== JOB MATCHES ENDPOINTS ==========
      if (pathname === '/api/job-matches' && req.method === 'POST') {
        const id = db.saveJobMatch(data);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id }));
        return;
      }

      const jobMatchesMatch = pathname.match(/^\/api\/job-matches\/(.+)$/);
      if (jobMatchesMatch && req.method === 'GET') {
        const jobId = jobMatchesMatch[1];
        const matches = db.getJobMatches(jobId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(matches));
        return;
      }

      // Shutdown endpoint
      if (pathname === '/api/shutdown' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Shutting down...' }));
        
        console.log('\n🛑 Shutdown requested from UI');
        
        // Stop background processes
        
        
        // Give response time to send, close processes gracefully, then exit
        setTimeout(async () => {
          console.log('👋 Career Assistant stopped');
          
          // Send SIGTERM to allow graceful cleanup
          if (scraperProcess) {
            scraperProcess.kill('SIGTERM');
          }
          if (enricherProcess) {
            enricherProcess.kill('SIGTERM');
          }
          
          // Wait for processes to clean up
          setTimeout(() => {
            process.exit(0);
          }, 2000);
        }, 500);
        return;
      }



    // Clear all jobs
    if (req.method === 'DELETE' && pathname === '/api/jobs') {
      db.run('DELETE FROM jobs', [], (err) => {
        if (err) {
          console.error('Error clearing jobs:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Failed to delete jobs' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API endpoint not found' }));
    } catch (err) {
      console.error('API error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const filePath = pathname === '/' ? path.join(FRONTEND_PATH, 'index.html') : path.join(FRONTEND_PATH, pathname);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}/`);
  console.log(`📊 Frontend: http://localhost:${PORT}/`);
  console.log(`🗄️  Database: ${path.join(__dirname, 'jobs.db')}`);
});

// Discovery scraper - run manually:
// node scrapers/discovery_scraper.js "business analyst"
let discoveryProc = null;

function stopDiscovery() {
  if (discoveryProc) {
    discoveryProc.kill('SIGTERM');
    discoveryProc = null;
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  stopDiscovery();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  stopDiscovery();
  process.exit(0);
});

// Process control endpoints

