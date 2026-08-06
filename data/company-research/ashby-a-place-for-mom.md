# A Place for Mom — research
Provider/key: ashby:a-place-for-mom | company_type: product

What they do: A Place for Mom (APFM) is, in its own words, "the leading platform guiding families through every stage of the aging journey. Together, we simplify the senior care search with free, personalized support — connecting caregivers and their loved ones to vetted providers from our network of 15,000+ senior living communities and home care agencies." It is a referral marketplace: free to families, monetised on the provider side. Operating since 2000, it says its teams "have helped millions of families find care."

How they describe themselves: "We're proud to be a mission-driven company where every role contributes to improving lives. Caring isn't just a core value — it's who we are. Whether you're supporting families directly or driving innovation behind the scenes, your work at A Place for Mom makes a real difference." Full stated values, quoted:
- **Mission Over Me** — "We find purpose in helping caregivers and their senior loved ones while approaching our work with empathy."
- **Do Hard Things** — "We are energized by solving challenging problems and see it as an opportunity to grow."
- **Drive Outcomes as a Team** — "We each own the outcome but can only achieve it as a team."
- **Win The Right Way** — "We see organizational integrity as the foundation for how we operate."
- **Embrace Change** — "We innovate and constantly evolve."

Size / stage / funding: Founded 2000; private, US, private-equity backed (General Atlantic / Silver Lake historically). Headcount not stated on the sources read — the engineering org is clearly large enough to run a dedicated Agentic Platform team plus a Director and a Principal Engineer over it. Not verified further in this pass.

Locations / HQ: US-based (historically Seattle/New York). Postings are listed as "Remote" and, for the Principal Data Engineer, explicitly "Remote-US".

Remote policy: Roles are tagged `#LI-REMOTE` and listed as Remote. Benefits quoted are US-domestic (401(k) plus match, US medical/dental/vision, PTO).

Remote-Canada eligibility: **No — verified negative.** Decisive evidence: both live JD bodies (Senior DevOps Engineer and Staff Software Engineer) carry the line *"A Place for Mom uses E-Verify to confirm the employment eligibility of all newly hired employees."* E-Verify is the US federal work-authorisation check and applies only to US hires, so a hire must be authorised to work in the United States. Corroborating: one of the three live relevant postings states its location as "Remote-US" outright, all posted comp is USD, and every posting's benefits package is US-only (401(k) with match). No page reached mentions Canada or any non-US hiring entity. This is a hard no for a Canada-based remote worker, not merely "unlikely".

Engineering & tech: TypeScript is the company standard. The Agentic Platform team builds genuine LLM infrastructure — an Agentic Platform SDK with primitives (Completion, Agent, Tool, Guardrail, PromptPack, Eval, Context); an "Agent-as-a-Service" service for long-running async tasks; externalised versioned prompt storage with CI/CD integration and Langfuse; provider abstraction across OpenAI/Anthropic/Google; structured-output validation, streaming, token management; composable guardrails, PII detection/redaction, audit logging; eval infrastructure with datasets and scorers (exact match, LLM-as-judge, schema validation) and regression detection; and an explicit "churn containment" strategy to absorb rapid provider-SDK change. Cloud is AWS (Fargate, EventBridge, DynamoDB, RDS/PostgreSQL, S3). Separately the data platform is Databricks-centred (Delta Lake, Unity Catalog, Workflows, AI/BI Genie, MLflow, Vector Search) under a federated data operating model with semantic-layer and metadata/lineage governance. Infra side: AWS multi-account, Terraform (Terramate a plus), ECS/EKS/Kubernetes, GitHub Actions/Jenkins/CircleCI/GitLab CI, New Relic/Datadog/CloudWatch/OpenTelemetry, SLIs/SLOs.

Notable / other: The company publishes a fraud warning noting illegitimate job postings and recruiting emails using its name — APFM says it will never ask for a SSN during recruiting, send unsolicited offers, request fees, or extend an offer without an interview. There is a production AI voice-and-chat application used as "the proving ground for platform patterns". Pay is disclosed on every relevant JD.

Open relevant roles (sample): Staff Software Engineer, Agentic Platform (Remote) — $160K–$190K + 10% bonus; Senior DevOps Engineer (Remote) — $130K–$150K + 10% bonus; Principal Data Engineer, Data Platform (Remote-US) — $170K–$195K + up to 30% bonus.

Sources: JD bodies in the registry — https://jobs.ashbyhq.com/a-place-for-mom/cba2a3da-daeb-45ff-8080-b003148f98ef , /75448664-31f9-4b32-bee4-d93d0266cca8 , /b12c5dd0-6184-4f2d-9973-d19437228d96 (no additional first-party page was fetched; the JDs carried the company description, full values list and comp)
