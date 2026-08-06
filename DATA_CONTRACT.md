# Data Contract & Repository Structure

This document outlines the file structure of **Build Your Own Job Board (BYOJB)**, distinguishing between core repository logic and user-specific configurations, cache files, and reports (which are gitignored to keep your search details private).

## 1. User Data & Configuration (Gitignored)

These files contain your personal data, credentials, and job-search records. They are excluded from version control to prevent data leaks.

| File / Folder | Purpose |
|---------------|---------|
| `config/profile.yml` | Personal details (name, target roles, location constraints, default resume) |
| `modes/_profile.md` | Target archetypes, narrative framing, and custom rubric overrides |
| `portals.yml` | Tracked companies list (name, ATS careers URL, optional local parser scripts) |
| `config/company_criteria.yml` | Search criteria used by `/byojb-find-companies` |
| `config/jobspy.yml` | Query strings for broad-board searches |
| `data/applications.jsonl` | Source of truth for your application tracking records |
| `data/applications.md` | Read-only markdown representation of the application tracker |
| `data/contacts.jsonl` | People you reach out to (name, title, archetype, relationship tier incl. LinkedIn 1st/2nd degree, 0–5 relevance, LinkedIn activity level, notes, email) |
| `data/outreach.jsonl` | Outreach threads — one per conversation, with the full `messages[]` log, the prepared-but-unsent `draft` + `scheduled_for` send day, and its link to a posting/application |
| `data/outreach.md` | Read-only markdown representation of the outreach tracker |
| `data/posting-research.jsonl` | Cache of objective extracted facets for job postings |
| `data/postings-personal.jsonl` | Personal scores, overrides, and shortlist/skip decisions for postings |
| `data/posting-research/*` | Full job description bodies captured during scan |
| `data/posting-fit/*` | Qualitative personal fit verdicts drafted during Stage 3 research |
| `data/companies-personal.jsonl` | Personal rankings, decisions, and fit reasons for companies |
| `data/company-research.jsonl` | Scraped metadata/details for companies |
| `data/company-research/*` | Detailed dossier notes scraped from company careers/about pages |
| `data/company-fit/*` | Personal company fit verdicts |
| `data/company-comp.jsonl` | **Objective** pay bands per (company, role family, level) — every row carries a `derivation` of `direct` / `inferred` / `estimated` and its provenance |
| `data/company-comp/*` | Objective free-text comp notes per company (shareable, like the research dossier) |
| `data/company-aggregates.jsonl` | Derived-only queue signals per company (live relevant postings, how many lack pay info, best posting score) — regenerate, never edit |
| `data/essay-answers.jsonl` | Saved responses to essay questions (harvested by Chrome Extension) |
| `data/application-snapshots/*` | Saved text snapshots of submitted forms (for record keeping) |
| `reports/*` | In-depth company or offer evaluation reports (markdown format) |

## 2. Core Repository Logic (Tracked in Git)

These files form the engine, backend, and UI of the application.

| File / Folder | Purpose |
|---------------|---------|
| `web/*` | The web dashboard (port 4173): interactive UI and local localhost API server |
| `extension/*` | Chrome Extension (Manifest V3) for DOM autofill and application reporting |
| `providers/*` | ATS scrapers and JSON/markdown parsers (Greenhouse, Ashby, Lever, Workday, etc.) |
| `ingest/jobspy_pull.py` | Broad-board scraper script wrapper |
| `scan.mjs` | Multi-provider background portal job scanner |
| `title-family.mjs` | Normalizes a raw job title into (title_family, ladder_level); owns `LEVEL_LADDER` and the yoe→rung thresholds |
| `comp-core.mjs` | Pay-band registry: comp string/interval parsing, `bandFor` selection (never crosses role families), and the `validateBandRow` contract |
| `company-aggregates.mjs` | Rolls the postings registry up into per-company queue signals |
| `ingest/jd-comp.mjs` | Builds pay bands from comp already present in the postings registry (no network access) |
| `posting-core.mjs` | Registry reading, saving, and canonical URL normalization utilities |
| `application-core.mjs` | Applications registry logic and markdown sync engine |
| `outreach-core.mjs` | Contacts + outreach-thread registries, lifecycle states, and markdown sync engine |
| `autofill-fields.mjs` | Heuristic field/form classifier for autofill planning |
| `score-postings.mjs` | Scoring utility combining rubric parameters with extracted facets |
| `rank-postings.mjs` | Scan results cache merging, basic deduplication, and initial heuristic sorting |
| `liveness-browser.mjs` | Sequential browser liveness verification via Playwright |
| `liveness-core.mjs` | Classification heuristic checking if job listings are closed or active |
| `llm-triage-jobs.mjs` | Posting Stage 2/3 CLI pipeline command executor |
| `llm-triage.mjs` | Company Stage 2/3 CLI pipeline command executor |
| `doctor.mjs` | Repository readiness check script |
| `test-all.mjs` | Internal syntax and logic test suite |
| `apply-rubric.mjs` | Compiles dimension weights from `rubric.yml` into prompt modes |
| `modes/` | Prompt mode markdown instruction files used by the agent during Stage 2 & 3 |
| `.agents/skills/` | Custom Claude Code slash command routing and definitions |
| `.gemini/commands/` | Custom Gemini Antigravity slash command TOML configs |
