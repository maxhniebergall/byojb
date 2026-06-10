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
   - **Find the URL first** with a quick WebSearch ("<company> careers" / "<company> about") —
     don't guess `/careers`; calibration showed ~⅓ of guesses 404/redirect. Then fetch the
     **about / values / engineering** page (more substance than the marketing careers landing
     page — you already have the job titles from the registry).
   - Read how they describe themselves, the work, pace, stability, and remote policy; check a
     couple of real JDs. Verify **remote-Canada eligibility** specifically.
   - Compare to `config/company_fit.yml` + `config/profile.yml` (`anti_targets`, `work_style_priorities`).
   - Budget ~2-4 fetches/company; mind subscription limits (Gemini free tier ~15 req/min).

3. Write TWO separated outputs per company (publishable split):

   **(i) Objective research note** → `data/company-research/<key>.md` — SHAREABLE, and it should
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

   **(ii) Personal fit verdict** → `data/company-fit/<key>.md` — PRIVATE, qualitative only:
   ```
   # <Company> — fit verdict
   Recommend: <keep | skip | consider>
   Aligns: <green signals matched vs config/company_fit.yml + profile.yml>
   Concerns: <red signals / disqualifiers, e.g. remote-only conflict>
   Verdict: <1-2 sentences vs the criteria>
   ```
   **Do NOT write a numeric "Fit: X/5" line in the verdict text.** The score is a STRUCTURED field:
   record it as `llm_fit` (1-5) in `data/companies-personal.jsonl` (the UI's rank box edits the same
   field). Keeping the number out of the prose prevents the two from drifting out of sync.

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
