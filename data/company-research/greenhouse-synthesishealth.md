# Synthesis Health — research
Provider/key: greenhouse:synthesishealth | company_type: product

What they do: Synthesis Health builds a cloud-native healthcare platform centred on medical imaging
and clinical data. The engineering surface described in its JDs is squarely infrastructure: on-premise
"Customer Edge" gateways that run inside hospital networks and bridge DICOM and HL7 data into the
cloud; high-throughput ingestion pipelines that absorb "massive bursts of DICOM images and HL7
messages"; FHIR/HL7/DICOM interoperability; and a polyglot data layer (AlloyDB/PostgreSQL for OLTP,
NoSQL, BigQuery for OLAP). Customers are hospitals and health systems.

How they describe themselves: Verbatim: "We're a mission- and values-driven company with tremendous
dedication to our customers. Our 100% remote team is dedicated to a common goal - to revolutionize
healthcare through innovation, collaboration, and commitment to our core values and behaviors."
Their values, stated in full on every JD: "Clinical service first. Collaborate with our customers.
Listen, respect, learn. Innovate to excel." And the behaviours they hire for: "Be nice. Be creative.
Be honest. Be helpful." They also describe themselves as "a rapidly growing company".

Size / stage / funding: Private and growing ("a rapidly growing company", equity/"employee option
program" offered). Headcount, funding stage and profitability could NOT be verified this session — no
first-party page was fetched (no non-ATS URL exists in the registry). The small number of live
postings (5) and the "establish yourself as a key technical voice" framing suggest a small
engineering org.

Locations / HQ: No HQ is stated in the JDs. Postings are split between Houston, TX (the two Principal
Platform Engineer roles) and Vancouver, BC (Sr. Platform Engineer, Staff Data Engineer, Staff
Platform Engineer). The Vancouver, BC presence plus CAD-scale salary ranges indicates a real Canadian
employment footprint.

Remote policy: Remote-first, stated repeatedly and unambiguously: "Our 100% remote team", and in the
benefits pitch "We offer a strong salary, meaningful equity, a 100% remote culture, and significant
opportunities for growth."

Remote-Canada eligibility: LIKELY YES. Three of the five live roles are posted against Vancouver, BC,
the company states a 100% remote culture, and it explicitly "participates in location based hiring
and salary ranges can be adjusted based on candidate's residence" — i.e. it hires by residence rather
than by office. Whether it will employ someone in BC outside the Vancouver metro was not separately
confirmed, but nothing in the JDs anchors the roles to an office. Caveat: because pay is
location-based and the BC-posted ranges are markedly lower than the US-posted ones, a BC hire is paid
on the lower scale.

Engineering & tech: Google Cloud-flavoured stack — AlloyDB (PostgreSQL), BigQuery, Kafka or PubSub
for ingestion. Distributed-systems problems with real depth: on-premise HA gateways, buffering
terabytes of imaging data during hospital connectivity outages, over-the-air fleet updates of
thousands of remote agents behind enterprise firewalls, backpressure and "thundering herd" protection,
multi-tenant rate limiting and fairness, sharding/partitioning/active-archiving, active-active
failover, circuit breaking and graceful degradation, targeting 99.99% reliability. Governance is
formalised through an Architecture Review Board (ARB). Compliance is engineered rather than
bolted on: "compliance as code" for HIPAA, ISO 27001 and SOC2.

Notable / other: Every JD posts a salary range plus the caveat "However, Synthesis participates in
location based hiring and salary ranges can be adjusted based on candidate's residence." Observed
ranges: Principal Platform Engineer (both variants, Houston TX) $170,000-$205,000; Staff Data
Engineer and Staff Platform Engineer (Vancouver BC) $120,000-$150,000; Sr. Platform Engineer
(Vancouver BC) $85,000-$110,000. Benefits: medical, dental, vision, a "use as needed" vacation
policy, and an employee option programme.

Open relevant roles (sample): Principal Platform Engineer; Principal Platform Engineer, Medical Data;
Staff Platform Engineer (Edge & Ingestion); Staff Data Engineer; Sr. Platform Engineer.

Sources: the 5 live JD bodies under https://job-boards.greenhouse.io/synthesishealth (cited; already
captured in data/posting-research/). No first-party company site was fetched — no such URL appears in
the registry and guessing one was out of budget, so company-level facts (headcount, funding, HQ) are
explicitly unverified above.
