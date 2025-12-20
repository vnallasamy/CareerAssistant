// ==================== CONFIGURATION ====================
const API_BASE = 'http://localhost:3000/api';

// ==================== STATE ====================
let allJobs = [];
let filteredJobs = [];
let searchQuery = '';
let selectedCountry = '';
let selectedCountries = [];


// ==================== DOM ELEMENTS ====================
const filterToggle = document.getElementById('filterToggle');
const sidePanel = document.getElementById('sidePanel');
const mainContent = document.getElementById('mainContent');
const jobsList = document.getElementById('jobsList');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const countryFilter = document.getElementById('countryFilter');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const manageResumesBtn = document.getElementById('manageResumesBtn');
const resumeManagerModal = document.getElementById('resumeManagerModal');
const closeResume = document.querySelector('.close-resume');

const monitorBtn = document.getElementById('monitorBtn');
const monitorModal = document.getElementById('monitorModal');
const closeMonitor = document.querySelector('.close-monitor');
const searchRolesBtn = document.getElementById('searchRolesBtn');
const searchRolesModal = document.getElementById('searchRolesModal');
const closeRoles = document.querySelector('.close-roles');
const saveRolesBtn = document.getElementById('saveRolesBtn');
const cancelRolesBtn = document.getElementById('cancelRolesBtn');
const rolesInput = document.getElementById('rolesInput');

const searchInput = document.getElementById('jobSearchInput');

let monitorInterval = null;

// ==================== JOB DETAIL MODAL HELPERS ====================
const jobDetailModal = document.getElementById('jobDetailModal');
const jobDetailTitleEl = document.getElementById('jobDetailTitle');
const jobDetailSubTitleEl = document.getElementById('jobDetailSubTitle');
const jobDetailBodyEl = document.getElementById('jobDetailBody');
const jobDetailCloseEl = document.querySelector('.job-detail-close');

function renderJobField(label, value) {
    const safe = (value === null || value === undefined || value === '')
        ? '<span class="job-field-value empty">No data</span>'
        : '<span class="job-field-value">' + String(value) + '</span>';

    return (
        '<div class="job-field">' +
          '<div class="job-field-label">' + label + '</div>' +
          safe +
        '</div>'
    );
}

function openJobDetail(job) {
    if (!jobDetailModal || !jobDetailTitleEl || !jobDetailBodyEl) return;

    // Title + subtitle
    jobDetailTitleEl.textContent = job.title || 'Job details';
    const subtitleParts = [];
    if (job.company) subtitleParts.push(job.company);
    if (job.location) subtitleParts.push(job.location);
    if (Array.isArray(job.sources) && job.sources.length) {
        subtitleParts.push('Source: ' + job.sources.join(', '));
    } else if (job.source) {
        subtitleParts.push('Source: ' + job.source);
    }
    if (jobDetailSubTitleEl) {
        jobDetailSubTitleEl.textContent = subtitleParts.join(' · ');
    }

    // Body: show all key fields, even if empty
    const fields = [
        ['Company', job.company],
        ['Location', job.location],
        ['Status', job.status],
        ['Salary', job.salary],
        ['Posted Date', job.postedDate || job.posteddate],
        ['Visa Requirement', job.requiresCitizenship || job.requirescitizenship],
        ['No Visa Sponsorship', job.noVisaSponsorship || job.novisasponsorship],
        ['Job URL', job.url],
        ['Summary', job.summary],
        ['Raw ID', job.id],
    ];

    let html = '';
    fields.forEach(([label, value]) => {
        html += renderJobField(label, value);
    });

    // Raw JSON dump at the end
    html += '<div class="job-field">' +
              '<div class="job-field-label">Raw Job JSON</div>' +
              '<pre class="job-field-value" style="background:#f9fafb;border-radius:6px;padding:10px;overflow-x:auto;">' +
              JSON.stringify(job, null, 2) +
              '</pre>' +
            '</div>';

    jobDetailBodyEl.innerHTML = html;

    // Footer actions (rendered after body, but wired here)
    const footerHtml = '<div class="job-detail-footer">' +
              '<a href="' + (job.url || '#') + '" target="_blank" class="job-btn job-btn-primary">View Job</a>' +
              '<button class="job-btn job-btn-green" data-action="applied">Mark as Applied</button>' +
              '<button class="job-btn job-btn-neutral" data-action="interested">Interested</button>' +
              '<button class="job-btn job-btn-danger" data-action="rejected">Reject</button>' +
              '<button class="job-btn job-btn-neutral" data-close="1">Close</button>' +
            '</div>';

    // Insert footer as the last element inside modal-content
    const modalContent = jobDetailModal.querySelector('.job-detail-content');
    if (modalContent) {
        const existingFooter = modalContent.querySelector('.job-detail-footer');
        if (existingFooter) existingFooter.remove();
        modalContent.insertAdjacentHTML('beforeend', footerHtml);
    }

    // Wire footer Close button
    const closeBtn = jobDetailModal.querySelector('.job-detail-footer button[data-close]');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeJobDetail());
    }

    // Wire footer status buttons
    (jobDetailModal.querySelectorAll('.job-detail-footer button[data-action]') || []).forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            if (!job.id || !action) return;
            await updateJobStatus(job.id, action);
        });
    });

    jobDetailModal.style.display = 'block';
}

