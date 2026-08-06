# Menlo Security — research
Provider/key: ashby:menlosecurity | company_type: product

What they do: Enterprise browser-security vendor. Its core technology is remote browser isolation — web content is executed in the cloud and only a safe rendering stream reaches the user's device — extended into a broader secure-enterprise-browser / SSE platform (secure web gateway, DLP, phishing protection). Customers are large enterprises: the company claims Fortune 500 accounts, 9 of the 10 largest global banks, and the US Department of Defense.

How they describe themselves: Mission is "enabling the world to connect, communicate and collaborate securely without compromise", and on the careers page "Help Us Secure the Way People Work" — they believe internet usage "should be safe, seamless, and effective". Their five stated values, in their own words, are **Stay Aligned**, **Get It Done**, **Customer Empathy**, **Think Creatively**, and **Help Each Other Out**, summarised on the careers page as "empathy, creativity, execution, collaboration, and alignment". Culture is described as "collaborative, inclusive, and fun", with "open communication, supporting new ideas". JD language asks for candidates who are "ethical, hyper-organized, fanatical about seeing things through to completion, service-oriented, and humble". The infra team's own words: "We expect failure, build security in by design, create evolvable systems, and enable multi-tenancy across the infrastructure. Automation is an absolute for us… We are committed to getting it done properly, the first time."

Size / stage / funding: ~400 employees and stating it is "growing from 400 employees into the next phase of our journey". Private, late-stage, "well-funded for growth"; investors named on their own JD are Vista Equity Partners, General Catalyst, JPMorgan Chase, American Express, HSBC and Ericsson Ventures — i.e. strategic/PE-backed rather than early venture.

Locations / HQ: North America HQ in Mountain View, CA, plus 9 international locations — Bracknell (UK), Israel, Japan, Singapore, South Korea, Australia/New Zealand and India.

Remote policy: Distributed/flexible remote — careers page states employees may work from any location outside a traditional office; teams stay connected through virtual collaborative sessions and monthly all-hands. Postings are geo-banded ("AMER - Canada", "EMEA - Distributed (UK)") rather than office-based.

Remote-Canada eligibility: **Verified yes.** The Principal Platform Infrastructure Engineer (Containers) requisition is posted as "AMER - Canada", is marked remote, and quotes a base range "in accordance with Canadian law" in CAD — an unambiguous Canadian employment relationship. Note the other principal infra role (SRE Enablement) is EMEA/UK-banded and is not Canada-eligible. Timezone: globally distributed team; the role carries a **24x7 on-call rotation** shared across that distributed team.

Engineering & tech: Cloud-native platform on **Google Kubernetes Engine** plus a large VM fleet across **GCP (primary) and AWS (secondary)**, dozens of clusters across dev/staging/prod in multiple regions. IaC in **Terraform** orchestrated with **Spacelift** (TACOS), deployments via **Helm**, GitOps workflows. Observability on **Grafana Cloud, Prometheus/Mimir and OpenTelemetry collectors**. Networking/service mesh via **Cilium**, plus certificate lifecycle, DNS automation and ingress. Languages: "a lot of python, bash and go". They explicitly expect fluency with LLM code-assist tools (Gemini Code Assist named).

Notable / other: Platform Infrastructure Engineering is a distinct, well-staffed internal-platform org — the roles are explicitly about building/operating the company's core infrastructure services for other engineering teams, i.e. internal-customer plumbing rather than customer-facing product. Hiring ladder shown on the board runs Senior I / Senior II / Principal I / Principal II. The company does not accept unsolicited agency resumes.

Open relevant roles (sample): Principal Platform Infrastructure Engineer (Containers) — AMER-Canada; Principal Platform Infrastructure Engineer (SRE Enablement) — EMEA/UK; Platform Infrastructure Engineer (SRE Core) — EMEA/UK; Principal Engineer I/II; Senior Software Engineer (Golang).

Pay (see data/company-comp.jsonl): Principal Platform Infrastructure Engineer (Containers), Canada — base **CAD 141,000 – 249,000**, stated on their own JD, plus stock-based compensation grants.

Sources: https://jobs.ashbyhq.com/menlosecurity/dd0e16f2-893e-43d1-a1e4-15f080a4f8ae (JD body, held locally); https://www.menlosecurity.com/about/life-at-menlo
