# Rally UXR — research
Provider/key: ashby:rallyuxr | company_type: product

What they do: In their own words, "Rally is the User Research CRM that helps product, design, and
research teams talk to their users quickly, safely, and at scale. Our platform automates the
unglamorous parts of research—participant recruitment, outreach, screening, scheduling, consent, and
incentives—so teams can spend more time learning from customers and less time wrestling with manual
workflows." They are "now building Rally's next chapter: an AI-native platform that handles the full
research recruiting lifecycle, end to end." Customers include research and design teams at Google,
Adobe, Figma, GitLab and Webflow.

How they describe themselves: The framing is a market-shift thesis — "a massive shift in how
companies run user research: from ad-hoc, one-off projects to continuous learning that informs every
product decision." Engineering is "a highly collaborative, user-obsessed group focused on making
research smoother for both our customers and their participants." They dogfood: "We use Rally to
build Rally — talking to our own users frequently, running studies on our platform, and feeding
insights straight into the roadmap." They "favor small, empowered teams, high ownership, and a tight
feedback loop between customers, product, and engineering." On working style, verbatim: "Rally is a
remote-first company with teammates across the US and Canada. We default to async communication, use
clear written documentation to keep everyone in the loop, and reserve meetings for collaboration,
decision-making, and relationship building." On pay: "Rally strives to recruit and retain exceptional
talent from diverse backgrounds while ensuring pay equity across our team. Our salary ranges are based
on competitive market data for our size, stage, and industry, and may adjust over time as the market
evolves."

Size / stage / funding: Early-stage startup. Backed by **Y Combinator, Stage 2 Capital and Canapi
Ventures**. They claim "strong product-market fit, a fast-growing customer base." Small enough that
they are only now "hiring our first dedicated infrastructure engineer" and that a new hire reports
directly to a founding engineer — likely well under 100 people, with an engineering team of perhaps
10–25.

Locations / HQ: Distributed; "teammates across the US and Canada." Optional in-person team onsites.
No office requirement stated.

Remote policy: **Remote-first and async-by-default**, with written documentation as the primary
coordination mechanism and meetings deliberately reserved for collaboration and decision-making.
Optional in-person onsites. Postings state "Remote" and "Remote-first and able to work within the US
timezones."

Remote-Canada eligibility: **YES — verified, first-party.** "Rally is a remote-first company with
teammates across the US and Canada." The only constraint is timezone: "able to work within the US
timezones," which Mountain Time satisfies directly. Caveat: the posted salary ranges are labelled
"Base salary range (US)", so a Canadian offer may be set on a different basis; that is not spelled out.

Engineering & tech: This is a real, deep platform-engineering charter. The Senior Infrastructure
Engineer is "Rally's founding Platform / Infrastructure Engineer" owning cloud infrastructure, the
CI/CD platform and developer experience. Concretely: evaluate/select/own the CI/CD platform and define
and track **DORA metrics**; build **on-demand ephemeral preview environments** for a large service
footprint that can't run locally; improve inner-loop developer workflows (build times, local tooling,
service scaffolding); own the full **AWS** stack (**ECS/Fargate, Aurora PostgreSQL, MSK, DynamoDB**);
mature **Terraform** IaC with modularization, drift detection and CI for infra changes; own cost
optimization and per-team cost visibility (FinOps); maintain and evolve the **Datadog** observability
stack, build automation and runbooks to reduce operational toil, and drive post-incident reviews; and
handle security/compliance — container scanning, secrets management, IAM least-privilege, and **SOC 2**
audit support. Also named: "agentic platform foundations" for the AI-native product direction.
Nice-to-haves reveal the rest of the stack: Node.js/TypeScript, Prisma, GraphQL, Kafka/event
streaming, **Temporal** or similar workflow orchestration, CloudFront/Cloudflare Workers/Vercel edge.
Architecture is described as a "complex distributed monolith."

Notable / other: The role reports directly to a founding engineer (Melvin) and works closely with
leadership — very short path to decision-makers, and correspondingly little organisational buffer.
A second role, Senior Platform Engineer, sits alongside it.

Open relevant roles (sample): Senior Infrastructure Engineer (Remote); Senior Platform Engineer
(Remote).

Posted pay (their own JDs, USD base, labelled US): Senior Infrastructure Engineer $190,000–$225,000;
Senior Platform Engineer $185,000–$210,000. A band of USD ~$186K–$221K is already on record for this
company's senior platform_infra slot, derived from exactly these two postings.

Sources: JD bodies at https://jobs.ashbyhq.com/rallyuxr/61e81d0e-aa04-407e-ab93-2a8115f5d350 and
https://jobs.ashbyhq.com/rallyuxr/844a571d-3238-4922-b4a2-14da5a6d4620
