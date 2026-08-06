# Newfold Digital (registry name "Web") — research
Provider/key: workday:web/externalcareersite | company_type: product

**Entity correction (registry data-quality issue):** this key is stored under the name **"Web"**, derived from the Workday tenant `web.wd1.myworkdayjobs.com`. The actual employer is **Newfold Digital**, the parent of the Web.com brand. Their own JD text states it plainly: *"Newfold Digital is a leading web technology company serving millions of customers globally."* The registry name should be corrected to Newfold Digital, otherwise the row is unmatchable to any external research.

What they do: Newfold Digital is a **web-presence and hosting conglomerate** — domains, shared hosting, website builders, and small-business online-presence services. In their words: *"Our customers know us through our robust portfolio of brands. We have some of the industry's most prominent and storied go-to-market brands, including Bluehost, HostGator, Domain.com, Network Solutions, Register.com and Web.com. We help customers of all sizes build a digital presence that delivers results."* The business is high-volume, low-ARPU SMB hosting and domains — a roll-up of long-established internet brands.

How they describe themselves: *"With our extensive product offerings and personalized support, we take pride in collaborating with our customers to serve their online presence needs. The strength of our company lives in the intersection of our people, our customers, and our brands."* The current engineering pitch is AI-platform framing: *"Join us to build the agent-powered backbone of our AI platform—robust, model agnostic, and ready for millions of users."* Tone is corporate and customer-service-oriented; no published values page, engineering handbook or eng blog surfaced.

Size / stage / funding: Large (several thousand employees), **private equity-owned** (formed from the Endurance International Group / Web.com combination), not a startup and not publicly traded. Mature, cash-generative, acquisition-assembled.

Locations / HQ: US-headquartered (Jacksonville, Florida / Burlington, Massachusetts lineage) with a heavily distributed global workforce. The live Workday board shows engineering roles posted for **Canada – Remote, Quebec Canada – Remote, Nova Scotia Canada – Remote, Brazil – Remote, Argentina – Remote, India – Remote** — i.e. hiring is concentrated in lower-cost geographies plus Canada.

Remote policy: Effectively **remote-by-geography** — roles are posted as "<Country/Province> - Remote" rather than office-based. No formal published remote policy. The AI role states the operating expectation directly: *"Remote work readiness with daily overlap of at least 09:00 – 13:00 EST."*

Remote-Canada eligibility: **Yes — verified from their own live postings.** Multiple current reqs are posted explicitly as Canadian remote: "Senior Software Engineer - AI" (Quebec, Canada – Remote, R14398), "ML Data Engineer" (Canada – Remote, R14450 and Nova Scotia, Canada – Remote), "Senior AI Back-End Engineer" (Canada – Remote, R14084). The stated overlap requirement of 09:00–13:00 EST translates to **07:00–11:00 Mountain Time**, which is comfortably workable from Kimberley BC. Caveat: several Canadian reqs name a specific province (Quebec, Nova Scotia) — the province-agnostic "Canada – Remote" reqs are the ones that clearly cover British Columbia.

Engineering & tech: Python 3.11+ with **FastAPI**, async I/O, Pydantic v2, dependency injection, "clean vertical-slice architecture." Agentic AI work with **Semantic Kernel** (handoff/sequential/concurrent multi-agent workflows), provider-agnostic LLM routing across OpenAI GPT-4.1/mini and Google Gemini 2.5 Flash for "A/B and cost-aware routing." RAG on **Azure AI Search, pgvector, or Chroma**. Postgres with SQLModel/SQLAlchemy 2 and Alembic. CI/CD on **Bitbucket + Jenkins**, Docker. Observability via structlog JSON logs, **OpenTelemetry**, Grafana and Langfuse for LLM cost governance, with a stated SLO: *"hold p95 < 100 ms."* Poetry for dependency management. They "champion AI-assisted development (GitHub Copilot, Cursor)." Other Newfold reqs are PHP/Golang (Platform & Payments) and Java. Requirement is 5+ years production Python APIs, 2+ years FastAPI. Degree not required.

Notable / other: The JD includes an unusually defensive boilerplate clause — *"The Company reserves the right to revise the Job Description at any time, and to require the employee to perform functions in addition to those listed above."* The posting mix (Brazil, Argentina, India, Canada remote; multiple near-duplicate Java/backend reqs across geos) is characteristic of a **cost-optimized, globally distributed engineering org**. There is no engineering blog, public handbook or values page to read, which is itself a signal about documentation culture.

Open relevant roles (sample):
- Senior Software Engineer - AI — Quebec, Canada – Remote (R14398)
- Senior AI Back-End Engineer — Canada – Remote (R14084)
- ML Data Engineer — Canada – Remote (R14450)
- Senior Java Software Engineer — Argentina – Remote (R14375)
- Senior Backend Developer (PHP/Golang) – Platform & Payments — Brazil – Remote (R14600)

Sources:
- https://web.wd1.myworkdayjobs.com/externalcareersite/job/Quebec-Canada---Remote/Senior-Software-Engineer---AI_R14398 (full JD body, incl. the Newfold Digital "Who we are" statement)
- Local registry: data/posting-research.jsonl (full posting/location inventory for this key)
