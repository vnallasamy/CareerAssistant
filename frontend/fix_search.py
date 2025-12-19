from pathlib import Path

p = Path("app.js")
t = p.read_text()

# 1) Add searchTerms state
if "let searchTerms = [];" not in t:
    t = t.replace("let filteredJobs = [];", "let filteredJobs = [];\nlet searchTerms = [];")

# 2) Add chip management
chip_block = """// ==================== CHIP MANAGEMENT ====================
function addSearchChip(term) {
    term = term.trim().toLowerCase();
    if (!term || searchTerms.includes(term)) return;
    searchTerms.push(term);
    renderSearchChips();
    applyFilters();
}

function removeSearchChip(term) {
    searchTerms = searchTerms.filter(t => t !== term);
    renderSearchChips();
    applyFilters();
}

function renderSearchChips() {
    const container = document.getElementById('searchChips');
    if (!container) return;
    container.innerHTML = searchTerms.map(term => 
        '<span class="chip">' + term + '<span class="chip-remove" onclick="removeSearchChip(\'' + term + '\')">×</span></span>'
    ).join('');
}

"""

if "CHIP MANAGEMENT" not in t:
    t = t.replace("// ==================== FETCH JOBS ====================", chip_block + "// ==================== FETCH JOBS ====================")

# 3) Replace applyFilters
old = """function applyFilters() {
    filteredJobs = allJobs.slice();
    displayJobs();
}"""

new = """function applyFilters() {
    let jobs = allJobs.slice();

    if (searchTerms.length > 0) {
        jobs = jobs.filter(job => {
            const haystack = [
                job.title || '',
                job.company || '',
                job.location || '',
                job.summary || ''
            ].join(' ').toLowerCase();
            return searchTerms.every(term => haystack.includes(term));
        });
    }

    filteredJobs = jobs;
    displayJobs();
}"""

if old in t:
    t = t.replace(old, new)

# 4) Add search input handler
marker = """if (closeResume) {
    closeResume.addEventListener('click', () => {
        resumeManagerModal.style.display = 'none';
    });
}"""

inject = marker + """

// ==================== SEARCH INPUT ====================
const searchInput = document.getElementById('jobSearchInput');
if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = searchInput.value.trim();
            if (value) {
                addSearchChip(value);
                searchInput.value = '';
            }
        }
    });
}"""

if marker in t and "jobSearchInput" not in t:
    t = t.replace(marker, inject)

p.write_text(t)
print("✅ Search and chips added successfully")
