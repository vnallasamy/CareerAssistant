# 🎯 CareerAssistant

**Your AI-Powered Personal Job Search Engine for Banking Careers**

CareerAssistant is a powerful, privacy-focused job search tool that runs entirely on your local machine. It uses **intelligent AI automation** to continuously monitor **100+ banking job sites** across American and Canadian banks, enriching and aggregating opportunities in one convenient location without relying on third-party job boards.

![CareerAssistant Banner](frontend/images/CareerAssistant. png)

---

## ⚠️ **Beta Notice**

**CareerAssistant is currently in BETA.**  While it's a powerful tool for discovering banking opportunities, please **do not rely on it as your sole source** for job applications. We recommend using it alongside traditional job search methods (LinkedIn, Indeed, direct company applications, networking, etc.) to ensure comprehensive coverage of available opportunities.

---

## 🌟 Why CareerAssistant?

### 🎯 **Comprehensive Coverage**
- **100+ Bank Job Sites** monitored automatically
- Coverage of major American and Canadian banking institutions
- Direct access to corporate career portals (bypassing Indeed, LinkedIn, etc.)
- **Future expansion** to insurance, healthcare, tech, consulting, and global markets

### 🤖 **AI-Powered Intelligence**
- **Smart Job Enrichment** using Ollama AI to extract: 
  - Precise location data (city, state, country)
  - Salary information and ranges
  - Required and preferred skills
  - Experience levels
  - Job types and work arrangements
- **Intelligent duplicate detection** to keep your database clean
- **Automated data validation** for location and company information

### 🔒 **Privacy First**
- **100% local execution** - all data stays on your machine
- No third-party tracking or data sharing
- Your search history never leaves your computer
- Complete control over your job search data

### ⚡ **Continuous Monitoring**
- **24/7 background job discovery** - never miss a new opportunity
- Automatically checks all 100+ sites in a continuous loop
- **Intelligent role matching** - only saves jobs matching your criteria
- **Live status updates** - see new jobs as they're discovered

### 📊 **Professional Job Management**
- **Advanced filtering** by location, company, salary, skills
- **Application tracking** through the entire interview process
- **Web archiving** - complete job posting HTML saved locally
- **Search across all fields** - find jobs by any keyword

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CareerAssistant                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │         Frontend (Web Interface)        │
        │  - Search & Filter Jobs                 │
        │  - Track Application Status             │
        │  - View Job Details & Archives          │
        │  - Country-Based Filtering              │
        └──────────────┬──────────────────────────┘
                       │ HTTP API (REST)
                       ▼
        ┌─────────────────────────────────────────┐
        │      Backend Server (Node.js)           │
        │  - REST API Endpoints                   │
        │  - Job Management & CRUD                │
        │  - Database Operations                  │
        └──────────┬─────────────┬────────────────┘
                   │             │
                   ▼             ▼
    ┌──────────────────┐  ┌─────────────────────┐
    │  SQLite Database │  │  Discovery Scraper  │
    │  - Job Storage   │  │  (Playwright)       │
    │  - Metadata      │  │  - Auto Site Detect │
    │  - Web Archives  │  │  - Pagination       │
    └──────────────────┘  └──────────┬──────────┘
                                     │
                    ┌────────────────┴─────────────────┐
                    ▼                                  ▼
        ┌──────────────────────┐      ┌─────────────────────────┐
        │   Job Link Extract   │      │   AI Enrichment         │
        │   - Multi-Site       │      │   (Ollama + llama3.2)   │
        │   - Smart Detection  │      │   - Location Parsing    │
        │   - Duplicate Filter │      │   - Skill Extraction    │
        └──────────────────────┘      │   - Salary Detection    │
                    │                 │   - Experience Level    │
                    └──────────┬──────┴─────────────────────────┘
                               ▼
                ┌─────────────────────────────────┐
                │   LocationIQ Geocoding API      │
                │   - City/State/Country Validate │
                │   - Country Code Resolution     │
                └─────────────────────────────────┘
                               │
                               ▼
                ┌─────────────────────────────────┐
                │      100+ Bank Job Sites        │
                │  - Workday (50+ sites)          │
                │  - Oracle Taleo                 │
                │  - Eightfold AI                 │
                │  - iCIMS                        │
                │  - UKG/Ultipro                  │
                │  - Avature                      │
                │  - Custom Career Portals        │
                └─────────────────────────────────┘
