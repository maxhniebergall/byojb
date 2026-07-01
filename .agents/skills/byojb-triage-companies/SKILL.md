---
name: byojb-triage-companies
description: "Stage 2: LLM company fit ranking (no web fetch)"
arguments: args
user-invocable: true
license: MIT
---

# BYOJB -- Triage Companies (Stage 2)

Performs a fast, cheap world-knowledge fit assessment of undecided companies (1-5 score) based on name and description to filter them down before full research.

## Execution
Follow the instructions in `modes/triage-companies.md`:
1. Emit a batch of undecided companies:
   `node llm-triage.mjs --emit 50`
2. Rate each company 1-5.
3. Write results to `/tmp/company-scores.json`.
4. Apply the scores:
   `node llm-triage.mjs --apply /tmp/company-scores.json`
