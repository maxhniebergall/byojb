# Anlatan — research
Provider/key: lever:Anlatan | company_type: product

What they do: In their own words: "Anlatan is a company working on cutting edge AI and making the best possible AI-fueled products. We pride ourselves on being user-friendly, privacy-safe, and censorship-free. We're a ragtag team of personalities, focused on crafting the best of the best in the AI world." Their named SaaS products are **NovelAI** and **AetherRoom** — consumer subscription AI products (AI-assisted text/story generation and image generation). Business model is direct-to-consumer SaaS with a strong community orientation; payment-provider API experience (Stripe, Paddle) is listed as a bonus skill, consistent with self-serve subscriptions.

How they describe themselves: The stated cultural principles, quoted in full from the JDs — "Beyond all else, our members are encouraged to:"
1. **Explore and Experiment** — "Unless we're completely focused on getting a specific feature done, feel free to try something new out! Every idea brought to the table is appreciated and discussed."
2. **Work Stress-free** — "We're here to push boundaries in the AI consumer world, but that doesn't mean you can't have a little fun along the way. Our entire team emerged from the internet, so we're a long ways from professional."
3. **Ask For Help** — "No one is all-knowing. Sometimes all you need a little poke in the right direction to get something done. Never be afraid to reach out if it means getting your problem solved sooner rather than later."
4. **Interact with the Community** — "Our community is what keeps us going, and we try to recognize that every single day. A primary goal of ours is to stay connected, and we pursue that by keeping in touch with our users through multiple different mediums."
Also: "We're working fast to send ripples through the ever-moving field of AI… we're all pretty fun to work with" and "A culture focused on pushing the envelope and having fun while doing it."

Size / stage / funding: **Unverified.** Self-described as "a ragtag team of personalities" and "our entire team emerged from the internet", which reads as a small, bootstrapped-feeling, community-grown company rather than a conventionally-funded startup. No headcount, funding round or investor is stated anywhere in the available material, and no first-party domain appears in the registry to fetch.

Locations / HQ: Not stated. Both live postings give location as "ONLINE, remote".

Remote policy: Fully remote / remote-first, and apparently location-agnostic. Benefits are explicitly split into a "**For US Citizens**" tier (Health, Vision and Dental Insurance, Life Insurance and Disability, 401k with 3% match at 100% and 2% at 50%) and a "**For non-US Citizens**" tier (Health, Vision and Dental Insurance) — direct evidence that they already employ people outside the US. Other stated perks: "A casual and flexible work environment" and "Incredibly flexible PTO."

Remote-Canada eligibility: **Likely yes, but not explicitly confirmed.** Evidence for: location is "ONLINE, remote" with no country qualifier, and the benefits section provides an explicit non-US-citizen tier. Evidence lacking: no country list, no statement about Canada specifically, no mention of an employer-of-record or contractor arrangement. Note the non-US benefits tier omits 401k/life/disability, so non-US staff may well be engaged as contractors rather than employees — worth asking. This is the only company in this batch with a plausible Canadian path.

Engineering & tech:
- Backend: **Go** with **gRPC** as the primary stack, plus RESTful APIs; **Docker, Kubernetes and the k8s ecosystem including Helm**; SQL database design and optimization; Git. Bonus: NoSQL (Cassandra, ScyllaDB, MongoDB), TypeScript/NodeJS "for maintaining and working with our legacy NovelAI codebase", payment APIs (Stripe, Paddle), CI workflows (GitHub Actions, CircleCI), AWS and Google Cloud. Stated expectations include "designing high performance scalable backend services", "Experience in working with large and ever-changing codebases", "Understanding of good security practices", and production troubleshooting/debugging.
- ML: they run **their own compute cluster** and a distributed training stack. The MLE role is "developing code and model architectures to train cutting edge LLMs and Image models in our compute cluster" — starting and tracking training runs, contributing new models/algorithms/features to the ML codebases, experimenting with architectures and "getting them production ready", plus training/finetuning and iterating on tester feedback. Required: PyTorch, Python, prior NLP or image model training, "Able to read cutting edge ML papers, implement them in pytorch and accurately reproduce." Bonus: **Kubernetes and SLURM, distributed computing, JAX, Triton**.
- The backend role notes close collaboration with a frontend team at the integration boundary, and participation in architecture design for new services.

Notable / other: "Censorship-free" is a stated product positioning — NovelAI is publicly known for permitting adult/unfiltered generated content, which is a material consideration for anyone weighing the domain. No compensation figures are stated on either posting ("a competitive salary package").

Open relevant roles (sample): Backend Engineer (ONLINE, remote); Machine Learning Engineer (ONLINE, remote).

Sources: registry JD bodies at `data/posting-research/https---jobs.lever.co-Anlatan-4622e112-ed53-4c3f-b2da-6c3a3f4304e3.md` and `…-b684a295-1603-4667-a4aa-3a82197c5559.md` (from https://jobs.lever.co/Anlatan). No first-party company domain is present in the registry, so nothing beyond the JD text could be verified.
