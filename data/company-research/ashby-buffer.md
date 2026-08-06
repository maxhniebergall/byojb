# Buffer — research
Provider/key: ashby:buffer | company_type: product

What they do: Buffer builds social-media and brand-building software for small businesses, creators and individuals — scheduling, publishing, analytics and engagement tools. Their stated mission is "to provide essential tools to help small businesses get off the ground and grow. Through exceptional customer service and uplifting content, we help our customers believe they can succeed and do good along the way." Their platform indirectly serves millions of creators publishing on the social web.

How they describe themselves: "Buffer is a fully distributed team, and we've always aimed to do things a little differently at Buffer. Since the early days, we've focused on building one of the most unique and fulfilling workplaces by rethinking a lot of traditional practices. We also default to transparency, so you can read all about our metrics, and our successes and failures along the way on our Transparency Dashboard." Default to Transparency is their most visible operating value and is not decorative — they publish company metrics, revenue, and every individual teammate's salary publicly. They also state "We're united by Buffer's values, and we hire and work from all over the world" and describe striving for "a diverse and inclusive work environment... where underrepresented groups are welcome and can flourish."

Size / stage / funding: Small, private, and — importantly — profitable. They describe themselves as "a profitable, 15-year-old company innovating at the edge of AI-assisted development." Roughly 70-90 people across 20+ countries. Not venture-runway dependent; they famously bought out their VC investors years ago. This is a stability signal, not a startup-risk one.

Locations / HQ: No headquarters — fully distributed by design, with teammates across 20+ countries including Canada (Vancouver-based staff appear on the public salaries page) and Taiwan.

Remote policy: Remote-first and fully distributed since the early days, with a long-standing async and transparency culture. The infrastructure JD states: "We're remote-first with a preference for at least 4 hours of overlap with EMEA time zones, but we're open to strong candidates anywhere in the world." They travel to meet in person once or twice per year, and those events are "highly encouraged." On-call is distributed across all engineers — a week-long shift roughly once per quarter, which is a light rotation.

Remote-Canada eligibility: YES, with a timezone caveat. Buffer hires globally and already employs Canadians (Vancouver appears on the public salaries roster), so employment from Canada is established practice rather than speculation. The caveat is the stated preference for 4+ hours of overlap with EMEA time zones: Mountain Time (UTC-7) is 8-9 hours behind CET, so 4 hours of EMEA overlap from Kimberley would mean starting around 1-2am local. The JD explicitly softens this to a preference and says they are "open to strong candidates anywhere in the world," so it is a negotiation point rather than a hard bar — but it is the single thing to confirm before investing in this application.

Engineering & tech: AWS with EKS, ArgoCD, Argo Rollouts, KEDA for autoscaling, CI/CD pipelines, and monitoring/observability tooling. The infrastructure team is deliberately tiny — two seasoned infrastructure engineers plus this hire — described as "a small, deliberate, high-leverage team" that "runs the platform that lets every Buffer engineer ship." The team's framing is explicitly infra-as-a-product: "Treating engineers across Buffer as customers," evolving developer tooling "that makes the inner loop fast, with documentation that holds up at 2am or when consumed by an agent." Three named workstreams: keeping the lights on at a higher bar (faster, anti-fragile CI/CD, boring deploys, incidents that teach rather than repeat), modernizing the foundation (KEDA, Argo Rollouts, better monitoring signal-to-noise, deeper AI use), and developer tooling as products. Engineering, Product and Design operate as one unified team ("EPD"), who are the internal customers of the platform.

Compensation transparency: Buffer publishes every salary publicly at buffer.com/salaries with a documented formula: a custom percentile per area applied to level-5 market data, then a cost-of-living adjustment across two bands (Global at 90%, High at 100%). The two existing Senior Platform Engineers are listed at $182,700 USD (Peter, Global band) and $192,981 USD (Steven, Taipei).

Notable / other: The public Transparency Dashboard covers metrics, revenue, and failures as well as successes. The role reports to Miguel, the Infrastructure Engineering Manager. The company is leaning into AI-assisted development for investigations and boilerplate and wants to push it deeper into daily work.

Open relevant roles (sample): Senior Infrastructure Engineer (Remote).

Sources:
- https://jobs.ashbyhq.com/buffer/1ee8b707-48a0-40cc-a319-3fb7c665a1e8 (JD body, local copy)
- https://buffer.com/salaries
- https://buffer.com/resources/salary-formula/
