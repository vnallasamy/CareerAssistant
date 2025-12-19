import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'jobs.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    description TEXT,
    source TEXT,
    status TEXT DEFAULT 'new',
    location TEXT,
    work_type TEXT,
    salary TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    experience_level TEXT,
    job_type TEXT,
    summary TEXT,
    mandatory_skills TEXT,
    preferred_skills TEXT,
    posted_date TEXT,
    webarchive_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export function addJob(job) {
  try {
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO jobs (id, title, company, url, description, source, salary, salary_min, salary_max, experience_level, job_type, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      job.title,
      job.company,
      job.url,
      job.description || '',
      job.source || 'Google Search',
      job.salary || null,
      job.salary_min || null,
      job.salary_max || null,
      job.experience_level || null,
      job.job_type || null,
      job.location || null
    );
    return true;
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return false;
    }
    console.error('Error adding job:', err);
    return false;
  }
}

export function getAllJobs() {
  const stmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
  const jobs = stmt.all();
  
  return jobs.map(job => ({
    ...job,
    mandatory_skills: job.mandatory_skills ? JSON.parse(job.mandatory_skills) : [],
    preferred_skills: job.preferred_skills ? JSON.parse(job.preferred_skills) : []
  }));
}

export function getJobsByFilters(filters = {}) {
  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];
  
  if (filters.location) {
    query += ' AND location LIKE ?';
    params.push(`%${filters.location}%`);
  }
  
  if (filters.experience_level) {
    query += ' AND experience_level = ?';
    params.push(filters.experience_level);
  }
  
  if (filters.job_type) {
    query += ' AND job_type = ?';
    params.push(filters.job_type);
  }
  
  if (filters.salary_min) {
    query += ' AND (salary_min IS NULL OR salary_min >= ?)';
    params.push(filters.salary_min);
  }
  
  if (filters.salary_max) {
    query += ' AND (salary_max IS NULL OR salary_max <= ?)';
    params.push(filters.salary_max);
  }
  
  if (filters.source) {
    query += ' AND source = ?';
    params.push(filters.source);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

export function getJobsByStatus(status) {
  const stmt = db.prepare('SELECT * FROM jobs WHERE status = ?');
  return stmt.all(status);
}

export function updateJobDetails(jobId, details) {
  try {
    const stmt = db.prepare(`
      UPDATE jobs 
      SET 
        location = ?,
        work_type = ?,
        salary = ?,
        salary_min = ?,
        salary_max = ?,
        experience_level = ?,
        job_type = ?,
        summary = ?,
        mandatory_skills = ?,
        preferred_skills = ?,
        posted_date = ?,
        webarchive_path = ?,
        status = 'scraped'
      WHERE id = ?
    `);
    
    stmt.run(
      details.location || null,
      details.work_type || null,
      details.salary || null,
      details.salary_min || null,
      details.salary_max || null,
      details.experience_level || null,
      details.job_type || null,
      details.summary || null,
      JSON.stringify(details.mandatory_skills || []),
      JSON.stringify(details.preferred_skills || []),
      details.posted_date || null,
      details.webarchive_path || null,
      jobId
    );
    
    return true;
  } catch (err) {
    console.error('Error updating job:', err);
    return false;
  }
}

export function updateJobStatus(jobId, status) {
  try {
    const stmt = db.prepare('UPDATE jobs SET status = ? WHERE id = ?');
    stmt.run(status, jobId);
    return true;
  } catch (err) {
    console.error('Error updating status:', err);
    return false;
  }
}

export function clearAllJobs() {
  const stmt = db.prepare('DELETE FROM jobs');
  const result = stmt.run();
  return result.changes;
}

// ============================================
// RESUME STORAGE FUNCTIONS
// ============================================

// Create resumes table
db.exec(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export function getResumes() {
  const stmt = db.prepare('SELECT * FROM resumes ORDER BY created_at DESC');
  return stmt.all();
}

export function addResume(name, text) {
  const stmt = db.prepare('INSERT INTO resumes (name, text) VALUES (?, ?)');
  const result = stmt.run(name, text);
  return result.lastInsertRowid;
}

export function getResumeById(id) {
  const stmt = db.prepare('SELECT * FROM resumes WHERE id = ?');
  return stmt.get(id);
}

export function deleteResume(id) {
  const stmt = db.prepare('DELETE FROM resumes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
