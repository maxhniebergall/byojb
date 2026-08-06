# Sumble Inc — research
Provider/key: workable:sumble-inc | company_type: product

What they do: In their own words, "Sumble is building a knowledge graph from web data with a first focus on data for go-to-market teams." They ingest sources like job postings and resume data and infer structured facts about companies — "org structure, tech stack, and key projects (e.g., GenAI initiatives, cloud migrations)." The customers are go-to-market / sales-intelligence teams who want to know which companies are running which technologies and initiatives. The company states its "long-term vision is to become the primary destination for accessing high-quality web data." The product is live and self-serve at sumble.com.

How they describe themselves: The JD is unusually plain-spoken and free of hype. On traction: "Our product already has strong product-market fit, early revenue, and happy customers — and now we're ready to accelerate." On the team: "We are a team of 15, including 10 engineers with experience at companies such as Google, Meta, Stack Overflow, and Kaggle." They frame the work as concrete data problems rather than mission rhetoric, listing "Challenges We Tackle": "Transforming noisy datasets into high-quality data products," "Running expensive analytics computations efficiently," "Managing the complexity of a growing number of data sources, machine learning models, and large data operations," and "Create a great PLG experience with upsell pathways." There is no values or principles page in the material available, and no "fast-paced"/"rocketship"/"wear many hats" language anywhere in the posting.

Size / stage / funding: 15 people, 10 of them engineers, per the JD. Early-stage but revenue-generating and claiming product-market fit. Funding round, investors and profitability are **not stated in the posting and were not verifiable** — a fetch of sumble.com returned no readable content (the site appears to be client-rendered), and no search was spent. Treat stage as "small, early, has revenue" and nothing more precise.

Locations / HQ: **Unverified.** The posting's location field is "United States (Remote)" and benefits are flagged "(US)", which implies US incorporation and a US payroll entity, but no HQ city is stated anywhere in the available material.

Remote policy: Remote. The Workable record sets `Workplace: remote` and the location reads "United States (Remote)". The single stated location requirement in the Requirements section is: "Located within Americas timezones." Async practices are not described.

Remote-Canada eligibility: **Unclear, but the most plausible of any company in this batch.** The evidence cuts both ways and it is worth being precise about it. In favour: the *only* stated eligibility requirement is "Located within Americas timezones" — not "US work authorization," not "US only," which is the phrasing several peer companies in this batch use explicitly. Kimberley (Mountain Time) sits comfortably inside Americas timezones and inside the US business day. Against: the location field says "United States (Remote)" and the benefits are annotated "Medical, dental, and vision (US)" and "401k (US)", which suggests a US-only payroll entity with no Canadian employment vehicle set up. A 15-person company is also unlikely to have an employer-of-record arrangement in place. **Verdict: not established either way — this is a question to ask directly rather than assume.** The timezone-only phrasing is a genuine signal, not wishful reading, but the US-tagged benefits are a real counterweight.

Engineering & tech: Stated stack, verbatim from the JD —
- ML/Data: PyTorch, Huggingface, Gemma models, LORA, VLLM, Skypilot, Marimo
- Languages & Frameworks: Python, FastAPI, React, TypeScript
- Cloud: Google Cloud Platform
- Databases: PostgreSQL, DuckDB
- Infrastructure: Cloud Run
- Product/Design: Figma, Vercel V0

The open role's actual work is described as: finetuning small language models; "Improving the quality of existing data using scalable approaches" (entity resolution — correctly associating URLs with companies, resolving HQ addresses, mapping parent-subsidiary relationships "using techniques like LLM validation, SERP, and triangulating across sources"); adding new signals by "scrubbing, matching and normalizing new signals and matching to our existing ontology"; and "Pushing solutions into production environments, which may involve touching data pipelines and/or backend systems." With 10 engineers there is no described specialization structure; ownership is presumably broad by necessity.

Notable / other: Benefits are medical/dental/vision (US), 401k (US), and "Target 4 weeks PTO" — the word "target" rather than "unlimited" is a mildly positive signal about PTO actually being taken. The posting is dated 2025-08-31, making it roughly eleven months old as of this research; it may be stale or the role long since filled. No engineering blog, handbook, or public values document was located.

Open relevant roles (sample): Data Scientist/Machine Learning Engineer — United States (Remote), no salary posted.

Sources:
- https://apply.workable.com/sumble-inc/jobs/view/484B6B7538 (full JD body, held locally)
- https://sumble.com — fetched, returned no readable content (client-rendered); no company facts obtained
- Registry: data/posting-research.jsonl, data/company-comp.jsonl
