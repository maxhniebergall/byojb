# S-Quantum Engine — research (FAILED)
Provider/key: recruitee:sqe | company_type: unknown

Status: **Unresearchable this session.** Recorded as a research failure rather than scored.

What happened:
- The only company URL in the registry is the Recruitee careers board `https://sqe.recruitee.com`.
  Fetching the live posting `https://sqe.recruitee.com/o/backend-engineer-mid-to-senior` returns
  **301 → https://recruitee.com/careers_not_hosted**, i.e. the Recruitee-hosted careers site for this
  account is no longer served. The posting is effectively dead even though the registry still marks it
  live.
- The locally stored JD body at
  `data/posting-research/https---sqe.recruitee.com-o-backend-engineer-mid-to-senior.md` (28 KB) is
  **not the job description** — it is a scrape of Recruitee/Tellent's own marketing site (product
  menus, pricing, "See why 7,000+ companies choose Tellent Recruitee"). The only company-specific text
  in the whole file is the title line "Senior Backend Engineer". This is a registry data-quality bug,
  not a source of information.
- No independent company domain is known. "S-Quantum Engine" / slug `sqe` does not map to a domain
  derivable from anything in the registry, and guessing one was deliberately avoided.
- The session's WebSearch budget was fully exhausted (200/200), so the name could not be resolved to a
  real entity. Company names of this shape collide readily, so asserting anything would be a guess.

What is known: nothing beyond the registry metadata — name "S-Quantum Engine", one posting titled
"Senior Backend Engineer" located "Remote job", no comp, no facets. Remote-Canada eligibility, size,
stage, HQ, stack and pay are all **unknown**.

Recommended follow-up: retry once the web-search budget resets, or drop the portal — a Recruitee
account returning `careers_not_hosted` usually means the company stopped using the ATS, in which case
the posting will never resolve.

Sources: none reachable.
- https://sqe.recruitee.com/o/backend-engineer-mid-to-senior (301 → recruitee.com/careers_not_hosted)
