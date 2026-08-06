# Roche (gRED AI for Drug Discovery / Prescient Design) — research
Provider/key: workday:roche/rog-a2o-gene | company_type: product

What they do: Roche is a Swiss multinational healthcare company (pharmaceuticals + diagnostics), one of the largest in the world. This particular Workday board (`rog-a2o-gene`) is the Genentech / Roche **Computational Sciences Center of Excellence**, specifically the AI for Drug Discovery (AIDD) group, also known as **Prescient Design**. The work is ML infrastructure and applied ML for drug discovery — training and serving computational models for molecule/antibody design across Roche's gRED and pRED research organizations.

How they describe themselves: "A healthier future. It's what drives us to innovate. To continuously advance science and ensure everyone has access to the healthcare they need today and for generations to come." Careers site frames the company around "diseases with the biggest social burden", "delivering life-changing healthcare solutions", and inclusion/diversity as an innovation driver ("different perspectives empower personal growth, accountability, discovery, innovation, and breakthrough treatments"). They publish an employee survey: 81% report being happy at Roche, 87% believe their work positively impacts society (2025 figures, self-reported on careers.roche.com). The AIDD JD itself uses "proactive, user-facing, get-it-done attitude", "thrive in a fast-paced environment", "adhering to corporate standards and best practices" — a large-enterprise framing with startup-flavoured urgency inside it.

Size / stage / funding: Public (SIX: ROG), 125+ years old, 103,000+ employees worldwide. Profitable, extremely stable — the opposite of runway risk.

Locations / HQ: HQ Basel, Switzerland. Genentech/gRED is South San Francisco. The AIDD postings on this board are **South San Francisco, CA and New York City, NY**. Roche does have a Canadian entity (Hoffmann-La Roche Ltd, Mississauga ON), but it does not appear on this board and careers.roche.com's landing content did not mention Canada.

Remote policy: Careers site mentions "flexible working arrangements" as a benefit but states no company-wide remote policy. The AIDD JDs are tied to named US offices; the ML DevOps JD states explicitly **"Relocation benefits are NOT available for this job posting"**, which reads as an onsite/hybrid, locally-hired role. Stage-3 facet extraction on that JD returned `remote_policy: unclear`, `geo_eligibility: us_only`, `timezone: America/New_York`.

Remote-Canada eligibility: **No / effectively disqualifying.** Every live role on this board is anchored to South San Francisco or New York City, extraction reads `us_only`, and relocation is explicitly excluded. Nothing in the registry or on their own pages indicates a Canada-remote hiring path for this org. Not verified against a Roche global mobility page (not fetched), but the JD evidence is unambiguous for these specific roles.

Engineering & tech: AWS-centric ML platform work — EC2, S3, RDS, EKS, SageMaker; Terraform for provisioning; Helm on Kubernetes; Python/Bash automation; Git-based CI/CD for ML workflows; HPC and distributed computing; monitoring via Prometheus/Grafana/ELK. Engineers sit alongside ML engineers and research scientists as an internal platform/service function ("collaborate closely with ML engineers and data scientists to understand their infrastructure needs"). Senior track adds architecture ownership and mentoring. The domain (computational drug discovery) is genuinely deep and technically interesting.

Notable / other: The AIDD group came out of Roche's acquisition of Prescient Design; the Computational Sciences CoE is a recently formed unified group spanning gRED and pRED, so this is a well-funded internal build-out rather than a legacy IT team. Roles are dual-posted at two levels in a single requisition (Engineer / Senior Engineer), with separate salary ranges for each.

Open relevant roles (sample): Software Development Engineer/Senior SDE, Agentic Systems, AI for Drug Discovery; Machine Learning Engineer/Senior MLE — DevOps, AI for Drug Discovery; Machine Learning Engineer/Senior MLE — Infra; Senior Data Engineer, AI for Drug Discovery; Senior/Principal AI/ML Computational Scientist; Principal Site Reliability Engineer (Intelligent Automation).

Pay: stated on their own JD (US pay-transparency). MLE — DevOps: California $147,600–$274,000, New York $141,100–$262,100. **Senior** MLE — DevOps: California $167,400–$310,800, New York $160,100–$297,300. Base only; a discretionary annual bonus is mentioned separately. These are US-geo figures.

Sources:
- https://roche.wd3.myworkdayjobs.com/rog-a2o-gene/job/New-York-City/Machine-Learning-Engineer---Devops_202509-122841 (JD body, held locally)
- https://careers.roche.com/ (fetched)
- local registry: data/posting-research.jsonl, data/company-comp.jsonl
