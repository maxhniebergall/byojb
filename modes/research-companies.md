# Mode: research-companies — Stage 3: LLM web-researches the top companies (NEW)

Goal: for the top of the pre-ranked queue, the LLM **fetches each company's own pages** and
writes a research report + fit verdict — so the user's only job (Stage 4) is to read and decide.
This is automated LLM work; it never asks the user to do research.

Pipeline position: Stage 1 survey/heuristic → Stage 2 prerank (`triage-companies.md`, no web)
→ **Stage 3 web research (this mode)** → Stage 4 user decides in the web console.

## Filenames — read this first

Company keys contain a colon (`ashby:1password`), but the files are named with the colon and any
slash replaced by `-`. Let **`FILE`** = key with every `:` and `/` → `-` (`ashby:1password` →
`ashby-1password`). **A note written to `data/company-research/ashby:1password.md` is invisible in
the dashboard** — the server only ever looks for the `-` form. If a key is unusually long (>200
chars), get the exact name from `node -e "import('./posting-core.mjs').then(m=>console.log(m.sk('<key>')))"`.

## Loop

0. **Refresh the derived signals first.** The work-list is ordered by each company's best live
   posting score, which is computed by these two. Skip this and the queue is stale or empty:
   ```bash
   node score-postings.mjs && node company-aggregates.mjs
   ```

1. Take the work-list — the companies whose OPEN POSTINGS score highest and that aren't researched yet:
   ```bash
   node llm-triage.mjs --emit-research N        # N = the skill's argument, default 20
   ```                                          # add --needs-comp to target pay-data gaps
   Research every row it returns — the command already limits the batch, so don't re-slice it.
   Ordered by `best_posting_score` (the rubric score of their best live role), then volume.
   `llm_rank` is only a boost — most rows will show `llm_rank: null`, which is expected and fine.

2. For EACH company, **web-research it** (this is the point — fetch its own words):
   - **Read what's already local BEFORE spending a fetch.** `data/posting-research.jsonl` holds this
     company's postings with their locations, ATS-posted comp and extracted facets (the JD *bodies*
     live separately in `data/posting-research/<sk(key)>.md`, when `has_body` is true);
     `data/company-comp.jsonl` holds any bands already on record. These usually answer the remote-eligibility and pay questions
     outright. Spend your fetches on what only the web has: the about / values / engineering pages.
   - **Do not fetch ATS board URLs** (`jobs.ashbyhq.com/...`, `job-boards.greenhouse.io/...`,
     `jobs.lever.co/...`). They are client-rendered and return an empty shell — a guaranteed wasted
     fetch. Their content is already in the registry; that's where the scanner got it.
   - **ALWAYS WebSearch for the URL before fetching it — never type a path from intuition.**
     This is the single biggest source of wasted budget: across a 12-company run every agent lost
     fetches to guessed paths that 404'd (`corp.narvar.com/about-us/`, `hightouch.com/blog/...`,
     `warp.dev/blog/how-we-work`, `alpaca.markets/careers` — the real one is `/hiring`). Company
     names also collide: `yobi.com` is a different company from the `yobi.ai` in the registry, so
     confirm you have the right entity before spending anything. Then fetch the
     **about / values / engineering** page (more substance than the marketing careers landing
     page — you already have the job titles from the registry).
   - Read how they describe themselves, the work, pace, stability, and remote policy; check a
     couple of real JDs. Verify **remote-Canada eligibility** specifically.
   - Compare to `config/company_fit.yml` + `config/profile.yml` (`anti_targets`, `work_style_priorities`).
     Its `min_fit: 3.5` is the Stage-1 *find-companies* gate — here it is a reference rubric only.
     **Always write the note and record an `llm_fit`, including a 1 or 2.** A recorded low score is
     what removes the company from the queue; refusing to score it jams the queue forever.
   - Budget ~2-4 fetches/company; mind subscription limits (Gemini free tier ~15 req/min).

