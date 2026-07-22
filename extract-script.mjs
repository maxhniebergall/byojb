import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Helper to sk() a key
function sk(url) {
  return url.replace(/[:/]/g, '-').replace(/\?/g, '-');
}

const outData = [];

// ClickHouse
const chKey = "https://job-boards.greenhouse.io/clickhouse/jobs/6107515004";
writeFileSync(join('/Users/mh/workplace/job-finder/data/posting-fit', sk(chKey) + '.md'),
`Recommend: shortlist

Aligns: Very strong fit. Data ecosystem, Python, ClickHouse infrastructure, RAG/LLM backend components. Completely remote in Canada.

Concerns: None immediately obvious.

Verdict: Excellent infrastructure and ML backend role at a well-regarded data company. Strongly aligned with your North Star.
`);

outData.push({
  key: chKey,
  fit_brief: `data/posting-fit/${sk(chKey)}.md`,
  llm_reason: "Strong fit data infra",
  extracted: {
    yoe_min: 7, yoe_max: null,
    seniority: "senior",
    employment_type: "full_time",
    languages: ["Python", "SQL"],
    technologies: ["ClickHouse", "Airflow", "Dagster", "Prefect", "dbt", "SQLMesh", "LangChain", "LlamaIndex", "n8n", "Pandas", "NumPy", "Pydantic", "AWS", "MLOps", "LLM", "RAG"],
    location_hints: ["Canada", "United States", "San Francisco Bay Area", "New York City Metro Area"],
    timezone: "unclear",
    remote_policy: "remote",
    geo_eligibility: "canada",
    comp: null,
    on_call: "unclear",
    autonomy: "medium",
    culture: "sustainable",
    company_stage: "late_stage",
    wlb_signals: ["Flexible work environment", "generous entitlement in other countries"],
    requirements: ["7+ years of software development experience", "experience building production-grade Python connectors", "experience applying AI/ML in production", "database fundamentals", "concurrent Python"],
    nice_to_haves: ["Prior experience as a Data Engineer or Data Scientist", "Familiarity with ClickHouse", "Familiarity with the JVM ecosystem", "Experience deploying AI/ML models in production"],
    benefits: ["Healthcare", "Equity", "Time off", "$500 Home office setup", "Global Gatherings"],
    pto_policy: "unclear",
    degree_required: "unclear",
    domain: "data warehousing and observability"
  }
});

// Samsara
const samKey = "https://samsara.com/company/careers/roles/8044126?gh_jid=8044126";
writeFileSync(join('/Users/mh/workplace/job-finder/data/posting-fit', sk(samKey) + '.md'),
`Recommend: shortlist

Aligns: Great OPX/DevEx role. Focuses on platform stability, observability (Datadog), and scaling infrastructure. Open to Canada, good compensation.

Concerns: ET timezone required, might mean earlier mornings. Emphasizes on-call responsibilities.

Verdict: Solid platform role matching your background in scalable backend/infrastructure, despite potential timezone/on-call factors.
`);
outData.push({
  key: samKey,
  fit_brief: `data/posting-fit/${sk(samKey)}.md`,
  llm_reason: "DevEx OPX platform role",
  extracted: {
    yoe_min: 8, yoe_max: null,
    seniority: "senior",
    employment_type: "full_time",
    languages: ["Go", "Python"],
    technologies: ["AWS", "GCP", "Datadog", "New Relic", "Grafana", "Terraform", "IoT"],
    location_hints: ["ET time Zone", "US and Canada", "SF office"],
    timezone: "America/New_York",
    remote_policy: "remote",
    geo_eligibility: "canada",
    comp: {min: 154700, max: 208000, currency: "USD", equity: true},
    on_call: true,
    autonomy: "high",
    culture: "sustainable",
    company_stage: "public",
    wlb_signals: ["flexible, employee-led remote model", "empathy for on-call engineers"],
    requirements: ["8+ years of experience", "Bachelor's Degree", "3+ years in infra/platform", "Expertise in Observability"],
    nice_to_haves: ["Incident management tooling", "Terraform"],
    benefits: ["comprehensive health and parental leave plans", "professional development stipend"],
    pto_policy: "unclear",
    degree_required: "bachelor",
    domain: "IoT and Connected Operations"
  }
});

