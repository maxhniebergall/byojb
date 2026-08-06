# Localcoin — research
Provider/key: greenhouse:localcoin | company_type: product

Research method: NO web fetches were possible for this company. WebSearch was exhausted for the
session (200/200 global cap) and the only URL on record is a client-rendered ATS board, which returns
an empty shell. Everything below is grounded in the company's OWN job-description text already captured
locally in `data/posting-research/`; anything not stated there is marked UNVERIFIED rather than guessed.

What they do: Localcoin operates a network of Bitcoin/digital-currency ATM terminals. Founded 2017,
headquartered in Toronto, it describes itself as "the fastest-growing Bitcoin ATM operator in the world",
with terminals across Canada, Poland and the APAC region (Australia, Hong Kong, New Zealand). The stated
mission is "to simplify the process and experience of buying or selling digital currencies globally",
reaching mainstream retail through partnerships with corporate and franchised retail spaces.

How they describe themselves: Own words from both live JDs — "everyone should be able to own
cryptocurrency and have a deep understanding of blockchain technology"; "a rapidly growing team… a
talented, dynamic group of team members who will encourage you to learn, grow, and thrive"; and the
explicit call for "a self-starter looking to hone your skills in a startup environment that fosters
innovation, transparency, and team connectivity". No separate values page was reachable, so this is the
full set of self-description available.

Size / stage / funding: UNVERIFIED (no headcount or funding figure in any local source). Self-described
"startup environment" and "rapidly growing"; operating since 2017 with international terminal footprint.

Locations / HQ: HQ Toronto; office in Etobicoke, Ontario. Terminal operations in Canada, Poland,
Australia, Hong Kong, New Zealand.

Remote policy: HYBRID, in-office. Both live JDs state it explicitly:
- Senior DevOps Engineer: "This position will be based out of our Etobicoke, ON office, with an
  expectation of working in-office two days per week."
- Java Backend Developer: "based out of our office in Etobicoke, ON, and will have a hybrid work
  schedule of 2 days a week."

Remote-Canada eligibility: NO — not remote-eligible outside the Greater Toronto Area. Both roles require
two days per week physically in Etobicoke. NOTE A DATA-QUALITY PROBLEM: the registry lists the location
as "Canada" and the extractor tagged the Java role `remote_policy: remote`, which contradicts the JD text.

Engineering & tech: Fintech/crypto infrastructure under regulated (PCI) constraints.
- DevOps/platform: AWS Organizations multi-account, multi-region HA to SLAs, VPC/private subnets,
  Transit Gateways, VPN, IAM governance (least privilege, Verified Permissions, SSO), advanced Terraform
  with module architecture and state strategy, GitLab CI/CD and SaaS runners, AMI pipelines in
  Python/Go/Bash, Kubernetes (EKS) or ECS, ECR + image scanning, Datadog (preferred) or Prometheus/Thanos,
  SLIs/SLOs, incident response and RCA, RDS, Vault / AWS Secrets Manager, CIS Benchmark and Security Hub
  remediation, Cloudflare (Firewall, WARP, Zero Trust, Access, DNS), FinOps/tagging, runbooks.
  Split stated as 80% hands-on execution / 20% mentoring.
- Backend: Java 8, Maven/Gradle, Spring (Boot, JPA, MVC, Security), REST, SQL (MySQL/Postgres/Oracle/
  MSSQL), Sonar, BDD, Git flow, NGINX, Docker; nice-to-haves Angular/React, Swagger/Postman, Flyway.
  The backend role explicitly includes collaborating with UI teams and mentoring juniors.

Notable / other: Stated benefits — competitive salary, RRSP group matching, hybrid work environment,
professional development. Salary ranges are published directly in the JDs (unusual and useful):
CAD $150,000–$180,000 for Senior DevOps Engineer, CAD $100,000–$135,000 for Java Backend Developer.

Open relevant roles (sample): Senior DevOps Engineer (Etobicoke, hybrid); Java Backend Developer
(Etobicoke, hybrid).

Sources: https://job-boards.greenhouse.io/localcoin/jobs/5980978004 (cited, JD text held locally);
https://job-boards.greenhouse.io/localcoin/jobs/5996901004 (cited, JD text held locally).
