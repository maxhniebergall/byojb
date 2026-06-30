---
name: byojb-scan
description: Scan target portals for new postings (zero LLM tokens)
arguments: args
user-invocable: true
license: MIT
---

# BYOJB -- Scan Portals

This command scans the target companies' ATS boards (Greenhouse, Lever, Ashby, BambooHR, Workday, etc.) and pulls new job postings.

## Execution
Run the following script to scan all configured portals:
`node scan.mjs`

If additional agent-based Playwright navigation is required for un-scanned companies, follow the instructions in `modes/scan.md`.
