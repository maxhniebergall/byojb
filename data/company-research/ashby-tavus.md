# Tavus — research
Provider/key: ashby:tavus | company_type: product

What they do: Tavus builds "AI Humans" — real-time conversational video avatars. Their models cover
human perception/understanding (multi-modal), avatar rendering, and real-time conversational video.
The flagship product is CVI (Conversational Video Interface), which runs live face-to-face
conversations between a person and a "PAL". Named target industries: healthcare, recruiting, sales,
education. Customers are individuals, enterprises, and developers building on the platform.

How they describe themselves: Two live JDs give two framings, and they differ — worth noting.
- Data/MLOps JD: "At Tavus, we're building the human layer of AI. Our mission is to make human-AI
  interaction as natural as face-to-face interaction, enabling the human touch where it has been
  previously unscalable... pioneering research in multi-modal AI models." Culture line: "We are not
  looking for cultural fits — we are looking for culture creators. Diversity is at the core of how we
  hire, communicate, and work."
- Infrastructure JD: "Tavus is a research lab pioneering human computing... AI Humans combine the
  emotional intelligence of humans with the reach and reliability of machines... capable, trusted
  agents available 24/7, in every language."
Stated behavioural expectations (infra JD, verbatim): "You own outcomes. You don't stop where
'infrastructure' ends"; "You're energized by unfamiliar problems"; "You adapt as priorities evolve. In
a space moving this fast, the most important thing to build can change as we learn"; "Fix what you
find" with "the trust and the mandate to fix it or flag it". Data JD asks for "Extreme ownership of
data strategy" and to "Balance speed with precision".

Size / stage / funding: The two live JDs disagree on stage — the older Data/MLOps post (2026-03-30)
says "We're a Series A company backed by top investors, including Sequoia, Y Combinator, and Scale
VC"; the Infrastructure post says "We're a Series B company backed by world-class investors including
Sequoia Capital, Y Combinator, and Scale Venture Partners." Best read: they raised a Series B between
the two postings and the older post is stale. Headcount not stated. Venture-funded, pre-profitability
by every indication.

Locations / HQ: Not stated outright. The Infrastructure role is listed "Remote, San Francisco", which
implies a San Francisco base. The Data/ML Ops role is listed "Remote" with no qualifier.

Remote policy: Remote is offered on both roles ("Remote" / "Remote, San Francisco"). Benefits listed
as "Flexible work schedule, unlimited PTO, competitive healthcare and gear stipends". No async or
handbook culture signals; no stated remote-work policy document.

Remote-Canada eligibility: UNVERIFIED. Neither JD states a country restriction, and neither states
Canada eligibility. No first-party careers/policy page was reachable this session. Given a
SF-headquartered US venture-backed company with no stated international hiring, assume US-only until
they confirm otherwise. Also note the infra role is real-time GPU/on-call-adjacent work, so Pacific/SF
hours are likely — Mountain Time overlap would be fine, but that is inference, not a stated policy.

Engineering & tech: The Infrastructure role is substantive, deep infra work — not a wrapper role:
- Owns CVI's GPU inference deployments across multiple providers and regions; tuning newest GPU
  generations, cutting cold-start and model-load times.
- Expanding the GPU footprint: new providers and regions, EKS clusters, routing/scheduling/throughput
  for fast weight loading.
- Uptime ownership plus security and SOC2 work.
- Deploy-pipeline rework ("shipping is fast and boring").
Shipped work they cite: multi-provider multi-region inference routing; CUDA optimisations for
"Phoenix", their video rendering model, doubling frame rate; several parallel live conversations
sharing a single GPU. Requirements: hands-on GPU inference, Kubernetes/EKS depth including routing and
scheduling, deep AWS. Nice-to-have: GCP, video streaming infra, training infra / LLM serving, SOC2.
The Data/MLOps role is a data-strategy ownership role: sourcing and curating multimodal data (text,
video, images) for model training, labeling/automation workflows, "Strong Python, SQL, and large-scale
data processing", LLM and multimodal dataset experience.

Notable / other: The Data/MLOps posting is titled "Data Engineer /ML Ops" but the body says "We're
looking for a Senior Data Engineer" — title and body disagree on level. Neither live posting states
any compensation.

Open relevant roles (sample):
- Software Engineer, Infrastructure — Remote, San Francisco
- Data Engineer / ML Ops — Remote

Sources:
- https://jobs.ashbyhq.com/tavus/2cdc9932-1140-42d6-9fce-ee7e26192b15 (Infrastructure JD text, from the local registry — ATS boards are not fetchable)
- https://jobs.ashbyhq.com/tavus/a29d6e98-3a83-461c-b651-fc0dc387c4c7 (Data Engineer / ML Ops JD text, same)
- No first-party company website was fetched this session (web search budget exhausted; the registry holds only the Ashby slug, so no company domain was derivable). All statements above are from Tavus's own JD copy.