function closeJobDetail() {
    if (jobDetailModal) jobDetailModal.style.display = 'none';
}

if (jobDetailCloseEl) {
    jobDetailCloseEl.addEventListener('click', closeJobDetail);
}
window.addEventListener('click', (e) => {
    if (e.target === jobDetailModal) closeJobDetail();
});

// ==================== FETCH JOBS ====================
async function fetchJobs() {
    try {
        const response = await fetch(`${API_BASE}/jobs`);
        const data = await response.json();
        allJobs = Array.isArray(data.jobs) ? data.jobs : [];

        updateStatusCounts();

        // Build country options from job locations
        if (countryFilter) {
            const countries = new Set();
            allJobs.forEach(job => {
                const loc = job.location || '';
                if (!loc) return;
                const parts = loc.split(',').map(p => p.trim()).filter(Boolean);
                const country = parts.length ? parts[parts.length - 1] : loc;
                countries.add(country);
            });

            const current = countryFilter.value;
            countryFilter.innerHTML = '<option value="">All countries</option>' +
                Array.from(countries).sort().map(c =>
                    `<option value="${c}">${c}</option>`
                ).join('');
            if (current && Array.from(countries).includes(current)) {
                countryFilter.value = current;
                selectedCountry = current;
            } else {
                countryFilter.value = '';
                selectedCountry = '';
            }
        }

        applyFilters();
    } catch (err) {
        console.error('Error fetching jobs:', err);
        showStatus('Error loading jobs', 'error');
    }
}



document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('statusClearAll');
  const checkBtn = document.getElementById('statusCheckAll');

  function refresh() {
    applyFilters();
    updateStatusCounts();
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.querySelectorAll('.status-filter-checkbox').forEach(cb => cb.checked = false);
      refresh();
    });
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      document.querySelectorAll('.status-filter-checkbox').forEach(cb => cb.checked = true);
      refresh();
    });
  }
});

function updateStatusCounts() {
    const counts = { discovered: 0, enriched: 0, interested: 0, applied: 0, rejected: 0 };
    const norm = (raw) => {
        if (!raw) return 'discovered';
        const s = String(raw).toLowerCase();
        if (s.startsWith('disc')) return 'discovered';
        if (s.startsWith('enrich')) return 'enriched';
        if (s.startsWith('inter')) return 'interested';
        if (s.startsWith('appl')) return 'applied';
        if (s.startsWith('rej')) return 'rejected';
        return s;
    };
    allJobs.forEach(job => {
        const mapped = norm(job.status);
        if (counts.hasOwnProperty(mapped)) counts[mapped]++;
    });
    document.querySelectorAll('.status-count').forEach(el => {
        const s = el.dataset.status;
        if (counts.hasOwnProperty(s)) el.textContent = counts[s];
    });
}

