# Mode: repair-boards — find where a company's jobs actually live now

A board in this queue is **broken**, not empty:

- `gone` — 404/410/DNS. The URL we hold is dead.
- `blocked` — 401/403. We were refused; this says nothing about the employer.

**Neither means the company stopped hiring.** Tailscale still hires — it moved from BambooHR to
Greenhouse, and until the registry follows, every one of its openings is invisible to us. dbt Labs
(rated fit 5, 36 postings previously seen, including "Senior Platform Engineer, Storage") is
404 on Greenhouse right now and therefore absent from the search entirely.

Your job is to find the company's **current** job board, or establish that the company itself is
gone. Getting this wrong in the "defunct" direction silently deletes a real employer, so the bar
for that verdict is high.

## Input

`/tmp/board-repair-in-<N>.json` — an array of:

```json
{ "key": "greenhouse:dbtlabsinc", "name": "dbt Labs", "probe_state": "gone",
  "current_url": "https://job-boards.greenhouse.io/dbtlabsinc", "provider": "greenhouse",
  "llm_fit": 5, "known_titles": ["Senior Platform Engineer, Storage", "..."],
  "previously_seen_postings": 36 }
```

`known_titles` is your best clue to WHICH employer this is: registry names are often raw ATS slugs
(`upboundext`, `gtp-software-inc`, `cxm`), and some are wrong outright ("Real Artists" is Real
Brokerage). Identify the company from the roles it used to post, not from the slug.

## Method

1. **Find the company's own site.** Search for the company name plus a distinctive title from
   `known_titles`. Confirm identity from the site's own copy — a name collision here is a real
   risk (there is a "Stratus" MEP-construction SaaS and an unrelated Stratus Technologies).
2. **Find its careers page**, then determine which ATS it uses. The board URL is usually visible in
   the careers page links or in the network requests behind it. Common shapes:
   - `https://job-boards.greenhouse.io/<slug>` (API `boards-api.greenhouse.io/v1/boards/<slug>/jobs`)
   - `https://jobs.lever.co/<slug>` · `https://jobs.ashbyhq.com/<slug>`
   - `https://<slug>.bamboohr.com/careers` · `https://apply.workable.com/<slug>`
   - `https://<tenant>.wdN.myworkdayjobs.com/<site>` (Workday)
3. **Verify before returning it.** Fetch the board and confirm it returns jobs for the right
   company. A URL that 404s or belongs to someone else is worse than no answer, because it will be
   scanned every run.
4. **If the company was acquired**, the right answer is usually `relocated` to the acquirer's board
   when the team still hires under it, or `defunct` when it was absorbed and the brand retired.
   Say which in the note.

## Outcomes

Return one per company. Only these three:

- **`relocated`** — you found a working board. Provide `careers_url` and `provider`.
- **`defunct`** — the company genuinely no longer exists (wound up, fully absorbed). Requires
  positive evidence in `note`: a shutdown notice, an acquisition that retired the brand, a dead
  site plus no hiring presence anywhere. **Not** "I couldn't find it."
- **`unknown`** — you could not determine it. This is a perfectly good answer and is recorded with
  a 45-day backoff. Prefer it over a guess in either direction.

## Output

Write `/tmp/board-repair-out-<N>.json`:

```json
[
  { "key": "greenhouse:dbtlabsinc", "outcome": "relocated",
    "careers_url": "https://jobs.ashbyhq.com/dbtlabs", "provider": "ashby",
    "note": "careers page links Ashby board; 40 jobs incl. Senior Platform Engineer" },
  { "key": "greenhouse:someco", "outcome": "defunct",
    "note": "acquired by X Nov 2025, site redirects, brand retired, no separate hiring" },
  { "key": "bamboohr:cxm", "outcome": "unknown",
    "note": "slug matches no identifiable company; no distinctive titles to search on" }
]
```

Rewrite the file after each company so a killed run keeps its work.

**Do not** run `board-repair.mjs --apply` yourself — the coordinator applies results serially, as
with the research pipeline, because concurrent writes to the registry lose updates.
