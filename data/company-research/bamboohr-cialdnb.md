# cialdnb — research (BLOCKED — not completed)
Provider/key: bamboohr:cialdnb | company_type: unknown

**Status: research failed this session.** Recorded here so a future run starts ahead rather than repeating the dead end.

Why it failed:
- The only URL in the registry is https://cialdnb.bamboohr.com/careers, and BambooHR returned **HTTP 403** to a fetch attempt — the board is unreadable.
- **No JD body was captured** for the single relevant posting (`has_body: false`), so there is no company self-description, no location, no stack, and no eligibility language to work from.
- The posting itself carries **no location field** at all.
- The session's global web-search budget (200 calls) was exhausted, so the company's own domain could not be resolved. Guessing a URL from the slug is disallowed by the mode and is exactly the failure this rule exists to prevent.

Everything verified (this is the complete set):
- Registry name/slug: `cialdnb`; 30 total open postings, 1 relevant, 0 remote-relevant.
- The one relevant posting: **"SRE — Incidents & Monitoring"**, no location, no compensation — https://cialdnb.bamboohr.com/careers/711
- Prior local triage note on that posting: *"SRE role, no location given"* (llm_rank 2).

Unresolved and explicitly NOT asserted: company identity. The slug reads like **"CIAL Dun & Bradstreet"** — Dun & Bradstreet's Latin America business — but that is a guess from the string alone and was **not confirmed against any source**. Do not treat it as identified. If correct, the role would most likely be based in Latin America and the remote-Canada question would almost certainly resolve negative; but that chain of inference is unverified at every link.

What the next run needs: one web search to resolve the entity and its real domain, then one fetch of its about/careers page. The title *"SRE — Incidents & Monitoring"* is on-archetype for the profile, so this is worth retrying rather than dropping.

Sources: local registry only (`data/company-research.jsonl`, `data/posting-research.jsonl`, `data/postings-personal.jsonl`). No page was successfully fetched.
