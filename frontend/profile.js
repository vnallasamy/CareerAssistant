// ==================== CONFIGURATION ====================
const API_BASE = 'http://localhost:3000/api';

// ==================== STATE ====================
let currentTab = 'profile';
let profile = {};
let workExperiences = [];
let education = [];
let certifications = [];
let languages = [];
let resumes = [];
let skills = [];
let currentResumeId = null;

// ==================== TAB NAVIGATION ====================
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const navButtons = document.querySelectorAll('.profile-nav-btn');
    const tabs = document.querySelectorAll('.profile-tab');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Update active states
            navButtons.forEach(b => b.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            currentTab = tabName;
            loadTabContent(tabName);
        });
    });
    
    // Back button
    const backBtn = document.getElementById('backToJobsBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Load initial content
    loadTabContent('profile');
});

async function loadTabContent(tabName) {
    switch(tabName) {
        case 'profile':
        case 'application':
            await loadProfileTab();
            break;
        case 'resumes':
            await loadResumesTab();
            break;
        case 'skills':
            await loadSkillsTab();
            break;
    }
}

// ==================== PROFILE TAB ====================
async function loadProfileTab() {
    try {
        // Fetch all data
        const [profileRes, workExpRes, eduRes, certRes, langRes] = await Promise.all([
            fetch(`${API_BASE}/profile`),
            fetch(`${API_BASE}/work-experience`),
            fetch(`${API_BASE}/education`),
            fetch(`${API_BASE}/certifications`),
            fetch(`${API_BASE}/languages`)
        ]);
        
        profile = await profileRes.json() || {};
        workExperiences = await workExpRes.json() || [];
        education = await eduRes.json() || [];
        certifications = await certRes.json() || [];
        languages = await langRes.json() || [];
        
        renderProfileForm();
    } catch (err) {
        console.error('Error loading profile:', err);
        showMessage('Error loading profile data', 'error');
    }
}

