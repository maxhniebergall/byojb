---
name: byojb-research-companies
description: "Stage 3: LLM company careers page scraping"
arguments: args
user-invocable: true
license: MIT
---

# BYOJB -- Research Companies (Stage 3)

Perform deep web-research or read scraped information on top-ranked companies to evaluate details and write company fit reports.

## Execution
Follow the instructions in `modes/research-companies.md`.

**Filenames:** company keys contain a colon (`ashby:1password`) but files use `-`. Let `FILE` = the
key with every `:` and `/` replaced by `-`. A note at `data/company-research/ashby:1password.md` is
invisible in the dashboard.

Sequence:
1. `node score-postings.mjs && node company-aggregates.mjs` — refresh the signals the queue is
   ordered by. Skip this and the queue is stale or empty.
2. `node llm-triage.mjs --emit-research N` (N = the argument, default 20) — the work-list,
   ordered by each company's best live posting score. Research every row it returns. Add `--needs-comp` to target pay-data gaps. Most rows show `llm_rank: null`;
   that's expected — it's only a boost now, not a gate.
3. Research each company from its own pages; write the objective note and the fit verdict using
   the templates in the mode file. **WebSearch for every URL before fetching it** — guessed paths
   are the main source of wasted budget, and company names collide (the `yobi.com` you'd guess is
   a different company from the `yobi.ai` in the registry).
4. **After EACH company**, record the score:
   `node llm-triage.mjs --apply-append /tmp/research.json`
   with `[{key, llm_fit, fit_brief, llm_reason, company_type?}]`.
   **This is not optional** — the queue filters on `llm_fit == null`, so an unrecorded company
   re-emits at the head forever. `--apply-append` checkpoints incrementally, so a dropped session
   loses at most one company.
5. If a company can't be researched: `node llm-triage.mjs --record-fail <key> "<reason>"` — it then
   backs off instead of jamming the queue head.
6. Pay bands: `node llm-triage.mjs --apply-comp /tmp/company-comp.json` (rows are validated).

Do NOT decide keep/skip — that's the user's job in the web console.

**Pay-band slots:** `title_family` and `ladder_level` must be copied verbatim from a `comp_slots`
entry in the work-list — never classified by hand. A band filed under any other family/level is
unreachable by the scorer and the research is wasted. Prefer slots with `needs_comp: true`.

Pay bands are OBJECTIVE, shareable data (`data/company-comp.jsonl`), keyed per company AND role
family. Every row carries a `derivation` of `direct` (the company stated it), `inferred` (derived
from company evidence), or `estimated` (your own prior, no citable source) — never blur them, and
cite whatever a number actually came from rather than dressing it up as better-sourced.
Build on first-party evidence; assume comp aggregators are unavailable and don't spend fetches on
them. Never store a market or regional wage figure — a band must belong to a specific company and
role family.

## Modes

The skill takes an optional argument selecting what to prioritise:

| invocation | what it does |
|---|---|
| `/byojb-research-companies` | **Fit research.** Work the queue by best open posting. Also fills pay bands opportunistically (steps 2b/2c) while the pages are open. |
| `/byojb-research-companies comp` | **Pay-gap research.** Same loop, but the work-list is `--needs-comp`: only companies with relevant open roles that state NO pay and have no band on record. Use when the goal is pay coverage rather than company fit. |
| `/byojb-research-companies N` | Research N companies (default 20) — pass N straight to `--emit-research`. Combine, e.g. `comp 30`. |

For the `comp` mode, substitute the work-list command in step 2 with:
```bash
node llm-triage.mjs --emit-research N --needs-comp
```
Everything else in the loop is unchanged — still write both notes, still record `llm_fit`, still
`--record-fail` on a dead page. The only difference is which companies come out.

## If it turns out to be another company you already have

A subsidiary posting its parent's roles, a rebrand, or a second board is the SAME employer. Add
`"alias_of": "<canonical key>"` to that company's result. Counterpart Health's own site says it is a
Clover Health subsidiary and its board carries five of Clover's seven roles — research notices this
routinely, and without somewhere to record it the observation is written into prose and lost.

## When a company's board is broken

If a company in your queue has no live postings because its board 404s or 403s, that is **not** a
research failure and must not be recorded as one — the company may be hiring perfectly well
somewhere else. `--record-fail` marks OUR fetch as failed, not the employer as absent.

Note it and hand it to **`/byojb-repair-boards`**, which finds where the jobs moved (or establishes
that the company genuinely no longer exists). A company research pass that writes `llm_fit` off the
back of a dead board is scoring the URL, not the employer.

Arguments: {{args}}
