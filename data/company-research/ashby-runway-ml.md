# Runway — research
Provider/key: ashby:runway-ml | company_type: product

What they do: Runway (Runway AI, Inc.) builds generative AI models for video, image and
"world simulation" — Gen-4.5, GWM-1, a Universal World Simulator, a Robotics SDK, and
conversational real-time agents. Customers span creative professionals and studios (Runway
Studios is an in-house film/entertainment arm) plus external developers who consume a public
API. The company positions world models — not language models — as the frontier of AI progress,
with applications framed as robotics, disease and scientific discovery as well as storytelling.

How they describe themselves: "We are building AI to simulate the world through merging art and
science." They argue "world models are at the frontier of progress in artificial intelligence.
Language models alone won't solve the world's hardest problems — robotics, disease, scientific
discovery." On team: "Our team consists of creative, open minded, caring and ambitious people who
are determined to change the world. We aspire to continuously build impossible things and our
ability to do so relies on building an incredible team." Explicit culture cues in JDs: "Humility
and open mindedness; at Runway we love to learn from one another"; and, for research roles,
"Ability to context-switch quickly and drive projects forward in a fast-moving, ambiguous
environment." The careers page foregrounds community investment (quarterly employee-chosen
charitable donations) and learning/travel budgets rather than a formal values list.

Size / stage / funding: Private, venture-backed. Press cited on their own careers page references
a ~$5B valuation. Headcount not stated publicly on their pages. Well-capitalized late-stage AI
startup rather than a profitable/established business.

Locations / HQ: HQ New York. Global offices in New York, San Francisco, Seattle, London, Paris,
Tel Aviv and Tokyo, plus remote team members worldwide.

Remote policy: Fully remote positions are offered across many departments; the registry shows all
relevant engineering roles listed as "Remote". Employees outside a 10-mile commuting distance from
the NY or SF office can expense up to $250 USD/month for co-working, internet and cellphone.

Remote-Canada eligibility: **Unclear — not verified.** The careers page says "remote team members
worldwide" and lists offices on three continents, but names no Canadian entity and makes no
Canada-specific statement. Benefits are explicitly scoped to US employees (100% medical/dental/
vision "US employees", 3% 401(k) "US"). JDs state "the provided range is the expected salary for
candidates in the U.S. Outside of those regions, there may be a change in the range" — which
implies non-US hiring is possible but is not a commitment, and no Canadian offices are listed.
Would need to be confirmed with a recruiter before applying.

Engineering & tech: Two distinct stacks. Product/API: TypeScript, running in ECS containers on
AWS Fargate, with S3, CloudFront, Lambda, Kinesis and SQS as building blocks; high-traffic
Postgres. Inference backend: Python (PyTorch, TorchScript) deployed across multiple clusters and
cloud providers, Kubernetes for orchestration with k8s-native components Flyte, Kueue and Kyverno
for job orchestration; Prometheus + Grafana for monitoring; Terraform for infrastructure. The core
API team owns a "mature, production system" serving millions of users and thousands of requests
per second, covering user data, task orchestration, billing, permissions and asset management, and
is expected to own the full API lifecycle including monitoring, incident response and docs.
Research roles are full-stack across pretraining, SFT/RL post-training, evaluation and productionizing.

Notable / other: Titles use the "Member of Technical Staff" convention across both engineering and
research. Awards cited on their own pages: Crain's, InHerSight, BuiltIn NYC, INC "best place to
work". Benefits: unlimited PTO with a 15-day minimum recommendation, paid sabbatical program,
16 weeks fully paid parental leave for all parents, $600 wellness stipend, $600 learning stipend,
$500 tech setup stipend. Compensation philosophy stated in JDs: ranges "based on competitive
market rates for our size, stage and industry", with internal pay equity to peers as an explicit
input, and openness to re-ranging for candidates more or less experienced than the posting.

Open relevant roles (sample): Member of Technical Staff, Backend Engineer, API ($240K–$290K USD);
Member of Technical Staff, Research Engineer; Member of Technical Staff, Applied Research
Scientist; Member of Technical Staff, Research Engineer (GPU Performance); Member of Technical
Staff, Research Engineer (Datasets); Member of Technical Staff, Robotics Research Engineer;
Member of Technical Staff, Trust & Safety Engineer.

Sources:
- https://runway.com/careers (fetched 2026-07-31; runwayml.com/careers 308-redirects here)
- https://jobs.ashbyhq.com/runway-ml/8489a08a-f0cf-4418-968c-c7c803d538bc (Backend Engineer, API JD)
- https://jobs.ashbyhq.com/runway-ml/98e4b160-3bbe-4acd-b106-ad75ccc49675 (Research Engineer JD)
- https://jobs.ashbyhq.com/runway-ml/0b7b8839-037f-4ccf-886b-6d247923601c (Applied Research Scientist JD)
