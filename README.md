# Build Your Own Job Board (BYOJB)

**Build Your Own Job Board (BYOJB)** is a self-hosted, personal web job board and automated application tracker. It combines background scraping, automated AI-assisted ranking and triage, an interactive local dashboard, and a Chrome Extension to help you run a high-quality, targeted job search.

Originally derived from `career-ops`, BYOJB transitions the tool from a CLI-centric application to a rich web dashboard layout with background pipeline automation.

---

## Architecture & Workflows

```
  [ Scrapers (scan.mjs) ]  →  Pulls raw listings from lever/greenhouse/ashby/etc.
           ↓
  [ Stage 2 (triage) ]     →  Quick world-knowledge fit filtering (1-5) via LLM
           ↓
  [ Stage 3 (research) ]   →  Reads full JDs, extracts structured JSON facets (no scoring)
           ↓
  [ Stage 4 (dashboard) ]  →  Interactive UI: sliders re-weight & score, keep/skip
           ↓
  [ Chrome Extension ]     →  DOM autofill & records applications back to the dashboard
```

1. **Scanners:** Hits public ATS APIs (Greenhouse, Lever, Ashby, BambooHR, Workday, etc.) or uses local parsers to gather fresh jobs. Zero LLM token costs.
2. **AI Triage & Research:** Runs sequentially on your own agent subscription (Gemini Antigravity or Claude Code) using custom slash commands. Extracts objective facets (languages, remote constraints, salary, tech stack).
3. **Re-weightable Scores:** The dashboard scores each role dynamically on a facet-weighted model. You can adjust rubric sliders and instantly re-sort the queue without re-running the LLM.
4. **Tracking & Autofill:** Track applications, sync status records, and use the MV3 Chrome Extension to autofill forms from your profile and record submissions back to the DB.

---

## Setup & Onboarding

### 1. Requirements
* **Node.js** v18 or later
* **Playwright** (for liveness verification and page crawling)
* **Python 3** (Optional: only needed if using JobSpy broad-board scraping)

### 2. Install
Clone the repository, install npm packages, and download Playwright dependencies:
```bash
npm install
npx playwright install chromium
```

If using JobSpy for broad job board pull (LinkedIn, Indeed, etc.):
```bash
python3 -m venv .venv
./.venv/bin/pip install -r ingest/requirements.txt # or install jobspy & pyyaml
```

### 3. Personal Config
Create local configuration files from the templates:
```bash
cp config/profile.example.yml config/profile.yml
cp config/jobspy.example.yml config/jobspy.yml
cp config/company_criteria.example.yml config/company_criteria.yml
cp config/company_fit.example.yml config/company_fit.yml
cp config/rubric.example.yml config/rubric.yml
cp templates/portals.example.yml portals.yml
```

Edit these files with your details:
* `config/profile.yml`: Set your name, target roles, location, timezone, and application profile.
* `config/rubric.yml`: Configure weights for criteria (tech stack, remote timezone, compensation, work-life balance, stability).
* `portals.yml`: Customize target companies and ATS careers pages.

Verify readiness anytime:
```bash
npm run doctor
```

---

## Daily Flow

1. **Scan target portals for new postings:**
   In your terminal, run the zero-token scanner:
   ```bash
   npm run scan
   ```
   Or inside Gemini CLI / Claude Code, run:
   ```bash
   /byojb-scan
   ```

2. **Run AI Triage (Prerank & Facet Extraction):**
   Run the Stage 2/3 triage pipeline using your agent subscription. In Gemini CLI or Claude Code:
   * `/byojb-triage-jobs` (Stage 2: fast ranking of new postings)
   * `/byojb-research-jobs` (Stage 3: full JD reading and facet extraction)
   * `/byojb-triage-companies` / `/byojb-research-companies` (for company vetting)

3. **Manage and Track in the Web Dashboard:**
   Start the local web dashboard:
   ```bash
   npm run dashboard
   ```
   Open `http://localhost:4173` in your browser. Review rankings, adjust rubric sliders, shortlist postings, keep/skip companies, and view application statuses.

4. **Autofill forms and record applications:**
   Load the `extension/` directory into Chrome (Developer Mode -> Load unpacked). The extension autofills ATS application fields based on `config/profile.yml` and automatically reports submissions back to your dashboard.

---

## License & Attribution

BYOJB is released under the **MIT License**.

This project is originally based on [career-ops](https://github.com/santifer/career-ops) (MIT License) by **Santiago Fernández de Valderrama**. We would like to express our gratitude to the original author for the excellent foundation, parsing architecture, and pre-configured ATS portals config.
