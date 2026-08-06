# Mixpanel — research
Provider/key: greenhouse:mixpanel | company_type: product

What they do: Mixpanel is an event-based digital/product analytics platform — the category-defining product analytics tool alongside Amplitude. Its platform combines product and web analytics, session replay, experimentation, feature flags and metric trees, and it now markets itself as "AI-first digital analytics". It claims more than 29,000 companies as customers (Workday, Pinterest, LG, Rakuten Viber named on its own JD) and, in the same JD, "over 9,000 customers" in the older boilerplate — the two numbers come from different sections of their own posting.

How they describe themselves: "Mixpanel turns data clarity into innovation." On their careers site they say "We believe in builders" — people creating change through new companies, products and services — and "when everyone in the organization can see, and learn from, the impact of their work, they are poised to make better decisions." Full stated culture values (verbatim from their JD and careers page):
- **Make Bold Bets** — "We choose courageous action over comfortable progress."
- **Innovate with Insight** — "We tackle decisions with rigor and judgment — combining data, experience and collective wisdom to drive powerful outcomes."
- **One Team** — "We collaborate across boundaries to achieve far greater impact than any of us could accomplish alone."
- **Candor with Connection** — "We build meaningful relationships that enable honest feedback and direct conversations."
- **Champion the Customer** — "We seek to deeply understand our customers' needs, ensuring their success is our north star."
- **Powerful Simplicity** — "We find elegant solutions to complex problems, making sophisticated things accessible."
The careers page additionally emphasises an ownership-based culture, belonging, psychological safety, diversity, and social/environmental responsibility. Tone is measured and engineering-credible rather than hustle-flavoured — though "Make Bold Bets" and "trailblazers" language does appear.

Size / stage / funding: Private, late-stage. $277M raised from Andreessen Horowitz, Sequoia, Y Combinator and most recently Bain Capital (their own words). Headcount is not disclosed on any page fetched; publicly it is a several-hundred-person company, but that is **unverified here**.

Locations / HQ: San Francisco is the anchor location (their salary bands are benchmarked to "the SF Bay Area Technology data cut released by Radford"). The careers page refers to "hub locations" without naming them, and the JD is titled "San Francisco, US (Remote)". Other office geos could not be verified from the pages fetched.

Remote policy: Flexible hybrid, hub-based. Their own words: "Both in-person and remote work drive value, depending on the job… we strategically hire in hub locations, create opportunities for intentional in-person moments and community building, and seek to optimize both the in-office and remote work experience." So remote is allowed but hiring is deliberately concentrated near hubs.

Remote-Canada eligibility: **No, for the live role — and unclear at company level.** The evidence is first-party and specific: the DevInfra JD states its range is "across the United States", that the band "represents the minimum and maximum TTCC for new hire salaries for the position **across all of our US locations**", and lists "Additional **US** Benefits: Pre-Tax Benefits including 401(K)…". Nothing on the careers page mentions Canadian employment. Treat the current opening as US-only; no Canadian entity was found or claimed.

Engineering & tech: Substantial, well-documented infrastructure org. Runs **entirely on Google Cloud Platform and GKE**. The DevInfra team is the platform-engineering team ("a force multiplier for Mixpanel engineering as a whole") and owns: Terraform, cloud networking, cost management and security; Kubernetes as service owner (standards for deployment, observability, developer experience; version upgrades); observability pipelines with **30M+ Prometheus time series** and **4B+ OpenTelemetry tracing spans/month**; GitHub Actions CI/CD in a monorepo with conditional required checks; a devbox system provisioning cloud dev environments; SaaS tooling relationships (GitHub, Honeycomb, Chronosphere, Sentry); and new-engineer onboarding. Data scale: ingests **>1 trillion user-generated events per month**, queries scanning **>1 quadrillion events per month**, balanced against low end-to-end query latency, on highly stateful in-house storage systems. Languages: Go, Python, JavaScript/TypeScript. Bonus skills sought include Bazel, service mesh, Backstage/IDP, SLO-based SRE practice, GitOps. They maintain a real engineering blog at engineering.mixpanel.com (cited posts: "Under the Hood of Mixpanel's Infrastructure", "How We Migrated from StatsD to Prometheus in One Month", a post on enforcing required checks on conditional CI jobs in a GitHub monorepo).

AI posture: DevInfra is "responsible for deploying AI tools like Claude Code to our entire engineering team" and is "building agents into our platform to… augment on-call response and automatically one-shot bugs that come through a team's triage queue". The JD asks for someone who "leverages AI to great effect without generating slop" and lists "Knowledgeable about coding agents like Claude Code" as a hard requirement.

Compensation (already on record, from their own JD): software_general / unspecified — **$157,500–$213,000 USD**, stated as total target cash compensation (base + bonus/commission), plus equity, for the DevInfra role across all US locations. Bands are Radford-benchmarked to SF Bay Area and refreshed twice a year. A second figure in the same posting's hidden metadata gives $174,600–$213,400 TTC; the visible published range is the $157,500–$213,000 one.

Notable / other: Benefits — comprehensive medical/vision/dental, mental wellness benefit, "generous" vacation plus additional company holidays, enhanced parental leave, volunteer time off, 401(k), wellness benefit, holiday break. Equal-opportunity employer language references the San Francisco Fair Chance Ordinance. Benefits explicitly vary for contract positions.

Open relevant roles (sample): Software Engineer, DevInfra; Senior Software Engineer, AI Platform; Senior Software Engineer, AI Product Insights; Software Engineer, AI Product Insights.

Sources:
- https://job-boards.greenhouse.io/mixpanel/jobs/7941929 (JD body via local registry; ATS board not fetched)
- https://mixpanel.com/about/
- https://mixpanel.com/careers/
- Engineering blog referenced from their JD: https://engineering.mixpanel.com/ (not fetched)
