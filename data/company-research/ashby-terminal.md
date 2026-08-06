# Terminal — research
Provider/key: ashby:terminal | company_type: product

ENTITY CHECK: "Terminal" is a heavily colliding name (Terminal.shop, Terminal the remote-hiring marketplace, and others). The entity behind `ashby:terminal` is identifiable from its own JDs as a **Toronto-based early-stage startup building a data/ingestion platform with connector frameworks and public APIs**, hiring exclusively in the GTA. The registry also carries a junk duplicate row for this key under the name "Terminal Use" — same Ashby board, not a distinct company (see data-quality note).

What they do: Based on the JD content, they build an integrations/ingestion platform — connector frameworks, an ingestion pipeline, orchestration and public APIs — with a dedicated Data Platform team alongside a Product & Integrations team. The customer-facing framing is not stated in the captured JD text beyond that, and no first-party marketing page could be fetched to confirm the vertical.

How they describe themselves: The JD signals captured are operational rather than mission-flavoured: "high ownership", "early-stage speed", and an explicit, repeated statement that roles are "only open to Toronto/GTA-based candidates" with work "in person 4 days/week [in] downtown Toronto". Four weeks paid time off is offered. No mission statement or values list was recoverable from the captured bodies.

Size / stage / funding: Early-stage startup — the Stage-3 extraction labelled both live postings `company_stage: startup` with an "early-stage speed" signal, and the prior Stage-2 note recorded it as Series A. Exact funding, investors and headcount are UNVERIFIED (no first-party page fetched). The org is small enough that only four engineering roles appear on the board, but already split into two named teams (Data Platform; Product & Integrations).

Locations / HQ: Downtown Toronto, Ontario. Every posting is tagged "📍 Toronto, ON" and the JDs restrict candidates to Toronto/GTA. Single-office company.

Remote policy: ONSITE-DOMINANT HYBRID — "in person 4 days/week downtown Toronto". One remote day a week. Timezone America/Toronto.

Remote-Canada eligibility: VERIFIED NO. The JDs state the roles are "only open to Toronto/GTA-based candidates" and require four in-person days a week in downtown Toronto. This is Canadian employment but categorically not remote-Canada. Fully disqualifying for a Kimberley, BC candidate who cannot relocate — more so than any other company in this batch, since even the one remote day is anchored to a GTA residence.

Engineering & tech: Stated stack, verbatim from the Backend JD: "TypeScript, JavaScript, Java; Node.js, AWS, Lambda, SQS, Kafka, EventBridge, Step Functions, Temporal", plus "connector frameworks, orchestration, monitoring, auth, distributed systems, ingestion platform, public APIs, serverless, event-driven architecture". This is genuinely strong infrastructure content — event-driven AWS serverless with Kafka and Temporal, an ingestion platform and connector framework. The Data Platform roles sit at a higher band than the product roles, suggesting the data platform is the harder/more valued surface.

Compensation (first-party, posted on their own Ashby JDs — Ashby renders the range in the ATS field): Software Engineer, Backend — CA$185K–CA$285K. Software Engineer, Data Platform — CA$200K–CA$295K. Senior Software Engineer, Data Platform (closed) — CA$150K–CA$200K. Senior Software Engineer, Product & Integrations (closed) — CA$150K–CA$200K. Equity is indicated on the live roles. Note the inversion: the roles titled "Senior" post LOWER ranges than the untitled ones, so the un-prefixed "Software Engineer" reqs are evidently the higher/staff-flavoured band. All four are already on record in `data/company-comp.jsonl` (two `direct`/`jd_posted`, one `inferred`/`jd_rollup`); no revision is warranted.

Notable / other: Pay is high for Toronto — CA$200–295K for a data-platform engineer is top-decile locally and is clearly being used to buy four-days-in-office attendance from a small early-stage company. Four weeks PTO is above the Canadian norm. "High ownership" plus "early-stage speed" at a company this size means broad scope and limited specialisation.

Open relevant roles (sample): Software Engineer, Backend (Toronto ON, live, CA$185–285K); Software Engineer, Data Platform (Toronto ON, live, CA$200–295K); Staff Software Engineer - Data Platform; Senior Software Engineer - Data Platform; Staff / Senior Software Engineer - Product & Integrations.

Sources: JD bodies and ATS comp fields captured in the registry: https://jobs.ashbyhq.com/terminal/bd6bbb0b-0628-44d5-9ffe-ab17d2f4a0e0, https://jobs.ashbyhq.com/terminal/16965e2e-318d-4d29-92b2-d900dc51aef9 (cited, not re-fetched — Ashby boards are client-rendered). No first-party site was fetched: WebSearch was exhausted this session and no company domain appears in the registry, so guessing a URL was declined — which also means the product/vertical remains unconfirmed.
