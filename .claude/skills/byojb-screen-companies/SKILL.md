---
name: byojb-screen-companies
description: "Stage 2: fast zero-fetch company screen (sets llm_rank)"
arguments: args
user-invocable: true
license: MIT
---

# BYOJB -- Screen Companies (Stage 2)

Wide, cheap triage over every company that has live postings, using only local data. Sets a 1-5
`llm_rank` priority so Stage-3 deep research knows where to look. **No web fetches.**

## Execution
Follow the instructions in `modes/screen-companies.md`.

Use:
- `node llm-triage.mjs --emit-screen 60 [--offset K]` — a batch of compact briefs (titles,
  locations, posted comp, and ~1200 chars of the best live JD per company).
- `node llm-triage.mjs --apply /tmp/screen.json` — merge `[{key, llm_rank, llm_reason, company_type?}]`.

Two things this mode must never do:
- **No web access.** A thin brief means score the midpoint and say "thin evidence" — not a fetch.
- **Never emit `llm_fit`.** That field drains the research queue; this pass sets `llm_rank` only,
  which prioritises companies rather than consuming them.

Write no dossiers and no fit verdicts — one JSON line per company, nothing else. Use the full 1-5
scale; if more than a third of a batch scores 4+, you are being too generous.

Arguments: {{args}} (batch size, default 60; pass an offset as the second argument)
