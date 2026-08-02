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

## After scanning: check for broken boards

A scan cannot tell you about a company whose board URL is dead — it simply returns nothing, which
looks identical to "no openings". Those companies drop out of the search silently, and they are
often the ones that matter: dbt Labs (fit 5) and Affinity.co (rank 5) are both 404 right now.

```
node probe-boards.mjs --limit 500   # classify boards: alive | empty | gone | blocked
node board-repair.mjs --stats       # how many need repair
```

If any are `gone` or `blocked`, run **`/byojb-repair-boards`** to find where those jobs moved.

Never act on `empty`: every board is scanned every run. Small companies hire sporadically, and 19
of 250 boards that had never yielded a job in the ledger were hiring when probed.
