# Mode: research-companies — Stage 3: LLM web-researches the top companies (NEW)

Goal: for the top of the pre-ranked queue, the LLM **fetches each company's own pages** and
writes a research report + fit verdict — so the user's only job (Stage 4) is to read and decide.
This is automated LLM work; it never asks the user to do research.

Pipeline position: Stage 1 survey/heuristic → Stage 2 prerank (`triage-companies.md`, no web)
→ **Stage 3 web research (this mode)** → Stage 4 user decides (`decide.mjs`).

## Loop

1. Take the top un-researched companies from the prerank queue:
   ```bash
   node llm-triage.mjs --queue 25          # top by llm_rank (prerank), undecided
   ```

2. For EACH company, **web-research it** (this is the point — fetch its own words):
   - **Fetch the careers page** and, where useful, the **about / values / engineering** page.
   - Read how they describe themselves, the work, pace, stability, and remote policy; check a
     couple of real JDs. Verify **remote-Canada eligibility** specifically.
   - Compare to `config/company_fit.yml` + `config/profile.yml` (`anti_targets`, `work_style_priorities`).

3. Write TWO separated outputs per company (publishable split):
   - **Objective research note** → `data/company-research/<key>.md` (shareable; the company's own
     words + facts, no rubric references).
   - **Personal fit verdict** → `data/company-fit/<key>.md` (private) and record `llm_fit` (1-5) +
     `fit_brief` path in `data/companies-personal.jsonl` for that `key`.

4. Repeat down the queue as far as the user wants (this is breadth — the LLM does it; on the
   Gemini CLI subscription it's zero-token).

## Then — Stage 4 is the user's (NOT this mode)
Present a compact table (Company | llm_fit | 1-line why | report link). The user reviews and runs
`node decide.mjs keep/skip ...`. Do not gate research behind the user, and do not make decisions
for them.

## Rules
- This mode RESEARCHES and SCORES; it does not decide. Only the user's `decide.mjs` adds to the watchlist.
- Always ground the report in the company's OWN pages (fetch them) — that's the whole purpose.
- Keep the objective note rubric-free (shareable); keep the fit verdict in the personal layer.
- Skip `company_type` in {consulting, outsourcing, staffing} — landscape-only, never researched here.