2b. **Comp & levels** — while you already have the company's pages open, look for what it pays.

   Most postings state no salary, so a company-level band is what lets those roles be compared at
   all. Bands are stored per **(title family, level)** — comparing pay across title families is
   meaningless, so never merge them.

   **Where to look** (first-party or public record — these are what the pipeline is built on):
   - the company's own careers / pay-transparency / compensation-philosophy page
   - a live JD from a pay-transparency jurisdiction (CO, NY, WA, CA, IL) — these state a range by law
   - a public engineering-levels page or handbook
   - a public filing

   Don't plan around comp aggregators (levels.fyi, Glassdoor, Blind, Payscale) — assume you can't
   read them and that there's nothing there. Don't spend fetches trying. If you do end up with a
   number from one, **cite it accurately** like any other source: a real URL and an honest
   `source_detail`. Never misattribute a number to make it look better-sourced than it is — an
   accurate weak citation is worth far more here than a laundered strong one.

   **Never emit a market or regional wage figure.** If all you find is "senior engineers in Toronto
   make about $X", that is not a company band — write no row. Every row must be attributable to
   **this specific company** and **this specific role family**.

   If an approved source yields a number, emit a row to a JSON array:
   ```json
   // DIRECT — the company states this number itself (its pay page, or a range on its own live JD)
   {"key":"greenhouse:acme","title_family":"platform_infra","ladder_level":"senior",
    "derivation":"direct",
    "band":{"min":196900,"mid":221500,"max":246100,"currency":"USD","component":"base"},
    "provenance":{"source":"jd_posted","method":"range posted on their Senior SWE JD",
      "source_urls":["https://job-boards.greenhouse.io/acme/jobs/123"],
      "as_of":"2026-07-31","sample_size":1,"confidence":"medium","geo":"US"}}

   // INFERRED — you pieced it together from company sources
   {"key":"greenhouse:acme","title_family":"platform_infra","ladder_level":"staff",
    "derivation":"inferred",
    "band":{"min":165000,"mid":190000,"max":215000,"currency":"USD","component":"base"},
    "provenance":{"source":"llm_research","method":"<how you arrived at it, one line>",
      "source_urls":["https://acme.com/careers/compensation"],
      "as_of":"2026-07-31","sample_size":3,"confidence":"medium","geo":"US"}}
   ```
   `as_of` must be a real `YYYY-MM-DD` date (it drives staleness — a literal "today" is rejected).
   If the company states a SINGLE number rather than a range (a no-negotiation policy), set
   `min`/`mid`/`max` all to that number and say so in `method`.
   - **`title_family` and `ladder_level` MUST be copied verbatim from a `comp_slots` entry in the
     work-list. Do not classify roles yourself.** A band is only ever read back by looking up the
     slot a posting classifies into; a row filed under any other family or level is unreachable and
     the research is wasted. Each slot tells you `postings`, `example_titles`, `has_band` (a band
     already exists — only supersede it with strictly better evidence) and `needs_comp` (the roles
     in that slot state no pay, so this is where a band actually buys something).
     If a number you find doesn't correspond to any listed slot, write no row.
     If every slot shows `has_band: true` and `needs_comp: false`, the company's pay is already
     covered — check `data/company-comp.jsonl` and only write a row that is strictly better
     evidence (a `direct` company statement beating an `inferred` rollup, say). Otherwise write none
     and spend the time on the fit verdict instead.
   - `component`: `base` unless the source clearly states total comp (`tc`) or total cash.
   - `source_urls` must be **non-empty**, and `confidence: high` requires a first-party source with
     `sample_size >= 3`.
   - `derivation:"direct"` has exactly two sources: `company_disclosure` (the company's own
     pay-transparency / compensation page) and `jd_posted` (a range stated in one of its live JDs,
     e.g. under CO/NY/WA/CA/IL transparency law). Cite the URL for either.
     Everything else you piece together is `derivation:"inferred"` + `source:"llm_research"`.

2c. **Parametric estimate — last resort only.** Run this only for a (company, title family, level)
   where 2b found nothing citable.

   Much of the compensation landscape isn't fetchable but *is* in your training data. Where no
   citable source exists, give your own best estimate of this company's band from what you already
   know about it — size, stage, funding, market, geography, and reputation for pay.

   - Emit `source:"llm_prior"`, `derivation:"estimated"`, `confidence:"low"`, `sample_size:0`,
     `"model":"<your model id>"`, and a `method` line stating the basis in plain words
     (e.g. *"Series C infra startup, SF-headquartered, benchmarks around the 75th percentile"*).
   - **Make the range wide enough to reflect real uncertainty.** A narrow estimated band is false
     precision — if you're unsure within ±$40k, say ±$40k.
   - **Abstain freely.** For a company you don't actually recognize, write no row. A small unknown
     startup is exactly where a parametric guess is worthless: the prior does no work and the number
     becomes pure anchoring. Only estimate where you have genuine knowledge of the specific company.
   - Never present an estimate as sourced, and never invent a citation for one.

   Estimated bands are stored and displayed but do **not** affect scores unless
   `preferences.comp_use_estimated` is enabled in `config/rubric.yml`.

   Apply the batch (every row is validated; bad rows are rejected with a reason):
   ```bash
   node llm-triage.mjs --apply-comp /tmp/company-comp.json
   ```
   Optional prose notes go to `data/company-comp/<FILE>.md` (objective/shareable tier).

   A dedicated queue exists for filling comp gaps specifically:
   ```bash
   node llm-triage.mjs --emit-comp 20   # companies whose relevant open roles state no pay
   ```