```

### How It Works

1. **Run Discovery Command**: Execute the scraper from terminal with your desired role
   ```bash
   node discovery_scraper.js "Program Manager"
   ```

2. **Site Detection**: Scraper reads 100+ bank sites from configuration and automatically detects each portal type (Workday, Oracle, iCIMS, etc.)

3. **Job Discovery**: For each site, the scraper:
   - Searches for the specified role
   - Handles pagination automatically (scroll + "Load More" buttons)
   - Extracts job links and basic metadata
   - Validates job URLs to avoid duplicates

4. **AI Enrichment** (Ollama + llama3.2):
   - Fetches full job page content
   - Uses AI to extract structured data: 
     - **Location**: City, State, Country
     - **Salary**: Min/Max ranges
     - **Skills**:  Mandatory and preferred
     - **Experience Level**: Entry, Mid, Senior, etc.
     - **Job Type**:  Full-time, Contract, etc.
     - **Visa Requirements**: Citizenship/sponsorship info

5. **Location Validation**:
   - Validates extracted location using LocationIQ geocoding API
   - Resolves country codes (US, CA, GB, etc.)
   - Ensures data consistency

6. **Storage**:
   - Jobs saved to local SQLite database
   - Duplicates filtered by URL
   - Complete job page HTML archived to `webarchives/` folder

7. **Continuous Loop**:
   - After completing all 100+ sites, the scraper automatically restarts
   - Runs in an infinite loop until manually stopped (Ctrl+C)
   - Continuously discovers new jobs as they're posted

8. **Frontend Display**:
   - Web interface queries database in real-time
   - Presents results with advanced filtering
   - Enables job tracking and status management

---

## 🚀 Installation

### Prerequisites

#### Required for All Platforms:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **Ollama** with llama3.2 model - [Download](https://ollama.ai/)
- **LocationIQ API Key** (free tier) - [Sign up](https://locationiq.com/)

---

### Installation on Mac

1. **Clone the repository**
   ```bash
   git clone https://github.com/vnallasamy/CareerAssistant.git
   cd CareerAssistant
   ```

2. **Install Ollama and llama3.2**
   ```bash
   # Download and install Ollama from https://ollama.ai/
   # Then pull the llama3.2 model: 
   ollama pull llama3.2
   
   # Start Ollama service (if not already running):
   ollama serve
   ```

3. **Get LocationIQ API Key**
   - Sign up for a free account at [https://locationiq.com/](https://locationiq.com/)
   - Copy your API key from the dashboard
   - Open `backend/scrapers/discovery_scraper.js`
   - Replace the placeholder API key: 
     ```javascript
     const LOCATIONIQ_KEY = 'YOUR_API_KEY_HERE';
     ```

4. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

5. **Install Playwright browsers**
   ```bash
   npx playwright install chromium
   ```

6. **Start the web server**
   ```bash
   node server.js
   ```

7. **Access the web interface**
   - Open your browser and navigate to: `http://localhost:3000`

8. **Run job discovery (in a new terminal)**
   ```bash
   cd backend/scrapers
   node discovery_scraper.js "Program Manager"
   
   # You can search for any role:
   node discovery_scraper.js "Business Analyst"
   node discovery_scraper.js "Data Scientist"
   ```

---

### Installation on Windows

1. **Clone the repository**
   ```cmd
   git clone https://github.com/vnallasamy/CareerAssistant.git
   cd CareerAssistant
   ```

