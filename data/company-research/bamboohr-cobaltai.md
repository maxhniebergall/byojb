# Cobalt AI — research
Provider/key: bamboohr:cobaltai | company_type: product

What they do: In their own words, from the live JD: *"Cobalt AI uses automation to elevate physical safety and security in the workplace. Our platform, Cobalt Monitoring Intelligence, is a hybrid AI system, cloud-hosted with edge-deployed hardware, that provides human-verified, real-time monitoring of surveillance cameras, alarms, and robots across enterprise locations."* So: an enterprise physical-security monitoring product combining computer vision / automation with a human-in-the-loop verification layer, sold to large multi-site enterprises. Customers run access-control systems (ACS), video management systems (VMS), alarm panels and ticketing tools that Cobalt integrates with.

Entity confirmation: the JD text names "Cobalt AI" and describes camera/alarm/robot monitoring, which matches the `bamboohr:cobaltai` registry slug. Note there are several unrelated companies called "Cobalt" (notably Cobalt.io, a pentest-as-a-service vendor) — this is **not** that company. Beyond the JD, no first-party page was reachable this session, so anything not quoted below is unverified.

How they describe themselves: only the JD's "Why Work for Us?" section is available: *"Competitive salary, equity, and full benefits (medical, vision, dental). Flexible work arrangements. A proven platform, an expanding customer base, and the opportunity to shape the engineering…"* The framing is stability-flavoured ("a proven platform, an expanding customer base") rather than rocketship hype. No published values list, mission statement or handbook was reachable — **unverified**.

Size / stage / funding: Not verified. The registry shows only 1 relevant open posting. The JD's language — "foundational ownership role", one engineer owning the entire integration service lifecycle, "clear potential to shape the future of our integration strategy" — is characteristic of a small-to-mid engineering org (roughly startup scale) where a single person owns a whole service. Equity is offered, which is consistent with a private venture-backed company. Funding stage **unverified**.

Locations / HQ: The posting states **no location**, and no location data reached the scanner. Compensation is quoted in **USD** ($160,000–$200,000/yr) and the benefits list is US-style (medical/vision/dental, no mention of a Canadian entity), which points to a US-based employer. HQ city **unverified**.

Remote policy: The JD offers only "Flexible work arrangements" with no further specifics — not stated as remote-first, not stated as onsite. **Unclear.**

Remote-Canada eligibility: **Unverified, leaning no.** There is no positive evidence either way: the posting carries no location field at all. The USD salary and US-style benefits package are weak indicators of a US-only hiring entity, but nothing in the JD explicitly excludes Canada, and no work-authorisation or E-Verify language appears. This would have to be asked directly.

Engineering & tech: Python is the primary language, specifically **async Python** (asyncio/aiohttp). The integration service connects to customer systems over **REST, MQTT and SignalR**, with webhook handlers for large-scale enterprise event ingestion and outbound orchestration layers that trigger automated responses such as lockdowns and security escalations. Reliability engineering is explicitly part of the role: alerting, retry logic, backoff strategies, health monitoring, and graceful degradation of dependencies; plus test harnesses and mock environments for debugging third-party APIs and legacy on-premise hardware. Observability is Datadog "or equivalent" (metrics and tracing). Deployment is Docker containers on **ECS**, with a stated strategic migration to **Kubernetes/EKS** that this role would lead. Nice-to-haves: Django, GraphQL for internal APIs, streaming/eventing (SignalR, MQTT, WebSocket), Rust interest, and domain familiarity with physical-security platforms (LenelS2, Genetec, Brivo, C•CURE, Netbox, Acre). They mention enterprise multi-tenant SaaS and **SOC 2 / GDPR-aware development**.

Notable / other: The role explicitly includes collaborating with **Sales Engineering** to scope requirements and driving new integrations, and acting as the **primary technical responder for integration-specific incidents** with deep-dive debugging across vendor platforms. Compensation is posted transparently on the JD itself. The work has an unusual amount of legacy-hardware and inconsistent-vendor-documentation surface area, which the JD is refreshingly honest about.

Open relevant roles (sample):
- Senior Software Engineer: Integrations Lead — location unstated — $160,000–$200,000 USD (live)

Sources:
- Local JD body: `data/posting-research/https---cobaltai.bamboohr.com-careers-92.md`
- Posting record in `data/posting-research.jsonl`
- Careers board (cited, not fetched): https://cobaltai.bamboohr.com/careers — BambooHR returned **HTTP 403** to a fetch attempt this session, so no board or company page could be read.
- **Not fetched:** the company's own website. Web-search budget for this session was exhausted and the mode forbids guessing URLs, so unverified items above are marked as such rather than asserted.
