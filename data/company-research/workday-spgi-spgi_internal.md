# S&P Global (registry name "Spgi") — research
Provider/key: workday:spgi/spgi_internal | company_type: product

**Entity + data-quality notes:** the registry stores this as name **"Spgi"**; the employer is **S&P Global Inc.** (NYSE: SPGI). More importantly, the tracked board is `spgi.wd5.myworkdayjobs.com/**spgi_internal**` — the **internal / employee-facing** careers site, not the public one (`spgi_careers`). Both tenants appear in local data, and at least one req (`Software-Engineering-Manager_328947`) is duplicated across `spgi_internal` and `spgi_careers`. The registry should track the public board; the internal one will over-count reqs and may list roles not open to external applicants.

What they do: S&P Global is one of the world's largest **financial information and analytics** companies. Divisions include S&P Global Ratings (credit ratings), S&P Global Market Intelligence, S&P Global Commodity Insights (formerly Platts — energy and commodity price assessment), S&P Global Mobility, and **S&P Dow Jones Indices** (owner of the S&P 500 and the fixed-income index families). Revenue is overwhelmingly subscription and license based — index licensing, data feeds, ratings fees. Engineering exists to build and run the calculation engines, data pipelines and platforms behind those products.

How they describe themselves: The public engineering voice appears mainly through JDs. The S&P DJI fixed-income team describes itself as: *"Our Fixed Income value stream focuses on delivering robust calculation engines essential for managing our fixed income indices. We operate with a product-first mindset, following Agile principles, and are committed to modernizing our technology stack to meet evolving industry standards."* Roles emphasize *"scalable, reliable, and auditable solutions,"* *"end-to-end data lineage, reconciliation, anomaly detection, reproducibility, auditability, and version control,"* and *"Independent Execution: Operate with a high degree of autonomy, quickly ramping up on complex financial domains and new technologies… with minimal oversight."* Notably restrained hiring language — they also state *"S&P Global will not be utilizing artificial intelligence in our hiring process"* and commit to *"inform all interviewed candidates of hiring decisions within 45 days of their interview."*

Size / stage / funding: **Public (NYSE: SPGI)**, ~40,000 employees, a member of the S&P 500 itself, consistently profitable with very high margins. About as far from runway risk as an employer gets. Uses an internal **grade-level ladder** (the Toronto lead role is "Grade Level 11").

Locations / HQ: HQ New York City. Engineering is heavily concentrated offshore. The live req inventory in the registry is dominated by **Hyderabad and Gurugram/Noida (India)**, **Islamabad (Pakistan)** and **Gdańsk (Poland)**, with a handful in **New York** and **Toronto**.

Remote policy: No published remote-first policy. Reqs are posted against named offices (Hyderabad, Islamabad, Toronto, New York, Gdańsk) rather than as "Remote," with some "2 Locations"/"3 Locations" multi-office reqs. The operating model is office-anchored hybrid.

Remote-Canada eligibility: **Effectively no, for this candidate.** There is Canadian hiring, but it is **Toronto-office** hiring — e.g. "Software Engineering Lead" (Associate Director, Software Engineering), *Toronto, CAN*, and "DevOps Engineer," Toronto. These are Toronto-anchored roles at a company with no remote posting convention, which is disqualifying for someone in Kimberley, British Columbia who cannot relocate. Nothing in the local data or the JD text offers a Canada-wide or BC-remote option.

Engineering & tech: Java (Spring), Python, .NET/C#, Salesforce (Apex/LWC/Flows), Azure, big-data and data-platform work (Spark-family pipelines), SRE/infrastructure and DevOps/platform engineering, plus a growing ML/AI line. The Fixed Income lead role is genuinely substantial systems work: *"Design and develop high-performance calculation engines and services for fixed income indices, processing large-scale financial data efficiently"*; *"Architect and oversee calculation engines and analytics services, balancing latency, throughput, cost, and accuracy."* Lead/Associate-Director roles carry explicit people responsibility: *"Lead, mentor, and grow a team of engineers and quantitative developers."*

Notable / other: Ontario pay-transparency compliance is visible in their own postings — the Toronto req states *"In accordance with Ontario's new regulations effective January 1, 2026, this job posting provides information on expected compensation,"* which is why Canadian bands are directly citable here. Title inflation is heavy and inconsistent ("Lead I", "Lead II", "Senior Lead", "Associate Director" all mapping to individual-contributor-ish engineering work), which makes level normalization unreliable for this company.

Open relevant roles (sample):
- Software Engineering Lead / Associate Director, Software Engineering — Toronto, CAN (328518)
- Software Engineering Technical Team Lead — New York, NY (328947)
- Senior Software Engineer, Backend Development (Python) — Hyderabad (323136)
- Senior Machine Learning Engineer — Hyderabad (323134)
- Senior Lead Data Engineer, Data Platform — Hyderabad (330177)
- DevOps Engineer — Toronto, CAN (324637)

Sources:
- https://spgi.wd5.myworkdayjobs.com/spgi_internal/job/Toronto-CAN/Associate-Director--Software-Engineering_328518-2 (full JD body incl. Ontario pay disclosure)
- https://spgi.wd5.myworkdayjobs.com/spgi_internal/job/New-York-NY/Software-Engineering-Manager_328947-1
- Local registry: data/posting-research.jsonl (full req/location inventory), data/company-comp.jsonl
