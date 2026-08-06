# Real — research
Provider/key: ashby:real | company_type: product

Entity confirmation: the registry carries this key under two different names ("Real" and "Real Artists" — see data-quality note below). The JD bodies confirm the actual entity is **Real Brokerage (The Real Brokerage Inc., Nasdaq: REAX)**, the technology-driven residential real-estate brokerage at onereal.com — **not** any company called "Real Artists". The "Real Artists" label in the registry is wrong for this key.

What they do: In their own words: "Real (Nasdaq: REAX) is a publicly traded, fast-growing global real estate brokerage powered by technology and driven by people. Since our founding in 2014, we've been reimagining the residential real estate experience. With operations across the U.S., Canada, India, and the District of Columbia, we're leading the industry with our cutting-edge platform that empowers agents, simplifies the buying and selling journey, and unlocks greater financial opportunities." The business is an agent-facing brokerage; the software is an internal platform serving those agents.

How they describe themselves: Tagline: "At Real, we believe in pairing Tech x Humanity to create something truly different." Their stated core values are listed explicitly in the JD as a must-have — candidates must have the "Ability to truly encompass our Company Core Values":
- "Work Hard. Be Kind"
- "'We' are bigger than 'me'"
- "Tech x Humanity"
They self-describe as "fast-growing" and the ML role calls for effectiveness "in a dynamic environment" and "managing multiple projects simultaneously, with a focus on meeting deadlines."

Size / stage / funding: **Public company** — Nasdaq: REAX. Founded 2014. Described as global and fast-growing. Headcount and financials UNVERIFIED (the company site returned HTTP 403 and could not be read).

Locations / HQ: Operations stated across "the U.S., Canada, India, and the District of Columbia". Engineering appears to be split between a US organisation and an R&D team in India. Posting locations seen: "USA (Remote)", a long list of US metros (Tampa, Boston, Atlanta, New York, Columbus, Chicago, Philadelphia, Raleigh, Charlotte, Minneapolis, Dallas, Washington D.C., Austin, Miami — all suffixed "(Remote)"), and "Remote - India".

Remote policy: Remote-first for engineering, but strictly partitioned by country of employment. Every relevant posting is either US-remote or India-remote. The India role carries a fixed shift: "Work Schedule: 2:30 PM TO 11:30PM IST."

Remote-Canada eligibility: **No, for the roles in scope — verified negative.** Although the company states it has operations in Canada (it is a brokerage licensed there), none of the live engineering postings are open to Canada. The backend roles are scoped "USA (Remote)" plus US metros only, and the Senior Machine Learning Engineer is not merely India-located but explicitly citizenship-restricted: "**Please note that this position is for 'Indian citizens only'**". Its 2:30 PM–11:30 PM IST shift is also an unworkable timezone from Mountain Time. Real's Canadian presence is brokerage operations, not an engineering hiring geography, on the evidence available.

Engineering & tech: Two distinct tracks.
- Backend (US): Java is the stated core — "Senior Backend Engineer - Java" and "Sr. Backend Engineer - Tech Lead (Java)". No body detail beyond title/comp was captured for these.
- ML/AI (India R&D): Python; generative-AI and LLM-driven applications; "agentic pipelines, including orchestration, tool integration, and feedback loops"; orchestration frameworks such as LangChain; "event-driven and asynchronous architectures"; prompt engineering and LLM fine-tuning; Docker and cloud platforms; "scalable, production-grade AI systems". The role is explicitly cross-functional and embedded — "you will work transversely across the company, embedding AI-driven and LLM-powered solutions into various facets of our business, including operations, customer experience, and product development."

Notable / other: The ML role's experience bar is unusually low for a "Senior" title — "Minimum of 2 years of experience working with Python in production environments" and "At least 5 years of experience in AI/ML, with exposure to Generative AI or LLM-based systems preferred". The JD includes a "Physical Requirements: Sit for long periods of time" line. Real is an equal-opportunity employer per standard boilerplate.

Compensation stated on their own JDs (all USD, US roles): Senior Backend Engineer - Java: "$152K – $194K • Offers Equity • Offers Bonus • Offers Life and Health Insurance, 401K, Flexible PTO". Sr. Backend Engineer - Tech Lead (Java): "Estimated Base Salary (DOE) $200K – $220K • Offers Equity • Offers Bonus". The Senior Machine Learning Engineer (India) posts **no** compensation.

Open relevant roles (sample): Sr. Backend Engineer - Tech Lead (Java) (USA Remote + 14 US metros); Senior Backend Engineer - Java (USA Remote); Senior Machine Learning Engineer (Remote - India, Indian citizens only).

Data-quality note: this key appears **twice** in `data/companies-personal.jsonl` with conflicting `name` ("Real" vs "Real Artists") and `relevance_score` (2.52 vs 50). "Real Artists" is incorrect for this entity.

Sources: JD body at https://jobs.ashbyhq.com/real/d36a6c61-ff2d-4530-bcb7-f3cead4b2bac ; posted comp/locations from https://jobs.ashbyhq.com/real/b0480e17-98f6-49e5-9fa2-565d30a11347 and https://jobs.ashbyhq.com/real/f37fa975-7ab7-4e27-a775-7e32f1f28173 . https://www.onereal.com/ was attempted and returned HTTP 403, so no first-party site content could be read.
