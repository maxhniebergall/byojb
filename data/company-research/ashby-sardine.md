# Sardine — research
Provider/key: ashby:sardine | company_type: product

Entity check: the registry's `ashby:sardine` resolves to **sardine.ai**, the fraud/AML risk platform (confirmed by the applicant-privacy-notice link `https://www.sardine.ai/applicant-and-worker-privacy-notice` embedded in its own JDs). No name collision found.

What they do: In their own words, "Sardine is the leading agentic risk platform for fighting financial crime. Our integrated solution unifies data across risk teams to help organizations stop fraud in real time, prevent AI-driven attacks, and automate fraud and AML operations. Sardine's platform is strengthened by one of the fastest-growing fraud consortiums in the market, spanning more than 6 billion profiled devices, 800 million consumers, and 3 million businesses worldwide." Product surface covers device intelligence and behavioural biometrics, real-time fraud scoring, KYC onboarding, sanctions screening, transaction monitoring, case management, and regulatory reporting (SAR filing, GoAML). Named customers: FIS, GoDaddy, Intuit, Edward Jones, ZoomInfo, Checkout.com.

How they describe themselves: The culture block is repeated verbatim on every requisition and is the clearest statement of values available —
- "We have hubs in the Bay Area, NYC, Austin, Toronto, and São Paulo. However, we maintain a remote-first work culture. #WorkFromAnywhere"
- "We hire talented, self-motivated individuals with extreme ownership and high growth orientation."
- "We value performance and not hours worked. We believe you shouldn't have to miss your family dinner, your kid's school play, friends get-together, or doctor's appointments for the sake of adhering to an arbitrary work schedule."
Location blurbs add "From Home / Beach / Mountain / Cafe / Anywhere! We are a remote-first company with a globally distributed team. You can find your productive zone and work from there." Closing line on every JD: "Join a fast-growing company with world-class professionals from around the world."

Size / stage / funding: Private, Series C. Raised $70M in February 2025 led by Activant Capital, with Andreessen Horowitz, Nyca Partners, Google Ventures, Geodesic Capital, Cross Creek Capital, Moody's Analytics, Experian Ventures and NAventures participating; $145M raised in total. Reported 130% YoY ARR growth in 2024 with a near-doubling of the customer base, and more than 2.2 billion devices profiled at the time of the raise (now stated as 6 billion in current JDs). Growth-stage and venture-funded — not profitable/established in the way a public company is.

Locations / HQ: Bay Area (San Francisco / Berkeley) as the leadership base, with hubs in NYC, Austin, Toronto and São Paulo. Globally distributed team.

Remote policy: Remote-first with hubs, stated on every requisition. Notable caveat on the two staff-level roles: "Given the strategic nature of this role, candidates should be comfortable traveling to San Francisco/Berkeley for in-person meetings with our leadership team approximately twice per quarter" (Staff Software Engineer — Compliance Platform), and "we expect a degree of flexibility for somewhat regular in-person meetings with our leadership team in San Francisco, Berkeley" (Staff Engineer — Fraud Prevention).

Remote-Canada eligibility: **Verified yes for most roles, but with a province/time-zone trap on one.** Machine Learning Engineer, Staff Engineer — Fraud Prevention and Staff Software Engineer — Compliance Platform are all "Remote — United States or Canada" with no province restriction. However, **Senior Software Engineer — AI Experiences is Ontario-only and Eastern Time**: "Location: Remote — Canada (Eastern Time). To be considered for this position, you must reside in one of the following locations and be legally authorized to work in Canada: Ontario." Canadian benefits are real (RRSP with 4% match, health/dental/vision "US and Canada specific"), so Canadian employment is direct rather than contractor-based.

Engineering & tech: Go is the dominant backend language across roles ("Proficiency in Golang is a significant advantage"), with Python for ML and React/TypeScript on the frontend track. Substantive systems work:
- *Staff Engineer — Fraud Prevention*: technical steward/platform architect across Consumer and Business Fraud teams; ultra-low-latency backend services and a high-throughput rules engine; data access patterns, partitioning strategies and caching layers across a multi-cloud database ecosystem; pipelines for massive parallel execution of real-time feature computations and aggregations. Requires stream processing in production (Kafka, Flink, SQS, PubSub), polyglot persistence across document/wide-column/relational stores, and "a strong platform engineering mindset focused on reliability, observability, and developer velocity."
- *Staff Software Engineer — Compliance Platform*: backend services for KYC workflows, sanctions screening engines and alert management; case management and alert creation pipelines; integrations with regulatory reporting systems including SAR filing and GoAML; high-throughput data processing and real-time screening; technical documentation for auditability and regulatory examinations. 7+ years required.
- *Machine Learning Engineer*: "design the systems that make fraud detection possible" — data pipelines and Go backend services processing device and behavioural data in real time, deploying fraud models reliably at scale, feature engineering, observability and testing practice. 5+ years software engineering with strong backend (Go or Python) plus applied ML on large datasets (PyTorch, scikit-learn).
- *Senior Software Engineer — AI Experiences*: frontend-first (React/TypeScript) with secondary Go backend work; explicitly expects fluent use of "AI and agentic development tools (such as Claude) to ship far faster than a traditional team would."

Notable / other: Benefits are consistent across JDs: generous cash and equity, early exercise for all options including pre-vested, flexible PTO plus a year-end break, health/dental/vision, 4% 401k/RRSP match, MacBook Pro, home-office setup stipend, and monthly meal, social meet-up, annual wellness and annual learning stipends.

Pay data note: Sardine posts ranges on its Ashby JDs but in mixed currencies. Observed live: Staff Engineer — Fraud Prevention $190K–$275K (USD, "Multiple Ranges"); Staff Software Engineer — Compliance Platform $210K–$265K USD; Senior Software Engineer — AI Experiences CAD $185K–$210K; and a Brazil-based Senior Software Engineer posting at **R$285K–R$400K BRL** (Brazilian reais — not a North American figure).

Open relevant roles (sample): Staff Engineer — Fraud Prevention (US/Canada remote); Staff Software Engineer — Compliance Platform (US/Canada remote); Machine Learning Engineer (US/Canada remote); Senior Software Engineer — AI Experiences (Ontario only, Eastern Time); Senior Software Engineer (Brazil).

Sources:
- https://jobs.ashbyhq.com/sardine/63f9b76c-0df0-49c1-b6a6-7147a52ccfc4 (Staff Engineer — Fraud Prevention, body from local registry)
- https://jobs.ashbyhq.com/sardine/ec2e86cc-2497-4c23-8e77-ddf962a7fc4c (Staff Software Engineer — Compliance Platform)
- https://jobs.ashbyhq.com/sardine/2c8f0342-b8af-4cc2-85cd-67bc48275568 (Machine Learning Engineer)
- https://jobs.ashbyhq.com/sardine/0602a07b-6f97-44c8-84e0-b2b1483852e9 (Senior Software Engineer — AI Experiences, Ontario/Eastern)
- https://www.sardine.ai/blog/series-c-announcement
- https://www.businesswire.com/news/home/20250211169372/en/Sardine-AI-Raises-$70M-to-Make-Fraud-and-Compliance-Teams-More-Productive
