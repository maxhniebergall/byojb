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
     <!-- `timezone` is the zone the ROLE'S HOURS are anchored to, not where the office is. It is
          scored by distance from Mountain Time (0h=5 … 4h+=0), so it is the facet that catches a
          remote-Canada job that still demands a 6am start. Give an IANA name so the offset can be
          computed — "EST" is ambiguous, "America/New_York" is not.
          Capture it whenever the JD states working hours, core hours, or an overlap requirement
          ("must overlap 9-5 ET", "East Coast hours", "EST +/- 2"), even if the location is
          "Remote - Canada".
          A NAMED CITY SETS THE TIMEZONE. If the posting anchors the role to a specific city —
          "Toronto, Canada (Remote)", "Remote (Toronto, CA)", "Ottawa, Ontario" — infer the zone
          from that city, even when no hours are stated. A company that posts one metro is
          telling you where the working day sits; treating that as unknown throws away the
          strongest hours signal most JDs carry. (This reverses an earlier rule that said never
          to infer from an office: it left a Toronto-anchored, NYC-headquartered role scoring as
          if its hours were unknown.)
          A MULTI-CITY list resolves to the city CLOSEST TO HOME, not to `unclear`. A role open in
          "San Francisco, Toronto, New York" would be taken on the San Francisco end, so record
          America/Los_Angeles — the candidate picks, so score the reachable option rather than
          throwing the whole signal away. Same for a list that crosses continents:
          "Warsaw, Poland; Mississauga, Canada" is America/Toronto.
          Two traps in that closest-city rule, both found in real postings:
            - A NAMED REGION BEATS A NAMED FOREIGN CITY. "Canada, remote, United Kingdom" is a
              Canada-remote role, but only "United Kingdom" is a place a city table can match, so
              a naive closest-city pass hands it Europe/London and scores it 0. When a reachable
              region (Canada / US / North America) appears next to foreign cities, the reachable
              option has no stated city — that is `unclear`, not the foreign zone.
            - AN EXPLICIT HOURS RANGE OUTRANKS EVERY CITY. "Senior Engineer (remote from GMT-7 to
              GMT+4 timezones)" is Belgrade-based, but it states outright that GMT-7 — Mountain —
              is permitted, so it is America/Edmonton. Stated hours always win; the city is only
              the fallback when the JD says nothing about when you work.
          Only one case stays `unclear`: a REGION with no city at all ("Remote - Canada",
          "Remote - Americas", "USA - Remote"). There is genuinely no zone to infer, and this is
          the case the old never-infer rule was protecting.
          `unclear` skips the dimension entirely rather than scoring it badly. -->

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
   **The posting's LOCATION field is authoritative and outranks your reading of the body.**
   "Remote - United States", "United States (Remote)", "Remote, US" and the like are `us_only`,
   full stop — a role being remote says nothing about which country may hold it.
   **Default to `unclear`, never to `canada`.** `canada` requires the posting to actually SAY it
   hires in Canada (or North America / anywhere / a named Canadian location). Silence is `unclear`.
   This is not a stylistic preference: 51% of extracted rows were labelled `canada`, including 109
   postings whose location named the US and never mentioned Canada. `geo_eligibility` combines with
   `remote_policy` into the `work_eligible` hard filter, so a wrong `canada` on a remote US role
   does not merely mis-rank it — it defeats the filter and surfaces an unreachable job as a match.
   **`global` carries exactly the same risk as `canada` and needs exactly the same evidence.** It
   passes the eligibility filter, so it is not a safe way to say "not sure". Two tests before using it:
   - **Workforce is not eligibility.** "We're a globally distributed, remote-first team", "400+
     members across 12 countries", "colleagues in 75+ countries" describe who already works there,
     not where this req can be filled. This one trap accounted for most of a 124-posting audit in
     which **only 20 were genuinely `global`** — ClickHouse, Alpaca, Docker and Sezzle reqs were all
     mislabelled on that basis.
   - **A single-currency band or a city list is evidence of a RESTRICTION.** A req quoting only a USD
     range, or naming four metros, is not worldwide. "Anywhere we have a hiring presence" is
     unenumerated, not global → `unclear`.
   Genuine `global` looks like an explicit statement of employer reach: "we hire almost anywhere in
   the world", "work from any country", "remote roles open in every time zone". Canonical, Sourcegraph
   and Cloudlinux really are this. When the JD does not say, the answer is `unclear`.
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
