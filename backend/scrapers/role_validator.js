// Add this to continuous_scraper.js - replace the isValidJob function

function isValidJob(title, url, baseUrl, searchRole) {
    // Title must be 20-150 chars
    if (!title || title.length < 20 || title.length > 150) return false;
    
    // STRICT: Title must contain the search role keywords
    const titleLower = title.toLowerCase();
    const roleLower = searchRole.toLowerCase();
    
    // For "program manager", require both "program" AND "manager" in title
    const roleWords = roleLower.split(' ');
    const hasAllRoleWords = roleWords.every(word => titleLower.includes(word));
    
    if (!hasAllRoleWords) {
        return false; // Reject if title doesn't contain all role keywords
    }
    
    // Strict exclusion list
    const badWords = [
        'sign in', 'log in', 'join now', 'register', 'privacy', 'cookie',
        'terms', 'forgot', 'user agreement', 'linkedin', 'indeed',
        'home', 'search', 'filter', 'careers', 'explore', 'locations',
        'saved jobs', 'job cart', 'about', 'contact', 'help', 'faq',
        'diversity', 'equal opportunity', 'apply now', 'create profile'
    ];
    
    if (badWords.some(word => titleLower === word || titleLower.includes(word + ' ') || titleLower.startsWith(word))) {
        return false;
    }
    
    // URL must contain job-related path
    const urlLower = url.toLowerCase();
    const hasJobPath = urlLower.includes('/job/') || 
                       urlLower.includes('/jobs/') ||
                       urlLower.includes('requisition') || 
                       urlLower.includes('position') ||
                       urlLower.includes('jobid') ||
                       urlLower.includes('job_id');
    
    if (!hasJobPath) return false;
    
    // URL must not be just the base search URL
    if (url === baseUrl || url + '/' === baseUrl) return false;
    
    return true;
}
