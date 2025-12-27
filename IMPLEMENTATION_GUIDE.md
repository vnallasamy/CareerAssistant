# Remaining Implementation Guide

This document outlines the remaining features to be implemented for the Profile Management System.

## Phase 8: AI Skills Auto-Population

### Implementation Steps:
1. Add "Analyze Resume" button in Resumes tab
2. When clicked, send resume text to Ollama endpoint
3. Create prompt template for skill extraction:

```javascript
const SKILL_EXTRACTION_PROMPT = `
Analyze the following resume and extract skills. Categorize them into:
- Technical Skills
- Soft Skills  
- Tools/Software
- Languages (programming)
- Certifications

For each skill, suggest a proficiency level (Beginner, Intermediate, Advanced, Expert) based on context.

Resume:
${resumeText}

Return as JSON:
{
  "skills": [
    {"name": "Python", "category": "Technical Skills", "proficiency": "Advanced"},
    ...
  ]
}
`;
```

4. Display extracted skills in a modal for user review
5. Allow user to accept/reject individual skills or all at once
6. Save accepted skills to database

### Files to Modify:
- `frontend/profile.js` - Add analyze resume function
- Create `backend/ollama-service.js` - Ollama integration helper

## Phase 9: Performance Optimizations - Infinite Scroll

### Implementation Steps:
1. Modify `/api/jobs` endpoint to support pagination:
   - Add query params: `?page=1&limit=100`
   - Return: `{ jobs: [...], total: 18000, page: 1, hasMore: true }`

2. Update `frontend/app.js`:
   - Load only first 100 jobs initially
   - Add scroll event listener to detect bottom of page
   - Load next batch when scrolled to bottom
   - Maintain ALL jobs in memory for search/filter

3. Search/Filter logic:
   - ALWAYS filter against the complete dataset
   - After filtering, apply pagination to results
   - This ensures searches work on all 18k jobs, not just visible 100

### Code Pattern:
```javascript
let allJobsInDatabase = 18000; // Track total
let loadedJobs = []; // Currently loaded in UI
let page = 1;

async function loadMoreJobs() {
  const response = await fetch(`/api/jobs?page=${page}&limit=100`);
  const data = await response.json();
  loadedJobs.push(...data.jobs);
  page++;
  renderJobs(loadedJobs);
}

// Search must query backend with search term, not just filter loaded jobs
async function searchJobs(query) {
  const response = await fetch(`/api/jobs/search?q=${query}`);
  const results = await response.json();
  displayJobs(results); // Display all matches, paginate UI rendering
}
```

## Phase 10: AI Job-to-Resume Matching

### Implementation Steps:
1. Create match calculation service:

```javascript
// backend/match-service.js
async function calculateMatch(jobId, resumeId) {
  const job = await db.getJobById(jobId);
  const resume = await db.getResumeById(resumeId);
  const skills = await db.getSkills();
  
  const prompt = `
  Analyze this job description and candidate resume. Calculate match percentage.
  
  Job Description:
  ${job.description}
  
  Required Skills: ${job.mandatory_skills}
  Preferred Skills: ${job.preferred_skills}
  
  Candidate Resume:
  ${resume.text}
  
  Candidate Skills: ${skills.map(s => s.skill_name).join(', ')}
  
  Provide:
  1. Match percentage (0-100)
  2. Matching skills (JSON array)
  3. Missing skills (JSON array)
  4. Experience gap analysis
  5. 3-5 actionable recommendations
  
  Return as JSON.
  `;
  
  const response = await callOllama(prompt);
  return JSON.parse(response);
}
```

2. Add match badge to job cards:
   - Calculate matches in background for all jobs
   - Cache results in `job_matches` table
   - Display badge with color coding

3. Add match analysis section to job modal:
   - Show detailed breakdown
   - Recommend best resume
   - Display matching/missing skills
   - Show recommendations

### Files to Create/Modify:
- `backend/match-service.js`
- `backend/ollama-service.js`
- `frontend/app.js` - Update job card rendering
- `frontend/index.html` - Add match section to job modal

## Phase 11: Custom Resume Generation

### Installation:
```bash
cd backend
npm install docx
```

### Implementation Steps:
1. When user marks job as "Applied", trigger resume generation:

```javascript
async function generateCustomResume(jobId, resumeId) {
  const job = await db.getJobById(jobId);
  const resume = await db.getResumeById(resumeId);
  const profile = await db.getUserProfile();
  
  // AI customization prompt
  const prompt = `
  Customize this resume for the specific job posting.
  
  Job: ${job.title} at ${job.company}
  Job Description: ${job.description}
  
  Original Resume:
  ${resume.text}
  
  Instructions:
  1. Generate a tailored summary/objective (3-5 sentences)
  2. Rewrite experience bullet points to emphasize relevant skills
  3. Maintain chronological order of companies (DO NOT reorder)
  4. Highlight keywords from job description
  5. Return structured sections:
     - summary
     - experience (array of {company, role, dates, bullets})
     - skills (array, ordered by relevance)
  
  Return as JSON.
  `;
  
  const customized = await callOllama(prompt);
  return await generateDocx(customized, profile);
}
```

