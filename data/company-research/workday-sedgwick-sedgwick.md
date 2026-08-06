# Sedgwick — research
Provider/key: workday:sedgwick/sedgwick | company_type: product (see caveat below)

What they do: Sedgwick is a global claims-management and risk-solutions firm — third-party administration (TPA) of insurance and benefits claims, loss adjusting, disability/absence administration, and product recall services, delivered on behalf of insurers, employers and corporates. It describes itself as helping "clients and individuals navigating life-changing events like natural disasters, injuries, accidents, and medical diagnoses." Caveat on `company_type`: Sedgwick is structurally a business-process outsourcer for the insurance industry, but the engineering roles here are **in-house platform/AI engineering on Sedgwick's own systems**, not client-placed consulting or staffing, so it has not been classified as consulting/outsourcing/staffing (that classification would permanently remove it).

How they describe themselves: Mission — "Delivering outcomes, experiences and insights that enable clients and communities to thrive." Stated core values: **empathy** ("the work we do is meaningful"), **growth**, **accountability**, **inclusion**, **collaboration**. The JD adds "caring counts" style framing plus "Certified as a Great Place to Work" and "enjoy work-life balance" as recruiting claims — sitting alongside, in the same posting, "high-stakes, execution-focused role" and "ability to move at the speed of a startup within a large enterprise."

Size / stage / funding: 33,000+ colleagues; privately held (majority PE-backed; ownership not stated on the pages fetched — unverified). Serves 59% of the Fortune 500. Long-established and operationally stable rather than venture-stage; facet extraction on the LLMOps JD tagged company_stage "growth."

Locations / HQ: Operates in 80 countries. HQ is Memphis, Tennessee (not confirmed on the page fetched — the about page did not state HQ; the Workday board's roles are anchored to "Telecommuter TN", consistent with a Memphis base). Country presence explicitly listed includes **Canada**, Australia, UK, Ireland, France, Germany, Spain, Portugal, Netherlands, Denmark, Norway, Greece, New Zealand, US.

Remote policy: The engineering roles are genuinely remote — postings are titled "Telecommuter TN" / "Telecommuter TX" and list 28–29 eligible locations. Facet extraction reads `remote_policy: remote`. So remote work is normal here, not an exception.

Remote-Canada eligibility: **No — US-only.** The eligible-location list on the Senior Engineer LLMOps/MLOps posting resolves to "Telecommuter TN and 27 other US states", and facet extraction records `geo_eligibility: us_only`. Sedgwick as a corporation has a Canadian presence, but these specific technology roles are posted through the US requisition system with US-state eligibility. No Canadian technology posting appears on this board. (Not separately verified against a Sedgwick Canada careers page — it was not fetched.)

Engineering & tech: Dual-cloud AWS + Azure, explicitly requiring both ("configure Bedrock and Azure OpenAI including private networking on day one"). Stack from the LLMOps JD: Python, SQL, PySpark; AWS SageMaker and Bedrock, Azure AI Studio, Azure AI Search; RAG with OpenSearch / Pinecone / vector DBs; Terraform and CloudFormation; Docker and Kubernetes; Airflow, Kubeflow, Step Functions; LLM observability via LangSmith, Arize Phoenix, WhyLabs; model-drift monitoring, LLM evaluation, Bedrock Guardrails; data on Palantir, Databricks, Snowflake. Requirements are steep for the level: bachelor's required, 6+ years engineering with 3+ strictly in production MLOps/LLMOps. Autonomy graded "medium." No public engineering blog or handbook was located. There is a "VP AI Engineering" opening alongside the ICs, suggesting the AI org is being stood up now rather than being mature.

Notable / other: The AI hiring is centred on applying LLMs to claims workflows (insurance domain), which is a substantive, data-rich, mission-critical problem area rather than a demo product. The postings pair enterprise scale with startup-speed rhetoric, and the technology list is unusually long for a single role — a breadth-over-depth signal.

Open relevant roles (sample): Senior Applied & Agentic AI Engineer; Applied & Agentic AI Engineer; Senior Engineer — LLMOps & MLOps; VP AI Engineering. (Two further data-engineering postings — Data Engineer, Data Engineer AI — are no longer live.)

Pay: **No band recorded.** No range appears in the registry for any Sedgwick posting, the Workday job page returns an empty client-rendered shell, and no Sedgwick pay-transparency or compensation page was located. Deliberately no estimated row written — there is no genuine company-specific basis for one.

Sources:
- https://www.sedgwick.com/about/ (fetched)
- https://sedgwick.wd1.myworkdayjobs.com/sedgwick/job/Telecommuter-TN/Senior-Engineer---LLMOps---MLOps_R71413 (cited; fetch returned an empty shell — content is from the registry's extracted facets)
- local registry: data/posting-research.jsonl
