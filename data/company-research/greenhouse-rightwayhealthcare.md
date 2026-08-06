# Rightway (Rightway Healthcare) — research
Provider/key: greenhouse:rightwayhealthcare | company_type: product

What they do: Rightway is a healthcare navigation and pharmacy-benefit-management (PBM) company selling to employers. Its own description: "Rightway is on a mission to harmonize healthcare for everyone, everywhere. Our products guide patients to the best care and medications by inserting clinicians and pharmacists into a patient's care journey through a modern, mobile app. Rightway is a front door to healthcare, giving patients the tools they need along with on-demand access to Rightway health guides, human experts that answer their questions and manage the frustrating parts of healthcare for them." It serves more than 3 million members, and clients "rely on us to transform the healthcare experience, improve outcomes for their teams, and decrease their healthcare costs." The engineering work in the registry is on the **next-generation PBM platform** — "the systems that power pharmacy benefits, determine coverage and pricing, and manage member cost-sharing across our entire book of business" — and on the data platform processing large healthcare datasets.

How they describe themselves: Values are published on the postings —
- **"We are human, first"** — "Our humanity binds us together. We bring the same empathetic approach to every individual we engage with, whether it be our members, our clients, or each other. We are all worthy of respect and understanding… We honor our stories. We listen to — and hear — each other, we celebrate our differences and similarities, we are present for each other, and we strive for mutual understanding."
- **"We redefine what is possible"** — (text truncated in the captured body; framed around ambition and challenging the status quo.)
They also state who they hire: "We're seeking those with passion for healthcare and relentless devotion to our goal."
On engineering culture the senior platform JD is unusually direct: "This isn't a 'write features to spec' role. Our senior engineers own initiatives end-to-end: they shape architecture, define technical direction, unblock other engineers, and drive delivery across multiple workstreams… You'll be the person your teammates come to when they're stuck, and you'll build the documentation, patterns, and tooling so they get stuck less often." And: "We're an AI-native engineering team that uses AI tooling daily in our development workflow and expects our senior engineers to lead adoption, establish best practices, and help the team get better at working with these tools. The platform team is designed from day one around AI-assisted development."

Size / stage / funding: Founded 2017. "Since its founding in 2017, Rightway has raised over $200mm from investors including Khosla Ventures, Thrive Capital, and Tiger Global." Late-stage venture-funded; profitability not stated. Headcount not stated.

Locations / HQ: "We're headquartered in New York City, with satellite offices in Denver and Dallas." Both live engineering roles are posted "Remote."

Remote policy: Roles are posted Remote against a NYC-headquartered, three-office company. No remote-work philosophy, async policy, or required-office-days statement appears in the postings — "Remote" is only the location field. Denver and Dallas offices mean Mountain and Central time zones are already represented in the company, which is a mild positive for Mountain-Time working hours.

Remote-Canada eligibility: **Unclear — not verified, and the available signals lean US-only.** The postings carry no country, work-authorization or timezone statement. Everything else is US-centric: NYC HQ, US satellite offices, US healthcare/PBM regulation (NCPDP, GPI, NDC standards), a US pharmacy benefits book of business, and compensation "determined by geographic location" in USD without a Canadian equivalent. Nothing states Canada is excluded, but nothing supports it either — confirm before investing effort.

Engineering & tech:
- **PBM Platform (backend/platform)**: "React on the frontend with TypeScript (NestJS) and Go on the backend. You should be comfortable working across both backend languages." gRPC APIs with Protocol Buffers, PostgreSQL persistence, normalized data models (3NF) for complex domain entities, service boundaries and API contracts, distributed-system failure modes and contract evolution, internal tooling interfaces in React, observability owned by the team (Datadog monitors, Sentry error tracking), test-driven development. Greenfield: "This is a greenfield platform and you'll be making foundational decisions with imperfect information." Domain-heavy — engineers attend "domain learning sessions with PBM subject matter experts and help translate business rules into system design"; financial calculation and rules engines are extra credit.
- **Data platform**: production Python and expert-level SQL ("complex SQL for data transformation, pipeline logic, and analytical query optimization"), AWS Lambda/Glue/Fargate, Apache Airflow for large-scale pipelines, DBT for ELT, PostgreSQL and Amazon Redshift schema design, serverless architecture, Terraform/CloudFormation IaC, Master Data Management and data governance, medical and pharmacy claims data. AI tooling is an explicit requirement here too: "Leverage AI tools and large language models to augment engineering workflows — from code generation and query optimization to automated testing, documentation, and process improvement."

Compensation: Ranges posted directly on both JDs (USD, annual, "in addition to bonus and equity"; "compensation offered will be determined by geographic location, experience, and qualifications"):
- Sr Software Engineer, PBM Platform — **$160,000 – $190,000**
- Data Engineer III — **$125,000 – $150,000**
Both already recorded as `direct` / `jd_posted` bands in the registry; no new or better evidence found, so no band row written.

Notable / other: The postings carry a **cybersecurity/recruitment-fraud notice**: "In response to ongoing and industry-wide fraudulent recruitment activities (i.e., job scams), Rightway wants to inform potential candidates that we will only contact them from the @rightwayhealthcare.com email domain. We will never ask for bank details or deposits of any kind as a condition of employment." Postings are hosted on the company's own domain (rightwayhealthcare.com/jobs) rather than only on a Greenhouse board.

Open relevant roles (sample): Sr Software Engineer, PBM Platform; Data Engineer III.

Sources: local JD bodies captured from the company's own careers pages —
https://rightwayhealthcare.com/jobs?gh_jid=7683695003 ;
https://rightwayhealthcare.com/jobs?gh_jid=7789961003 .
No additional corporate pages fetched this session, so headcount, profitability, remote policy and Canadian hiring are unverified.
