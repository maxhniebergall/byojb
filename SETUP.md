# Build Your Own Job Board (BYOJB) — Setup & Configuration

This guide helps you set up the web dashboard, background scrapers, and AI pipelines.

---

## 1. Configure Personal Settings

You must customize the following templates to match your search profile. Create them from templates and customize (these are gitignored to keep your search private):

| Config File | Configuration details |
|-------------|-----------------------|
| `config/profile.yml` | Set your full name, email, target roles (e.g. `Platform Engineer`), timezone, and application defaults. |
| `modes/_profile.md` | Write details about your background, target archetypes, and narrative to help the LLM align. |
| `config/rubric.yml` | Set weights and preference values (desired salary, tech keywords, desired seniority) to calculate computed matching scores. |
| `portals.yml` | Configure the list of companies you want to track (ATS names and URLs). |

Run the doctor script to verify everything is set up:
```bash
npm run doctor
```

---

## 2. Load the Chrome Extension

To enable automatic application submission recording and ATS form autofill:
1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right switch).
4. Click **Load unpacked** (top left button).
5. Select the `extension/` folder in the project root.

---

## 3. Running the Pipeline

Follow these steps periodically:

### Step 1: Scan
Scan for new postings across tracked companies:
```bash
npm run scan
```

### Step 2: AI Triage & Extraction
Run custom slash commands in your agent console (Gemini CLI or Claude Code) to triage the queue:
* `/byojb-triage-jobs` (rapidly filters the queue down using world knowledge)
* `/byojb-research-jobs` (reads full job descriptions and extracts objective JSON facets)

### Step 3: Browse in Dashboard
Start the local server:
```bash
npm run dashboard
```
Open `http://localhost:4173` to browse postings sorted by matches, modify sliders live, shortlist roles, and track applications.