3. Write TWO separated outputs per company (publishable split):

   **(i) Objective research note** → `data/company-research/<FILE>.md` — SHAREABLE, and it should
   be a COMPREHENSIVE dossier of everything you learned, NOT just what's relevant to the rubric.
   Capture all of it (omit a heading only if genuinely unknown after fetching):
   ```
   # <Company> — research
   Provider/key: <ats:slug> | company_type: <product|consulting|outsourcing|staffing>
   What they do: <2-4 sentences: product/business, customers, domain>
   How they describe themselves: <their mission + the FULL set of stated values/principles, and
     tone — quote/cite their own words; don't reduce to one value>
   Size / stage / funding: <headcount, public/private, funding stage, profitability if known>
   Locations / HQ: <HQ + office geos>
   Remote policy: <remote-first / hybrid / onsite; any stated specifics; async?>
   Remote-Canada eligibility: <verified yes/no/unclear, with the evidence>
   Engineering & tech: <stack, how eng is organized, eng-blog/handbook signals>
   Notable / other: <anything else gathered — culture notes, recent news, products, awards>
   Open relevant roles (sample): <a few real titles from the registry>
   Sources: <the pages you fetched>
   ```
   Write everything factual you found — future re-use (other people's rubrics) depends on breadth.

   **(ii) Personal fit verdict** → `data/company-fit/<FILE>.md` — PRIVATE, qualitative only:
   ```
   # <Company> — fit verdict
   Recommend: <keep | skip | consider>
   Aligns: <green signals matched vs config/company_fit.yml + profile.yml>
   Concerns: <red signals / disqualifiers, e.g. remote-only conflict>
   Verdict: <1-2 sentences vs the criteria>
   ```
   **Do NOT write a numeric "Fit: X/5" line in the verdict text.** The score is a STRUCTURED field —
   see step 4. Keeping the number out of the prose prevents the two from drifting out of sync.

4. **Record the score — after EACH company, not at the end of the batch.** This is not optional:
   the queue filters on `llm_fit == null`, so **until `llm_fit` is recorded the company re-emits at
   the head of the queue forever** and the next run re-researches it.

   Write `/tmp/research.json`:
   ```json
   [{"key":"ashby:redis","llm_fit":4,"fit_brief":"data/company-fit/ashby-redis.md",
     "llm_reason":"<=12 words","company_type":"product"}]

   **If the company turns out to BE another company already in the registry** — a subsidiary
   posting its parent's roles, a rebrand, a second board — add `"alias_of": "<canonical key>"`
   and a short `"alias_note"`. You will often notice this while reading their careers page:
   Counterpart Health's own copy says it is a Clover Health subsidiary, and its board carries five
   of Clover's seven live roles. Recording it folds the two into one employer, so the openings stop
   appearing twice and the queue stops spending a second research slot on the same company.

   Only use it when the company says so, or the boards plainly carry the same requisitions. Two
   firms in one industry are not aliases; a wrong alias hides a real employer behind another.
   ```
   then:
   ```bash
   node llm-triage.mjs --apply-append /tmp/research.json
   ```
   `--apply-append` buffers to `data/company-research-pending.jsonl` and folds into the registry
   every 5 companies (`BYOJB_RESEARCH_CHECKPOINT_EVERY`). So after one company it will say
   `queued 1 (1/5 until checkpoint)` and `companies-personal.jsonl` is not yet updated — that is
   correct, not a failure. Any command you run afterwards folds the buffer in, and a session that
   dies loses at most one company. Use `--flush-pending` to force it. Never hand-edit
   `data/companies-personal.jsonl`.

   **`--record-fail` is only for a genuine dead end** — no reachable company site, or nothing
   substantive on it. An unfetchable ATS board is NOT a failure: the registry already has that
   company's postings, so research it from local data plus its own site and score it normally.

   **If a company CANNOT be researched** (careers page dead, no substantive content), record that
   instead of silently skipping — otherwise it jams the queue head on every future run:
   ```bash
   node llm-triage.mjs --record-fail <key> "careers page 404"
   ```
   It then backs off exponentially (1 week, then 2, 4…) rather than being retried immediately.

   **If the pages reveal a staffing / consulting / outsourcing firm**, put `"company_type":"staffing"`
   (or `consulting`/`outsourcing`) in the apply payload and write no fit note. That writes through to
   the objective layer and removes the company permanently — the name-based heuristic upstream misses
   plenty of these, and one fetch is exactly the right place to catch them.

5. Repeat down the queue as far as the user wants (this is breadth — the LLM does it; on the
   Gemini CLI subscription it's zero-token).

## Then — Stage 4 is the user's (NOT this mode)
Present a compact table (Company | llm_fit | 1-line why | report link). The user reviews and decides
keep/skip in the web console (`npm run dashboard` → Companies tab). Do not gate research behind the
user, and do not make decisions for them.

## Rules
- This mode RESEARCHES and SCORES; it does not decide. Only the user's keep/skip in the web console adds to the watchlist.
- Always ground the report in the company's OWN pages (fetch them) — that's the whole purpose.
- Keep the objective note rubric-free (shareable); keep the fit verdict in the personal layer.
- **Pay bands are OBJECTIVE data about a company** — like headcount or remote policy — so they go
  to `data/company-comp.jsonl` + `data/company-comp/<FILE>.md` (shareable), never to `data/company-fit/`.
- Never let a derived or estimated number pass as a stated one: `derivation` is required on every
  band row, and the UI, the scorer, and `doctor.mjs` all key off it.
- Skip `company_type` in {consulting, outsourcing, staffing} — landscape-only, never researched here.