function renderProfileForm() {
    const container = currentTab === 'profile' 
        ? document.getElementById('profileContent')
        : document.getElementById('applicationContent');
    
    container.innerHTML = `
        <form id="profileForm">
            <!-- Personal Information -->
            <div class="form-section">
                <h3 class="form-section-title">Personal Information</h3>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Legal First Name *</label>
                        <input type="text" name="legal_first_name" value="${profile.legal_first_name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Legal Middle Name</label>
                        <input type="text" name="legal_middle_name" value="${profile.legal_middle_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Legal Last Name *</label>
                        <input type="text" name="legal_last_name" value="${profile.legal_last_name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Preferred First Name</label>
                        <input type="text" name="preferred_first_name" value="${profile.preferred_first_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Email *</label>
                        <input type="email" name="email" value="${profile.email || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Phone Number *</label>
                        <input type="tel" name="phone" value="${profile.phone || ''}" required>
                    </div>
                </div>
                
                <div class="form-grid" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Address Line 1</label>
                        <input type="text" name="address_line1" value="${profile.address_line1 || ''}">
                    </div>
                    <div class="form-group">
                        <label>Address Line 2</label>
                        <input type="text" name="address_line2" value="${profile.address_line2 || ''}">
                    </div>
                    <div class="form-group">
                        <label>City</label>
                        <input type="text" name="city" value="${profile.city || ''}">
                    </div>
                    <div class="form-group">
                        <label>State/Province</label>
                        <input type="text" name="state" value="${profile.state || ''}">
                    </div>
                    <div class="form-group">
                        <label>Country</label>
                        <input type="text" name="country" value="${profile.country || ''}">
                    </div>
                    <div class="form-group">
                        <label>Zip/Postal Code</label>
                        <input type="text" name="zip_code" value="${profile.zip_code || ''}">
                    </div>
                </div>
                
                <div class="form-grid" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Birth Month</label>
                        <select name="birth_month">
                            <option value="">Select month</option>
                            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                                `<option value="${m}" ${profile.birth_month == m ? 'selected' : ''}>${new Date(2000, m-1).toLocaleString('en', {month: 'long'})}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Birth Year</label>
                        <input type="number" name="birth_year" value="${profile.birth_year || ''}" min="1920" max="2010">
                    </div>
                    <div class="form-group">
                        <label>Gender</label>
                        <select name="gender">
                            <option value="">Prefer not to say</option>
                            <option value="male" ${profile.gender === 'male' ? 'selected' : ''}>Male</option>
                            <option value="female" ${profile.gender === 'female' ? 'selected' : ''}>Female</option>
                            <option value="non-binary" ${profile.gender === 'non-binary' ? 'selected' : ''}>Non-binary</option>
                            <option value="other" ${profile.gender === 'other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Preferred Pronouns</label>
                        <select name="preferred_pronouns">
                            <option value="">Prefer not to say</option>
                            <option value="he/him" ${profile.preferred_pronouns === 'he/him' ? 'selected' : ''}>He/Him</option>
                            <option value="she/her" ${profile.preferred_pronouns === 'she/her' ? 'selected' : ''}>She/Her</option>
                            <option value="they/them" ${profile.preferred_pronouns === 'they/them' ? 'selected' : ''}>They/Them</option>
                            <option value="other" ${profile.preferred_pronouns === 'other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Professional Links -->
            <div class="form-section">
                <h3 class="form-section-title">Professional Links</h3>
                <div class="form-grid">
                    <div class="form-group">
                        <label>LinkedIn Profile URL</label>
                        <input type="url" name="linkedin_url" value="${profile.linkedin_url || ''}" placeholder="https://linkedin.com/in/yourprofile">
                    </div>
                    <div class="form-group">
                        <label>GitHub/Portfolio URL</label>
                        <input type="url" name="github_url" value="${profile.github_url || ''}" placeholder="https://github.com/yourusername">
                    </div>
                </div>
            </div>
            
            <!-- Work Experience -->
            <div class="form-section">
                <h3 class="form-section-title">Work Experience</h3>
                <div id="workExperienceList">${renderWorkExperiences()}</div>
                <button type="button" class="btn-add" onclick="addWorkExperience()">+ Add Work Experience</button>
            </div>
            
            <!-- Education -->
            <div class="form-section">
                <h3 class="form-section-title">Education</h3>
                <div id="educationList">${renderEducation()}</div>
                <button type="button" class="btn-add" onclick="addEducation()">+ Add Education</button>
            </div>
            
            <!-- Certifications -->
            <div class="form-section">
                <h3 class="form-section-title">Certifications</h3>
                <div id="certificationsList">${renderCertifications()}</div>
                <button type="button" class="btn-add" onclick="addCertification()">+ Add Certification</button>
            </div>
            
            <!-- Languages -->
            <div class="form-section">
                <h3 class="form-section-title">Languages</h3>
                <div id="languagesList">${renderLanguages()}</div>
                <button type="button" class="btn-add" onclick="addLanguage()">+ Add Language</button>
            </div>
            
            <!-- Additional Questions -->
            <div class="form-section">
                <h3 class="form-section-title">Additional Questions</h3>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Would you consider relocating?</label>
                        <select name="willing_to_relocate">
                            <option value="">Prefer not to say</option>
                            <option value="1" ${profile.willing_to_relocate ? 'selected' : ''}>Yes</option>
                            <option value="0" ${profile.willing_to_relocate === false ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Are you 18 years or older?</label>
                        <select name="is_18_or_older">
                            <option value="">Prefer not to say</option>
                            <option value="1" ${profile.is_18_or_older ? 'selected' : ''}>Yes</option>
                            <option value="0" ${profile.is_18_or_older === false ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Military service?</label>
                        <select name="military_service">
                            <option value="">Prefer not to say</option>
                            <option value="1" ${profile.military_service ? 'selected' : ''}>Yes</option>
                            <option value="0" ${profile.military_service === false ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Are you a veteran?</label>
                        <select name="is_veteran">
                            <option value="">Prefer not to say</option>
                            <option value="1" ${profile.is_veteran ? 'selected' : ''}>Yes</option>
                            <option value="0" ${profile.is_veteran === false ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-grid single" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Salary Expectations</label>
                        <input type="text" name="salary_expectation" value="${profile.salary_expectation || ''}" placeholder="e.g., $80,000 - $100,000">
                    </div>
                    <div class="form-group">
                        <label>Notice Period (if currently employed)</label>
                        <input type="text" name="notice_period" value="${profile.notice_period || ''}" placeholder="e.g., 2 weeks">
                    </div>
                </div>
            </div>
            
            <!-- Save Button -->
            <div class="profile-actions">
                <button type="submit" class="btn-primary">Save Profile</button>
                <button type="button" class="btn-secondary" onclick="loadProfileTab()">Reset</button>
            </div>
        </form>
    `;
    
    // Attach form submit handler
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
}

function renderWorkExperiences() {
    if (workExperiences.length === 0) return '<p style="color:#6b7280;font-size:14px;">No work experience added yet.</p>';
    
    return workExperiences.map((exp, idx) => `
        <div class="repeatable-section" data-id="${exp.id}">
            <div class="repeatable-section-header">
                <h4 class="repeatable-section-title">${exp.company_name || 'New Experience'}</h4>
                <button type="button" class="btn-remove" onclick="removeWorkExperience(${exp.id})">Remove</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Company Name *</label>
                    <input type="text" name="work_company_${exp.id}" value="${exp.company_name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" name="work_location_${exp.id}" value="${exp.location || ''}">
                </div>
                <div class="form-group">
                    <label>Start Month</label>
                    <select name="work_start_month_${exp.id}">
                        <option value="">Select</option>
                        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                            `<option value="${m}" ${exp.start_month == m ? 'selected' : ''}>${new Date(2000, m-1).toLocaleString('en', {month: 'long'})}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Start Year</label>
                    <input type="number" name="work_start_year_${exp.id}" value="${exp.start_year || ''}" min="1950" max="2030">
                </div>
                <div class="form-group">
                    <label>End Month</label>
                    <select name="work_end_month_${exp.id}" ${exp.is_current ? 'disabled' : ''}>
                        <option value="">Select</option>
                        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                            `<option value="${m}" ${exp.end_month == m ? 'selected' : ''}>${new Date(2000, m-1).toLocaleString('en', {month: 'long'})}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>End Year (or check "Current")</label>
                    <input type="number" name="work_end_year_${exp.id}" value="${exp.end_year || ''}" min="1950" max="2030" ${exp.is_current ? 'disabled' : ''}>
                </div>
            </div>
            <div class="form-group" style="margin-top:12px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                    <input type="checkbox" name="work_is_current_${exp.id}" ${exp.is_current ? 'checked' : ''} onchange="toggleCurrentJob(${exp.id})">
                    <span>I currently work here</span>
                </label>
            </div>
            <div class="form-group" style="margin-top:12px;">
                <label>Responsibilities</label>
                <textarea name="work_responsibilities_${exp.id}">${exp.responsibilities || ''}</textarea>
            </div>
        </div>
    `).join('');
}

function renderEducation() {
    if (education.length === 0) return '<p style="color:#6b7280;font-size:14px;">No education added yet.</p>';
    
    return education.map(edu => `
        <div class="repeatable-section" data-id="${edu.id}">
            <div class="repeatable-section-header">
                <h4 class="repeatable-section-title">${edu.degree || 'New Education'}</h4>
                <button type="button" class="btn-remove" onclick="removeEducation(${edu.id})">Remove</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Degree *</label>
                    <input type="text" name="edu_degree_${edu.id}" value="${edu.degree || ''}" required>
                </div>
                <div class="form-group">
                    <label>Institution *</label>
                    <input type="text" name="edu_institution_${edu.id}" value="${edu.institution || ''}" required>
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" name="edu_location_${edu.id}" value="${edu.location || ''}">
                </div>
                <div class="form-group">
                    <label>Start Year</label>
                    <input type="number" name="edu_start_year_${edu.id}" value="${edu.start_year || ''}" min="1950" max="2030">
                </div>
                <div class="form-group">
                    <label>End Year</label>
                    <input type="number" name="edu_end_year_${edu.id}" value="${edu.end_year || ''}" min="1950" max="2030">
                </div>
                <div class="form-group">
                    <label>GPA</label>
                    <input type="text" name="edu_gpa_${edu.id}" value="${edu.gpa || ''}" placeholder="e.g., 3.8/4.0">
                </div>
            </div>
        </div>
    `).join('');
}

function renderCertifications() {
    if (certifications.length === 0) return '<p style="color:#6b7280;font-size:14px;">No certifications added yet.</p>';
    
    return certifications.map(cert => `
        <div class="repeatable-section" data-id="${cert.id}">
            <div class="repeatable-section-header">
                <h4 class="repeatable-section-title">${cert.certification_name || 'New Certification'}</h4>
                <button type="button" class="btn-remove" onclick="removeCertification(${cert.id})">Remove</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Certification Name *</label>
                    <input type="text" name="cert_name_${cert.id}" value="${cert.certification_name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Year Obtained</label>
                    <input type="number" name="cert_year_${cert.id}" value="${cert.year_obtained || ''}" min="1950" max="2030">
                </div>
                <div class="form-group">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" name="cert_active_${cert.id}" ${cert.is_active ? 'checked' : ''}>
                        <span>Currently Active</span>
                    </label>
                </div>
            </div>
        </div>
    `).join('');
}

function renderLanguages() {
    if (languages.length === 0) return '<p style="color:#6b7280;font-size:14px;">No languages added yet.</p>';
    
    return languages.map(lang => `
        <div class="repeatable-section" data-id="${lang.id}">
            <div class="repeatable-section-header">
                <h4 class="repeatable-section-title">${lang.language_name || 'New Language'}</h4>
                <button type="button" class="btn-remove" onclick="removeLanguage(${lang.id})">Remove</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Language *</label>
                    <input type="text" name="lang_name_${lang.id}" value="${lang.language_name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Proficiency Level</label>
                    <select name="lang_proficiency_${lang.id}">
                        <option value="">Select</option>
                        <option value="Elementary" ${lang.proficiency_level === 'Elementary' ? 'selected' : ''}>Elementary</option>
                        <option value="Limited Working" ${lang.proficiency_level === 'Limited Working' ? 'selected' : ''}>Limited Working</option>
                        <option value="Professional Working" ${lang.proficiency_level === 'Professional Working' ? 'selected' : ''}>Professional Working</option>
                        <option value="Full Professional" ${lang.proficiency_level === 'Full Professional' ? 'selected' : ''}>Full Professional</option>
                        <option value="Native" ${lang.proficiency_level === 'Native' ? 'selected' : ''}>Native</option>
                    </select>
                </div>
            </div>
        </div>
    `).join('');
}

// Add/Remove functions
window.addWorkExperience = function() {
    const newId = Date.now();
    workExperiences.push({
        id: newId,
        company_name: '',
        location: '',
        start_month: null,
        start_year: null,
        end_month: null,
        end_year: null,
        is_current: false,
        responsibilities: ''
    });
    renderProfileForm();
};

window.removeWorkExperience = async function(id) {
    if (!confirm('Are you sure you want to remove this work experience?')) return;
    
    try {
        if (id < Date.now() - 100000) { // Existing record
            await fetch(`${API_BASE}/work-experience/${id}`, { method: 'DELETE' });
        }
        workExperiences = workExperiences.filter(exp => exp.id !== id);
        renderProfileForm();
        showMessage('Work experience removed', 'success');
    } catch (err) {
        console.error('Error removing work experience:', err);
        showMessage('Error removing work experience', 'error');
    }
};

window.addEducation = function() {
    const newId = Date.now();
    education.push({
        id: newId,
        degree: '',
        institution: '',
        location: '',
        start_year: null,
        end_year: null,
        gpa: ''
    });
    renderProfileForm();
};

window.removeEducation = async function(id) {
    if (!confirm('Are you sure you want to remove this education?')) return;
    
    try {
        if (id < Date.now() - 100000) {
            await fetch(`${API_BASE}/education/${id}`, { method: 'DELETE' });
        }
        education = education.filter(edu => edu.id !== id);
        renderProfileForm();
        showMessage('Education removed', 'success');
    } catch (err) {
        console.error('Error removing education:', err);
        showMessage('Error removing education', 'error');
    }
};

window.addCertification = function() {
    const newId = Date.now();
    certifications.push({
        id: newId,
        certification_name: '',
        year_obtained: null,
        is_active: true
    });
    renderProfileForm();
};

window.removeCertification = async function(id) {
    if (!confirm('Are you sure you want to remove this certification?')) return;
    
    try {
        if (id < Date.now() - 100000) {
            await fetch(`${API_BASE}/certifications/${id}`, { method: 'DELETE' });
        }
        certifications = certifications.filter(cert => cert.id !== id);
        renderProfileForm();
        showMessage('Certification removed', 'success');
    } catch (err) {
        console.error('Error removing certification:', err);
        showMessage('Error removing certification', 'error');
    }
};

window.addLanguage = function() {
    const newId = Date.now();
    languages.push({
        id: newId,
        language_name: '',
        proficiency_level: ''
    });
    renderProfileForm();
};

window.removeLanguage = async function(id) {
    if (!confirm('Are you sure you want to remove this language?')) return;
    
    try {
        if (id < Date.now() - 100000) {
            await fetch(`${API_BASE}/languages/${id}`, { method: 'DELETE' });
        }
        languages = languages.filter(lang => lang.id !== id);
        renderProfileForm();
        showMessage('Language removed', 'success');
    } catch (err) {
        console.error('Error removing language:', err);
        showMessage('Error removing language', 'error');
    }
};

window.toggleCurrentJob = function(id) {
    const checkbox = document.querySelector(`input[name="work_is_current_${id}"]`);
    const endMonth = document.querySelector(`select[name="work_end_month_${id}"]`);
    const endYear = document.querySelector(`input[name="work_end_year_${id}"]`);
    
    if (checkbox.checked) {
        endMonth.disabled = true;
        endYear.disabled = true;
        endMonth.value = '';
        endYear.value = '';
    } else {
        endMonth.disabled = false;
        endYear.disabled = false;
    }
};

// Save Profile
async function saveProfile(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const profileData = {};
        
        // Extract basic profile fields
        for (let [key, value] of formData.entries()) {
            if (!key.includes('_')) {
                profileData[key] = value || null;
            }
        }
        
        // Save main profile
        await fetch(`${API_BASE}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });
        
        // Save work experiences
        for (const exp of workExperiences) {
            const expData = {
                company_name: formData.get(`work_company_${exp.id}`),
                location: formData.get(`work_location_${exp.id}`),
                start_month: formData.get(`work_start_month_${exp.id}`) || null,
                start_year: formData.get(`work_start_year_${exp.id}`) || null,
                end_month: formData.get(`work_end_month_${exp.id}`) || null,
                end_year: formData.get(`work_end_year_${exp.id}`) || null,
                is_current: formData.get(`work_is_current_${exp.id}`) ? true : false,
                responsibilities: formData.get(`work_responsibilities_${exp.id}`)
            };
            
            if (exp.id < Date.now() - 100000) {
                await fetch(`${API_BASE}/work-experience/${exp.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(expData)
                });
            } else {
                await fetch(`${API_BASE}/work-experience`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(expData)
                });
            }
        }
        
        // Save education
        for (const edu of education) {
            const eduData = {
                degree: formData.get(`edu_degree_${edu.id}`),
                institution: formData.get(`edu_institution_${edu.id}`),
                location: formData.get(`edu_location_${edu.id}`),
                start_year: formData.get(`edu_start_year_${edu.id}`) || null,
                end_year: formData.get(`edu_end_year_${edu.id}`) || null,
                gpa: formData.get(`edu_gpa_${edu.id}`)
            };
            
            if (edu.id < Date.now() - 100000) {
                await fetch(`${API_BASE}/education/${edu.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(eduData)
                });
            } else {
                await fetch(`${API_BASE}/education`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(eduData)
                });
            }
        }
        
        // Save certifications
        for (const cert of certifications) {
            const certData = {
                certification_name: formData.get(`cert_name_${cert.id}`),
                year_obtained: formData.get(`cert_year_${cert.id}`) || null,
                is_active: formData.get(`cert_active_${cert.id}`) ? true : false
            };
            
            if (cert.id < Date.now() - 100000) {
                await fetch(`${API_BASE}/certifications/${cert.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(certData)
                });
            } else {
                await fetch(`${API_BASE}/certifications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(certData)
                });
            }
        }
        
        // Save languages
        for (const lang of languages) {
            const langData = {
                language_name: formData.get(`lang_name_${lang.id}`),
                proficiency_level: formData.get(`lang_proficiency_${lang.id}`)
            };
            
            if (lang.id < Date.now() - 100000) {
                await fetch(`${API_BASE}/languages/${lang.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(langData)
                });
            } else {
                await fetch(`${API_BASE}/languages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(langData)
                });
            }
        }
        
        showMessage('Profile saved successfully!', 'success');
        await loadProfileTab();
    } catch (err) {
        console.error('Error saving profile:', err);
        showMessage('Error saving profile', 'error');
    }
}

