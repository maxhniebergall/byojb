# Steel — research
Provider/key: ashby:steel | company_type: product

What they do: Steel builds open-source **browser infrastructure for AI agents** — a headless-browser / "Sessions API" cloud service that lets AI applications drive real browsers (JS rendering, authenticated sessions, proxies/stealth, CAPTCHA handling, HTML/markdown/PDF/screenshot extraction). Their own docs frame it as "a headless browser API that lets AI engineers" control remote browser sessions, solving that "getting LLMs to use the web is *hard*." Customers are developers building agentic/AI products; they run "millions of sessions monthly" for "dozens of paying customers."

How they describe themselves: From their JDs — "Steel is building open-source browser infrastructure for AI agents and apps. We make it easy for developers to ship AI products that interact with the web using our Sessions API." They emphasize traction ("over 7,000 GitHub stars… we grew our platform 50x in 2025 purely through word-of-mouth and our open-source community") and team shape: "Backed by world-class investors, we're building a small, highly motivated, and talent-dense team that's shaping the future of how humans interact with the internet." The Agents JD adds that they want people who "thrive in highly autonomous work environments" and are "AI-native, heavy user of AI agents in daily coding." No published values page was reachable — the values above are inferred from their JD language only.

Size / stage / funding: Small early-stage startup ("small, talent-dense team"); registry facet extraction classifies the Agents role as `company_stage: seed` and the Infrastructure role as `startup`. Investors described only as "world-class" — not named, unverified. Headcount not stated anywhere reachable; likely well under 30. Not profitable/established by any evidence available.

Locations / HQ: Toronto, Ontario. Both live postings are Toronto-based and reference "our Toronto office."

Remote policy: **In-person.** The Infrastructure JD lists as a hard requirement: "Able to work in-person from our Toronto office." The Agents JD does not restate it but is also Toronto-listed, and the interview loop ends with "an onsite in our office."

Remote-Canada eligibility: **Verified NO for remote.** The company is Canadian (Toronto) so it can employ a Canadian, but the role requires in-person Toronto attendance — not workable from Kimberley BC, and Eastern-Time-anchored.

Engineering & tech: Systems-heavy infrastructure work: VM snapshotting ("restores full browser state in under a second"), Linux-kernel-level performance engineering ("staring at kernel traces"), orchestrating "millions of browser sessions across regions with sub-second cold starts," VMs, proxies, caches, task queues, observability and CI/CD built from scratch. Cloud: AWS + GCP. Rust "a plus, not a requirement." Requirements: 4+ years production code, large-scale distributed systems, strong OS foundations, performance-optimization track record. The Agents role is instead full-stack product engineering (design → frontend → backend → model integration) plus evals.

Notable / other: Open-source-first go-to-market (7k+ GitHub stars); public referral bonus of $10,000 for a hire. Hiring loop: 2–3 short technicals, then an in-office onsite project day.

Open relevant roles (sample): Member of Technical Staff – Infrastructure (Toronto); Member of Technical Staff – Agents (Toronto); registry also lists Member of Technical Staff – Applied AI.

Sources:
- https://docs.steel.dev/overview/intro-to-steel (fetched)
- JD bodies already in the registry: https://jobs.ashbyhq.com/steel/612cf7fc-d001-47ac-ad15-90bf8f6dc70e , https://jobs.ashbyhq.com/steel/c5a1ec46-5507-4c5b-9fed-f15ce25fd7be (cited, not fetched — ATS boards are client-rendered)
