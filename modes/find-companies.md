# Mode: find-companies — Discover NEW target companies (NEW)

Goal: grow `portals.yml` with companies that match the user's criteria — so the scanner
has the right companies to scan. This is upstream of job discovery.

Cost model: discovery uses **WebSearch on your subscription** (no API billing). ATS
resolution and writing to `portals.yml` are **zero-token** (the `find-companies.mjs` script).

## Steps

1. **Read criteria.** Load `config/company_criteria.yml` (industries, size, funding stage,
   locations, mission_keywords, exclusions, target_count). If every field is still a
   `[FILL IN]` placeholder, ask the user for at least an industry + location before searching.

2. **Research candidates.** Run several WebSearch queries combining the criteria
   (e.g. `"<industry>" companies hiring <location> <mission_keyword>`, plus lists like
   "top <industry> startups <funding_stage>"). Aim for ~`target_count` distinct companies.
   For each, note: company name, why it matches (1 line), and any obvious red flag vs the
   `exclusions` list. Drop excluded companies.

3. **Resolve to ATS boards (zero-token).** Two tracks:

   a. **By name** — for startups / tech companies on the single-slug ATSs
      (Greenhouse/Ashby/Lever/SmartRecruiters/Recruitee). Write candidate names to a temp
      file (one per line):
      ```bash
      node find-companies.mjs --resolve-file <tmp-names.txt> > /tmp/resolved.json
      ```

   b. **By careers URL** — for enterprise/Workday employers (banks, telecom, big tech), which
      CANNOT be guessed from a name. For each such company, WebSearch "<company> careers" to
      get its `*.myworkdayjobs.com` (or other ATS) URL, then write `Name<TAB>careers_url` rows:
      ```bash
      node find-companies.mjs --urls-file <tmp-urls.txt> > /tmp/resolved-url.json
      ```
      This validates Workday boards via the public CXS endpoint (and also classifies slug-ATS
      URLs). Workday entries get a default `workday_search` (your green-list titles) to narrow
      large boards at the source.

   Each result is `resolved:true` (with a live job count) or `resolved:false`.

4. **VET — does the company fit, by how it talks about itself? (the critical step).**
   Resolving a board only proves a company *has* jobs — not that it's a place the user wants
   to work. Before adding any company, judge company-level fit:

   a. Load `config/company_fit.yml` (green_signals, red_signals, sources, min_fit, scoring).
   b. For each resolved company, gather **how it describes itself** — read (WebSearch/WebFetch,
      in the `sources` priority order): its careers/values/culture page, engineering blog or
      handbook, a few of its actual JDs (watch the language — "fast-paced"? "ownership"?
      "scope"?), and recent news (funding stage, layoffs, remote policy).
   c. Write **TWO separated outputs** (this keeps the project publishable — objective research
      is shareable, the fit judgement is personal):

      **(i) Objective research note** → `data/company-research/<key>.md` (SHAREABLE — no rubric
      references, just facts anyone could reuse):
      ```
      # <Company> — research
      Provider: <ats> (<live relevant openings>) | company_type: product|consulting|outsourcing|staffing
      Remote-Canada eligibility: <verified yes/no/unclear, with evidence>
      What they do: <1-2 sentences>
      How they describe themselves: <2-3 sentences quoting/citing their OWN language>
      Size / stage / stability: <facts>
      Remote policy: <facts>
      ```

      **(ii) Personal fit verdict** → `data/company-fit/<key>.md` (PRIVATE — vs YOUR criteria in
      `config/company_fit.yml` + `config/profile.yml` `anti_targets`/`work_style_priorities`):
      ```
      # <Company> — fit verdict
      Fit: <1-5> | Recommend: keep|skip
      Aligns: <green signals matched>   Concerns: <red signals matched>
      Verdict: <one line vs the criteria>
      ```
   d. Record the verdict in the personal registry layer: set `llm_fit`, `fit_brief`, and
      (on the user's decision) `decision` for that company's `key` in `data/companies-personal.jsonl`.
      Add `fit_score` to the resolved JSON if you intend to use the optional `--append --min-fit` gate.

5. **Present for confirmation.** Show a table: Company | How they self-describe (1 phrase) |
   Fit /5 | Board (provider, live jobs) | Recommend. Group unresolved companies separately —
   they can still be covered via JobSpy keyword search (`config/jobspy.yml` `search_terms`).

6. **Add to the watchlist on approval (human-in-the-loop).** `portals.yml` is a **generated
   artifact** — don't hand-edit company entries. On the user's approval, set `decision: keep`
   for the company's `key` in `data/companies-personal.jsonl`, then regenerate the watchlist:
   ```bash
   node generate-watchlist.mjs        # personal decision=keep → portals.yml tracked_companies
   node scan.mjs                       # pull current postings from the watchlist
   ```
   (For ad-hoc one-offs not yet in the registry, `node find-companies.mjs --append <json>` still
   works and can be gated with `--min-fit`.)

## Rules
- NEVER add a company to the watchlist without explicit user confirmation.
- NEVER add a company without BOTH outputs (objective research note + personal fit verdict) — vetting is mandatory.
- Keep the two layers separate: research notes carry NO rubric references; fit verdicts/scores stay in the personal layer.
- `company_type` in {consulting, outsourcing, staffing} → landscape-only: keep in the research dataset, never vet or add to the watchlist.
- Ground the research in the company's OWN words (quote/cite), not assumptions.
- For strong-fit companies with no resolvable board, recommend adding their name/role to
  `config/jobspy.yml` search terms instead.
