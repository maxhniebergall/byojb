# Process Street — research
Provider/key: greenhouse:processstreet | company_type: product

What they do: Process Street is a **compliance operations platform** — workflow automation, policy enforcement and audit-ready evidence for business processes. The product has three parts: **Docs** (document/policy management), **Ops** (workflow automation and process orchestration), and **Cora**, an AI compliance-and-risk agent that "monitors regulations 24/7." The company reports 3,000+ customers and 1M+ users, naming Salesforce, Slack, Cisco, Colliers and the Government of Canada. Historically a checklist/SOP tool, it has repositioned around compliance and AI-native workflows.

How they describe themselves: Taglines are "Systemize execution. Prove compliance." and "Automate business processes, enforce policies, and deliver audit-ready proof, consistently." The engineering culture is documented publicly and in unusual detail in their own JDs and blog:
- **Shape Up** process: "6-week cycles: solve problems, not tickets" and "2-week cooldowns: improve systems, tooling, or explore ideas." They published that this cut time-to-ship a feature "from 6 months to 6 weeks" (~70% cycle reduction).
- **Async-first, anti-meeting**: "You love the process but loathe meetings, bureaucracy, and ceremony. We think process is a tool. Used well, it makes us a better, faster team. But when it's not doing that, we drop it… A typical week for our engineers and designers has fewer than 5 hours of meetings." Plus "No Meeting Fridays."
- **Agency**: "PMs provide a problem statement and some guidelines – no tickets, no detailed specs, no high-fidelity solutions, and no estimates. Designers and engineers are trusted to craft the best solution possible in the cycle… During the 2-week cooldowns, you have the autonomy to work on what's important *to you* – including code maintainability or making the team faster."
- **Small and early**: "We're a small team, and we're still at an early stage. We don't have designated areas of responsibility, and everyone wears the product hat. Every cycle brings new challenges, and your sphere of influence is wide."
- **AI-native engineering** is the current identity: "You think of coding as a collaboration with AI, not a solo activity"; "You're a Claude Code / Codex power user"; the role is framed as helping define "How engineers collaborate with AI / How codebases are structured for agent interaction / How workflows evolve when AI is a first-class participant."

Size / stage / funding: Private, venture-backed, self-described as "small" and "still at an early stage." Founded ~2014, originally San Francisco. Funding not disclosed on the site; equity is offered "for all full-time roles."

Locations / HQ: San Francisco referenced in postings as the nominal HQ; the company operates as a distributed team.

Remote policy: **Fully remote, async-first**, with a hard timezone band: "You live in a timezone between UTC-6 to UTC+2 (North American Central Time through Central European Summer Time)." Benefits: unlimited PTO ("most take 3-4 weeks, plus their major holidays, AND a company-wide week off in December"), company offsite plus sponsored small-group meetups, regular social time, US-employee health insurance, equity.

Remote-Canada eligibility: **Unclear / borderline, and the constraint is timezone rather than country.** No country restriction is stated — hiring is described globally within the UTC-6…UTC+2 band, and the postings are extracted as `geo_eligibility: global`. However health insurance is explicitly "for US employees," which suggests non-US staff are contractors or employer-of-record. Note the timezone edge case for **Kimberley, BC**: Mountain *Daylight* Time is UTC-6 (inside the band) but Mountain *Standard* Time is UTC-7 (outside it) — so BC-interior candidacy sits exactly on the boundary half the year and must be raised explicitly rather than assumed.

Engineering & tech: Backend **Scala 3 / Play 3, Postgres, Redis**; frontend **React, Redux, React Query, Chakra, XState**; infra **AWS, Docker, CircleCI**; "AI Workflow: Claude Code, Codex, agent-based tooling (evolving rapidly)." Role expects 7+ years, strong backend (Scala or Java/Ruby/C#) plus strong React, SaaS scaling experience, and deep familiarity with AI coding tools. Explicitly no on-call in the extracted facets. Path to "eventually lead a small team (2–3 engineers)."

Notable / other: They publish process/engineering content on their own blog (Shape Up adoption, design perspective on Shape Up, modernizing the tech stack). **Data-quality note:** the Greenhouse board carries **15 near-identical live postings** all titled "Senior Software Engineer | Remote | AI SaaS Software Role" with essentially identical bodies — this looks like repost/SEO duplication rather than 15 open headcount, and it inflates this company's posting volume in the registry.

Open relevant roles (sample): Senior Software Engineer | Remote | AI SaaS Software Role — https://job-boards.greenhouse.io/processstreet/jobs/8567648002

Sources:
- https://www.process.st/ (product, positioning, customers)
- https://www.process.st/shape-up/ ("How We Cut Our Time to Ship a Feature from 6 months to 6 weeks Using Shape Up")
- https://www.process.st/deliver-features-faster-with-shape-up/
- https://www.process.st/shape-ups-design-process/
- Live JD body: https://job-boards.greenhouse.io/processstreet/jobs/8567648002
