# RegScale — research
Provider/key: greenhouse:regscale | company_type: product

What they do: RegScale sells a **continuous controls monitoring (CCM)** platform — software that
helps organizations "automate and scale their security, risk, and compliance programs." In their own
words, "AI is central to where RegScale is going, woven into how compliance programs are automated,
monitored, and delivered at scale." The domain is GRC (governance, risk, compliance), with named
frameworks FedRAMP, NIST and CMMC — i.e. heavily US-federal and defence-adjacent compliance, plus
enterprise SaaS customers. The product surface includes "Compliance as Code."

How they describe themselves: The most revealing self-description is a stated inflection point:
"We are at an inflection point, transitioning from startup execution to a disciplined, enterprise
ready engineering organization, and we are building the team that will take us there." Engineering
values, as expressed in the JD, are unusually mature and infra-flavoured: they want "an engineer who
brings the same rigor to AI systems as to any other production engineering discipline, including
reliability, observability, cost management, and ongoing behavior in the real world," someone who
"builds primitives and frameworks others build on top of," and who will "proactively identify risks
in AI system behavior, data quality, and model performance, bringing proposed mitigations before they
become production incidents." No hustle/rocketship language appears anywhere in the posting.

Size / stage / funding: Private venture-backed startup; the "transitioning from startup execution"
line and the enterprise-readiness framing place it somewhere post-product-market-fit but pre-scale.
**Headcount, funding stage, investors and profitability are unverified** — no first-party page was
fetched (web search budget was exhausted for the session, and the only registry URL is a Greenhouse
board, which is not fetchable). Treat stage as unknown rather than assumed.

Locations / HQ: **Unverified.** Not stated in the JD. The FedRAMP/NIST/CMMC focus and the US-citizen
requirement imply a US-headquartered, federal-market company, but no city is confirmed.

Remote policy: The live Senior AI Engineer role is posted as "Remote" — with a citizenship
restriction attached (below). No further remote-culture, async, or handbook detail is stated.

Remote-Canada eligibility: **No — disqualifying, verified from the JD.** The posting ends with a
one-line statement: **"RegScale is only able to hire US Citizens."** This is unambiguous and is
consistent with a FedRAMP/CMMC compliance vendor selling into US federal channels. Max is a Canadian
citizen without US authorization; the role is closed to him, and this restriction is almost certainly
company-wide rather than role-specific given the market they serve.

Engineering & tech: The Senior AI Engineer sits **inside Platform Engineering**, building primitives
consumed by product teams and integrators — genuinely platform work, not product AI. Scope named in
the JD: production AI systems owned end to end (reliability, performance, cost, observability, model
behaviour); data pipelines that "ingest, clean, transform, and version" AI training/serving data with
traceability from source to model; **retrieval-augmented generation**, vector and graph search, hybrid
retrieval; fine-tuning, evaluation and monitoring; **AI agent systems and orchestration layers** for
multi-step reasoning and tool use across GRC workflows; **MCP servers** exposing platform capabilities
to AI systems "reliably, securely, and observably"; reusable AI primitives and frameworks; AI
integrated into CI/CD with testing and evaluation gates. Partner teams named: Platform Engineering,
Core Engineering, Compliance as Code. Preferred experience mentions **Azure** cloud-native AI
infrastructure, inference cost optimization and caching, model-selection tradeoffs at scale, and data
lakes (Snowflake, Databricks, Synapse Analytics, AWS Redshift). Bar is high: 8+ years of software
engineering with 4+ years operating production AI/ML systems.

Compensation (objective): **No pay data.** The live JD states no salary range (consistent with a
remote-US posting that avoids the transparency jurisdictions), and no first-party pay page was
reachable. The work-list slot ml_eng/senior is flagged needs_comp with no existing band; no citable
source was found and RegScale is not a company with enough public signal to justify a parametric
estimate, so **no band row was written** (deliberate abstention rather than an omission).

Notable / other: The JD is one of the most substantive AI-platform descriptions in this batch — MCP
server development and eval gates in CI/CD are specific, current, and rarely written down this
precisely. That makes the citizenship bar the only thing standing in the way.

Open relevant roles (sample): Senior AI Engineer (Remote, US citizens only, live); Senior Software
Engineer, Integrations (no longer live).

Sources:
- https://job-boards.greenhouse.io/regscale/jobs/5083273007 (JD text, from local registry body — cited, not fetched)
- https://job-boards.greenhouse.io/regscale/jobs/5083257007 (closed JD, registry body)
No first-party RegScale pages were fetched; company size, funding, HQ and pay are therefore recorded
as unverified rather than guessed.
