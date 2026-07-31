# Mode: screen-companies — Stage 2: wide, zero-fetch company screen

Goal: put a defensible 1-5 **priority** on every company that has live postings, fast, using only
data already on disk. This is the cheap wide pass that decides what deep research looks at next.

Pipeline position: Stage 1 survey → **Stage 2 screen (this mode)** → Stage 3 web research
(`research-companies.md`) → Stage 4 user decides in the web console.

## The one rule that matters

**No web access. None.** Everything you need is in the brief. If a brief is thin, score it with low
confidence and say so in the reason — do not reach for a fetch. The whole point of this mode is that
it costs no network round-trips, so a single agent can screen 60 companies in one pass instead of 5.

The second rule: **you are setting `llm_rank`, not `llm_fit`.** `llm_fit` is what removes a company
from the research queue; writing it here would consume companies rather than prioritise them. Never
emit `llm_fit` from this mode.

## Loop

1. Get a batch (each agent uses a distinct `--offset` so slices don't overlap):
   ```bash
   node llm-triage.mjs --emit-screen 60 --offset 0
   ```
   Each entry has: `name`, `live_relevant`, `best_posting_score`, up to 8 live `titles`,
   `locations`, `posted_comp` when the company publishes one, and `jd_excerpt` — ~1200 chars from
   its highest-scoring live JD.

2. Read `config/company_fit.yml` and `config/profile.yml` once, at the start. Not per company.

3. Score each company 1-5 on **how much it deserves a closer look**, weighing:
   - **Is the work infrastructure/platform, or product surface?** The single strongest signal.
     Backend/platform/data/ML-infra/SRE with internal or predictable consumers scores high;
     consumer product, growth, full-stack feature work scores low.
   - **Remote-Canada plausibility.** "Canada Remote", "US & Canada", "Anywhere" are strong. US-only,
     onsite, or a named non-Canadian city is a heavy penalty — it is a hard constraint downstream.
   - **Pace and hype language** in the excerpt: "fast-paced", "wear many hats", "hyper-growth",
     "founder mindset" all cut against; async, documented, sustainable, well-scoped all count for.
   - **Stability**: public, profitable, established, boring-and-critical domains rate above
     pre-seed, token-economy, or hype-dependent ones.
   - **`posted_comp`** when present, against the profile's target range. Absence is not a penalty —
     most companies publish nothing.

4. Emit ONE line per company. Write no dossiers, no fit verdicts, no files other than the JSON.
   ```json
   [{"key":"ashby:acme","llm_rank":4,"llm_reason":"<=12 words"}]
   ```
   Add `"company_type":"staffing"` (or `consulting`/`outsourcing`) when the brief plainly shows an
   agency or services firm — client-facing language, "our clients", a partner/certification list,
   or a wall of unrelated contract roles. That one field removes them permanently, which is worth
   far more than a score.

5. Apply:
   ```bash
   node llm-triage.mjs --apply /tmp/screen.json
   ```

## Use the whole scale

A screen that rates everything 3 has sorted nothing and wasted the pass. Calibrate roughly:

- **5** — infrastructure/platform work at a stable company, Canada-eligible, no hype. Rare.
- **4** — clearly relevant work with one real reservation (geography unclear, early stage, some pace language).
- **3** — plausible but unremarkable, or too little evidence to tell.
- **2** — mostly product/feature work, or a significant blocker like US-only.
- **1** — off-target domain, agency/consultancy, or a role well below the seniority and pay floor.

Expect most companies to land at 2-3; that is the correct shape for a wide screen over a corpus
that is mostly noise. If more than about a third are scoring 4+, you are being too generous.

## Rules

- Judge the COMPANY and the work on offer, not the writing quality of one JD.
- A thin brief means low confidence, not a low score — say "thin evidence" in the reason and score
  the midpoint. Deep research adjudicates later; this pass only decides reading order.
- `llm_reason` is <= 12 words and should name the deciding factor, not restate the title.
- Never fabricate. If the excerpt does not say where the role can be worked from, do not assert it.
