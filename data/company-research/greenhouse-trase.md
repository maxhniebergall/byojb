# Trase Systems — research
Provider/key: greenhouse:trase | company_type: product

What they do: In their own words: "Co-founded in 2023 by Joe Laws and Grant Verstandig, Trase Systems is AI, Uncomplicated. Trase empowers enterprise leaders to harness the full potential of AI without the associated complexity and risks. We are an end-to-end solution for deploying, managing, and optimizing AI in the enterprise. Our platform specializes in bridging the 'last mile' of AI adoption, unlocking AI's full potential while driving efficiency and significant cost savings." They claim leadership in agent benchmarks: "Trase is at the forefront of AI Agent innovation, topping the Hugging Face GAIA Leaderboard for Generalized AI Assistants, ahead of industry giants such as Google, Meta, Microsoft, and OpenAI." Target verticals: "mission-critical agentic applications in complex industries such as Healthcare, Oil & Gas, and National Security."

How they describe themselves: The tagline is "AI, Uncomplicated." Engineering-culture statements are embedded in the role framing rather than a values list: "Clean abstractions and correctness-under-failure are critical because we operate long-lived agents in healthcare/defense environments where auditability and reliability are non-negotiable." And: "Balance short-term delivery with long-term architectural integrity, ensuring the platform evolves without accumulating systemic risk." No published values page was reachable (see Sources).

Size / stage / funding: Founded 2023. A portfolio company of **Red Cell Partners**, the McLean, VA incubation firm (Red Cell's own site lists Trase among 15 companies created, incubated in the healthcare practice, 2024; Red Cell itself has 76 FTEs). Trase's own headcount, funding round and revenue are **unverified**. The JD implies a multi-team engineering org ("a force multiplier across all engineering teams", "mentor & unblock senior engineers").

Locations / HQ: Postings list "Seattle, WA or McLean, VA or Remote (USA)" — one adds "Seattle, WA (Preferred)". McLean, VA is the Red Cell base.

Remote policy: Remote offered, scoped to "Remote (USA)". Seattle is stated as preferred for one of the two roles. No async/handbook signals available.

Remote-Canada eligibility: **No — not eligible (high confidence).** Both postings state "Remote (USA)". Trase also operates in "healthcare/defense environments" and national security, which commonly carries US-person or clearance requirements even where the JD is silent.

Engineering & tech: The product is **Trase OS**, described as "the shared platform ('agentic operating system') that powers all Trase deployments in regulated environments" — "an orchestration-heavy system coordinating long-lived workflows, agents, and tools across multiple services and environments." The Staff Platform Architecture role covers:
- Core execution model: state machine, lifecycle, resource model, failure semantics
- Platform APIs/SDKs connecting workflows, agents, tools and product surfaces; versioning & compatibility
- Correctness: idempotency, deterministic replay, compensating actions, data integrity
- Reliability at scale: concurrency controls, rate limits, backpressure, sharding/partitioning, workload isolation
- Security & governance in the core: RBAC/ABAC, policy enforcement, fine-grained audit & lineage
- Observability: distributed tracing, structured logs, metrics, evaluation hooks, an "explainable trail" of agent actions
- Quality: design reviews, test strategy (unit, property, chaos), performance baselines, SLOs, incident response, postmortems
- Pragmatic choices on storage, queueing and compute; "paved roads that accelerate all other teams"
Requirement bar: "10+ years of experience building distributed/platform systems, including significant experience defining arch[itecture]…". They explicitly name the failure modes the role exists to prevent: "Poor abstractions create tight coupling across services", "Workflow execution becomes difficult to reason about under failure", "Platform capabilities fragment instead of becoming reusable primitives", "Scaling introduces complexity instead of leverage."

Notable / other:
- Comp is not stated on either live posting. An inferred rollup band (platform_infra / staff, USD 180k–243.75k) already sits in `data/company-comp.jsonl` for both this key and greenhouse:redcellpartners.
- **Registry data-quality note:** `greenhouse:trase` and `greenhouse:redcellpartners` list the *same two* Staff Software Engineer postings under different Greenhouse job IDs (parent incubator board vs. portfolio-company board). They should probably be deduplicated or linked. Separately, the registry's `titles` array for greenhouse:trase shows "Principal AI Researcher (Agentic Systems & AI Infrastructure)" while the `comp_slots` example titles are the two Staff SWE roles — the title list and the posting set are inconsistent.

Open relevant roles (sample): Staff Software Engineer (Platform Architecture & Execution Model); Staff Software Engineer (Product + Platform Development) — both Seattle, WA / McLean, VA / Remote (USA).

Sources: registry JD bodies at `data/posting-research/https---job-boards.greenhouse.io-trase-jobs-5166227007.md` and `…-5195313007.md`; https://www.redcellpartners.com/ (fetched, for the parent/portfolio relationship). trasesystems.com was not fetched — no first-party Trase domain appears in the registry, so company-level facts beyond the JD text are unverified.
