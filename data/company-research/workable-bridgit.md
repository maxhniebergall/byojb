# Bridgit — research
Provider/key: workable:bridgit | company_type: product

**Research constraint, stated plainly:** web search was exhausted for this session and Bridgit's own domain is not derivable from any URL in the registry (the only URL on record is the Workable ATS board, which is client-rendered and not fetchable). **No first-party Bridgit page was read.** Everything below comes from the registry record and the structured facets extracted from their live JD; the JD body itself was not captured (`has_body: false`), so even the JD statements are second-hand through the extractor. Anything I could not source is marked unverified rather than guessed.

**Entity note:** "Bridgit" is a colliding name (there are several unrelated companies and products using it). The registry entity is the one posting via `apply.workable.com/bridgit`. The extracted domain label is "construction tech / backend and applied AI", which is consistent with the Bridgit that sells construction workforce/resource-planning software — but **I could not confirm the corporate identity from a first-party page this session**, so treat the identification as unverified.

What they do: Construction technology — backend and applied-AI software for the construction industry, per the extracted `domain` field. Product specifics, customers and business model are **unverified**.

How they describe themselves: The only culture language on record comes from signals extracted from their JD, quoted as captured: **"No Grit, No Pearl: embrace the gritty aspects of the journey"**, **"no task is beneath us"**, and **"confronting ambiguity or adversity with determination"**. The extractor classified the overall culture as `hustle`. They also want engineers who are "Curious and growth-minded". No mission statement, values page or handbook was readable.

Size / stage / funding: Extracted `company_stage: growth`. Headcount, funding round, investors and profitability are all **unverified** — no source was reachable.

Locations / HQ: **Unverified.** No HQ is recorded in the registry. The single live posting is tagged only "Canada (Remote)".

Remote policy: **Remote.** The posting's location field is "Canada (Remote)", the extracted `remote_policy` is `remote`, and `remote` appears in the work-life signals. No office-day requirement appears anywhere in the record. Async practices, core hours and offsite expectations are unverified.

Remote-Canada eligibility: **Yes — the strongest evidence in this batch.** The role is posted explicitly as "Canada (Remote)", with `geo_eligibility: canada` and `location_hints: ["Canada", "remote"]`. There is no city anchor and no hybrid tag. Caveat: the timezone expectation is recorded as `unclear`, so Mountain-Time workability is **unverified** — if the company is Ontario-based (as the construction-tech Bridgit is generally understood to be), Eastern-Time core hours are plausible and should be confirmed directly before applying.

Engineering & tech: Backend-heavy with a genuine applied-LLM component. Languages: C#, Go. Stack: .NET, PostgreSQL, Redis, REST and GraphQL APIs, AWS, Terraform, Kubernetes, GitHub Actions CI/CD. AI side: **AWS Bedrock, Anthropic/Claude models, production LLM integration into backend workflows**. Requirements as extracted: "5+ years hands-on experience building high-quality software with strong command of C#, Go or another modern backend language"; "Skilled in architecting and building scalable distributed systems"; "Extensive experience with SQL and/or NoSQL databases designing for performance and reliability"; "Product-driven and cross-functional, having deployed and maintained services in production"; and notably "Regular use of AI-assisted development tools like Cursor or Claude Code". Nice-to-haves: hands-on applied AI/LLM experience with Claude or OpenAI, production LLM integration, PostgreSQL or Redis. No degree required. Autonomy rated `medium`; on-call `unclear`.

Notable / other: Benefits recorded as equity awards plus comprehensive benefits. PTO policy unverified. The posting is recent — first seen 2026-07-23, still live as of 2026-07-30.

Open relevant roles (sample): Senior Backend/Applied AI Developer — Canada (Remote). This is the only live relevant posting on record.

Comp on record: the extractor captured $120,000–$170,000 CAD base with equity from the JD. Note that `data/company-comp.jsonl` currently holds this as an *estimated* `llm_prior` row (120/145/170 CAD) even though the numbers match the JD-extracted figures — see the fit/data-quality note; without the JD body I cannot upgrade it to `jd_posted` with confidence.

Sources: registry record and extracted facets for https://apply.workable.com/bridgit/jobs/view/9835C24E1D . No first-party page was fetched — web search budget was exhausted and no company domain was derivable from the registry.
