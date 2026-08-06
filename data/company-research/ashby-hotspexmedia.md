# Hotspex Media — research
Provider/key: ashby:hotspexmedia | company_type: product

What they do: Hotspex Media is a Canadian media buying and planning agency — it plans and buys advertising for clients across Google Ads, Meta, LinkedIn and similar platforms, and has built an internal AI/analytics practice on top of that marketing data. The engineering role tracked here exists to serve that internal data layer, not an external software product. NOTE ON IDENTITY: this is the agency Hotspex Media, distinct from the market-research firm of a similar name; the JD's media-buying and Clutch.co ranking confirm the agency entity matches the registry.

How they describe themselves (their own words, from the posting): "#1 Ranked Media Buying and Planning Agency on Clutch.co"; "Finalist 'Best AI Tool', 2024 Digiday Technology Awards"; "Winner of Waterstone Canada's Most Admired Corporate Cultures"; "Hybrid Work Model (1 Day in Office / Week)". Team framing: "Small, high-autonomy team with direct access to leadership." Scope framing: "Owns design, build, operation of Hotspex's data transformation and storage layer." The posting is written as a competency matrix (Core Competencies / Job Specific Competencies / Responsibilities) — an unusually well-scoped, engineering-literate JD for an agency.

Size / stage / funding: Not stated. Private Canadian agency, self-described as growth stage. Headcount unknown.

Locations / HQ: Greater Toronto Area, Ontario.

Remote policy: Their own words: "Hybrid Work Model (1 Day in Office / Week)" and "Location: Hybrid with the option for Remote if Outside Greater Toronto Area (must be legally authorized to work in and based in Canada)."

Remote-Canada eligibility: YES — verified from the JD's own location line. Fully remote is explicitly offered to candidates based outside the Greater Toronto Area, with a hard requirement to be legally authorized to work in and based in Canada. A British-Columbia-based remote arrangement fits that wording directly; Mountain-Time overlap with a Toronto team is workable but unaddressed by the posting.

Engineering & tech: BigQuery, Postgres, Airtable, dbt, Airflow (or Dagster/Prefect), Kimball dimensional modelling with slowly changing dimensions, stored procedures and scripted procedures (BigQuery scripting / PL/pgSQL), UDFs, incremental models, partitioning/clustering/materialized views for cost tuning, n8n for workflow automation, plus RAG/embedding feature tables served to an AI team. Explicit reliability practice: dbt tests, freshness checks, row-count anomaly detection, runbooks, and a stated "Detect and acknowledge data quality incidents within 1 business hour (SLA)". Reports to a Director of AI & ML; partners with a Workflow Automation Engineer and a Junior AI Engineer.

Notable / other: Compensation is posted on the role at CA$85,000–CA$115,000 base for a Data Engineer. The org is small enough that this one hire owns "every production stored procedure, scripted procedure, scheduled query across BigQuery and Postgres". The AI work is real but downstream and small-scale (feature tables and serving views for a junior AI engineer's RAG work).

Open relevant roles (sample): Data Engineer (Toronto / remote-in-Canada, CA$85K–115K).

Sources: their own live JD text captured in the registry — https://jobs.ashbyhq.com/hotspexmedia/b9b63a9d-6412-4d65-9982-dd68b2b3f8b4 (Ashby board not re-fetched; body already local).
