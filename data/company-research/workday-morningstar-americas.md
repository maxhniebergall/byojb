# Morningstar — research
Provider/key: workday:morningstar/americas | company_type: product

Research method: NO web fetches were possible for this company. WebSearch was exhausted for the
session (200/200 global cap) and the only URL on record is a client-rendered ATS board, which returns
an empty shell. Everything below is grounded in the company's OWN job-description text already captured
locally in `data/posting-research/`; anything not stated there is marked UNVERIFIED rather than guessed.

What they do: Morningstar is a long-established, publicly traded investment-research and financial-data
company. The engineering work on record here is the "next generation data feed platform": building and
delivering investment data products to institutional clients as files and cloud data shares, plus the
internal platform and SRE function that runs it. Customers are institutional/enterprise, with contractual
SLAs on data delivery.

How they describe themselves: The only first-party language available is the boilerplate on their own
Workday JDs. The strongest statement is about working style: "Morningstar's hybrid work environment gives
you the opportunity to collaborate in-person each week as we've found that we're at our best when we're
purposely together on a regular basis. In most of our locations, our hybrid work model is four days
in-office each week. A range of other benefits are also available to enhance flexibility as needs change."
A broader values/mission statement was NOT reachable — UNVERIFIED.

Size / stage / funding: Public company (Morningstar, Inc. — the JDs are filed under the legal entity
"001_MstarInc Morningstar Inc."). Large, established, not runway-dependent. Exact headcount UNVERIFIED
from local sources.

Locations / HQ: HQ UNVERIFIED from local sources (Chicago per general knowledge, not confirmed here).
Offices evidenced by live postings: Toronto, Ontario and London, UK. The board is the "americas" Workday
tenant but carries London requisitions too.

Remote policy: HYBRID — four days in-office per week in most locations, stated on the JDs themselves.
This is the least flexible policy in this batch.

Remote-Canada eligibility: NO, effectively. The Canadian roles are Toronto-anchored and carry the
four-days-in-office hybrid statement. Canada employment clearly exists (Toronto office, CAD salary bands),
but not as remote work from British Columbia. A Kimberley, BC candidate cannot take these.

Engineering & tech: Substantive data/platform engineering.
- Data feeds: Python data pipelines on AWS (S3, Lambda, Step Functions, Glue, ECS), file formats
  CSV/Parquet/JSON with partitioning, compression and encryption, delivery via S3, SFTP and cloud data
  marketplaces (Snowflake Marketplace), data-quality validation, monitoring and alerting, migration of
  legacy feed products to cloud-native architecture, CI/CD and IaC. Some front-end contribution expected
  (Vue.js/React) — "willingness to learn and contribute is more important than deep front-end expertise".
- Principal SWE: Spark/PySpark, DuckDB, Snowflake, Databricks, Redshift, AWS, S3, Docker.
- AI Engineer: MCP and an internal "MCP Gateway", LLMs, LangChain, AWS Bedrock, Copilot Studio, GitHub
  Copilot, Claude Code, Docker, PostgreSQL — i.e. a real internal GenAI platform effort, not a wrapper.
- SRE: AWS (EC2, S3, ECS, EKS, Lambda, RDS, VPC, IAM, CloudWatch).
Requirements are conventional (BSc + 5 years); financial-services/regulated-industry experience valued.

Notable / other: Compensation is disclosed on the JDs — Senior Software Engineer CAD 90,489–132,711 plus
a 12.5% annual incentive target; Principal Software Engineer CAD 112,583–162,125; AI Engineer CAD
106,037–126,094; Senior SRE CAD 90,489–132,711 (the Senior SWE and Senior SRE share one band, so
Morningstar appears to run a single Toronto senior-engineering band across families).

Open relevant roles (sample): Senior Software Engineer (Toronto); Principal Software Engineer (Toronto);
AI Engineer (Toronto); Senior Site Reliability Engineer (Toronto); Senior Software Engineer – Real-Time
Data Platform (London); Software Engineer Mid-Level C++, 1-year fixed term (London).

Sources: https://morningstar.wd5.myworkdayjobs.com/americas/job/Toronto/Senior-Software-Engineer_REQ-057254 ;
https://morningstar.wd5.myworkdayjobs.com/americas/job/Toronto/Principal-Software-Engineer_AP-24263882 ;
https://morningstar.wd5.myworkdayjobs.com/americas/job/Toronto/AI-Engineer_REQ-056759 ;
https://morningstar.wd5.myworkdayjobs.com/americas/job/Toronto/Senior-Site-Reliability-Engineer_REQ-057039
(all cited from locally captured JD text).
