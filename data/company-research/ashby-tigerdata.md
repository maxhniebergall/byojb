# Tiger Data — research
Provider/key: ashby:tigerdata | company_type: product

Entity note: **Tiger Data is the renamed Timescale, Inc.** — the creators of TimescaleDB. Their own JDs open with "At Tiger Data, formerly Timescale." Do not confuse with the unrelated "Data Tiger" entity that appears separately in company databases, nor with Tiger Global Management (which is, confusingly, one of their investors). The registry entry matches the Timescale/TimescaleDB company.

What they do: Tiger Data builds a PostgreSQL platform positioned for transactional, analytical and increasingly "agentic" workloads — in their words, "the fastest PostgreSQL platform," used to accelerate real-time insights and power critical infrastructure at scale. The open-source foundation is TimescaleDB, the Postgres extension for time-series and analytical workloads. Commercially there are two arms: **Tiger Cloud**, the managed multi-region, multi-cloud database service, and **TimescaleDB Enterprise**, a newer on-prem offering that lets customers deploy, manage, secure and operate TimescaleDB inside their own environments. Customer base is "thousands of organizations" globally.

How they describe themselves: The self-description that appears verbatim atop every JD is: "a globally distributed, remote-first team committed to direct communication, accountability, and collaborative excellence, we're shaping the future of data infrastructure, built for speed, flexibility, and simplicity." Their stated remote principles are that remote "means communicating with purpose, taking ownership, and delivering results," with teams working across time zones and **collaborating asynchronously**. Tone is engineering-substantive rather than hype-driven; the Enterprise role does, however, use growth-flavored language ("high-growth role for a builder," "navigate ambiguity confidently").

Size / stage / funding: Private, venture-backed. Roughly $180M raised total from Tiger Global Management, Redpoint Ventures and Benchmark Capital; the last disclosed round was a **$110M Series C in February 2022**. Headcount reporting is inconsistent across aggregators — 41 and 67 from two data vendors, while the company's own careers material describes 100+ people across 20+ countries and six continents. Treat it as roughly 50–100. No profitability statement is published. The gap since the last raise (four years) is the main open question about financial footing.

Locations / HQ: No headquarters in practice — "an all-remote organization," globally distributed across 20+ countries and six continents. Nominally US-incorporated (New York).

Remote policy: **All-remote / remote-first**, stated explicitly and unambiguously in the JDs: "Tiger Data is an all-remote organization." Asynchronous collaboration across time zones is called out as a stated norm rather than a tolerated exception. Individual roles still carry their own geographic restrictions, which vary considerably.

Remote-Canada eligibility: **Mixed — depends entirely on the role, and the two live postings differ.**
- **Senior Platform Engineer — YES.** The JD states: "This role is a full-time position, looking for candidates in the US or Canada." The registry location field for this posting is somewhat garbled ("US Full-time, Spain Full-time, Remote, Brazil"), but the JD body is explicit and authoritative: US or Canada. No province exclusions stated, so British Columbia should qualify.
- **Senior Software Engineer, Enterprise — NO.** The JD states: "This role is remote. Candidates must be located in the US Eastern or Central Time Zone." That excludes Mountain Time and excludes Canada-by-default. This posting is disqualified on the hard geographic constraint.

Engineering & tech: Deep infrastructure work. The Platform role covers a control plane of distributed Go microservices interacting with Kubernetes and cloud-provider APIs across multiple regions and clouds; building Kubernetes controllers, operators and CRDs; automating database lifecycle operations (deploy, resize, upgrade, fork); observability and monitoring; and deployment reliability plus CLI tooling. Stated engineering standards are specific and mature: idiomatic Go with comprehensive unit and integration tests, **>80% code coverage**, golangci-lint enforcement, peer review, security compliance and vulnerability management. There is an on-call rotation with incident response and root-cause analysis. The Enterprise role is broader/full-stack — React + TypeScript consoles, Go backends, Ansible deployment workflows — and is pitched at an earlier career stage. Requirements for the Platform role are 3+ years software/platform engineering, 2+ years production Go, 2+ years Kubernetes operations.

Notable / other: Neither live JD posts a salary range, and no public pay-transparency or compensation page was found — unusual for a company hiring in the US, and it means comp must be established in conversation. The "agentic workloads" positioning reflects the current push to use Postgres (plus pgvector-style capabilities) as the store behind AI applications.

Open relevant roles (sample): Senior Platform Engineer; Senior Platform Engineer - Postgres Specialist; Senior Software Engineer, Enterprise.

Sources:
- Live JD bodies in the registry: https://jobs.ashbyhq.com/tigerdata/9f71650b-230b-4316-ab4e-abe0ebc6385f (Senior Platform Engineer) and https://jobs.ashbyhq.com/tigerdata/d07c7cb2-c304-455c-9941-55e14f8a92c5 (Senior Software Engineer, Enterprise)
- https://www.tigerdata.com/careers
- https://www.tigerdata.com/blog/year-of-the-tiger-110-million-to-build-the-future-of-data-for-developers-worldwide (Series C)
- https://www.crunchbase.com/organization/timescaledb (funding total; aggregator, low confidence)
