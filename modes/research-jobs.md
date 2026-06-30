# Mode: research-jobs — Stage 3: LLM extracts structured facets from each JD

Goal: for the top of the preranked queue, read the **full job description** and **extract a strict,
structured set of facts** (the facet schema below). That's the LLM's *only* job here — objective,
computer-readable observations. **You do NOT score anything.** Every rubric dimension is scored
deterministically in code (`score-postings.mjs`) from these facets × the user's preferences, so the
user can re-weight, re-tune, filter, and override later without ever re-running the LLM.

Pipeline position: Stage 2 prerank (`triage-jobs.md`) → **Stage 3 facet extraction (this mode)** →
Stage 4 user decides (dashboard).

SUBSCRIPTION ONLY: do the reading + extraction YOURSELF. No `GEMINI_API_KEY`/`.env`, no LLM SDK, no
script that calls an LLM API, no subagents decomposing the list with scripts. `llm-triage-jobs.mjs`
is a deterministic helper only.

## Loop
1. Work-list: `node llm-triage-jobs.mjs --emit-research 20` — top preranked, not yet extracted.
   (Add `--all` to also re-extract already-extracted postings — e.g. to backfill new facets.)
   Each item: `{key, company, title, url, llm_rank, has_body, body_file}`.
2. For EACH posting, read the JD:
   - If `has_body` → read the file at `body_file` (the full JD captured at scan time — no fetch).
   - If not (e.g. a JobSpy posting) → fetch `url` once and read it. (This is the only fetch case.)
3. **Extract the facet schema** as STRICT JSON (use the exact enum values; use `"unclear"` / `null`
   / `[]` rather than guessing — `score-postings.mjs` relies on these being clean):
   ```json
   {
     "yoe_min": <int|null>, "yoe_max": <int|null>,
     "seniority": "junior|mid|mid-senior|senior|staff|principal|manager|unclear",
     "employment_type": "full_time|contract|internship|unclear",
     "languages": [<programming languages named>],
     "technologies": [<frameworks/tools/clouds/datastores/architectures named (e.g. AWS, Kubernetes, Postgres, ML, LLM, data pipeline, distributed systems)>],
     "location_hints": [<locations/regions named>], "timezone": "<e.g. America/… or unclear>",
     "remote_policy": "remote|hybrid|onsite|unclear",
     "geo_eligibility": "canada|us_only|eu_only|global|unclear",
     "comp": {"min": <num|null>, "max": <num|null>, "currency": "<CAD|USD|…>", "equity": <bool|null>} | null,
     "on_call": <true|false|"unclear">,
     "autonomy": "high|medium|low|unclear",
     "culture": "sustainable|balanced|hustle|unclear",
     "company_stage": "seed|startup|growth|late_stage|public|profitable|unclear",
     "wlb_signals": [<phrases: "flexible hours","fast-paced","4-day week","heavy on-call",…>],
     "requirements": [<the must-haves>], "nice_to_haves": [<the preferred/bonus items>],
     "benefits": [<stated benefits>], "pto_policy": "<e.g. unlimited / 20 days / unclear>",
     "degree_required": "none|bachelor|master|phd|unclear",
     "domain": "<fintech|devtools|observability|cloud-infra|… free text>"
   }
   ```
   These three drive the `scope`/`wlb`/`stability` dimensions — extract the *signal*, not a score:
   - `autonomy` — **high** = rigidly-scoped, async, predictable, internal customers, rare emergencies;
     **low** = wear-many-hats, firefighting, deadline/sales pressure; **medium** = in between.
   - `culture` — **sustainable** = async, builder/engineering culture, sane hours; **hustle** =
     "fast-paced", "move fast", sales-/growth-driven, always-on; **balanced** = neither extreme.
   - `company_stage` — read funding/size/profitability cues (public co, profitable, Series A, seed…).
   `geo_eligibility` is the sharpest signal — only roles open to Canadians in Canada clear the user's
   hard filter. "US-only"/"must reside in the US"/visa-sponsorship-only = `us_only`; "open to
   Canada"/"North America"/"anywhere" = `canada`/`global`.
4. Write a short **personal fit verdict** → `data/posting-fit/<sk(key)>.md` (PRIVATE; `sk` =
   key with `:`/`/`→`-`). Prose only — Recommend (shortlist|skip|consider), Aligns, Concerns,
   Verdict (1-2 sentences). **No numbers** — every score is computed from the facets, not authored here.
5. Build `/tmp/job-research.json` = array of
   `{"key":"…","extracted":{…schema…},"fit_brief":"data/posting-fit/<sk(key)>.md","llm_reason":"<=10 words"}`
   and apply: `node llm-triage-jobs.mjs --apply /tmp/job-research.json`
   (writes facets to the objective layer; `score-postings.mjs` recomputes every dimension from facets × rubric).
6. Repeat down the queue as far as requested.

## Then — Stage 4 is the user's (NOT this mode)
The user opens the dashboard (`npm run dashboard:web`), filters/sorts/re-weights, and decides
shortlist/skip. Shortlisted postings then go through the existing `oferta` full evaluation. Do not
decide for them.

## Rules
- Extract FACTS from the JD; never invent a fact not in the text (use `unclear`/`null`).
- **Never author a score** — the LLM only reports facets; all scoring is deterministic code.
- The objective layer is shareable — keep it rubric-free (it's just the JD + extracted facts).
- Keep the fit verdict (prose) in the personal layer.

Arguments (how many postings to extract): {{args}}