// Instacart
const instKey = "https://instacart.careers/job?gh_jid=8049922";
writeFileSync(join('/Users/mh/workplace/job-finder/data/posting-fit', sk(instKey) + '.md'),
`Recommend: shortlist

Aligns: Senior backend/data pipeline role. Heavy on microservices, event streaming (Kafka), and cloud. Good overlap with your tech stack. Remote in Canada.

Concerns: Mentions fast-paced environment and ambiguous requirements, which might impact WLB.

Verdict: High-paying, tech-aligned role in fulfillment systems; fits well with distributed systems and data pipeline experience.
`);
outData.push({
  key: instKey,
  fit_brief: `data/posting-fit/${sk(instKey)}.md`,
  llm_reason: "Data streaming and cloud",
  extracted: {
    yoe_min: 6, yoe_max: null,
    seniority: "senior",
    employment_type: "full_time",
    languages: ["Go", "Java", "Python", "Scala", "SQL"],
    technologies: ["AWS", "GCP", "Azure", "Docker", "Kubernetes", "Kafka", "Pub/Sub", "Redis", "PostgreSQL", "MySQL", "GKE", "BigQuery", "Cloud SQL"],
    location_hints: ["Canada", "Toronto", "Ontario", "Alberta", "British Columbia", "Nova Scotia"],
    timezone: "unclear",
    remote_policy: "remote",
    geo_eligibility: "canada",
    comp: {min: 168000, max: 177500, currency: "USD", equity: true},
    on_call: true,
    autonomy: "medium",
    culture: "sustainable",
    company_stage: "late_stage",
    wlb_signals: ["Flex First team", "choose where they do their best work"],
    requirements: ["6+ years experience", "Proficiency in Go, Java, Python, or Scala", "Microservices on major cloud", "SQL skills and event streaming", "On-call rotation"],
    nice_to_haves: ["Real-time decisioning systems", "ML feature stores", "GCP ecosystem"],
    benefits: ["equity grant", "refresh grants"],
    pto_policy: "unclear",
    degree_required: "bachelor",
    domain: "grocery delivery marketplace"
  }
});

// Stripe
const stripeKey = "https://stripe.com/jobs/search?gh_jid=8047083";
writeFileSync(join('/Users/mh/workplace/job-finder/data/posting-fit', sk(stripeKey) + '.md'),
`Recommend: consider

Aligns: Platform/backend infrastructure role at a major tech company. 

Concerns: JD is very generic without specific technologies listed. Remote policy and Canada eligibility are unclear.

Verdict: Worth a look if Stripe supports Canada remote, but the posting lacks concrete details.
`);
outData.push({
  key: stripeKey,
  fit_brief: `data/posting-fit/${sk(stripeKey)}.md`,
  llm_reason: "Generic platform role",
  extracted: {
    yoe_min: 3, yoe_max: null,
    seniority: "unclear",
    employment_type: "full_time",
    languages: [], technologies: [], location_hints: [],
    timezone: "unclear", remote_policy: "unclear", geo_eligibility: "unclear",
    comp: null, on_call: "unclear", autonomy: "high", culture: "sustainable", company_stage: "late_stage",
    wlb_signals: [], requirements: ["3+ years of experience designing and engineering large-scale systems", "Track record of leading and shipping complex cross-team projects", "measure success in terms of business impact"],
    nice_to_haves: [], benefits: [], pto_policy: "unclear", degree_required: "unclear", domain: "financial infrastructure and stablecoins"
  }
});

// Landr
const landrKey = "https://landr.bamboohr.com/careers/198";
writeFileSync(join('/Users/mh/workplace/job-finder/data/posting-fit', sk(landrKey) + '.md'),
`Recommend: skip

Aligns: AI Platform role.

Concerns: JD details are obfuscated, likely heavily front-end or product-facing given the company profile. Unknown if remote or Canada friendly.

Verdict: Skipping due to lack of clear infrastructure alignment and unknown remote status.
`);
outData.push({
  key: landrKey,
  fit_brief: `data/posting-fit/${sk(landrKey)}.md`,
  llm_reason: "Obfuscated JD details",
  extracted: {
    yoe_min: null, yoe_max: null, seniority: "unclear", employment_type: "unclear", languages: [], technologies: [],
    location_hints: [], timezone: "unclear", remote_policy: "unclear", geo_eligibility: "unclear", comp: null,
    on_call: "unclear", autonomy: "medium", culture: "unclear", company_stage: "unclear",
    wlb_signals: [], requirements: [], nice_to_haves: [], benefits: [], pto_policy: "unclear", degree_required: "unclear", domain: "AI audio"
  }
});

writeFileSync('/tmp/job-research.json', JSON.stringify(outData, null, 2));
