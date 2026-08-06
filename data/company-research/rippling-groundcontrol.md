# GroundControl — research (INCOMPLETE — not researchable this session)
Provider/key: rippling:groundcontrol | company_type: unknown

Status: **Research could not be completed.** No company website could be identified without a web search, and the session's web-search budget was exhausted. The only URL on record is the Rippling ATS board (`https://ats.rippling.com/groundcontrol`), which is client-rendered and returns no content to a fetcher, and no company domain is derivable from it. The name "GroundControl" collides with several unrelated businesses (a US device-management vendor, a UK events venue, a coworking space, various agencies), so guessing a domain would risk documenting the wrong entity entirely. Nothing below should be treated as verified company research.

What is known, entirely from the local registry (no company page was read):
- One live posting: **Senior Software Developer**, location field "St. John's, Newfoundland and Labrador, Canada", first seen in the current scan window.
- The posting body was never captured (`has_body: false`), so there is no job text to read — only the title, location and ATS metadata.
- Stage-2 facet extraction (which had no body to work from, and is therefore low-confidence) recorded: seniority senior, full-time, `remote_policy: remote`, `geo_eligibility: canada`, 5+ years. Treat these as defaults, not findings.
- No compensation is posted, and there is no row in `data/company-comp.jsonl`.
- Uses Rippling as its ATS, which typically indicates a small company (Rippling ATS is bundled with its HR/payroll product).

Remote-Canada eligibility: **UNVERIFIED.** A St. John's, NL location is Newfoundland Time — 4.5 hours ahead of Mountain Time, the worst timezone offset in Canada for a Kimberley, BC candidate. If the role turns out to be office-based or requires Atlantic-hours overlap, it is effectively disqualifying. This must be established before any further work.

What the next attempt should do: run one web search for "GroundControl" together with "St. John's" or "Newfoundland" to identify the actual company and domain, then fetch its about/careers page.

Sources: none fetched. Registry only:
- https://ats.rippling.com/groundcontrol (ATS board, client-rendered — cited, not fetched)
- https://ats.rippling.com/groundcontrol/jobs/1dfff731-ab2c-48cf-a04b-c205a81336b0 (Senior Software Developer posting — cited, body never captured)
