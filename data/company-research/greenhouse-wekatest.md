# WEKA (registry key `greenhouse:wekatest`) — research
Provider/key: greenhouse:wekatest | company_type: product

**Entity confirmation / registry note:** the key is `wekatest`, which looks like a *test* Greenhouse board slug, but the entity is unambiguously WEKA (WekaIO). The live posting's URL is `https://weka.io/company/careers?gh_jid=5085240007` and the JD body contains WEKA's own values section ("The WEKA Way"). Flagging the slug as a possible data-quality artifact — a test board may carry stale or non-production listings.

What they do: WEKA builds high-performance data infrastructure for AI. Their homepage describes **NeuralMesh**, a platform that "combines storage and memory on one platform" to raise GPU efficiency and lower cost per token for AI inference and training. Hardware appliance line: WEKApod (WEKApod 3 is current); NeuralMesh 6 is the current software generation. Positioning is explicitly economic — making AI inference cheaper and faster at scale.

How they describe themselves — "The WEKA Way", quoted in full from their JD:
- **We are Accountable**: "We take full ownership, always–even when things don't go as planned. We lead with integrity, show up with responsibility & ownership, and hold ourselves and each other to the highest standards."
- **We are Brave**: "We question the status quo, push boundaries, and take smart risks when needed. We welcome challenges and embrace debates as opportunities for growth, turning courage into fuel for innovation."
- **We are Collaborative**: "True collaboration isn't only about working together. It's about lifting one another up to succeed collectively. We are team-oriented and communicate with empathy and respect. We challenge each other and conduct positive conflict resolution. We are being transparent about our goals and results."
- **We are Customer Centric**: "Our customers are at the heart of everything we do. We actively listen and prioritize the success of our customers, and every decision we make is driven by how we can better serve, support, and empower them to succeed."
They also state a "High Bar for Quality: a strong sense of engineering craftsmanship, with a track record of building reliable, high-throughput systems", and include an explicit encouragement for underrepresented candidates who don't meet every qualification to apply anyway.

Size / stage / funding: Late-stage private, venture-backed, well capitalized — but exact headcount, latest round and valuation were **not verified this session** (the about-us page 404'd and no other first-party page carried the numbers). Customer roster on their homepage includes Hugging Face, Stability AI, ElevenLabs and Novartis, described as "trusted by 30+ organizations", which places them firmly in the production AI-infrastructure tier rather than early stage.

Locations / HQ: Not verified from a first-party page this session (about-us 404). The live role is posted as "U.S. Remote".

Remote policy: No company-wide policy statement verified. The relevant posting is "U.S. Remote", so remote work is clearly supported for at least some roles.

Remote-Canada eligibility: NO for this role — the posting is "U.S. Remote" and the compensation paragraph is prefixed "**USA Residents Only**". Company-wide Canada hiring is unverified, but the live opening is US-scoped.

Engineering & tech: The AI Inference team ("AMG") owns an unusually deep systems stack: NVMe Token Warehouse and GPUDirect Storage (GDS) data paths, the vLLM/LMCache serving stack, disaggregated prefill/decode, persistent off-HBM KV caching, RDMA-based transport, multi-tier GPU memory hierarchies (HBM → NVMe), continuous batching. Languages and tools: Python, C++, CUDA, Rust (a plus), NIXL/NVIDIA Dynamo, Kubernetes, bare-metal GPU clusters (H100/A100), high-throughput distributed storage. They benchmark the ecosystem continuously (SGLang, TRT-LLM, NVIDIA Dynamo) and decide "when to adopt, build, or pivot." Other open roles show a kernel/filesystem/control-plane engineering org — this is genuine low-level systems work.

Notable / other: The live relevant opening is a **Tech Lead** seat, not a pure IC one: "lead and grow a squad of 3 developers, balancing hands-on technical contribution with strong people leadership", including 1:1s, career coaching and sprint reviews. Benefits mentioned: Medical, Dental, Vision, Life, 401(K), Flexible Time Off (FTO), sick time, FMLA leave — all US-form benefits. Compensation range is referenced ("Total Compensation hiring wage range… for the specified geographic areas") but the actual numbers were not present in the captured JD body.

Open relevant roles (sample): Senior Team Lead - AI Inference (captured as "Tech Lead - AI Inference"); Senior Software Engineer, Kernel; Senior Software Engineer, Filesystem; Senior Software Engineer, Control; Senior Software Engineer, Platform; Senior Software Engineer - Verification and Reliability; Senior Engineer, Lab.

Sources: https://www.weka.io/ (fetched; the about-us and /company/ paths both returned 404). JD body in local registry — https://weka.io/company/careers?gh_jid=5085240007 (cited, not fetched).
