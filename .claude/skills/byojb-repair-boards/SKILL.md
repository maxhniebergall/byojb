---
name: byojb-repair-boards
description: "Find where a company's jobs moved after its board broke (404/403)"
arguments: args
user-invocable: true
license: MIT
---

# BYOJB -- Repair Broken Boards

A board that 404s is **a company we lost track of, not a company that stopped hiring**. dbt Labs
(fit 5, 36 postings previously seen including "Senior Platform Engineer, Storage") is 404 on
Greenhouse and therefore absent from the search entirely. Tailscale still hires — it moved from
BambooHR to Greenhouse. Until the registry follows, every one of their openings is invisible.

This runs after a scan, or whenever `board-repair.mjs --stats` shows a backlog.

## Execution
Follow the instructions in `modes/repair-boards.md`.

```
node probe-boards.mjs [--limit N]        # classify boards: alive | empty | gone | blocked
node board-health.mjs                    # what state is everything in
node board-repair.mjs --emit 20          # work-list of broken boards
node board-repair.mjs --apply fix.json   # apply [{key, outcome, careers_url?, provider?, note}]
node board-repair.mjs --stats
```

For more than ~10 boards, split the work-list into slices and run parallel agents, then apply
serially — the registry is a read-modify-write file and concurrent applies lose updates.

## The rules that matter

- **Never pause or retire a board for being empty.** Every board is scanned every run. Small
  companies hire sporadically: of 250 boards the ledger said had *never* yielded a job, 19 were
  hiring when probed. An empty board is not a problem.
- **`blocked` (401/403) is not evidence about the employer** — we were refused at the door.
  BambooHR 403s automated agents while serving its JSON perfectly. Treat it as "find another route
  in", never as absence.
- **`defunct` requires positive evidence** — a shutdown notice, an acquisition that retired the
  brand, a dead site *plus* no hiring presence anywhere. "I couldn't find it" is `unknown`, which
  is a good answer and carries a 45-day backoff. Guessing defunct silently deletes a real employer
  from the search, and nothing downstream will ever question it.
- **Verify a relocated URL returns jobs for the right company before returning it.** A wrong URL is
  worse than no answer: it gets scanned every run and looks healthy.
- Identify companies from `known_titles`, not the registry name — names are frequently raw ATS
  slugs (`upboundext`, `cxm`) or plain wrong ("Real Artists" is Real Brokerage).

After applying relocations, run `node scan.mjs` to pull the recovered boards back into the registry.

Arguments: {{args}} (batch size, default 20)
