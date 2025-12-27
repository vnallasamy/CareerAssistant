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

// Create resumes table (updated with is_default and updated_at)
db.exec(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    is_default BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migrate existing resumes table if needed (add is_default and updated_at columns if they don't exist)
try {
  db.exec(`ALTER TABLE resumes ADD COLUMN is_default BOOLEAN DEFAULT 0`);
} catch (e) {
  // Column already exists, ignore
}
try {
  db.exec(`ALTER TABLE resumes ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
} catch (e) {
  // Column already exists, ignore
}

// Create user profile table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY,
    legal_first_name TEXT,
    legal_middle_name TEXT,
    legal_last_name TEXT,
    preferred_first_name TEXT,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip_code TEXT,
    birth_month INTEGER,
    birth_year INTEGER,
    gender TEXT,
    preferred_pronouns TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    authorized_countries TEXT,
    require_sponsorship TEXT,
    willing_to_relocate BOOLEAN,
    military_service BOOLEAN,
    military_country TEXT,
    is_veteran BOOLEAN,
    is_18_or_older BOOLEAN,
    felony_conviction BOOLEAN,
    race_ethnicity TEXT,
    has_disability BOOLEAN,
    disability_details TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    salary_expectation TEXT,
    current_salary TEXT,
    notice_period TEXT,
    start_date_availability TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create work experience table
db.exec(`
  CREATE TABLE IF NOT EXISTS work_experience (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    location TEXT,
    start_month INTEGER,
    start_year INTEGER,
    end_month INTEGER,
    end_year INTEGER,
    is_current BOOLEAN DEFAULT 0,
    responsibilities TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create education table
db.exec(`
  CREATE TABLE IF NOT EXISTS education (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    degree TEXT NOT NULL,
    institution TEXT NOT NULL,
    location TEXT,
    start_year INTEGER,
    end_year INTEGER,
    gpa TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create certifications table
db.exec(`
  CREATE TABLE IF NOT EXISTS certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certification_name TEXT NOT NULL,
    year_obtained INTEGER,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create languages table
db.exec(`
  CREATE TABLE IF NOT EXISTS languages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_name TEXT NOT NULL,
    proficiency_level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create skills table
db.exec(`
  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT NOT NULL,
    category TEXT NOT NULL,
    proficiency_level TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create job matches table (cache)
db.exec(`
  CREATE TABLE IF NOT EXISTS job_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    resume_id INTEGER,
    match_percentage INTEGER,
    matching_skills TEXT,
    missing_skills TEXT,
    experience_gap TEXT,
    recommendations TEXT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (resume_id) REFERENCES resumes(id)
  )
`);

// Create indexes for performance (only on columns that exist)
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(created_at);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
  CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
  CREATE INDEX IF NOT EXISTS idx_job_matches_job_id ON job_matches(job_id);
  CREATE INDEX IF NOT EXISTS idx_job_matches_resume_id ON job_matches(resume_id);
`);

export function getResumes() {
  const stmt = db.prepare('SELECT * FROM resumes ORDER BY created_at DESC');
  return stmt.all();
}

export function addResume(name, text, isDefault = false) {
  try {
    // If this resume is being set as default, unset all others first
    if (isDefault) {
      db.prepare('UPDATE resumes SET is_default = 0').run();
    }
    
    const stmt = db.prepare('INSERT INTO resumes (name, text, is_default, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)');
    const result = stmt.run(name, text, isDefault ? 1 : 0);
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Error adding resume:', err);
    throw err;
  }
}

export function updateResume(id, name, text, isDefault = false) {
  try {
    // If this resume is being set as default, unset all others first
    if (isDefault) {
      db.prepare('UPDATE resumes SET is_default = 0').run();
    }
    
    const stmt = db.prepare('UPDATE resumes SET name = ?, text = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const result = stmt.run(name, text, isDefault ? 1 : 0, id);
    return result.changes > 0;
  } catch (err) {
    console.error('Error updating resume:', err);
    throw err;
  }
}

export function getResumeById(id) {
  const stmt = db.prepare('SELECT * FROM resumes WHERE id = ?');
  return stmt.get(id);
}

export function getDefaultResume() {
  const stmt = db.prepare('SELECT * FROM resumes WHERE is_default = 1 LIMIT 1');
  return stmt.get();
}

export function deleteResume(id) {
  const stmt = db.prepare('DELETE FROM resumes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
// USER PROFILE FUNCTIONS
// ============================================

export function getUserProfile() {
  const stmt = db.prepare('SELECT * FROM user_profile WHERE id = 1');
  return stmt.get();
}

export function saveUserProfile(profile) {
  try {
    const existingProfile = getUserProfile();
    
    if (existingProfile) {
      // Update existing profile
      const stmt = db.prepare(`
        UPDATE user_profile SET
          legal_first_name = ?,
          legal_middle_name = ?,
          legal_last_name = ?,
          preferred_first_name = ?,
          email = ?,
          phone = ?,
          address_line1 = ?,
          address_line2 = ?,
          city = ?,
          state = ?,
          country = ?,
          zip_code = ?,
          birth_month = ?,
          birth_year = ?,
          gender = ?,
          preferred_pronouns = ?,
          linkedin_url = ?,
          github_url = ?,
          authorized_countries = ?,
          require_sponsorship = ?,
          willing_to_relocate = ?,
          military_service = ?,
          military_country = ?,
          is_veteran = ?,
          is_18_or_older = ?,
          felony_conviction = ?,
          race_ethnicity = ?,
          has_disability = ?,
          disability_details = ?,
          emergency_contact_name = ?,
          emergency_contact_phone = ?,
          emergency_contact_relationship = ?,
          salary_expectation = ?,
          current_salary = ?,
          notice_period = ?,
          start_date_availability = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);
      
      stmt.run(
        profile.legal_first_name || null,
        profile.legal_middle_name || null,
        profile.legal_last_name || null,
        profile.preferred_first_name || null,
        profile.email || null,
        profile.phone || null,
        profile.address_line1 || null,
        profile.address_line2 || null,
        profile.city || null,
        profile.state || null,
        profile.country || null,
        profile.zip_code || null,
        profile.birth_month || null,
        profile.birth_year || null,
        profile.gender || null,
        profile.preferred_pronouns || null,
        profile.linkedin_url || null,
        profile.github_url || null,
        profile.authorized_countries || null,
        profile.require_sponsorship || null,
        profile.willing_to_relocate || null,
        profile.military_service || null,
        profile.military_country || null,
        profile.is_veteran || null,
        profile.is_18_or_older || null,
        profile.felony_conviction || null,
        profile.race_ethnicity || null,
        profile.has_disability || null,
        profile.disability_details || null,
        profile.emergency_contact_name || null,
        profile.emergency_contact_phone || null,
        profile.emergency_contact_relationship || null,
        profile.salary_expectation || null,
        profile.current_salary || null,
        profile.notice_period || null,
        profile.start_date_availability || null
      );
    } else {
      // Insert new profile
      const stmt = db.prepare(`
        INSERT INTO user_profile (
          id, legal_first_name, legal_middle_name, legal_last_name, preferred_first_name,
          email, phone, address_line1, address_line2, city, state, country, zip_code,
          birth_month, birth_year, gender, preferred_pronouns, linkedin_url, github_url,
          authorized_countries, require_sponsorship, willing_to_relocate, military_service,
          military_country, is_veteran, is_18_or_older, felony_conviction, race_ethnicity,
          has_disability, disability_details, emergency_contact_name, emergency_contact_phone,
          emergency_contact_relationship, salary_expectation, current_salary, notice_period,
          start_date_availability
        ) VALUES (
          1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      stmt.run(
        profile.legal_first_name || null,
        profile.legal_middle_name || null,
        profile.legal_last_name || null,
        profile.preferred_first_name || null,
        profile.email || null,
        profile.phone || null,
        profile.address_line1 || null,
        profile.address_line2 || null,
        profile.city || null,
        profile.state || null,
        profile.country || null,
        profile.zip_code || null,
        profile.birth_month || null,
        profile.birth_year || null,
        profile.gender || null,
        profile.preferred_pronouns || null,
        profile.linkedin_url || null,
        profile.github_url || null,
        profile.authorized_countries || null,
        profile.require_sponsorship || null,
        profile.willing_to_relocate || null,
        profile.military_service || null,
        profile.military_country || null,
        profile.is_veteran || null,
        profile.is_18_or_older || null,
        profile.felony_conviction || null,
        profile.race_ethnicity || null,
        profile.has_disability || null,
        profile.disability_details || null,
        profile.emergency_contact_name || null,
        profile.emergency_contact_phone || null,
        profile.emergency_contact_relationship || null,
        profile.salary_expectation || null,
        profile.current_salary || null,
        profile.notice_period || null,
        profile.start_date_availability || null
      );
    }
    
    return true;
  } catch (err) {
    console.error('Error saving user profile:', err);
    throw err;
  }
}

// ============================================
// WORK EXPERIENCE FUNCTIONS
// ============================================

export function getWorkExperience() {
  const stmt = db.prepare('SELECT * FROM work_experience ORDER BY start_year DESC, start_month DESC');
  return stmt.all();
}

export function addWorkExperience(experience) {
  const stmt = db.prepare(`
    INSERT INTO work_experience (
      company_name, location, start_month, start_year, end_month, end_year,
      is_current, responsibilities
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    experience.company_name,
    experience.location || null,
    experience.start_month || null,
    experience.start_year || null,
    experience.end_month || null,
    experience.end_year || null,
    experience.is_current ? 1 : 0,
    experience.responsibilities || null
  );
  
  return result.lastInsertRowid;
}

export function updateWorkExperience(id, experience) {
  const stmt = db.prepare(`
    UPDATE work_experience SET
      company_name = ?,
      location = ?,
      start_month = ?,
      start_year = ?,
      end_month = ?,
      end_year = ?,
      is_current = ?,
      responsibilities = ?
    WHERE id = ?
  `);
  
  const result = stmt.run(
    experience.company_name,
    experience.location || null,
    experience.start_month || null,
    experience.start_year || null,
    experience.end_month || null,
    experience.end_year || null,
    experience.is_current ? 1 : 0,
    experience.responsibilities || null,
    id
  );
  
  return result.changes > 0;
}

export function deleteWorkExperience(id) {
  const stmt = db.prepare('DELETE FROM work_experience WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
// EDUCATION FUNCTIONS
// ============================================

export function getEducation() {
  const stmt = db.prepare('SELECT * FROM education ORDER BY end_year DESC');
  return stmt.all();
}

export function addEducation(education) {
  const stmt = db.prepare(`
    INSERT INTO education (degree, institution, location, start_year, end_year, gpa)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    education.degree,
    education.institution,
    education.location || null,
    education.start_year || null,
    education.end_year || null,
    education.gpa || null
  );
  
  return result.lastInsertRowid;
}

export function updateEducation(id, education) {
  const stmt = db.prepare(`
    UPDATE education SET
      degree = ?,
      institution = ?,
      location = ?,
      start_year = ?,
      end_year = ?,
      gpa = ?
    WHERE id = ?
  `);
  
  const result = stmt.run(
    education.degree,
    education.institution,
    education.location || null,
    education.start_year || null,
    education.end_year || null,
    education.gpa || null,
    id
  );
  
  return result.changes > 0;
}

export function deleteEducation(id) {
  const stmt = db.prepare('DELETE FROM education WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
// CERTIFICATIONS FUNCTIONS
// ============================================

export function getCertifications() {
  const stmt = db.prepare('SELECT * FROM certifications ORDER BY year_obtained DESC');
  return stmt.all();
}

export function addCertification(certification) {
  const stmt = db.prepare(`
    INSERT INTO certifications (certification_name, year_obtained, is_active)
    VALUES (?, ?, ?)
  `);
  
  const result = stmt.run(
    certification.certification_name,
    certification.year_obtained || null,
    certification.is_active ? 1 : 0
  );
  
  return result.lastInsertRowid;
}

export function updateCertification(id, certification) {
  const stmt = db.prepare(`
    UPDATE certifications SET
      certification_name = ?,
      year_obtained = ?,
      is_active = ?
    WHERE id = ?
  `);
  
  const result = stmt.run(
    certification.certification_name,
    certification.year_obtained || null,
    certification.is_active ? 1 : 0,
    id
  );
  
  return result.changes > 0;
}

export function deleteCertification(id) {
  const stmt = db.prepare('DELETE FROM certifications WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
// LANGUAGES FUNCTIONS
// ============================================

export function getLanguages() {
  const stmt = db.prepare('SELECT * FROM languages ORDER BY created_at DESC');
  return stmt.all();
}

export function addLanguage(language) {
  const stmt = db.prepare(`
    INSERT INTO languages (language_name, proficiency_level)
    VALUES (?, ?)
  `);
  
  const result = stmt.run(
    language.language_name,
    language.proficiency_level || null
  );
  
  return result.lastInsertRowid;
}

export function updateLanguage(id, language) {
  const stmt = db.prepare(`
    UPDATE languages SET
      language_name = ?,
      proficiency_level = ?
    WHERE id = ?
  `);
  
  const result = stmt.run(
    language.language_name,
    language.proficiency_level || null,
    id
  );
  
  return result.changes > 0;
}

export function deleteLanguage(id) {
  const stmt = db.prepare('DELETE FROM languages WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
// SKILLS FUNCTIONS
// ============================================

export function getSkills() {
  const stmt = db.prepare('SELECT * FROM skills ORDER BY category, skill_name');
  return stmt.all();
}

export function addSkill(skill) {
  const stmt = db.prepare(`
    INSERT INTO skills (skill_name, category, proficiency_level)
    VALUES (?, ?, ?)
  `);
  
  const result = stmt.run(
    skill.skill_name,
    skill.category,
    skill.proficiency_level
  );
  
  return result.lastInsertRowid;
}

export function updateSkill(id, skill) {
  const stmt = db.prepare(`
    UPDATE skills SET
      skill_name = ?,
      category = ?,
      proficiency_level = ?
    WHERE id = ?
  `);
  
  const result = stmt.run(
    skill.skill_name,
    skill.category,
    skill.proficiency_level,
    id
  );
  
  return result.changes > 0;
}

export function deleteSkill(id) {
  const stmt = db.prepare('DELETE FROM skills WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
// JOB MATCHES FUNCTIONS
// ============================================

export function getJobMatch(jobId, resumeId) {
  const stmt = db.prepare('SELECT * FROM job_matches WHERE job_id = ? AND resume_id = ? ORDER BY calculated_at DESC LIMIT 1');
  return stmt.get(jobId, resumeId);
}

export function saveJobMatch(match) {
  const stmt = db.prepare(`
    INSERT INTO job_matches (
      job_id, resume_id, match_percentage, matching_skills, missing_skills,
      experience_gap, recommendations
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    match.job_id,
    match.resume_id || null,
    match.match_percentage || null,
    match.matching_skills ? JSON.stringify(match.matching_skills) : null,
    match.missing_skills ? JSON.stringify(match.missing_skills) : null,
    match.experience_gap || null,
    match.recommendations ? JSON.stringify(match.recommendations) : null
  );
  
  return result.lastInsertRowid;
}

export function getJobMatches(jobId) {
  const stmt = db.prepare('SELECT * FROM job_matches WHERE job_id = ? ORDER BY match_percentage DESC');
  const matches = stmt.all(jobId);
  
  return matches.map(match => ({
    ...match,
    matching_skills: match.matching_skills ? JSON.parse(match.matching_skills) : [],
    missing_skills: match.missing_skills ? JSON.parse(match.missing_skills) : [],
    recommendations: match.recommendations ? JSON.parse(match.recommendations) : []
  }));
}

// ============================================
