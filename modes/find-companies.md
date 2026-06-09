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

3. **Resolve to ATS boards (zero-token).** Write the candidate names to a temp file (one per
   line) and run:
   ```bash
   node find-companies.mjs --resolve-file <tmp-names.txt> > /tmp/resolved.json
   ```
   This probes Greenhouse/Ashby/Lever/SmartRecruiters/Recruitee and marks each
   `resolved:true` (with a live job count) or `resolved:false`.

4. **Present for confirmation.** Show the user a table: Company | Why it matches | Board
   (provider + live job count) | Resolved?. Group unresolved companies separately and note
   they can still be covered via JobSpy keyword search (config/jobspy.yml `search_terms`)
   since they have no public ATS board the scanner can hit directly.

5. **Append on approval (human-in-the-loop).** Only after the user confirms, append the
   resolved companies to `portals.yml`:
   ```bash
   node find-companies.mjs --append /tmp/resolved.json
   ```
   It dedupes against existing entries by name. Then suggest running `node scan.mjs` to pull
   jobs from the newly added companies.

## Rules
- NEVER append to `portals.yml` without explicit user confirmation.
- Prefer companies with a resolvable public ATS board (the scanner can read those zero-token).
- For strong-fit companies with no resolvable board, recommend adding their name/role to
  `config/jobspy.yml` search terms instead.
- Keep the "why it matches" grounded in the criteria — no filler.
