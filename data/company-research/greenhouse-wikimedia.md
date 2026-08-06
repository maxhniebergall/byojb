# Wikimedia Foundation — research
Provider/key: greenhouse:wikimedia | company_type: product (non-profit)

What they do: The Wikimedia Foundation is the US 501(c)(3) non-profit that operates Wikipedia and the other Wikimedia free-knowledge projects. It runs one of the top-10 websites in the world on its own bare-metal + Kubernetes infrastructure (plus Wikimedia Enterprise, a paid API product selling structured Wikimedia content to large commercial re-users). Revenue is primarily individual donations, plus Enterprise API contracts. "Customers" are volunteer editors, readers, and Enterprise API partners.

How they describe themselves: Mission — "a world in which every single human being can freely share in the sum of all knowledge." Their published values (wikimediafoundation.org/who-we-are/values/) are: **collaboration** ("we solve problems better through collaboration… we find joy, belonging and connection in doing things together"), **learning from failure** ("success often comes through learning from failure"), **diversity and inclusion** ("to build the sum of all knowledge we need to embrace human diversity… we do our best work when we understand different perspectives"), **accountability and transparency**, and **safety and equity** ("we contribute to making spaces safe for people to express themselves… repair harm while modeling accountability"). Tone across their own pages and JDs is deliberate, civic, non-hype — no "fast-paced", "rocketship" or hustle language anywhere in the seven live engineering JDs on file.

Size / stage / funding: ~700 staff and contractors; non-profit, donation-funded, operating-surplus stable (JD facet extraction repeatedly tags company_stage as "profitable"). Not runway-dependent. Note recent labour news: a July 2026 CWA union recognition request covering US staff (wikimediafoundation.org/news/2026/07/27/statement-cwa-recognition-request/) — a signal of internal labour organizing, not of financial distress.

Locations / HQ: HQ San Francisco, CA. Staff and contractors in 40+ countries; individual JDs enumerate eligible countries (Canada, US, UK, Germany, Brazil, Colombia, France, Ghana, India, Indonesia, Italy, Kenya, Mexico, Morocco, Netherlands, Poland, Singapore, South Africa, Spain, Switzerland).

Remote policy: Remote-first / distributed by default; no commute expectation, flexible hours to accommodate a globally distributed org, San Francisco office optional. All seven live engineering postings are listed simply as "Remote".

Remote-Canada eligibility: **Verified yes.** Canada appears explicitly in the eligible-country list on the SRE Data Persistence, SRE Infrastructure Foundations, SRE Wikimedia Enterprise, Senior SWE MediaWiki and Senior SWE Core Experiences JDs. **One caveat**: both Wikidata Platform roles (Senior Software Engineer / Software Engineer, Wikidata Platform) state a timezone requirement of **UTC+1 to UTC-5 with 14:00–17:00 UTC core overlap** — Mountain Time is UTC-7 (UTC-6 in summer), i.e. outside that band and requiring a 07:00–10:00 local start. Those two specific roles are a timezone stretch; the other five are not.

Engineering & tech: SRE stack — Kubernetes, Puppet, Ansible, Debian/Linux, Prometheus, Grafana, memcached, distributed caching, Terraform, GitLab, ArgoCD, and multi-cloud (AWS/GCP/Azure) on the Enterprise side. Product/platform stack — MediaWiki (PHP), web performance and frontend infrastructure, event streams, Kafka/Flink, observability, SLOs, CI/CD. Wikidata Platform is knowledge-graph work: RDF, SPARQL, triple stores, graph databases, search indexes, data pipelines. Engineering is organized into long-lived teams around durable systems (Data Persistence, Infrastructure Foundations, Core Experiences, Editing, Wikidata Platform, Product Safety & Integrity) rather than around feature squads. Essentially all engineering is public: code, RFCs, incident reports and technical decisions live on Phabricator/Wikitech in the open.

Notable / other: Wikimedia Enterprise is the commercial arm and the one part of the org with external paying customers; the rest is internal/volunteer-facing. Equity is explicitly `false` in extracted comp facets — non-profit, so cash + benefits only, no stock. Salary ranges are stated directly in JDs with a note about "multiple individualized factors, including cost of living in the location where the candidate resides" — i.e. geo-adjusted pay, which for a BC-based hire likely lands below the US-anchored top of the range.

Open relevant roles (sample): Senior Site Reliability Engineer, Data Persistence; Senior Site Reliability Engineer, Infrastructure Foundations; Senior Site Reliability Engineer, Wikimedia Enterprise; Senior Software Engineer, MediaWiki; Senior Software Engineer, Wikidata Platform; Software Engineer III, Core Experiences; Software Engineer III, Editing; Software Engineer III, Product Safety & Integrity.

Comp on record (from their own JDs): Senior SRE roles US$113,082–181,243 base; Senior SWE Core Experiences US$113,000–175,000 base; Software Engineer III roles US$92,267–148,729 base.

Sources:
- https://wikimediafoundation.org/who-we-are/values/
- https://wikimediafoundation.org/who-we-are/
- https://wikimediafoundation.org/wiki/Work_with_us
- https://wikimediafoundation.org/news/2026/07/27/statement-cwa-recognition-request/
- Live JD bodies already in the registry: https://job-boards.greenhouse.io/wikimedia/jobs/7919287 , /7997194 , /8090103 , /7972965 , /7921820 , /7946461 , /7875719 , /8060261 , /8060307
