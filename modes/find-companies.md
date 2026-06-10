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
   c. Compare that self-description to the user's criteria — `config/company_fit.yml` plus
      `config/profile.yml` (`anti_targets`, `work_style_priorities`). Write a short **fit brief**
      to `data/company-fit/<slug>.md`:
      ```
      # <Company> — fit brief
      Fit: <1-5> | Provider: <ats> (<live jobs>) | Recommend: keep|skip
      How they describe themselves: <2-3 sentences quoting/citing their own language>
      Aligns: <green signals matched>
      Concerns: <red signals matched>
      Verdict: <one line: why keep or skip vs the criteria>
      ```
   d. Record the score in the resolved JSON by adding a `fit_score` field to each entry, so the
      append step can gate on it. (Edit /tmp/resolved.json to add `"fit_score": <n>` per company.)

5. **Present for confirmation.** Show a table: Company | How they self-describe (1 phrase) |
   Fit /5 | Board (provider, live jobs) | Recommend. Group unresolved companies separately —
   they can still be covered via JobSpy keyword search (`config/jobspy.yml` `search_terms`).

6. **Append on approval (human-in-the-loop).** Only after the user confirms, append — gated by
   the vetting score:
   ```bash
   node find-companies.mjs --append /tmp/resolved.json --min-fit 3.5
   ```
   `--min-fit` drops companies scored below `config/company_fit.yml`'s `min_fit`. Dedupes by
   name. Then suggest `node scan.mjs` to pull jobs from the newly added companies.

## Rules
- NEVER append to `portals.yml` without explicit user confirmation.
- NEVER add a company without a fit brief + `fit_score` — vetting is mandatory, not optional.
- Ground the fit judgement in the company's OWN words (quote/cite), not assumptions.
- Prefer companies with a resolvable public ATS board (the scanner reads those zero-token).
- For strong-fit companies with no resolvable board, recommend adding their name/role to
  `config/jobspy.yml` search terms instead.
