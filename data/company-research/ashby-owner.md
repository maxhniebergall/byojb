# Owner.com — research
Provider/key: ashby:owner | company_type: product

What they do: Owner (owner.com) sells an all-in-one, AI-powered growth platform to independent restaurants — restaurant websites, direct online ordering, mobile apps, email/SMS marketing automation, and loyalty programs. The pitch is that independents can take direct orders and own their customer relationships instead of paying DoorDash/Grubhub commissions. Founded 2019 by Adam Guild. Self-reported traction from their JDs: "Since 2020, we've generated tens of millions in revenue and processed over a billion dollars of online orders. 1 in 5 Americans have used an Owner.com website. We've helped over 20,000 restaurant owners, and saved them nearly $200 million in fees." Current build areas visible in open roles: **Grader** (a scanning/diagnostic product), **RestX** (autonomous restaurant-operations software, workflow orchestration and AI agents), Guest Lifecycle & Loyalty, and Identity & Access Management.

How they describe themselves: Growth-forward and unapologetically ambitious. Recurring JD language: "We'll be scaling even faster in 2026 to keep pace with our customer growth"; "Comfort with ambiguity and a bias for impact — you turn open-ended, aspirational goals into concrete technical bets, and you're energized rather than daunted by problems nobody has solved yet"; "Strong sense of ownership and drive… a proactive approach to identifying and solving problems"; "align stakeholders and influence decisions across teams without authority"; "high degree of cross-functional collaboration — past colleagues in product, design, and business would speak highly of your teamwork"; "fast-moving environment." They foreground the pedigree of the team: "Our team is now in the low hundreds. We've got top talent from the most successful companies in SMB software, including Shopify, HubSpot, DoorDash, ServiceTitan, Rappi, Faire and Stripe."

Size / stage / funding: ~387 employees as of June 2026 (roughly doubling year over year — 100 → 200 during 2024). Private, **Series C**: $120M raised at a **$1B valuation**, led by Meritech (Alex Kurland) and Headline (Shalini Rao), with strategic angel money from the Sweetgreen and Cava CEOs; ~$189M total raised, other backers include Redpoint Ventures, Altman Capital and SaaStr. Their own JDs reference a "generous **pre-IPO** equity package," so an eventual listing is the framing. Not stated to be profitable.

Locations / HQ: Headquartered in San Francisco (a new HQ in the Presidio; some sources list Palo Alto), with a **sales hub in Toronto**. "Most of our teammates are distributed throughout the globe."

Remote policy: "Owner is a remote-first, global company." Benefits copy says "work from anywhere (remote-first workplace)" and unlimited PTO. Caveat in their own words: "For a few of our roles we prioritize in-person collaboration at one of our office locations" — for SF-based candidates the Presidio HQ is optional in-person collaboration.

Remote-Canada eligibility: **Verified yes for the engineering roles.** The Backend, Grader, RestX and IAM JDs each state "This role is 100% remote and can be based anywhere in the United States or Canada," and registry locations include "Remote - Canada" and "Remote - United States, Remote - Canada." A Toronto sales hub plus existing Canadian postings confirm they can employ Canadians. **Two caveats**: (a) several engineering reqs are posted as "Remote - United States" only — Senior/Staff SWE Guest Lifecycle & Loyalty and Senior/Staff SWE RestX in some variants — so eligibility must be checked per-req, not assumed company-wide; (b) no timezone requirement is stated anywhere, but the company's centre of gravity is US Pacific/Eastern, which is workable from Mountain Time.

Engineering & tech: **TypeScript everywhere.** Backend Node.js/TypeScript; Frontend React, Next.js, some Vue; Mobile React Native; Databases MongoDB and PostgreSQL; Infrastructure & Observability Datadog, AWS, **Temporal** (workflow orchestration). Engineering themes include data pipelines behind Grader scans, auth/authorization infrastructure (OAuth, BFF pattern, IAM, API design), workflow orchestration, automation systems and AI agents, plus lifecycle/loyalty systems with A/B experimentation ("defining success metrics, running controlled experiments/holdouts, debugging performance changes across complex funnels"). Levels visible: senior, staff, lead. Roles are described as end-to-end ownership within a product domain.

Notable / other: Benefits are thin on detail — comprehensive health coverage, work-from-anywhere, unlimited PTO, "plus extra fun perks", and pre-IPO equity. JDs carry an employment-scam warning notice. A separate track of "Applied AI" roles (Lead/Senior Associate, Product & Customer Strategy Analytics & Applied AI) sits between analytics and engineering; those postings are Remote US **and** Canada.

**Data-quality flags for this registry entry**:
1. `data/company-comp.jsonl` holds a `security`/`senior` band of US$120,000–180,000 attributed to the Senior SWE Identity and Access Management JD. That JD body in `data/posting-research/` contains **no compensation section at all** — the number does not appear in the source and should be treated as an extractor artifact, not a company statement. Owner's sibling senior engineering JDs all state $190K–$220K.
2. The two "Applied AI" analytics JD bodies (`...2113febe...`, `...afeed50a...`) are ~240-byte stubs — headers only, no content was captured despite `has_body: true`.
3. The Senior SWE, Identity and Access Management req appears twice (Remote - Canada and Remote - United States) — same role, two location variants, counted as two postings.

Open relevant roles (sample): Senior DevOps Engineer; Senior Software Engineer, Backend; Senior/Staff Software Engineer, Backend (Grader); Senior/Staff Software Engineer, RestX; Senior/Staff Software Engineer, Guest Lifecycle & Loyalty; Senior Software Engineer, Identity and Access Management; Lead, GTM Analytics & Applied AI.

Comp (stated on their own JDs, USD base, "estimated starting base salary range… depending on level, location and experience, plus a generous pre-IPO equity package"):
- Senior Software Engineer, Backend — $190K–$220K
- Senior Software Engineer, Guest Lifecycle & Loyalty — $190K–$220K
- Senior Software Engineer, RestX — $210K–$230K
- Staff Software Engineer, RestX / Guest Lifecycle / Grader — $220K–$240K
- Senior DevOps Engineer — $190K–$220K (senior level) or $220K–$240K (staff level)
No dual-currency (CAD) figures are published; all ranges are USD.

Sources:
- JD bodies already in the registry: https://jobs.ashbyhq.com/owner/0b373b8f-ca11-4a4a-ad68-76ffd79a35d6 , /03e2288e-b2dc-4430-ac02-af1731630c93 , /0fdcea84-a2fd-49a9-9065-5ee6c6c5aae2 , /21f3b4f3-290c-4339-aea4-ef62598624f1 , /835c2f86-eeb7-4b23-a285-b26b339ad80a , /fc0836f0-a4f2-437f-b438-5774e0021fbc , /f3a1916f-4da3-4579-88c1-7afeca67811d
- https://www.restaurantbusinessonline.com/technology/tech-supplier-ownercom-raises-120m-giving-it-1b-valuation
- https://research.contrary.com/company/owner
- https://en.wikipedia.org/wiki/Owner.com
