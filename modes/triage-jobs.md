# Mode: triage-jobs — Stage 2: LLM world-knowledge prerank of the postings queue (NEW)

Goal: a fast, cheap first pass that ranks individual postings 1-5 from their title + company +
a short JD excerpt, using your judgement + the rubric — **no web fetch, no full-JD read yet**.
This thins hundreds of postings down to a top slice worth the deeper Stage-3 facet extraction.

Pipeline position: Stage 1 scan/heuristic (`scan.mjs` → `rank-postings.mjs`) → **Stage 2 prerank
(this mode)** → Stage 3 facet extraction (`research-jobs.md`) → Stage 4 user decides (dashboard).

SUBSCRIPTION ONLY: score the postings YOURSELF, in your own response. Do NOT use a `GEMINI_API_KEY`/
`.env`, do NOT import an LLM SDK, do NOT write a script that calls an LLM API, and do NOT spawn
subagents that decompose the list with scripts. `llm-triage-jobs.mjs` is a deterministic helper only.

First read `config/rubric.yml` (dimensions, weights, `preferences`) and `config/profile.yml`
(target_roles, anti_targets) so your ranking reflects the user's actual priorities.

## Loop
1. Get a batch: `node llm-triage-jobs.mjs --emit 50` — each item: `{key, company, title, department, location, jd_excerpt}`.
2. Score EACH posting **1-5** for fit using your knowledge + the title/excerpt:
   - **Use judgement, not keyword automation.** Reserve 4-5 for well-scoped backend/platform/
     infra/data/MLOps/cloud IC roles at credible companies; most postings are 2-3; give 1 to
     clearly off-target roles (product/growth/customer-facing/management, internships, wrong stack).
   - The excerpt is a hint, not the full JD — when unsure, score CONSERVATIVELY (2-3) rather than
     inflating. Stage 3 reads the full JD and can still promote a 3.
   - Keep batches ≤50 so you judge each posting rather than reaching for a script.
3. Write `/tmp/job-scores.json` = `[{"key":"…","llm_rank":<1-5>,"llm_reason":"<=10 words"}, …]`.
4. Apply: `node llm-triage-jobs.mjs --apply /tmp/job-scores.json`.
5. Repeat for the number of batches requested; check progress with `--stats`.

This stage RANKS only — it never decides shortlist/skip and never fetches the web.

Arguments (how many postings / batches to prerank): {{args}}
