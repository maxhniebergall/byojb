# DV Trading — research
Provider/key: greenhouse:dvtrading | company_type: product (proprietary trading firm)

What they do (their own words): *"Founded 20 years ago and headquartered in Chicago, the DV Group of financial services firms has grown to more than 600 people operating throughout North America, Europe and Asia. Since spinning out of a large brokerage firm in 2016, DV Trading has rapidly scaled as an independent proprietary trading firm utilizing its own capital, trading strategies, and risk management methodologies to provide liquidity to worldwide financial markets and hedging opportunities to commodity producers and users. Now, DV group affiliates include two broker dealers, a cryptocurrency market making firm, and a bourgeoning investment adviser."* It trades its own capital — there are no external customers, but engineering's internal customers are the trading desks.

How they describe themselves: No values or culture page is quoted in the JDs; self-description is factual/firm-history boilerplate. The DevOps JD does give a culture glimpse: *"a small, high-impact team… This team built the entire platform from scratch in 2025 and now owns it end-to-end. You'll be joining at a pivotal moment: the team is growing, the platform is scaling… and there's no shortage of hard problems to solve. **You'll have real ownership from day one — not tickets in a queue.**"* Trading-firm urgency is stated as a preferred qualification: *"understanding the urgency and reliability requirements of systems that support P&L-impacting workloads."*

Size / stage / funding: Private proprietary trading firm, ~600+ people, 20 years old, self-funded by trading capital (spun out of a brokerage in 2016). Not venture-runway dependent; prop-firm revenue is however inherently P&L-volatile.

Locations / HQ: HQ **Chicago**. Live relevant postings are office-city-tagged: **Chicago, New York, Toronto, London, Hong Kong, Singapore**.

Remote policy: Predominantly office-based — every live relevant posting names one or more physical trading-office cities rather than "Remote". One **Senior Cloud Engineer (Remote)** req (greenhouse job 4687488005) exists in the captured JD corpus but is **not among the live relevant postings** in this scan, so remote hiring appears to be occasional and role-specific rather than the norm. Nothing in the JDs states an async or remote-first posture; the DevOps role explicitly requires working *"directly with trading desks and development teams."*

Remote-Canada eligibility: **No, on current openings.** DV has a **Toronto** office and hires there (*Software Developer (Toronto)*), so Canadian employment is possible in principle — but the Toronto posting is office-tagged, Eastern Time, and nothing indicates remote-from-BC. The Senior AI Engineer and Senior DevOps reqs list Chicago/NY/London/HK/Singapore. The only remote-labelled role in the corpus (Senior Cloud Engineer) is not currently live. Effectively disqualifying today.

Engineering & tech: Genuinely strong infrastructure content, split three ways.
- **Platform/DevOps** (London): Kubernetes at scale — *"Cluster lifecycle management via Cluster API, fleet-wide upgrades, bare metal provisioning, CNI networking, storage, autoscaling, and disaster recovery"*; an on-prem observability stack of **Mimir, Loki, Tempo, Grafana, OpenTelemetry Collector fleet, Alertmanager**; **GitLab CI, ArgoCD, Artifactory** for CI/CD and GitOps; Terraform/Ansible; Go or Python for tooling; self-service platform tooling *"that enables teams across the firm to move faster without depending on DevOps for every change."* 5–8 years required.
- **AI/ML platform**: DV is *"building a centralized AI function"* and hiring for both the agent layer and the model layer. The model-layer role builds *"a model gateway routing inference across open and closed models with cost, latency, and quality tracking,"* distillation pipelines, fine-tuning of open-weight models (Llama, Qwen, Mistral), on-prem serving with **vLLM/TGI/Triton on Kubernetes**, GPU infrastructure management, and model evaluation/regression frameworks. The agent-layer role defines *"firm-wide standards for agent and MCP development"*, patterns for connecting agents to internal databases/APIs, and AI security/governance in a regulated trading environment.
- **Low-latency trading systems**: C++17 core trading platform (DV Equities), Python trading tooling, Linux, parallel programming, networking and performance analysis; *"work directly with trading desks on new feature requests."*

Notable / other: The AI mandate is unusually well-articulated for a trading firm — *"the long-term goal is for DV to own its model capability — not to be permanently dependent on what frontier providers choose to offer, at what price, for how long."* That is model-serving infrastructure, not a prompt-wrapper. Benefits are US-flavoured (HSA/FSA, group term life, retirement plan with employer match, flexible vacation, discretionary bonus).

Open relevant roles (sample):
- Senior AI Engineer — model layer: gateway, distillation, vLLM on K8s (Chicago; Hong Kong; London; New York; Singapore)
- Senior AI Engineer — agent/MCP standards (Hong Kong; London; Singapore)
- Senior DevOps Engineer — Kubernetes/observability platform (London)
- C++ Software Developer, DV Equities (London; Hong Kong)
- Software Developer — Python, DV Equities (Hong Kong)
- Software Developer (Toronto) — 0–7 years, low-latency algorithmic platform

Pay (stated on their own live JD):
- Senior AI Engineer: *"Base Salary Range $200,000 — $300,000 USD"*, described as *"the expected base salary for this position… also eligible for a discretionary bonus (at DV Trading's discretion)"*. → band row written (ml_eng / senior, direct, jd_posted, base only). This is base excluding what at a prop firm is typically a very substantial bonus, so total comp is materially higher.
- No range is posted on the Senior DevOps (London) or Toronto reqs.

Sources:
- 8 live JD bodies under data/posting-research/https---job-boards.greenhouse.io-dvtrading-*.md, plus the non-live Senior Cloud Engineer (Remote) body in the same corpus
- https://job-boards.greenhouse.io/dvtrading/jobs/4716238005 (cited for the posted base range; ATS host not fetched — client-rendered)
