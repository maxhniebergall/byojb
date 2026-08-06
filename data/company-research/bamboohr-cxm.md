# cxm — research (BLOCKED — not completed)
Provider/key: bamboohr:cxm | company_type: unknown

**Status: research failed this session.** Recorded here so a future run starts ahead rather than repeating the dead end.

Why it failed:
- The only URL in the registry is https://cxm.bamboohr.com/careers, and BambooHR returned **HTTP 403** to a fetch attempt — the board is unreadable.
- **No JD body was captured** for the single relevant posting (`has_body: false`) — no company self-description, no location, no stack, no eligibility language.
- The posting carries **no location field** at all.
- The session's global web-search budget (200 calls) was exhausted on the attempt to identify this company specifically, so the entity could not be resolved and no company domain is known. Guessing a URL from a three-letter slug would be pure invention and is disallowed.

Everything verified (this is the complete set):
- Registry name/slug: `cxm`; 0 relevant / 0 remote-relevant in the objective record.
- The one relevant posting: **"Site Reliability Engineer"**, no location, no compensation — https://cxm.bamboohr.com/careers/222

Unresolved and explicitly NOT asserted: company identity. `cxm` is a three-letter slug that most commonly abbreviates **"customer experience management"**, a label used by numerous software vendors *and* by BPO / outsourced-contact-centre firms. If it turns out to be the latter, the correct outcome is `company_type: outsourcing` and permanent removal rather than a fit score — **that determination could not be made here and should be the first thing the next run checks.** No identification is being claimed.

What the next run needs: one web search on the slug to establish the entity and whether it is a product company or an outsourcing/BPO firm, then one fetch. The title "Site Reliability Engineer" is on-archetype for the profile, so it is worth one retry — but if it resolves to a BPO, close it out with `company_type`.

Sources: local registry only (`data/company-research.jsonl`, `data/posting-research.jsonl`, `data/postings/raw-latest.jsonl`). No page was successfully fetched.
