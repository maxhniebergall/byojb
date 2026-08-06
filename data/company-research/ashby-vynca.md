# Vynca — research
Provider/key: ashby:vynca | company_type: product

What they do: Vynca is a healthcare technology and care-delivery company focused on "transforming care for individuals with complex needs." Its stated mission: "to provide comprehensive care for more quality days at home." The engineering work centres on clinical data integration and real-time pipelines; the wider company clearly also employs clinical staff directly (one of the two live postings is an "Enrollment Medical Assistant"), so it is a hybrid tech + care-delivery organisation rather than a pure software vendor. Domain touches Medicare/Medicaid, payors and EHR integrations.

How they describe themselves: "Join the dynamic journey at Vynca… We're more than just a team; we're a close-knit community. Our shared commitment to caring for each other and those we serve is what sets us apart." Their four stated core values, in full: **Excellence, Compassion, Curiosity, Integrity** — "Guided by our unwavering core values… we forge paths of success together. Join us in this transformative movement where you can contribute to making a profound difference every day."

Size / stage / funding: **Unverified.** No first-party company page was fetched this session and the registry holds no headcount or funding data. Signals from the JD (small posting volume, a single senior engineering opening, mentions of legacy-system rewrites and data-lake/warehouse buildout) suggest a small-to-mid private healthtech, but this is inference, not a verified fact.

Locations / HQ: Not stated in the available material. Postings are listed as "Remote - United States" with an explicit state allow-list.

Remote policy: Remote, but geographically constrained and timezone-constrained. The Senior Software Engineer JD states plainly: "This position is remote and requires working Pacific Coast business hours (PST)." And: "At this time we are only considering applicants in the following states: Arizona, California, Colorado, Florida, Georgia, Illinois, Nevada, North Carolina, Oregon, Texas, Utah and Washington."

Remote-Canada eligibility: **No — not eligible (high confidence).** The JD enumerates twelve US states as the complete eligible set and requires US employment-eligibility verification via E-Verify ("Compliance with federal law requires identity and work eligibility verification using E-Verify upon hire"). Canada is not in scope.

Engineering & tech: Python and Java (Flask/FastAPI, Spring Boot). Event-driven architecture with Apache Kafka, Kafka Streams, Kinesis, Flink, Spark Streaming, Airflow. AWS + Kubernetes, cloud-native fault-tolerant design, distributed caching. Databases: SQL, NoSQL, DynamoDB; warehousing on Redshift, BigQuery, Snowflake. Observability via Datadog and Kibana; CI/CD emphasised. Healthcare data standards are central: FHIR, CCDA, HL7 V2/V3, DICOM. Stated scale target: "event-streaming and ETL flows that process millions of records per second with low latency." Compliance context: HIPAA, HITRUST. Also mentions R&D prototyping including "AI/ML integration, real-time analytics" and genomic data pipelines.

Notable / other: Hiring process is described as apply → phone screen → online assessment(s) → interview(s) → offer → background/reference checks, with a background check and possible drug test. Patient/client/customer-facing roles carry an influenza vaccination requirement. The senior engineering role is pitched as technical leadership + mentoring, owning end-to-end delivery and leading migration/modernisation efforts.

Open relevant roles (sample): Senior Software Engineer (Remote — US, 12-state list); Enrollment Medical Assistant (Remote — United States).

Sources: registry JD body at `data/posting-research/https---jobs.ashbyhq.com-vynca-25a07131-c2d8-48c2-a2c2-6bf59bdb6b4a.md` (from https://jobs.ashbyhq.com/vynca). The Enrollment Medical Assistant posting has no stored body. No first-party vynca site page was fetched — HQ, headcount and funding remain unverified.
