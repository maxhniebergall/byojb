# Mode: research-jobs — Stage 3: LLM extracts structured facets from each JD (NEW)

Goal: for the top of the preranked queue, read the **full job description** and **extract a strict,
structured set of facts** (the facet schema below) plus one holistic fit read. The facets are
objective observations from the JD — the *score* is then recomputed deterministically from them ×
the user's rubric (`score-postings.mjs`), so the user can re-weight/filter/override later. You do
NOT author a final score here.

Pipeline position: Stage 2 prerank (`triage-jobs.md`) → **Stage 3 facet extraction (this mode)** →
Stage 4 user decides (dashboard).

SUBSCRIPTION ONLY: do the reading + extraction YOURSELF. No `GEMINI_API_KEY`/`.env`, no LLM SDK, no
script that calls an LLM API, no subagents decomposing the list with scripts. `llm-triage-jobs.mjs`
is a deterministic helper only.

## Loop
1. Work-list: `node llm-triage-jobs.mjs --emit-research 20` — top preranked, not yet extracted.
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
     "technologies": [<frameworks/tools/clouds/datastores named>],
     "location_hints": [<locations/regions named>], "timezone": "<e.g. America/… or unclear>",
     "remote_policy": "remote|hybrid|onsite|unclear",
     "geo_eligibility": "canada|us_only|eu_only|global|unclear",
     "comp": {"min": <num|null>, "max": <num|null>, "currency": "<CAD|USD|…>", "equity": <bool|null>} | null,
     "on_call": <true|false|"unclear">,
     "wlb_signals": [<phrases: "flexible hours","fast-paced","4-day week","heavy on-call",…>],
     "requirements": [<the must-haves>], "nice_to_haves": [<the preferred/bonus items>],
     "benefits": [<stated benefits>], "pto_policy": "<e.g. unlimited / 20 days / unclear>",
     "degree_required": "none|bachelor|master|phd|unclear",
     "domain": "<fintech|devtools|healthcare|… free text>"
   }
   ```
   `geo_eligibility` is the sharpest signal — only roles open to Canadians in Canada clear the
   user's hard filter. Read carefully: "US-only", "must reside in the US", visa-sponsorship-only =
   `us_only`; "open to Canada"/"North America"/"anywhere" = `canada`/`global`.
4. Write a short **personal fit verdict** → `data/posting-fit/<sk(key)>.md` (PRIVATE; `sk` =
   key with `:`/`/`→`-`). Qualitative only — Recommend (shortlist|skip|consider), Aligns, Concerns,
   Verdict (1-2 sentences). **No numeric "Fit: X/5" in the prose** — the holistic number is a
   structured field (`llm_holistic_fit`).
5. Build `/tmp/job-research.json` = array of
   `{"key":"…","extracted":{…schema…},"llm_holistic_fit":<1-5 for the qualitative dims>,
     "fit_brief":"data/posting-fit/<sk(key)>.md","llm_reason":"<=10 words"}`
   and apply: `node llm-triage-jobs.mjs --apply /tmp/job-research.json`
   (this writes facets to the objective layer and RECOMPUTES the score from facets × rubric).
6. Repeat down the queue as far as requested.

## Then — Stage 4 is the user's (NOT this mode)
The user opens the dashboard (`npm run dashboard:web`), filters/sorts/re-weights, and decides
shortlist/skip. Shortlisted postings then go through the existing `oferta` full evaluation. Do not
decide for them.

## Rules
- Extract FACTS from the JD; never invent a fact not in the text (use `unclear`/`null`).
- The objective layer is shareable — keep it rubric-free (it's just the JD + extracted facts).
- Keep the fit verdict and all scoring in the personal layer.

Arguments (how many postings to extract): {{args}}
