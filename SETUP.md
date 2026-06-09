# Job Finder — Setup & Usage

This is [career-ops](https://github.com/santifer/career-ops) (MIT) scoped to **discovery →
research → ranked reports**, with four additions for this setup. It runs on your LLM
**subscription** (Claude Code or Gemini CLI) — no per-token API billing.

## 1. Fill in your details (required)

The system can't run evaluations until these have your real info (replace every `[FILL IN]`):

| File | What goes in it |
|------|-----------------|
| `cv.md` | Your CV in markdown. Drives match scoring + the "why it matched" explanations. |
| `config/profile.yml` | Identity, target roles, comp, location. Your email is already set. |
| `portals.yml` → `title_filter` | Keywords for YOUR target roles (currently AI/ML defaults). |
| `config/jobspy.yml` → `search_terms` | Your role keywords for broad-board scraping. |
| `config/company_criteria.yml` | Criteria for the company finder (industry, location, …). |

> On a fresh clone, create your live configs from the templates (they're gitignored so your
> search terms / criteria stay private):
> `cp config/jobspy.example.yml config/jobspy.yml && cp config/company_criteria.example.yml config/company_criteria.yml`

Run `npm run doctor` anytime to check readiness.

## 2. Pick your LLM (subscription, zero-token)

- **Gemini CLI** (your preference): `npm i -g @google/gemini-cli && gemini auth`, then run
  `gemini` in this folder and use `/career-ops-*` commands. Free tier covers a full search.
- **Claude Code**: run `claude` here and use `/career-ops …`.
- Avoid `npm run gemini:eval` — that path uses a `GEMINI_API_KEY` (per-token billing).

## 3. Daily flow

```bash
# (occasionally) discover NEW companies matching your criteria → portals.yml
#   in Claude Code / Gemini CLI:  /career-ops find-companies

# refresh broad-board (LinkedIn/Indeed/Glassdoor/ZipRecruiter) cache — slow, run on its own
npm run jobspy:refresh

# discover jobs from target companies + JobSpy cache (zero-token)
npm run scan            # = node scan.mjs

# research + score + write ranked reports (uses your subscription)
#   in Claude Code / Gemini CLI:  /career-ops pipeline

# browse everything, ranked by relevance, with explanations
npm run dashboard:web   # → http://localhost:4173
```

## 4. The four additions (what's custom here)

1. **Company finder** — `config/company_criteria.yml` + `modes/find-companies.md` (LLM web
   research) + `find-companies.mjs` (zero-token ATS-board resolver → appends to `portals.yml`).
   Run via `/career-ops find-companies`. Standalone test: `node find-companies.mjs --resolve "Stripe"`.
2. **Broad-board ingestion (JobSpy)** — `config/jobspy.yml` + `ingest/jobspy_pull.py`, wired
   into the scanner as the "JobSpy Boards" entry in `portals.yml` via the local-parser provider.
   `--refresh` scrapes into `data/jobspy-cache.json`; the scanner reads that cache instantly.
3. **User-defined rubric** — `config/rubric.yml` is the single source of truth for scoring
   weights/dimensions. Edit it, then `npm run rubric` re-renders it into the evaluation prompts
   (`modes/_profile.md`, `modes/ofertas.md`, `modes/_shared.md`) and the dashboard.
4. **Web dashboard** — `web/server.mjs` + `web/index.html`. Read-only; ranks evaluated jobs by
   score with explanations + report links, lists discovered (pending) jobs, shows the active rubric.

## Notes
- `reports/SAMPLE-*.md` are demo fixtures so the dashboard's ranked view isn't empty — delete
  them once you have real evaluations.
- Python deps live in `.venv` (JobSpy + PyYAML). The JobSpy portal entry calls `.venv/bin/python`.
- JobSpy scraping (esp. LinkedIn) is rate-limit/ToS-sensitive — keep `--refresh` runs modest.
  Target-company ATS scanning is the reliable backbone.
- Out of scope by design (left unused): resume PDF generation, auto-apply, interview prep.