// ==================== RESUMES TAB ====================
async function loadResumesTab() {
    try {
        const response = await fetch(`${API_BASE}/resumes`);
        resumes = await response.json() || [];
        renderResumesTab();
    } catch (err) {
        console.error('Error loading resumes:', err);
        showMessage('Error loading resumes', 'error');
    }
}

function renderResumesTab() {
    const container = document.getElementById('resumesContent');
    
    container.innerHTML = `
        <div class="resume-note">
            <strong>Note:</strong> For easier navigation and selection, we recommend keeping a manageable number of resume versions rather than hundreds.
        </div>
        
        <div class="resume-tabs">
            ${resumes.map((resume, idx) => `
                <button class="resume-tab ${currentResumeId === resume.id ? 'active' : ''}" onclick="selectResume(${resume.id})">
                    ${resume.name}
                    ${resume.is_default ? '<span class="default-badge">Default</span>' : ''}
                </button>
            `).join('')}
            <button class="resume-tab" onclick="createNewResume()" style="background:#E67548;color:white;">+ Add New Resume</button>
        </div>
        
        <div id="resumeFormContainer">
            ${currentResumeId ? renderResumeForm() : '<p style="color:#6b7280;text-align:center;padding:40px;">Select a resume to edit or create a new one.</p>'}
        </div>
    `;
}

