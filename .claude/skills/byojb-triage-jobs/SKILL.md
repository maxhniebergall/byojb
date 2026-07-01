---
name: byojb-triage-jobs
description: "Stage 2: LLM postings ranking (no web fetch)"
arguments: args
user-invocable: true
license: MIT
---

# BYOJB -- Triage Jobs (Stage 2)

Performs a fast first-pass world-knowledge ranking (1-5) of individual scanned postings based on their titles and short snippets.

## Execution
Follow the instructions in `modes/triage-jobs.md`:
1. Emit a batch of undecided postings:
   `node llm-triage-jobs.mjs --emit 50`
2. Rate each posting 1-5 based on your world knowledge + target profiles in `config/profile.yml`.
3. Save results to `/tmp/job-scores.json`.
4. Apply the ratings:
   `node llm-triage-jobs.mjs --apply /tmp/job-scores.json`
