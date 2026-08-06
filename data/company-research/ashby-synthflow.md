# Synthflow AI — research
Provider/key: ashby:synthflow | company_type: product

What they do: Synthflow AI describes itself as *"an enterprise AI agent platform that unifies customer operations across voice, chat, and messaging. Our agents handle routine interactions at scale so teams can focus on high-value work."* The original and still core product is no-code AI phone agents: *"At Synthflow we're building the easiest way for businesses to create AI-powered phone agents. No coding, no fuss—just smarter automation."* The company *"democratizes access to advanced voice AI with a no-code platform that lets enterprises easily create, deploy and scale natural-sounding, cost-effective voice agents tailored to their business needs."* Customers are businesses automating inbound/outbound call operations (support, scheduling, qualification).

How they describe themselves: Metrics-forward marketing: *"Over 20M hours of operations automated"*, *"60% more calls answered vs. non-AI operators"*, *"150M interactions handled, 99.99% uptime"*, *"Trusted by 1,000+ customers"*, *"Recognized as one of the most promising companies in Germany."* Culture language is explicitly startup-intensity: *"We're passionate about delivering the future of voice technology with lightning-fast, scalable solutions. It's an exciting time at Synthflow: we're **early, fast-growing, and laser-focused on impact**. Join us to do the best work of your career while helping businesses thrive."* The offer list reads: *"Autonomy at speed: High-ownership roles in a **fast-moving startup**"*, *"Remote-first flexibility: Contribute from anywhere, on your schedule"*, *"Cutting-edge technology: Work on what interests you most"*, *"Career growth: Scale your impact as the company grows"*, *"Rewarding package: Competitive pay, equity options, and comprehensive benefits."*

Size / stage / funding: **Early-stage startup, founded in Berlin in 2023** by serial entrepreneurs Albert Astabatsyan, Hakob Astabatsyan and Sassun Mirzakhan-Saky. Backed by **Accel, Atlantic Labs and Singular**. Small headcount; no profitability claim. This is a young, venture-funded company in the most crowded segment of the current AI cycle (voice agents), competing against Retell, Vapi, Bland, ElevenLabs and the major model providers' own voice stacks.

Locations / HQ: Berlin, Germany. Remote-first with EU-centred hiring; job locations are listed as "Global Remote, EU Remote."

Remote policy: **Remote-first and explicitly stated** — *"Remote-first flexibility: Contribute from anywhere, on your schedule."* Postings are tagged "Global Remote, EU Remote."

Remote-Canada eligibility: **Plausible but unverified, and the practical shape is EU-centric.** The posting is tagged "Global Remote, EU Remote" and the extractor recorded `geo_eligibility: canada` for it, but no Canadian entity, no country list and no timezone policy are stated anywhere in their own copy. A Berlin-HQ company with EU-Remote framing almost certainly engages non-EU staff as **contractors** rather than employees, and CET-anchored collaboration is a ~9-hour offset from Mountain Time — an 08:00 MT start is already 16:00 in Berlin. Treat "Global Remote" as an aspiration to confirm, not as verified Canada eligibility; the timezone gap is the real obstacle.

Engineering & tech: **Go** is the primary language (5+ years required), with Python secondary. Deep systems focus for the real-time engine role: *"Expertly manage concurrency and parallelism in Go using goroutines, channels, and synchronization primitives like mutexes and wait groups"*; *"Develop robust networking and streaming capabilities, including experience with network programming, sockets, and protocols like **WebSockets and WebRTC**"*; *"Lead performance optimization initiatives by profiling Go code, reducing latency, and efficiently managing memory and garbage collection"*; *"Build fault-tolerant systems with strong recovery mechanisms and failover strategies."* Observability with **zap, klog, OpenTelemetry, Jaeger**. Cloud on **GCP or AWS**, containerized. Engineering practices are explicitly stated: *"Apply Test-Driven Development (TDD) and engage in Pair Programming"* and active code review. Telephony APIs, LLMs, speech-to-text and voice synthesis are the domain. On-call is indicated in the extracted facets.

Notable / other: The real-time voice engine is genuine latency-critical distributed-systems work — this is not an LLM-wrapper role technically, even though the company sits in the AI-wrapper market segment. Only one relevant live posting in the registry.

Open relevant roles (sample):
- Senior Software Engineer - (Go) Real-Time Engine — Global Remote / EU Remote (https://jobs.ashbyhq.com/synthflow/7fd58cad-4ea0-40ad-b56a-d8605aab2f5c)
- Senior Python Software Engineer

Sources:
- https://jobs.ashbyhq.com/synthflow/7fd58cad-4ea0-40ad-b56a-d8605aab2f5c (full JD body, incl. company self-description, investors and founding details)
- Local registry: data/posting-research.jsonl, data/company-comp.jsonl
