# Mode: triage-companies — LLM first-pass ranking of many companies (NEW)

Goal: rank a large set of companies for fit BEFORE manual vetting, so human judgement is
spent only on the LLM's top picks (target ~100 LLM rankings per 1 manual decision).

Cost model: LLM judgement on **metadata + world knowledge only** — no per-company web fetch.
Fast and scalable. Deep web research is reserved for the manual vetting step
(`modes/find-companies.md`).

## Loop

1. Emit a batch of un-triaged eligible companies:
   ```bash
   node llm-triage.mjs --emit 50 > /tmp/batch.json
   ```
   Each entry: `{ key, name, company_type, remote_openings, titles[] }` (titles = the company's
   actual relevant open roles).

2. **Score each company 1-5** for fit to the user's rubric/criteria, using what you KNOW about
   the company plus its job titles. Read `config/rubric.yml` + `config/company_fit.yml` +
   `config/profile.yml` (`anti_targets`, `work_style_priorities`). Judge:
   - North-Star fit: is this an infrastructure/utility/backend/data/platform/MLOps shop, or a
     product/growth/AI-hype/consulting company?
   - Stability & remote/async culture; the nature of the actual `titles` (real IC infra roles vs
     customer-facing/management).
   - 5 = clear strong fit · 4 = good · 3 = mixed/unclear · 2 = mostly off · 1 = anti-fit.
   Write `/tmp/scores.json`: `[{ "key": "...", "llm_rank": <1-5>, "llm_reason": "<≤12 words>" }, ...]`.
   Keep reasons terse and grounded (company nature + title signal). Do NOT web-fetch.

3. Apply:
   ```bash
   node llm-triage.mjs --apply /tmp/scores.json
   ```

4. Repeat (`--offset`/next `--emit`) across the eligible set. Check progress with
   `node llm-triage.mjs --stats`.

5. When done, hand the top of the ranked queue to manual vetting:
   ```bash
   node llm-triage.mjs --queue 30
   ```
   Then deep-vet those via `modes/find-companies.md` (objective note + personal verdict) and,
   on the user's approval, `decision=keep` → `generate-watchlist.mjs`.

## Rules
- Metadata + knowledge only in this mode — no web fetch (that's the manual step).
- `llm_rank`/`llm_reason` are PERSONAL (a judgement vs the user's rubric) — they live in
  `data/companies-personal.jsonl`, never in the shareable research layer.
- Be calibrated, not generous: most companies are 2-3; reserve 4-5 for genuine infra/utility fit.
- This pass RANKS; it never decides. Only the user's manual approval adds a company to the watchlist.
