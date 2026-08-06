# Adobe — research
Provider/key: workday:adobe/external_experienced | company_type: product

What they do: Adobe is a large, long-established public software company (NASDAQ: ADBE) selling creative, document and marketing/data software. The relevant product surfaces visible in this job board are Adobe Firefly (generative AI), Adobe Experience Platform / Real-Time Customer Data Platform (RTCDP), Adobe Cloud Platform, 3D workflows, and various developer-experience and ML-infrastructure teams. Note: this entry is Adobe's `external_experienced` Workday board, i.e. the experienced-hire requisition feed, not a subsidiary.

How they describe themselves: NOT CAPTURED THIS SESSION. An attempt to fetch adobe.com/careers.html timed out, and the Workday job pages are client-rendered and return an empty shell to a fetcher. No values or culture statement is therefore quoted here. The registry's stored JD bodies are requisition text (responsibilities/qualifications) rather than culture material.

Size / stage / funding: Large-cap public company, long profitable, tens of thousands of employees. This is general background rather than a figure verified this session — no first-party page was readable — but the stability signal is not in serious doubt.

Locations / HQ: San Jose, California. The live requisitions in the registry cluster on San Jose, San Francisco, Seattle, and Washington state in the US, plus Noida and Bangalore in India. No Canadian location appears on any of the 25 relevant live postings.

Remote policy: Onsite / hybrid. Adobe's postings are anchored to specific offices, and the extracted facets on the live requisitions record `remote_policy` as "onsite" or "hybrid" — never "remote" — across every posting where the facet was populated. Multi-location postings ("2 Locations", "3 Locations", "6 Locations") are lists of offices, not remote options.

Remote-Canada eligibility: VERIFIED NO — this is the decisive finding. Every relevant live posting with an extracted geo facet records `geo_eligibility: us_only` (San Jose, San Francisco, Seattle, California, Washington), with the remainder anchored to India (Noida, Bangalore). Not one of the 25 relevant live requisitions is Canada-eligible, and none is remote. Adobe does operate Canadian offices (Ottawa, Toronto, Vancouver), but nothing in this board offers a Canada-based, let alone Kimberley-BC-remote, position. A candidate who cannot relocate and has no US work authorisation is not employable against any current posting here.

Engineering & tech: Deep and well-resourced. Named across the live requisitions: Java, Scala, Kubernetes, Node.js/Fastify, C++, and substantial ML/AI platform work — Firefly Services ML engineering, "Sr Machine Learning Engineer - ML Infrastructure & Data Platforms", "Senior Machine Learning Engineer, Services/MLOps", "Senior AI Platform Engineer", "Staff Software Engineer - Web and Agentic", "Principal AI Systems Engineer — C++ / Applied AI", plus Site Reliability Engineering, developer experience, and SDK/cloud data platform teams. Ladder is explicit and deep (Engineer → Senior → Staff → Sr Staff → Principal; also the legacy "Computer Scientist" / "Machine Learning Engineer 4" numbered titles).

Notable / other: Adobe posts salary ranges under US pay-transparency law, so the registry already holds six band rows derived directly from its own requisitions. Recorded USD base bands (from data/company-comp.jsonl, sourced from Adobe's own JDs):
- backend / senior: 208,300–301,600 (direct, jd_posted)
- software_general / senior: 185,500–290,588 (inferred rollup over 2 JDs)
- ml_eng / senior: 181,950–274,413 (inferred rollup over 4 JDs)
- ml_eng / staff: 238,700–345,650 (direct, jd_posted)
- ml_eng / principal: 248,900–360,500 (direct, jd_posted)
- other / principal: 268,000–388,000 (direct, jd_posted)
These are US ranges for US-anchored roles and are not attainable from Canada.

Open relevant roles (sample): Senior Machine Learning Engineer, Services/MLOps; Sr Machine Learning Engineer - ML Infrastructure & Data Platforms; Senior Site Reliability Engineer; Senior AI Platform Engineer; Staff Software Engineer - Web and Agentic; Senior Backend Engineer (Java, Scala, K8s); Senior Software Development Engineer, SDK & Cloud Data Platform Engineering.

Sources: registry postings, extracted geo/remote facets, and posted comp for 25 live requisitions (data/posting-research.jsonl, data/company-comp.jsonl). Web fetches attempted and failed: adobe.com/careers.html (timeout) and one Workday requisition page (client-rendered, returned no content). WebSearch was exhausted for the session. Culture/values material is therefore absent rather than summarised from memory.
