# CertifyOS — research
Provider/key: ashby:certifyos | company_type: product

What they do: CertifyOS builds provider-data infrastructure for healthcare. Its API-first platform automates provider licensing, enrollment, credentialing and network monitoring by connecting directly to "hundreds of primary data sources", giving payers and health systems a single accurate provider record. Their marketing site claims 8 of the 10 publicly listed US health plans as clients, and cites outcomes like "75% reduction in re-credentialing costs", "50% fewer roster mismatches" and "10x faster provider onboarding". Named customers include Alma Health and OncoHealth.

How they describe themselves: Framing on the site is infrastructure-first — "Provider Data Is the Backbone of Healthcare — And It's Broken" — and the vision line is "One API. One provider ID. Frictionless provider data." Stated values, verbatim from the JD: "authenticity, accountability, collaboration, results, and openness to feedback". They describe the team as "a high-ownership team focused on solving real infrastructure problems that impact millions of patients". On working style: "We ship fast, but we don't ship sloppy… We use AI-assisted tooling aggressively to reduce toil and accelerate troubleshooting, which raises the floor on the problems we tackle — not an excuse to reduce rigor." They also state "We are also committed to pay transparency and foster an open culture where compensation conversations are encouraged and respected." Notably the SRE JD screens *against* firefighting: "If you do your best work reacting to incidents, this probably isn't the right fit. If you do your best work preventing them, we should talk."

Size / stage / funding: Not disclosed on the marketing site and not stated in the JD beyond "backed by leading investors" and "built by a team with deep experience in provider data systems". Headcount, funding stage and profitability are UNVERIFIED here.

Locations / HQ: Not disclosed on the pages fetched. The benefits section distinguishes a US-based team from an India-based team ("In India, employees are supported with health insurance, statutory leave benefits, and additional wellness (menstrual) leave for women"), so there are at least US and India employment entities. HQ city unverified.

Remote policy: The one live relevant posting is listed "Remote US". No company-wide remote-policy statement was found on the pages fetched.

Remote-Canada eligibility: **No evidence of Canada eligibility — likely NO.** The Senior SRE posting is scoped "Remote US"; benefits are described only for US and India entities, with no Canadian entity or EOR mentioned. Nothing found suggests they can employ someone in British Columbia. Treat as effectively disqualifying unless confirmed otherwise with the company.

Engineering & tech: Stack named explicitly in the SRE JD — GCP (GKE, Cloud Run, BigQuery, Cloud Monitoring), Terraform / Pulumi, Docker / Kubernetes, GitHub Actions / Cloud Build, Prometheus / Grafana / Datadog, Python / Bash / Go, Sentry, Snyk, SonarQube, Jira / Slack. Application stacks mentioned as nice-to-have: NodeJS, TypeScript, Java, React. SREs "own the full lifecycle of what they support — from infrastructure design and deployment automation through observability, incident response, and postmortems". The role explicitly includes designing SLIs/SLOs/error budgets and data-platform health signals (lineage, freshness, correctness), and mentions operating in a regulated / PII environment.

Notable / other: Benefits stated: 100% employer-paid health, dental and vision premiums for employees; unlimited PTO for the US team with a stated minimum of two weeks off per year. Recruiting contact is recruiting@certifyos.com. No engineering blog or public handbook was found.

Open relevant roles (sample): Senior Site Reliability Engineer (Remote US); board also lists Senior Software Engineer and Data Infrastructure & Analytics Specialist.

Sources:
- https://certifyos.com/ (fetched)
- https://jobs.ashbyhq.com/certifyos/405a5c5c-5ceb-4f13-93a5-dc176ffd4e1f (JD body, from local registry — ATS boards are not fetched)
