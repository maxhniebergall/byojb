---
name: byojb-research-jobs
description: "Stage 3: LLM JD facet extraction"
arguments: args
user-invocable: true
license: MIT
---

# BYOJB -- Research Jobs (Stage 3)

Reads the full job descriptions of shortlisted/highly-ranked jobs and extracts objective structural facets (languages, timezone, remote policy, salary range, etc.) for deterministic scoring.

## Execution
Follow the instructions in `modes/research-jobs.md`:
1. Emit postings needing extraction:
   `node llm-triage-jobs.mjs --emit-research 20`
2. For each, read the full JD body from files in `data/posting-research/` or fetch the URL.
3. Extract the strict JSON facet schema and write the fit verdict to `data/posting-fit/<key>.md`.
4. Apply the extracted facets:
   `node llm-triage-jobs.mjs --apply /tmp/job-research.json`
