# Workday — research
Provider/key: workday:workday/workday | company_type: product

What they do: Workday is an enterprise cloud software platform for HR, finance, planning, legal and
IT operations — the incumbent SaaS system of record for HCM and financial management at large
enterprises. Current positioning is heavily AI-agent-flavoured: enabling organizations to "turn AI
into ROI" and "transform how work gets done," with AI agents automating business processes. It also
runs a US Federal business (FedRAMP-scoped government cloud) and has absorbed acquisitions including
**Evisort** (AI contract intelligence), which is a distinct engineering group in the postings.

How they describe themselves: The public site foregrounds "inclusion & belonging" as a core value
and refers to employees as "Workmates" (which appears verbatim in JDs). Their flexible-work
philosophy is stated on nearly every JD as **"Flex Work"**: "With Flex Work, we're combining the
best of both worlds: in-person time and remote... We know that flexibility can take shape in many
ways, so rather than a number of required days in-office each week, we simply spend at least half
(50%) of our time each quarter in the office or in the field with our customers, prospects, and
partners." They add that "Those in our remote 'home office' roles also have the opportunity to come
together in our offices for important moments that matter." The full formal value set was not
retrievable — the about-page path returned 404 and search was unavailable, so it is UNVERIFIED.

Size / stage / funding: Large, publicly traded (investor.workday.com; NASDAQ: WDAY), long-
established enterprise SaaS. Maximum stability class. Headcount not verified from a fetched source.

Locations / HQ: HQ is not stated on the homepage (historically Pleasanton, California — treated as
unverified here, though "USA, CA, Pleasanton" is the primary location on multiple live JDs).
Engineering locations visible in live postings: Pleasanton CA; **Reston, Virginia** (the entire US
Federal organisation); and **Toronto, Ontario, Canada** (Evisort AI and related roles).

Remote policy: **Hybrid by design.** "Flex Work" mandates roughly 50% of time per quarter in an
office or in the field. Some federal JDs put it even more concretely: "We have a hybrid schedule
where you will have the opportunity to collaborate with Workmates at the office but still have the
flexibility to work up to 50% remote." Fully-remote "home office" roles are acknowledged to exist
but none of the live engineering postings in this registry is one.

Remote-Canada eligibility: **NO — effectively disqualifying, on two independent grounds.**
(1) The large majority of live relevant roles (roughly 24 of 34) are **US Federal** roles based at
USA.VA.Reston, and their JDs state: "due to federal government security requirements, [it] mandates
that all Workday personnel working on the contracts be United States citizens (naturalized or
native)," with many adding "This role may require a security clearance at the TS/SCI w/CI Poly
level." A Canadian citizen is categorically ineligible for these.
(2) The Canadian roles that do exist are **Toronto** seats under Flex Work's 50%-in-office
expectation — e.g. "Senior Software Engineer - Evisort AI (Python/Typescript)", Canada-ON-Toronto,
extracted as `hybrid`. That is a Toronto hybrid role, not remote-from-BC, and Eastern time is two
hours off Mountain.

Engineering & tech: Broad and genuinely infrastructural in parts. Live roles cover distributed
systems at principal level, DBaaS (database-as-a-service) engineering, developer platform, cloud
engineering, integration platform, DevOps and a large SRE contingent, cybersecurity data
engineering on a data platform / lakehouse, analytics engineering, and an AI/agentic track
(Principal AI Engineer, "Sr Software Engineer – API Platform & Agentic AI (Python/Typescript)",
Senior Software Engineer (Gen AI), Evisort AI). Languages visible: Python, TypeScript. Much of the
platform work (DBaaS, developer platform, cloud/integration platform) is exactly the internal-
plumbing shape the profile targets.

Compensation transparency: Very good — Workday posts base-pay ranges on its own JDs, typically as
"Primary Location Base Pay Range" plus "Additional US Location(s) Base Pay Range". Observed on live
JDs: Senior Software Engineer (Pleasanton) $190,100–$285,100 USD (additional US $160,100–$285,100);
Sr SWE API Platform & Agentic AI (Pleasanton) $176,000–$264,000 USD; Senior SWE (Gen AI)
$171,600–$257,400 USD (additional US $163,000–$288,000); Mid/Senior SWE Developer Platform (Federal)
$163,800–$245,800 USD (additional US $148,200–$264,000); Principal, Software Engineer (Distributed
Systems) $222,900–$334,300 USD (additional US $187,100–$334,300); Principal Cloud Engineer (Federal)
$191,500–$287,300 USD (additional US $173,300–$309,600); Senior Cybersecurity Data Engineer
$159,600–$239,400 USD (Colorado $152,000–$228,000); Software Engineer Integration Platform (Federal)
$151,500–$227,300 USD; Software Engineer DBaaS (Federal) $137,000–$205,400 USD; Cloud Engineer
(Federal) $123,300–$184,900 USD; Analytics Sr SWE (Federal, additional US) $137,100–$243,600 USD.
**Canada:** Senior Software Engineer - Evisort AI, Toronto — "Primary CAN Base Pay Range: $140,000 -
$210,000 CAD". Roles are also noted as potentially eligible for "the Workday Bonus Plan or a
role-specific commission/bonus".

Notable / other: **Data-quality note for the registry** — this portal shows 34 live relevant
postings, but ~24 are US-Federal/Reston roles requiring US citizenship and often TS/SCI clearance.
Those citizenship clauses are in the JD bodies but are not reflected in any extracted geo facet, so
the company reads far more available than it is. Several federal SRE postings are near-duplicates of
each other, inflating the count further.

Open relevant roles (sample): Principal, Software Engineer (Distributed Systems) — Pleasanton;
Sr Software Engineer – API Platform & Agentic AI — Pleasanton; Senior Software Engineer - Evisort AI
(Python/Typescript) — Toronto, Canada; Principal Cloud Engineer - US Federal — Reston; Senior Site
Reliability Engineer (US Federal) — Reston; Senior Cybersecurity Data Engineer - Data Platform &
Lakehouse SME.

Sources:
- https://www.workday.com/ (fetched 2026-07-31)
- https://www.workday.com/en-us/company/about-workday/overview.html (attempted 2026-07-31, HTTP 404)
- Live JD bodies from the local registry (cited, not re-fetched), e.g.
  https://workday.wd5.myworkdayjobs.com/workday/job/Canada-ON-Toronto/Senior-Software-Engineer---Evisort-AI--Python-Typescript-_JR-0107091
  https://workday.wd5.myworkdayjobs.com/workday/job/USAVAReston/Principal-Cloud-Engineer---US-Federal_JR-0108260
