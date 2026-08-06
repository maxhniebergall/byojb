# Bree — research
Provider/key: ashby:bree | company_type: product

What they do: Bree (Bree Technologies Ltd.) is a Canadian consumer fintech offering interest-free instant cash advances of up to CA$750 to Canadians, with no mandatory fees and no credit check. Users link a bank account or upload PDF statements to qualify; repayment comes out of the next paycheque. Standard funding takes one to three business days and is free; instant delivery and optional "tips" are the revenue model. It also ships budgeting tools and a financial newsletter. The stated ambition is broader than lending: to build "a challenger bank for the 11 million Canadians living paycheck to paycheck, starting with interest-free cash advances." The company reports serving more than 800,000 Canadians.

How they describe themselves: "Our mission at Bree is to help Canadians like you move towards financial wellness." The public positioning stresses a community-supported lending model — users choose optional tips rather than mandatory fees — explicit contrast with expensive payday lenders, and "pay it forward" mutual aid. No formal values/principles list is published. Internal tone from their own JDs is high-ownership and fast-moving: "own the entire platform layer," "high ownership, high impact," "move faster."

Size / stage / funding: Private, early-stage. Founded 2021; a Y Combinator company. Small (startup-stage engineering org). No disclosed funding total found on first-party pages.

Locations / HQ: Toronto, Ontario, Canada — 2 Bloor St W.

Remote policy: Mixed and office-leaning. Job locations across the four live engineering roles are "Toronto" (Senior Software Engineer, Infrastructure; Software Engineer, Backend), "Canada" (Machine Learning Engineer) and "Remote" (Machine Learning Engineer, Underwriting). Benefits on the infrastructure JD include "in office amenities" and "commuter benefits," which indicates a real Toronto office expectation for at least the Toronto-tagged roles. The extracted remote policy on that JD is "unclear"; timezone is America/Toronto. No remote-first statement exists anywhere on their site.

Remote-Canada eligibility: Yes for Canada as a country — this is a Canadian employer hiring Canadians, and geo eligibility on all four live roles extracts as "canada." But **remote-from-anywhere-in-Canada is only clearly true for one role** (Machine Learning Engineer, Underwriting, tagged "Remote"); two roles are Toronto-tagged with commuter and in-office benefits, and the timezone expectation is Eastern. Mountain Time is not addressed anywhere.

Engineering & tech: Small platform-heavy stack, well specified in the infrastructure JD. Languages: TypeScript and Python. Infrastructure: AWS, AWS Lambda / serverless, Netlify, PostgreSQL. IaC: Pulumi, Terraform or CloudFormation, with CI/CD pipelines built from scratch. Security is a first-class requirement — "IAM least-privilege, secrets management, encryption, audit logging, PII handling" — and observability via Grafana and Datadog with tracing. Nice-to-haves are fintech-specific: SOC 2, banking rails, payment processors, financial-data integrations. The role is scoped as owning the entire platform layer, i.e. a single engineer owning infra end-to-end. Autonomy extracts as high.

Compensation: Bree posts pay on every engineering role via Ashby, which is unusual and useful. Machine Learning Engineer and ML Engineer (Underwriting): CA$180K – CA$250K, offers bonus. Senior Software Engineer, Infrastructure: CA$180K – CA$250K, offers equity and bonus. Software Engineer, Backend: CA$120K – CA$200K base, offers bonus. These are strong Canadian numbers for a company of this size.

Notable / other: Benefits per the infrastructure JD: health, dental and vision; CA$1,500 annual learning & home-office stipend; CA$1,000 annual wellness stipend; monthly lunch stipend; commuter benefits; paid parental leave; 20 annual PTO days plus unlimited sick days; quarterly team gatherings. The domain is regulated consumer lending, which brings SOC 2 and PII obligations. Note the ethical texture of the business — an alternative to payday lending, but still short-term consumer credit monetised through tips and expedited-funding fees.

Open relevant roles (sample): Senior Software Engineer, Infrastructure (Toronto); Machine Learning Engineer (Canada); Machine Learning Engineer, Underwriting (Remote); Software Engineer, Backend (Toronto).

Sources:
- https://www.trybree.com/ (fetched)
- https://jobs.ashbyhq.com/bree/6c927dd4-df04-4030-b6a4-2860212b2de7 (Senior Software Engineer, Infrastructure — JD body in local registry)
- https://ycombinator.com/companies/bree
- Local registry: data/posting-research.jsonl (Ashby-posted comp and extracted facets for all four roles)