function renderResumeForm() {
    const resume = resumes.find(r => r.id === currentResumeId);
    if (!resume) return '';
    
    return `
        <form id="resumeForm" class="resume-form">
            <div class="form-group">
                <label>Resume Name *</label>
                <input type="text" name="name" value="${resume.name}" required placeholder="e.g., Technical Resume, Banking Resume">
            </div>
            
            <div class="form-group">
                <label>Resume Content *</label>
                <textarea name="text" class="resume-textarea" required placeholder="Paste your resume content here...">${resume.text || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                    <input type="checkbox" name="isDefault" ${resume.is_default ? 'checked' : ''}>
                    <span>Mark as Default Resume</span>
                </label>
            </div>
            
            <div class="profile-actions">
                <button type="submit" class="btn-primary">Save Resume</button>
                <button type="button" class="btn-secondary" onclick="deleteResume(${resume.id})">Delete Resume</button>
            </div>
        </form>
    `;
}

window.selectResume = function(id) {
    currentResumeId = id;
    renderResumesTab();
    
    // Attach form handler
    const form = document.getElementById('resumeForm');
    if (form) {
        form.addEventListener('submit', saveResume);
    }
};

window.createNewResume = async function() {
    const name = prompt('Enter a name for the new resume:');
    if (!name) return;
    
    try {
        const response = await fetch(`${API_BASE}/resumes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, text: '', isDefault: false })
        });
        
        const data = await response.json();
        await loadResumesTab();
        selectResume(data.id);
        showMessage('Resume created successfully!', 'success');
    } catch (err) {
        console.error('Error creating resume:', err);
        showMessage('Error creating resume', 'error');
    }
};

async function saveResume(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const resumeData = {
            name: formData.get('name'),
            text: formData.get('text'),
            isDefault: formData.get('isDefault') ? true : false
        };
        
        await fetch(`${API_BASE}/resumes/${currentResumeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resumeData)
        });
        
        showMessage('Resume saved successfully!', 'success');
        await loadResumesTab();
        selectResume(currentResumeId);
    } catch (err) {
        console.error('Error saving resume:', err);
        showMessage('Error saving resume', 'error');
    }
}

