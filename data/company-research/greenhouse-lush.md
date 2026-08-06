# Lush Handmade Cosmetics — research
Provider/key: greenhouse:lush | company_type: product

What they do: Cosmetics manufacturer and retailer — "you might know us as the inventors of the bath
bomb". The engineering org, **Lush Digital**, builds the company's global digital estate: consumer
apps (Bath Bot, Lush Lens), the e-commerce Commerce platform, the Lush Pay payment system, and
internal business tooling. "LUSH Digital offers a range of exciting online and in store experiences
for our customers. Developers of many disciplines are responsible for creating and developing new
innovations in technology, as well as providing and maintaining a global digital estate across
multiple platforms and devices."

How they describe themselves: Values-forward and unusually specific, in their own words —
"there's more to this great-smelling, partly employee-owned, family-run company than pioneering
cosmetics. We believe our business should put more back into the world than it takes and demonstrate
that **capitalism can be a force for good**. We put our people first and fight cruel practices like
animal testing, promote regeneration, and show that it is what's inside that counts - whether that's
an ingredient in a product, or the minerals in a smartphone." On the digital side: "technology should
give more than it takes from society and the environment." Employee ownership is stated concretely:
"We're 10% Employee Owned - all colleagues play a role in protecting our ethics and our
independence, contributing ideas for the future and sharing in the rewards of success when the
company is doing well." They also publish land acknowledgements and a reconciliation/decolonization
commitment referencing the TRC Calls to Action #92.

Size / stage / funding: Private, family-run, 10% employee-owned. Long-established global retailer
(hundreds of physical stores). Headcount and financials are not stated on the pages fetched. Not
venture-backed, so no runway risk — but retail-cyclical.

Locations / HQ: Lush is UK-headquartered (Poole); Lush Cosmetics North America is headquartered in
Canada, and their own words note "our largest facilities are located on the unceded territories of
the Musqueam, Squamish and Tsleil-Waututh" (i.e. Vancouver) "as well as here on the lands of the
Mississaugas of the Credit…" (Toronto). The digital team is "based across the globe." The relevant
engineering postings are Toronto: office at **35 Jutland Road, Etobicoke, Ontario**. US operations
exist in AL, GA, NC, SC, FL, AZ, UT and TN (E-Verify states).

Remote policy: **Hybrid, and explicitly so.** Stated on the JD: "Work Type: Hybrid role, must have
flexibility to go on-site 1-2 days/week" and "Job Location: The successful candidate must be located
in or around Toronto, ON." The posting is even tagged `#LI-Hybrid`.

Remote-Canada eligibility: **No.** It is a Canadian employer, but the roles require Toronto
residency and 1-2 office days per week in Etobicoke. Unambiguously disqualifying from Kimberley BC.

Engineering & tech: Genuinely appealing on the technical merits and strongly open-source-oriented —
"We love open source! The Cloud Native Computing Foundation is always our first port of call when a
requirement for a new tool comes up. Whenever we can, the code we produce is made public for all to
use." A stated strategic priority is de-big-teching: "our transition away from big-tech reliance;
you will play a pivotal role in this journey by researching, scoping, and implementing open-source
solutions that enhance our independence and development velocity." Stack: **Go** (primary, with
Python/TypeScript a plus), Terraform, Kubernetes + Helm, Docker/Podman, GitLab CI/CD and ArgoCD plus
custom in-house tooling, observability on Loki/Prometheus/Grafana, Cloudflare (proxying, geo-aware
load balancing, workers), MySQL and Postgres, on Google Cloud — chosen "for 100% renewable energy
use". Architecture is a headless, API-driven microservices platform; payments via Adyen. On-call is
explicit: "Provide on-call support for global production environments during emergency scenarios"
and "Ability to support a global, 24/7 production environment."

Compensation: Posted directly under Ontario pay transparency. Senior DevOps Engineer:
**CAD 91,000–99,000** base. Intermediate Backend Engineer: **CAD 80,000–89,000** base. Their caveat:
"This salary range is based on an assessment of the local market and may vary depending on the
successful candidate's location… based on base salary and does not include additional bonus program
and total rewards eligibility."

Notable / other:
- Recruitment process is diagrammed in the JD (images only).
- Social programmes: a £213k Digital Fund supporting digital-freedom activists, a £170k Wholeness
  Fund for mental health, and Digital Detox Day campaigns.
- **Registry data-quality issue**: this company appears twice. `greenhouse:lush` and
  `greenhouse:internaljobsatlush` are the same employer with duplicate comp rows for the same
  Senior DevOps Engineer posting (CAD 91,000–99,000) under two different keys.

Open relevant roles (sample): Senior DevOps Engineer (Toronto, hybrid); Intermediate Backend
Engineer (Toronto) — two separate reqs.

Sources:
- https://weare.lush.com/lush-life/our-company/we-are-digital/
- https://job-boards.greenhouse.io/lush/jobs/8056348 (Senior DevOps Engineer, full body local)
- https://job-boards.greenhouse.io/lush/jobs/8055568 and /7986212 (Intermediate Backend Engineer)