// ==================== FILTER JOBS ====================
function applyFilters() {
    let jobs = allJobs.slice();

    // Status filter from top bar
    const statusCbs = document.querySelectorAll('.status-filter-checkbox');
    if (statusCbs.length) {
        const selected = Array.from(statusCbs)
            .filter(cb => cb.checked)
            .map(cb => cb.value.toLowerCase());

        const norm = (raw) => {
            if (!raw) return 'discovered';
            const s = String(raw).toLowerCase();
            if (s.startsWith('disc')) return 'discovered';
            if (s.startsWith('enrich')) return 'enriched';
            if (s.startsWith('inter')) return 'interested';
            if (s.startsWith('appl')) return 'applied';
            if (s.startsWith('rej')) return 'rejected';
            return s;
        };

        if (selected.length > 0 && selected.length < statusCbs.length) {
            jobs = jobs.filter(job => {
                const mapped = norm(job.status);
                return selected.includes(mapped);
            });
        }
    }

    // Search filter
    if (typeof searchQuery === 'string' && searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        jobs = jobs.filter(job => {
            const haystack = [
                job.title || '',
                job.company || '',
                job.location || '',
                job.summary || ''
            ].join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }

    // Country / chips filter
    if (selectedCountries.length > 0) {
        jobs = jobs.filter(job => {
            const loc = (job.location || '').toLowerCase();
            return selectedCountries.some(c => loc.includes(c.toLowerCase()));
        });
    } else if (selectedCountry) {
        jobs = jobs.filter(job => {
            const loc = (job.location || '').toLowerCase();
            return loc.includes(selectedCountry.toLowerCase());
        });
    }

    filteredJobs = jobs;
    displayJobs();
}

// ==================== DISPLAY JOBS ====================
// ==================== DISPLAY JOBS ====================
// ==================== DISPLAY JOBS ====================
function displayJobs() {
  const count = filteredJobs.length;
  const countEl = document.getElementById('filteredCount');

  if (countEl) {
    countEl.innerHTML = `Showing <strong>${count}</strong> jobs`;
  }

  if (count === 0) {
    jobsList.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">No jobs match your current filters.</div>';
    return;
  }

  jobsList.innerHTML = filteredJobs.map(job => {
    const companyDisplay = job.company || 'Unknown';
    const visaStatus = job.requiresCitizenship || job.noVisaSponsorship
      ? '<span style="color:#ff3b30;">Visa: No</span>'
      : '<span style="color:#34c759;">Visa: Possible</span>';

    const location = job.location || 'Unknown';

    return `
      <div class="job-card" data-job-id="${job.id}">
        <div class="job-card-header-row">
          <h3 class="job-title">${job.title}</h3>
          <a href="${job.url}" target="_blank" rel="noopener noreferrer" class="job-original-link">Original posting</a>
        </div>
        <div class="job-company">${job.company || ''}</div>
        <div class="job-details">
          <div>🏢 ${companyDisplay}</div>
          <div>📍 ${location}</div>
          <div>✅ ${visaStatus}</div>
        </div>
        ${job.summary ? `<div class="job-summary">${job.summary}</div>` : ''}
        <div class="job-card-actions">
          <a href="${job.url}" target="_blank" class="job-btn job-btn-primary job-link">View Job</a>
          <button class="job-btn job-btn-green btn-status-change" data-job-id="${job.id}" data-new-status="applied">Mark as Applied</button>
          <button class="job-btn job-btn-neutral btn-status-change" data-job-id="${job.id}" data-new-status="interested">Interested</button>
          <button class="job-btn job-btn-danger btn-status-change" data-job-id="${job.id}" data-new-status="rejected">Reject</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-status-change').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const jobId = e.target.dataset.jobId;
      const newStatus = e.target.dataset.newStatus;
      await updateJobStatus(jobId, newStatus);
    });
  });

  // Wire all "View Job" buttons to open the detail modal instead of navigating
  document.querySelectorAll('.job-link').forEach(link => {
    if (link.dataset.jobDetailWired) return;
    link.dataset.jobDetailWired = '1';

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const card = link.closest('.job-card');
      if (!card) return;
      const jobId = card.dataset.jobId;
      const job = filteredJobs.find(j => String(j.id) === String(jobId));
      if (!job) return;
      openJobDetail(job);
    });
  });
}
// ==================== STATUS MESSAGE ====================
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    setTimeout(() => statusEl.style.display = 'none', 3000);
}

// ==================== EVENT LISTENERS ====================
document.querySelectorAll('.status-filter-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
        applyFilters();
    });
});


if (filterToggle) {
    filterToggle.addEventListener('click', () => {
        sidePanel.classList.toggle('active');
        mainContent.classList.toggle('shifted');
    });
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value || '';
        applyFilters();
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchQuery = searchInput.value || '';
            applyFilters();
        }
    });
}

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        if (countryFilter) countryFilter.value = '';
        selectedCountry = '';
        applyFilters();
        selectedCountries = [];
        renderChips();
    });
}

if (countryFilter) {
    countryFilter.addEventListener('change', (e) => {
        selectedCountry = e.target.value || '';
        applyFilters();
    });
}


if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
        if (!confirm('Delete all jobs? This cannot be undone.')) return;

        try {
            const response = await fetch(`${API_BASE}/jobs/clear`, { method: 'DELETE' });
            const data = await response.json();
            showStatus(`Deleted ${data.deleted || 0} jobs`, 'success');
            fetchJobs();
        } catch (err) {
            console.error('Error deleting jobs:', err);
            showStatus('Error deleting jobs', 'error');
        }
    });
}

// Monitor + roles minimal wiring (kept from your backend contract)
// ... you can paste back your existing monitor/roles code here if needed ...

// ==================== INITIALIZATION ====================

const countryChipInput = document.getElementById('countryChipInput');
const countryChips = document.getElementById('countryChips');

function renderChips() {
    if (!countryChips) return;
    countryChips.innerHTML = selectedCountries.map((c, i) => `
        <div class="country-chip">
            ${c}
            <button onclick="removeChip(${i})">×</button>
        </div>
    `).join('');
}

function removeChip(index) {
    selectedCountries.splice(index, 1);
    renderChips();
    applyFilters();
}

if (countryChipInput) {
    countryChipInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = countryChipInput.value.trim();
            if (val && !selectedCountries.includes(val)) {
                selectedCountries.push(val);
                renderChips();
                applyFilters();
            }
            countryChipInput.value = '';
        }
    });
}

console.log('✅ App initialized - simple search, all jobs visible');

fetchJobs();
setInterval(fetchJobs, 15000);
async function updateJobStatus(jobId, newStatus) {
    try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('Failed to update job');
        showStatus(`Job marked as ${newStatus}`, 'success');
        await fetchJobs();
        closeJobDetail();
    } catch (err) {
        console.error('Error updating job:', err);
        showStatus('Error updating job status', 'error');
    }
}
