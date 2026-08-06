# Scalar — research
Provider/key: ashby:scalar | company_type: product

> **Entity note / registry data-quality flag:** the registry stores this company's `name` as **"Scalar Field"**. That is wrong. The Ashby slug `scalar` and the live JD both resolve to **Scalar, "the API company"** (scalar.com), the open-source OpenAPI documentation / SDK / API-client company. "Scalar Field" is an unrelated name. The registry `name` field should be corrected to "Scalar".

What they do: Scalar builds API developer-experience infrastructure as a product — API reference documentation generated from OpenAPI/AsyncAPI specs, an SDK generator that turns a customer's OpenAPI document into type-safe client libraries across TypeScript, Python, Go, PHP, Java and Ruby, an open-source offline-first API client (a Postman alternative), an API registry, and "Agent Scalar," a set of secure MCP servers and AI features for chatting with APIs. The thesis in their own words: "Building on a great API is one of the best feelings in software — every interface you want is right there, and it all just works. Building on a bad one is the opposite: out-of-date docs, no SDK in your language, no MCP server. We started Scalar to fix that."

How they describe themselves: Three stated principles — accessibility, API-first design, and open-source commitment. "We think every company deserves Stripe-level docs, SDKs, and MCP servers from day zero — not just the ones with a platform team to build them." "Open-source is in our DNA: our whole team contributes to and maintains repositories across the API ecosystem, including the standards everyone relies on, like OpenAPI." On working style: "We're a small team (around ten engineers and designers) who wear a lot of hats and obsess over our craft… We keep things lean and move without layers of process — engineers pick up problems, talk to each other, and ship. We're looking for owners with high agency: people who see what needs doing and do it. If you do your best work with a lot of autonomy and very little ego, you'll feel at home here." And on disagreement: "You'd rather collaborate to the right answer than win the argument, and you operate with a high level of kindness."

Size / stage / funding: ~10 engineers and designers — very early. Backed by General Catalyst and Kindred, plus angels from GitHub, Vercel, Figma, Notion, Sentry, Clerk and PagerDuty. Co-founders Marc Laventure, Cameron Rohani, Hans Pagel. The open-source project started in 2023. Early-stage and runway-dependent.

Locations / HQ: Distributed; origins are a Berlin-based core team, hiring across Europe and North America.

Remote policy: Remote. Their own JD: "Remote. Most of the team overlaps with US time zones (PT–ET), and we prefer candidates in the US or Western Canada for that overlap."

Remote-Canada eligibility: **Yes — and explicitly Western Canada.** The Senior Platform Engineer JD names "the US or Western Canada" as the preferred candidate geography for PT–ET overlap. This is the single most favourable remote-eligibility statement in this batch: Kimberley, BC (Mountain Time) is squarely inside the stated preference rather than merely tolerated. The posted range is also in CAD (CA$150K – CA$250K + equity), which is strong evidence they actually employ Canadians rather than only contracting them.

Engineering & tech: TypeScript monorepo on GCP. Infrastructure-as-code is Pulumi written in TypeScript — "our infrastructure-as-code is Pulumi written in TypeScript — so platform work here is engineering, not just YAML" and "our infrastructure is real software, not config soup." Hybrid compute model: Cloud Run for most backend services plus multi-region Compute Engine managed instance groups for stateful high-throughput services (hosted doc serving, realtime, collaborative editing). Async backbone on Pub/Sub with dead-letter handling, Cloud Tasks, Cloud Scheduler. Object storage and artifact pipelines on GCS with CDN delivery. Polyglot persistence: MongoDB as primary store alongside purpose-specific PostgreSQL databases including pgvector. Observability via Sentry, structured logging (pino → Better Stack), analytics into BigQuery. Internal tooling: in-house CLI toolkit, per-service deploy pipelines, GitHub Actions CI, DB-backed feature-flag system. Agent Scalar is built on the Vercel AI SDK, the MCP SDK, and Vertex AI. They state an "in-house-first instinct — we build our own clients and tooling and work hard to reduce external dependencies."

Notable / other: The Senior Platform Engineer role is framed as "one of the most load-bearing roles on the team: when you make the platform faster and more reliable, everyone ships faster" — i.e. an explicitly internal-customer, leverage-oriented platform role rather than feature work.

Open relevant roles (sample): Senior Platform Engineer (Remote, CA$150K–CA$250K + equity). They also advertise Senior/Staff Fullstack and Senior/Staff Product Engineer roles.

Sources:
- https://scalar.com/company
- https://scalar.com/
- JD body already in the registry: https://jobs.ashbyhq.com/scalar/77ff0d8b-37ea-4185-b3fd-6f6cc64c08fd
