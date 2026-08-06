# Kombo — research
Provider/key: smartrecruiters:kombo | company_type: unverified (likely product)

**Data-quality warning — read first.** This registry entry appears to be populated with placeholder / demo / test postings rather than genuine openings, and the underlying company entity could not be confirmed from any first-party source. Nothing below should be treated as verified company fact.

What they do: **Unverified.** No posting body in the registry describes a product, a customer, a market, or a mission. Every JD body is generic, boilerplate backend text with no company-specific content whatsoever. The `careers_url` is `https://careers.smartrecruiters.com/kombo`, a client-rendered SmartRecruiters board; no root corporate domain is derivable from it, and I did not guess one. There is a well-known German HR-integrations API company trading under the name "Kombo", but **I could not confirm that this registry entry is that company** — nothing in the scraped text identifies it, and company names collide.

Evidence that the postings are not genuine:
- Titles are malformed or obviously synthetic: "Best Senior Backend Engineera" (typo baked into the title), "Senior Backend Engineer 2", "TM Back End Developer " (trailing space, "TM" prefix).
- Location metadata contradicts the body: the posting located "Long Biên, Hà Nội, Vietnam" has a body opening "We're looking for a Senior Backend Engineer to join our growing engineering team in **Toronto, Canada**."
- The body text is entirely generic ATS-template prose — microservices, Docker/Kubernetes, code reviews, mentoring — with no product, domain, team or company detail of any kind.
- Six titles are listed for the company but only two survive as live-relevant, and the two live ones are the two most obviously synthetic.

Size / stage / funding: Unverified — no source.
Locations / HQ: Unverified. Posting metadata claims both Toronto ON and Hanoi, Vietnam, inconsistently.
Remote policy: The Toronto posting extracts as `remote_policy: remote`, `geo_eligibility: canada`, but this is derived from a posting whose provenance is doubtful.

Remote-Canada eligibility: **Unclear / not trustworthy.** The extracted `geo_eligibility: canada` on "Best Senior Backend Engineera" comes from a posting that has no body (`has_body: false`) and a corrupted title. The one posting that does have a body claims a Toronto team while being filed under a Vietnam location. No conclusion can be drawn.

Engineering & tech: Only generic template requirements: Java/Python/Go/Node.js/C++, SQL plus MongoDB/Redis, microservices and distributed systems, Docker/Kubernetes, AWS/Azure/GCP, REST API design, Git; preferred Kafka/RabbitMQ, observability tooling, IaC, performance profiling. None of this is attributable to a real team.

Notable / other: Recommend treating this key as suspect in the registry — either a test tenant on SmartRecruiters or a scraping artifact. The scanner should probably not be surfacing it.

Open relevant roles (sample): "Best Senior Backend Engineera" (Toronto, ON); "Senior Backend Engineer 2" (Long Biên, Hà Nội, Vietnam).

Sources:
- https://jobs.smartrecruiters.com/kombo/postings/744000116432267 (cited; no body captured)
- https://jobs.smartrecruiters.com/kombo/postings/744000110779859 (body in local registry)
- No first-party company site fetched — none derivable from the registry, and not guessed.