2. **Install Ollama and llama3.2**
   - Download Ollama from [https://ollama.ai/](https://ollama.ai/)
   - Install and launch Ollama
   - Open Command Prompt or PowerShell and run:
   ```cmd
   ollama pull llama3.2
   ```

3. **Get LocationIQ API Key**
   - Sign up for a free account at [https://locationiq.com/](https://locationiq.com/)
   - Copy your API key from the dashboard
   - Open `backend\scrapers\discovery_scraper. js` in a text editor
   - Replace the placeholder API key:
     ```javascript
     const LOCATIONIQ_KEY = 'YOUR_API_KEY_HERE';
     ```

4. **Install backend dependencies**
   ```cmd
   cd backend
   npm install
   ```

5. **Install Playwright browsers**
   ```cmd
   npx playwright install chromium
   ```

6. **Start the web server**
   ```cmd
   node server.js
   ```

7. **Access the web interface**
   - Open your browser and navigate to: `http://localhost:3000`

8. **Run job discovery (in a new Command Prompt/PowerShell window)**
   ```cmd
   cd backend\scrapers
   node discovery_scraper.js "Program Manager"
   
   REM You can search for any role:
   node discovery_scraper.js "Business Analyst"
   node discovery_scraper.js "Data Scientist"
   ```

---

## 📖 Usage Guide

### 1. Start the Web Interface

```bash
cd backend
node server.js
```

Open your browser to `http://localhost:3000`

### 2. Run Job Discovery

In a **separate terminal window**, run the discovery scraper with your desired role:

```bash
cd backend/scrapers
node discovery_scraper.js "Program Manager"
```

The scraper will:
- Visit all 100+ configured bank job sites
- Search for your specified role
- Extract job listings
- Enrich them with AI-powered data extraction
- Save to your local database
- Archive complete job postings
- **Automatically restart and run continuously in an infinite loop**

**You can watch the progress in the terminal as it discovers and enriches jobs!**

**To stop the scraper**:  Press `Ctrl+C` in the terminal window

### 3. Search and Filter Jobs

In the web interface: 

**Search Bar**:  Type anything - role, skill, location, company
- Example: "Python", "New York", "Wells Fargo", "remote"

**Country Filter**:
- Type a country name and press Enter to add it as a filter chip
- Example: "United States", "Canada"
- Remove by clicking the × on the chip

**Filter by Multiple Criteria**:
- Location
- Company
- Job status
- Salary range
- Experience level

### 4. View Job Details

Click on any job card to see:
- Full job description (AI-enriched)
- Company information
- Location details (city, state, country)
- Salary range (if available)
- Required & preferred skills
- Experience level
- Visa/citizenship requirements
- Link to original job posting
- Archived web page (if scraping was successful)

### 5. Track Application Status

Click the status badge on each job card to update:
- 🆕 **New** - Just discovered
- 📝 **Applied** - Application submitted
- 💼 **Interviewing** - In interview process
- ❌ **Rejected** - Application rejected
- 🎉 **Offer** - Offer received

---

## ⚙️ Configuration

### Setting Up LocationIQ API Key

**Required for location validation and geocoding.**

1. Sign up for a free account at [https://locationiq.com/](https://locationiq.com/)
2. Navigate to your dashboard and copy your API key
3. Open `backend/scrapers/discovery_scraper.js` in a text editor
4. Find this line near the top of the file:
   ```javascript
   const LOCATIONIQ_KEY = 'pk.bfc262eefb0672ba1f6daf84bbf3b08b';
   ```
5. Replace with your API key: 
   ```javascript
   const LOCATIONIQ_KEY = 'YOUR_API_KEY_HERE';
   ```
6. Save the file

The free tier provides 5,000 requests/day, which is sufficient for most use cases.

### Changing Ollama Model

By default, the scraper uses `llama3.2`. To use a different model:

1. Pull the desired model: 
   ```bash
   ollama pull llama3.1
   ```

2. Edit `backend/scrapers/discovery_scraper.js`:
   ```javascript
   const MODEL = 'llama3.1'; // Change this line
   ```

### Monitoring Additional Roles

Simply run the discovery script multiple times with different roles: 

```bash
node discovery_scraper.js "Program Manager"
node discovery_scraper.js "Business Analyst"
node discovery_scraper.js "Data Engineer"
```

All jobs are saved to the same database. 

---

## 📁 Project Structure

```
CareerAssistant/
├── backend/
│   ├── server.js                      # Main web server
│   ├── db. js                          # Database operations
│   ├── jobs. db                        # SQLite database (auto-created)
│   ├── package.json                   # Node.js dependencies
│   ├── config/
│   │   └── job_sites.txt              # 100+ bank job sites (curated list)
│   ├── scrapers/
│   │   ├── discovery_scraper.js       # Main job discovery & AI enrichment
│   │   └── scraper. log                # Scraper activity log
│   └── webarchives/                   # Archived job posting HTML files
├── frontend/
│   ├── index.html                     # Main UI
│   ├── app.js                         # Frontend logic
│   ├── style.css                      # Styling
│   └── images/
│       └── CareerAssistant.png        # Logo
├── package.json                       # Root dependencies
└── README.md
```

---

## 🛣️ Future Roadmap

### Upcoming Features

#### 🎯 Resume Management & Matching
- **Multiple Resume Support** - Store and manage multiple versions of your resume as text
- **AI-Powered Job Matching** - Automatically match your resume against job descriptions
  - **Match percentage calculation** - See how well you fit each role
  - **Missing skills identification** - Know exactly what skills you need to develop
  - **Experience gap analysis** - Understand where your experience aligns or falls short
  - **Tailored recommendations** - Get specific advice for improving your candidacy

#### ✨ AI Resume Customization
- **Auto-Generated Custom Resumes** - AI will generate a customized resume for each job you want to apply to
  - Highlights most relevant experience for each role
  - Emphasizes matching skills prominently
  - Tailors professional summary to job requirements
  - Suggests keyword optimizations for ATS systems
  - Multiple format outputs (PDF, DOCX, plain text)

#### 🤖 Automated Job Applications
- **Auto-Fill Application Forms** - Automatically fill job site forms using your user profile
  - **Works inside your existing browser** - maintains your session and cookies
  - **Supports multiple job portal types** (Workday, Oracle, iCIMS, Taleo, etc.)
  - **Intelligent form field detection** - recognizes fields across different portals
  - **User profile management** - store your application data once, use everywhere
  - **Manual review before submission** - you always have final control

#### 🔎 Enhanced Filtering
- **Advanced Filter Options**:
  - **Remote/Hybrid/On-site** work type filtering
  - **Visa sponsorship** availability
  - **Security clearance** requirements
  - **Company size** (startup, mid-size, enterprise)
  - **Industry sector** within banking (retail, investment, corporate, etc.)
  - **Posted date range** (last 24h, week, month)
  - **Benefits and perks** (401k, stock options, etc.)

#### 🧠 Advanced Data Enrichment
- **Improved Job Data Extraction**:
  - **Better salary parsing** - normalize across different formats ($80K-$100K, 80000-100000, etc.)
  - **Enhanced skill extraction** - identify technical skills, soft skills, certifications
  - **Company rating integration** - pull Glassdoor ratings, employee reviews
  - **LinkedIn data correlation** - match jobs with company LinkedIn pages
  - **Interview process insights** - identify interview stages from job descriptions
  - **Team size and structure** - extract team composition details
  - **Technology stack identification** - automatically detect required tech/tools

#### 🌍 Global Expansion
- **More Industries & Institutions**:
  - 🏥 **Insurance companies** (Prudential, MetLife, State Farm, Nationwide, etc.)
  - 🏥 **Healthcare institutions** (UnitedHealth, Anthem, Kaiser Permanente, etc.)
  - 💻 **Technology companies** (Microsoft, Google, Amazon, Salesforce, etc.)
  - 📊 **Consulting firms** (McKinsey, BCG, Deloitte, Accenture, etc.)
  - 🏛️ **Government agencies** (federal, state, local opportunities)
  - 🌟 **Non-profit organizations** (foundations, NGOs, international orgs)

- **International Coverage**:
  - 🇬🇧 🇩🇪 🇫🇷 **European banks** (HSBC, BNP Paribas, Credit Suisse, etc.)
  - 🇯🇵 🇸🇬 🇭🇰 **Asian financial institutions** (SMBC, DBS, OCBC, etc.)
  - 🇦🇪 🇸🇦 **Middle Eastern markets** (Emirates NBD, Al Rajhi, etc.)
  - 🇧🇷 🇲🇽 🇦🇷 **Latin American banks** (Itaú, Bradesco, Banorte, etc.)

---

## 🛠️ Troubleshooting

### Port 3000 Already in Use
If you see "Port 3000 already in use", either:
- Stop the other application using port 3000, OR
- Edit `backend/server.js` and change `const PORT = 3000` to another port (e.g., `3001`)

### Ollama Not Running
If you see "Error connecting to Ollama": 
```bash
# Start Ollama service
ollama serve

# In another terminal, verify it's working:
ollama list
```

### Scraper Not Finding Jobs
- **Verify internet connection**
- **Check Ollama is running**:  `ollama list` should show `llama3.2`
- **Verify Playwright installation**: `npx playwright install chromium`
- **Review scraper logs**: Check `backend/scrapers/scraper.log` for errors
- **Some job sites have anti-bot protections** - the scraper includes delays and stealth mode

### Database Locked Error
- **Only run one instance** of the web server at a time
- If error persists, close all terminals running CareerAssistant and restart
- **Last resort**: Delete `backend/jobs.db` and restart (you'll lose saved jobs)

### AI Enrichment Taking Too Long
- AI enrichment can take 5-15 seconds per job (Ollama processing time)
- For faster results: 
  - Use a faster Ollama model (though accuracy may decrease)
  - Run Ollama on a machine with GPU support
  - Be patient - the quality of enrichment is worth the wait! 

### LocationIQ API Rate Limit
The free tier allows 5,000 requests/day. If you hit the limit:
- Jobs will still be saved, but country validation may be incomplete
- Upgrade your LocationIQ plan or wait until the next day for quota reset
- Consider reducing the frequency of scraper runs

---

## 🤝 Contributing

This is a curated project with a controlled job site list.  Contributions are welcome for: 
- 🐛 Bug fixes
- 🎨 UI/UX improvements
- 📝 Documentation enhancements
- ✨ Feature implementations from the roadmap

Please open an issue before starting work on major features. 

---

## 📄 License

This project is licensed under the ISC License.

---

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for robust, stealth web scraping
- Uses [SQLite](https://www.sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for lightning-fast local storage
- AI enrichment powered by [Ollama](https://ollama.ai/) and Meta's Llama 3.2
- Geocoding validation by [LocationIQ](https://locationiq.com/)
- UI design inspired by Apple's human interface guidelines

---

## 📊 Supported Banking Institutions

Currently monitoring **100+ job sites** from institutions including: 

### 🇺🇸 US Banks
- Wells Fargo, Morgan Stanley, PNC Bank, Fifth Third Bank
- M&T Bank, Northern Trust, Regions Bank, State Street
- Truist, Ally Bank, East West Bank, Frost Bank
- Old National Bank, Ozark Bank, Cadence Bank, Flagstar Bank
- Associated Bank, Western Alliance Bank, Wintrust

### 🇨🇦 Canadian Banks
- BMO (Bank of Montreal), TD Bank, CIBC
- Sun Life Financial, Canadian Tire Financial Services
- Fairstone Financial, Home Equity Bank, PC Financial

### 🌍 International Banks
- Barclays (UK), Deutsche Bank (Germany)
- MUFG (Japan), Santander (Spain)
- BBVA (Spain), ING (Netherlands)

### 🏢 Investment & Specialty Banks
- Morgan Stanley, Raymond James
- Goldman Sachs (via career portal)
- JLL LaSalle (real estate finance)

---

**🎉 Happy Job Hunting with AI-Powered Intelligence!**

*Built with ❤️ for job seekers who value privacy, automation, and comprehensive coverage.*

---

**Remember**: CareerAssistant is in BETA. Use it as a powerful supplement to your job search strategy, not as a replacement for traditional methods. 
