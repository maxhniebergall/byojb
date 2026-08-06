# NovoEd — research
Provider/key: greenhouse:novoed | company_type: product

What they do: NovoEd is an enterprise **collaborative / cohort-based learning platform** — a talent-development product large organizations use to run leadership development, onboarding, functional upskilling and mentoring programs for their employees and customers. They position themselves explicitly as "not an LMS or an LXP," but a platform for social, cohort-based, experiential learning. Recent product lines lean on AI: "Learn+" (AI learning platform) and "Mentor+" (AI-driven mentoring). Customers are enterprise L&D organizations.

How they describe themselves: Founded in 2012 out of **Stanford's Social Algorithms Lab** by Farnaz Ronaghi and Amin Saberi, from frustration with the limits of early MOOCs. Their founding belief, in their words, is that "true learning isn't an isolated activity but happens collaboratively and is felt experientially." The story page emphasises transformational learning through peer collaboration, team-based projects, group discussion and feedback exchange, and a pivot from B2C to B2B/B2B2C. The engineering JD describes them as "a fast-growing product company integrating cutting-edge AI capabilities into our core offering to stay competitive," and sells the role on "small, fast-moving team with high autonomy" and "shape our AI architecture and best practices from the ground up."

Size / stage / funding: Private, small. Acquired in 2018 by **Devonshire Investors**, the private investment arm of Fidelity, based in Boston — so it is PE-owned rather than VC-runway-funded. Headcount not disclosed publicly; the "small, fast-moving team" framing in the JD and the single-engineer-shaped role scope suggest a small engineering org (tens, not hundreds).

Locations / HQ: Originally San Francisco / Bay Area (Stanford origin); owner is Boston-based. Current HQ and offices are not stated on their public story page. Leadership: Scott Kinney (CEO & Chairman), Farnaz Ronaghi (Co-Founder & CTO), Todd Moran (Chief Learning Strategist).

Remote policy: Not stated publicly on their own site. The live engineering req is posted as **"Remote - Canada."**

Remote-Canada eligibility: **Yes.** The Sr. AI Engineer posting is explicitly scoped "Remote - Canada" on their own Greenhouse board, so a Canada-based remote hire is in scope. Nothing in the JD restricts it to a particular province or requires office attendance. Timezone expectations are not stated; the company's centre of gravity (Bay Area origin, Boston owner) points to Pacific/Eastern rather than Mountain, but Pacific overlap is easy from Mountain Time.

Engineering & tech: Python backend on **FastAPI + Gunicorn + Nginx**, heavy background job processing with **Celery**, vector databases for RAG pipelines, LLM integration and prompt/context-window work, plus "task-specific" classical ML models trained and maintained in house, and "agentic systems that orchestrate multiple tools." Nice-to-haves: Docker, CI/CD, deployment automation, Kubernetes. The JD stresses production discipline — performance tuning, latency reduction, parallel processing and multithreading in background jobs, monitoring/observability of APIs and background work, error reporting, testing discipline for both backend and AI components, and dev testing before QA handoff. Explicit hybrid architecture goal: "balance LLM calls with traditional ML." There is a separate QA function.

Notable / other: The role sits at the seam of backend and applied AI rather than in a dedicated ML-infra team — the JD asks the engineer to debug "cross-layer issues spanning backend, AI inference, and UI integration" and to collaborate with frontend engineers. Framing is candidly competitive-pressure driven ("to stay competitive and deliver exceptional value to customers"). Required experience is a relatively modest 3–5+ years.

Open relevant roles (sample): Sr. AI Engineer (Remote - Canada).

Sources:
- https://novoed.com/our-story/
- https://novoed.com/
- https://info.novoed.com/press-release/novoed-acquired-by-devonshire
- https://job-boards.greenhouse.io/novoed/jobs/8055650 (Sr. AI Engineer)