window.deleteResume = async function(id) {
    if (!confirm('Are you sure you want to delete this resume? This action cannot be undone.')) return;
    
    try {
        await fetch(`${API_BASE}/resumes/${id}`, { method: 'DELETE' });
        currentResumeId = null;
        await loadResumesTab();
        showMessage('Resume deleted successfully', 'success');
    } catch (err) {
        console.error('Error deleting resume:', err);
        showMessage('Error deleting resume', 'error');
    }
};

// ==================== SKILLS TAB ====================
async function loadSkillsTab() {
    try {
        const response = await fetch(`${API_BASE}/skills`);
        skills = await response.json() || [];
        renderSkillsTab();
    } catch (err) {
        console.error('Error loading skills:', err);
        showMessage('Error loading skills', 'error');
    }
}

function renderSkillsTab() {
    const container = document.getElementById('skillsContent');
    
    const categories = {
        'Technical Skills': skills.filter(s => s.category === 'Technical Skills'),
        'Soft Skills': skills.filter(s => s.category === 'Soft Skills'),
        'Tools/Software': skills.filter(s => s.category === 'Tools/Software'),
        'Languages': skills.filter(s => s.category === 'Languages'),
        'Certifications': skills.filter(s => s.category === 'Certifications')
    };
    
    container.innerHTML = Object.entries(categories).map(([category, categorySkills]) => `
        <div class="skills-category">
            <div class="skills-category-header">
                <h3 class="skills-category-title">${category}</h3>
            </div>
            <div class="skills-list">
                ${categorySkills.map(skill => `
                    <div class="skill-chip">
                        <span class="skill-chip-name">${skill.skill_name}</span>
                        <span class="skill-chip-level">${skill.proficiency_level}</span>
                        <button class="skill-chip-remove" onclick="deleteSkill(${skill.id})">×</button>
                    </div>
                `).join('') || '<span style="color:#6b7280;font-size:14px;">No skills in this category yet</span>'}
            </div>
            <div class="skill-input-container">
                <input type="text" placeholder="Skill name" id="skillName_${category.replace(/\//g, '_').replace(/ /g, '_')}">
                <select id="skillLevel_${category.replace(/\//g, '_').replace(/ /g, '_')}">
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                </select>
                <button onclick="addSkill('${category}')">Add</button>
            </div>
        </div>
    `).join('');
}