2. DOCX Generation:
```javascript
import { Document, Packer, Paragraph, TextRun } from 'docx';

async function generateDocx(content, profile) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header with name
        new Paragraph({
          children: [
            new TextRun({
              text: `${profile.legal_first_name} ${profile.legal_last_name}`,
              size: 48,
              bold: true
            })
          ],
          alignment: 'center'
        }),
        // Contact info
        new Paragraph({
          children: [
            new TextRun({
              text: `${profile.address_line1} | ${profile.phone} | ${profile.email}`,
              size: 20
            })
          ],
          alignment: 'center'
        }),
        // Profile section
        new Paragraph({
          children: [
            new TextRun({
              text: 'PROFILE',
              size: 24,
              bold: true
            })
          ]
        }),
        // ... continue with sections
      ]
    }]
  });
  
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
```

3. Download endpoint:
```javascript
// backend/server.js
if (pathname.startsWith('/api/generate-resume/') && req.method === 'POST') {
  const jobId = pathname.split('/')[3];
  const { resumeId } = data;
  
  const buffer = await generateCustomResume(jobId, resumeId);
  
  res.writeHead(200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="Resume_${jobId}_${Date.now()}.docx"`
  });
  res.end(buffer);
}
```

### Files to Create:
- `backend/resume-generator.js`
- `backend/ollama-service.js`

## Phase 12: Testing & Security

### Testing Checklist:
- [ ] Test profile save/load with all field types
- [ ] Test work experience CRUD operations
- [ ] Test resume management (create, edit, delete, set default)
- [ ] Test skills management in all categories
- [ ] Test search chips functionality
- [ ] Test country chips functionality
- [ ] Test clear filters button
- [ ] Add test jobs to database (100+)
- [ ] Test infinite scroll loading
- [ ] Test search across all jobs
- [ ] Test AI skills extraction with sample resume
- [ ] Test job matching with sample data
- [ ] Test resume generation and DOCX download
- [ ] Test on Mac and Windows
- [ ] Verify all forms validate correctly
- [ ] Check responsive design on mobile

### Security Review:
```bash
# Run CodeQL
npm install -g @github/codeql
codeql database create codeql-db --language=javascript
codeql database analyze codeql-db --format=sarif-latest --output=results.sarif
```

### Performance Testing:
- Load 18,000 jobs into database
- Test search/filter performance
- Monitor memory usage with infinite scroll
- Profile database query times
- Optimize slow queries with indexes (already added in Phase 1)

## Ollama Service Helper (Reusable)

Create `backend/ollama-service.js`:

```javascript
import axios from 'axios';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.2';

export async function callOllama(prompt, options = {}) {
  try {
    const response = await axios.post(OLLAMA_URL, {
      model: MODEL,
      prompt: prompt,
      stream: false,
      ...options
    });
    
    return response.data.response;
  } catch (error) {
    console.error('Ollama error:', error);
    throw new Error('AI service unavailable');
  }
}

export async function extractSkills(resumeText) {
  const prompt = `[Skill extraction prompt from Phase 8]`;
  const response = await callOllama(prompt);
  return JSON.parse(response);
}

export async function calculateJobMatch(job, resume, skills) {
  const prompt = `[Match calculation prompt from Phase 10]`;
  const response = await callOllama(prompt);
  return JSON.parse(response);
}

export async function customizeResume(job, resume) {
  const prompt = `[Resume customization prompt from Phase 11]`;
  const response = await callOllama(prompt);
  return JSON.parse(response);
}
```

## Notes

- All AI operations should have loading states (5-15 seconds)
- Implement error handling for Ollama failures
- Cache AI results to avoid redundant API calls
- Use environment variables for Ollama URL configuration
- Consider rate limiting for AI operations
- Add retry logic for failed Ollama requests

## Priority Order

If implementing incrementally:
1. Phase 9 (Performance) - Critical for usability with large datasets
2. Phase 10 (Job Matching) - High value feature
3. Phase 11 (Resume Generation) - Complex but high impact
4. Phase 8 (Skills Auto-population) - Nice to have, can be manual
5. Phase 12 (Testing) - Throughout all phases

## Estimated Effort

- Phase 8: 4-6 hours
- Phase 9: 3-4 hours
- Phase 10: 8-10 hours (most complex)
- Phase 11: 6-8 hours
- Phase 12: 4-6 hours testing

Total: 25-34 hours additional development
