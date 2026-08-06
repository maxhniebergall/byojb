# Intrahealth — research
Provider/key: breezy:intrahealth | company_type: product

What they do: Intrahealth builds an enterprise Electronic Medical Records (EMR) platform called **Profile**, which in their own words handles "charting, scheduling, medications, billing, reporting, and more in one system." Alongside Profile they offer **Aero Cloud** (hosted delivery) and add-on modules for patient engagement, provider portals and secure data management. Their stated market segments are primary care, government/public health, community and allied health, corrections health, and specialist clinics — they reference deployments in defence health, corrections and public health systems.

How they describe themselves: The site's own claims are scale-and-longevity oriented rather than mission-slogan oriented: "over 22,000 providers," "20+ million patient records," "25+ years" in operation. A published values list, handbook or engineering blog was not found on the pages reachable in this pass — the stated values set is therefore **unverified**.

Size / stage / funding: Not stated on their site and **unverified**. The 25+ year operating history and government/public-sector customer base indicate an established, mature vendor rather than a venture-runway startup. Headcount, ownership and profitability are unknown. Note that a company serving 22,000 providers with a 25-year history is very likely a modest-sized private company rather than a large one — but that inference is not sourced.

Locations / HQ: **Not stated on the pages fetched.** The one live engineering posting is listed simply as "Canada Remote," which confirms a Canadian operating footprint but not a head-office city.

Remote policy: Remote, at least for this role. The posting title itself is "Senior DevOps Engineer (**Remote in Canada**)" and the location field reads "Canada Remote." The extracted facets record `remote_policy: remote`, `geo_eligibility: canada`. This is the only company in this batch whose posting is explicitly country-wide remote.

Remote-Canada eligibility: **Yes — verified, and stated in the job title itself.** "Remote in Canada" is unambiguous and was confirmed directly on Intrahealth's own Breezy posting page. Timezone is not specified, so Mountain-Time workability is unconfirmed, but a pan-Canada remote posting from a company with western-Canada and government health customers is unlikely to be Eastern-Time-mandatory.

Engineering & tech: Not documented. The Senior DevOps Engineer posting body was never captured (`has_body: false`) and the posting has since closed, so the stack is unknown. Inferable from the product only: EMR hosting ("Aero Cloud"), which implies healthcare-grade infrastructure work — availability, backup/DR, PHI security and privacy compliance (PIPEDA/provincial health-information acts), and audit requirements.

Notable / other: **The one live relevant posting is no longer open.** Fetching the posting URL on 2026-07-31 returned "This position is no longer accepting candidates," while the registry still marks it live with `last_seen` in the current scan window. That is a registry freshness problem worth noting.

Compensation: No figure is published by the company. `data/company-comp.jsonl` carries an `estimated` (llm_prior) band of CAD 100,000-120,000 base for sre_devops/senior — that is a Stage-3 extractor guess with no company source behind it, not a stated number. Nothing found in this pass improves on it, and the single comp slot is marked `needs_comp: false`, so no new row was written.

Open relevant roles (sample): Senior DevOps Engineer (Remote in Canada) — now closed.

Sources: https://intrahealth.breezy.hr/p/4a907ab76103-senior-devops-engineer-remote-in-canada (their own posting; now shows a closure notice); https://intrahealth.com (product/company overview).
