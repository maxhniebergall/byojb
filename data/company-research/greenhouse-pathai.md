# PathAI — research
Provider/key: greenhouse:pathai | company_type: product

What they do: PathAI builds AI-powered digital pathology. In their words: "PathAI is on a mission to improve patient outcomes with AI-powered pathology. We are transforming traditional pathology methods into powerful, new technologies. These innovations in pathology can help accelerate drug development, improve confidence in the accuracy of diagnosis, and get life-saving therapies to patients more quickly." The customer base implied by that framing is pharma/biotech (drug development) and diagnostic pathology.

How they describe themselves: "At PathAI, you'll work with a diverse and talented team of people, who are dedicated to solving complex problems and making a huge impact." Hiring stance, quoted: "At PathAI, we are looking for individuals who are team players, are willing to do the work no matter how big or small it may be, and who are passionate about everything they do. If this sounds like you, even if you may not match the job description to a tee, we encourage you to apply." A formal published values list was **not** obtained — pathai.com returned HTTP 403 to the fetch attempt, so this section reflects only JD language.

Size / stage / funding: **Unverified.** Not stated in the registry or the JDs. The SRE JD does say the ML team is "rapidly growing" and that they are building out their own data center to support it, which implies meaningful scale and capital, but no headcount or funding round is confirmed here.

Locations / HQ: Boston, MA. The SRE role is "Boston, MA or Remote"; the MLOps co-op is Boston, MA only. They operate at least one physical on-prem data center in addition to AWS.

Remote policy: Partial remote — the SRE posting is tagged `#LI-Remote` and lists "Boston, MA or Remote," so remote is genuinely offered for at least some engineering roles. However that same role requires hands-on physical hardware administration and "Willingness to travel up to 25% of the time," so it is remote-with-substantial-travel rather than fully distributed. Async/handbook signals: none found.

Remote-Canada eligibility: **Unclear, leaning no.** The posting says only "Boston, MA or Remote" with no country qualifier — it never states US-only, but it also never states international or Canadian eligibility. Pay is quoted in USD, hiring is Boston-anchored, and the role requires up to 25% travel to a US data center. Treat as unverified; do not assume Canada-eligible. The MLOps co-op is Boston-onsite and therefore not eligible at all.

Engineering & tech: Hybrid cloud/on-prem. AWS ("engineering infrastructure patterns for cloud environments in Amazon Web Services — building in security, reliability and scalability") integrated with an on-prem data center into "a seamless hybrid cloud environment." Automation via Ansible and Python/GoLang — "You work hard to eliminate toil by automating everything." Observability with Datadog/Grafana/Prometheus. IaC with Terraform/CloudFormation. Physical hardware stacks: iDRAC/IPMI/Nvidia UFM/Juniper. Storage: Quobyte/S3/FSx/EFS, optimized for high-performance workloads. Virtualization/orchestration: EKS/ClusterAPI/KVM. Modern network design across layers. Platform on-call rotations and "urgent incident response" are explicit parts of the job. The data center exists specifically to serve the ML training org — this is GPU/ML-infrastructure work.

Comp (their own statement): the Senior/Staff SRE JD states "Annual Pay Range: $165,750 - $224,450", describes it as cash compensation including base or hourly wage plus on-target commission for eligible roles, and adds "Not Overtime Eligible" / "Eligible for Equity". A band matching this is already on record in `data/company-comp.jsonl` (sre_devops / staff, direct, jd_posted).

Notable / other: Standard strong EEO language: "we base our employment decisions on business needs, job requirements, and qualifications — that's all… We don't tolerate any kind of discrimination or bias, and we are looking for teammates who feel the same way." They run a structured co-op program (Software Engineering Co-op MLOps, Sept–Dec 2026).

Open relevant roles (sample): Senior/Staff Site Reliability Engineer - Data Center (Boston, MA or Remote); Software Engineering Co-op MLOps, September–December 2026 (Boston, MA).

Sources: registry JD bodies at `data/posting-research/https---pathai.com-careers-8369253002?gh_jid=8369253002.md` and `…8651564002…md`. Attempted https://pathai.com/ — returned **HTTP 403 Forbidden**, so no first-party marketing/about page could be read; size, funding and formal values are unverified as a result.