window.addSkill = async function(category) {
    const catKey = category.replace(/\//g, '_').replace(/ /g, '_');
    const skillName = document.getElementById(`skillName_${catKey}`).value.trim();
    const proficiency = document.getElementById(`skillLevel_${catKey}`).value;
    
    if (!skillName) {
        showMessage('Please enter a skill name', 'error');
        return;
    }
    
    try {
        await fetch(`${API_BASE}/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                skill_name: skillName,
                category: category,
                proficiency_level: proficiency
            })
        });
        
        showMessage('Skill added successfully!', 'success');
        await loadSkillsTab();
    } catch (err) {
        console.error('Error adding skill:', err);
        showMessage('Error adding skill', 'error');
    }
};

window.deleteSkill = async function(id) {
    if (!confirm('Are you sure you want to delete this skill?')) return;
    
    try {
        await fetch(`${API_BASE}/skills/${id}`, { method: 'DELETE' });
        showMessage('Skill deleted successfully', 'success');
        await loadSkillsTab();
    } catch (err) {
        console.error('Error deleting skill:', err);
        showMessage('Error deleting skill', 'error');
    }
};

// ==================== UTILITY FUNCTIONS ====================
function showMessage(message, type = 'success') {
    const container = document.querySelector('.profile-content');
    const existing = container.querySelector('.status-message');
    if (existing) existing.remove();
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `status-message ${type}`;
    msgDiv.textContent = message;
    
    container.insertBefore(msgDiv, container.firstChild);
    
    setTimeout(() => msgDiv.remove(), 5000);
}
