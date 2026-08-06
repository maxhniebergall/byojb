# Strike — research
Provider/key: greenhouse:strike | company_type: product

What they do: In their own words, "Strike is the Bitcoin company. With Strike, you can buy and sell
bitcoin, pay bills, and borrow against your holdings. From individuals to businesses, Strike is
purpose-built for every step of the Bitcoin journey. Available in more than 100 countries —
including the U.S., Europe, Latin America, and Africa — Strike is building a better financial system
powered by Bitcoin. Bitcoin is better money. Strike is how you use it." Their headline is "Better
Money." Consumer and business bitcoin payments, custody-adjacent services and bitcoin-backed
lending.

How they describe themselves: Engineering-forward and self-consciously high-velocity: "Strike is
already a high-velocity, cloud-native engineering organization. We run immutable infrastructure on
GKE, we enforce 'Shift-Left' security, and we deploy constantly." On AI they are pointedly
anti-hype: "We are fully integrating frontier AI capabilities directly into our ecosystem — not as a
gimmick, but as a force multiplier for our team", "You will not be fine-tuning models or building
chatbots for fun", "this is NOT a Data Science or MLOps role", "You treat AI as a component, not
magic. You are skeptical of hype and focused on measurable utility." Stated expectations include
"Ownership. You are an owner at heart... You operate autonomously, do the unglamorous 80%, and see
things through to completion — every time", "Pragmatism", "Security-First Mindset", and "Clear
communicator." On hiring: "We do not make hiring decisions based on educational history whatsoever.
Our Founder is a college dropout. We work with high school dropouts, PHD candidates and everything
in-between. We do not hire credentials."

Size / stage / funding: Private, venture-backed; the JD calls it "a high-growth startup" and offers
"Equity in a high-growth startup." Headcount, round and investors UNVERIFIED (no first-party site
was fetchable this session — the only registry URLs are Greenhouse board pages, which are off-limits
to fetch, and web search was exhausted). Revenue and profitability unknown. Note the sector: a
bitcoin-exposed consumer fintech carries both crypto-market and regulatory cyclicality.

Locations / HQ: Not stated on the posting. All three live postings are listed simply as "Remote."
The company operates in "more than 100 countries." HQ UNVERIFIED.

Remote policy: Remote. All live engineering postings are "Remote" with no city attached.

Remote-Canada eligibility: **PLAUSIBLE but not explicitly confirmed.** The strongest evidence is
that the JD's compensation section is split into two headings — "**US-Based Positions**" (salary
range $206K–$232K, 401k, US health/dental/vision, etc.) and "**Non US-Based positions**" ("Benefits
and compensation are location dependent"). Strike therefore demonstrably employs people outside the
US, and the role is remote with no stated country restriction. But Canada is nowhere named, and the
non-US arrangement (contractor vs. employer-of-record vs. local entity) is unstated, as is the
compensation consequence — the $206K–$232K figure is explicitly US-only. Ask directly.
Timezone: unstated; a US-centric company is generally workable from Mountain Time.

Engineering & tech: Fully cloud-native on **GCP** with Terraform IaC; orchestration on **Google
Kubernetes Engine** with **Helm and ArgoCD** (GitOps); languages **C#/.NET** for core services,
Python for data/scripts, TypeScript for web; enterprise secrets management and governance tooling;
"Zero Trust" and Shift-Left security. The AI-platform role is explicitly *infrastructure* work:
building and hosting **internal MCP servers** on the GKE/Helm/ArgoCD stack, deploying and tuning IDE
agents, building "the orchestration layers and secure runtime environments for LLM tool-use", an
enterprise knowledge base and connectors for retrieval, and a "Tiered Autonomy" security model
spanning "Advisory (read-only)" to "Autonomous (action-taking)" with "Verifiable State" and "Revert"
mechanisms, plus auth/authorization and human-in-the-loop safeguards for non-human actors. Patterns
named: MCP, RAG, function-calling, evals, AI-as-a-Judge, agent self-improvement. They expect
carrying the pager: "You have carried the pager for what you shipped — you don't just use this
stack, you run it." They also want "Full-Stack Systems DNA... comfortable across the stack —
frontend interfaces, backend distributed systems, and cloud infrastructure."

Notable / other: The company discloses that "Strike uses AI-assisted tools to help review, assess,
and verify applications", with a human always involved. Perks include "No trading fees when you buy
and sell bitcoin on Strike." The JD contains a typo ("our enginners relies on").

Open relevant roles (sample): Senior Platform Engineer, AI Systems (Remote); Site Reliability
Engineer (Remote); Software Engineer, Backend (Remote).

Sources:
- https://job-boards.greenhouse.io/strike/jobs/5779695004 (JD body from local registry; cited, not fetched)
- https://job-boards.greenhouse.io/strike/jobs/4015660004 (registry record)
- https://job-boards.greenhouse.io/strike/jobs/4003945004 (registry record)
- No first-party corporate site verified; web search unavailable this session.
