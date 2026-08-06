# Tucows (registry key `remotetcx`) — research
Provider/key: greenhouse:remotetcx | company_type: product

**Entity confirmation:** the Greenhouse board slug is `remotetcx` and the apply URLs resolve to `tucows.com/careers/jobs`. The JD bodies self-identify as Tucows / Tucows Domains. Confirmed match — the opaque slug is just Tucows' remote-hiring board.

What they do: Tucows is one of the oldest commercial internet companies (operating since 1993) and is really a holding group of three businesses. **Tucows Domains** is "the world's largest wholesale domain registrar, responsible for maintaining the health, neutrality, and openness of an important—but largely invisible part of the Internet: the domain name system (DNS)", operating under the Ascio, Enom, Hover and OpenSRS brands (and second-largest registrar overall). **Ting Internet** is a fiber ISP across US markets. **Wavelo** sells telecom/communications billing and subscriber-management software. Customers are resellers, registrars, ISPs and telecom operators — internal/infrastructure customers rather than consumer growth funnels.

How they describe themselves: "We embrace a people-first philosophy that is rooted in respect, trust, and flexibility. We believe that whatever works for our employees is what works best for us. It's also why the majority of our roles are remote-first, meaning you can work from anywhere you can connect to the Internet! Today, over one thousand people from over 20 countries are part of our team. If this sounds exciting to you, join the herd!" The careers page adds a "people-first culture" built on "trust, inclusivity, and transparency", employee resource groups, "a commitment to continuous learning", and the aim that "every Herd member feels supported, respected, and empowered." Tucows Domains frames its own mission around "helping make the Internet better." Employees are called "the Herd."

Size / stage / funding: Public company (NASDAQ/TSX: TCX), founded 1993. "Over one thousand people from over 20 countries." Long-established rather than venture-stage; the domains business is a mature, cash-generative utility, while Ting Internet's fiber build has been the capital-intensive piece of the portfolio in recent years.

Locations / HQ: Toronto, Canada (corporate roots and Canadian LinkedIn presence). Distributed across 20+ countries; no office requirement for the roles in scope.

Remote policy: Remote-first, and stated as such in the company's own words: "the majority of our roles are remote-first, meaning you can work from anywhere you can connect to the Internet." A "Nomad program" lets employees "work abroad for up to 90 days per year." Benefits emphasise flexibility "for caregiving, health, accessibility, or future planning", in-house leadership programs, generous learning benefits, and promotion from within. Distributed-team experience is an explicit hiring requirement ("Experience working in a remote, distributed team"), which is a real async signal rather than a slogan.

Remote-Canada eligibility: **Yes — verified, unambiguously.** The Senior Backend Engineer JD states plainly: "This is a remote position for applicants based in Canada." Both live relevant postings carry `location: Canada`, `remote_policy: remote`, `geo_eligibility: canada`. Timezone is unconstrained in the JD and the company spans 20+ countries, so Mountain Time is a non-issue.

Engineering & tech: Backend/platform-shaped and explicitly hands-on IC. From the Senior Backend Engineer JD: "design, build, and maintain the services, databases, and APIs that support our products. This is a hands-on individual contributor role that also includes responsibility for technical direction and coordinated delivery across multiple systems." Named stack: Python or Go, RESTful APIs via FastAPI or Gin, PostgreSQL (schema design and query optimisation), HTTP/REST/JSON/XML, automated testing, CI, Git. Nice-to-haves are strongly infrastructure-flavoured: RabbitMQ and other message brokers, AWS/Azure/GCP, Docker/Docker Swarm/Nomad/Kubernetes, OAuth 2.0/JWT/OpenAPI, and "networking, Linux, infrastructure operations, or Internet protocols such as DNS, EPP, and RDAP." Minimum 6+ years. Responsibilities include incident response, observability, documented technical decisions and mentorship.

Compensation: Stated openly on the Canadian JDs. Senior Backend Engineer: "$145,000 – $155,000 CAD for Canadian" applicants. Data Platform Engineer: $90,700–$113,400 CAD. Both already recorded in `data/company-comp.jsonl` as `direct`/`jd_posted`.

Notable / other: DNS/registrar infrastructure is about as close to "boring, mission-critical plumbing" as commercial software gets — EPP, RDAP and registry operations are protocol-level work with real correctness constraints and no consumer-growth pressure. The pay is the soft spot: $145–155K CAD tops out below the $160–200K target band, though it clears the $150K walk-away at the top of the range. Ting's fiber capex has been the source of most of Tucows' financial-press volatility; the domains segment itself is steady.

Open relevant roles (sample): Senior Backend Engineer (Canada, remote); Data Platform Engineer (Canada, remote).

Sources:
- https://tucows.com/careers/ (fetched)
- https://tucows.com/careers/jobs?gh_jid=7794709003 — Senior Backend Engineer JD body (local registry)
- https://tucows.com/careers/jobs?gh_jid=7790698003 — Data Platform Engineer JD (local registry)
- https://tucowsdomains.com/ (cited in JD)
