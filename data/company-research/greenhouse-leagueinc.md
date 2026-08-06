# League Inc. — research
Provider/key: greenhouse:leagueinc | company_type: product

What they do: League is a Toronto-headquartered healthcare experience platform — a "health OS" that
health plans and health systems license to drive member engagement and care completion. Their framing
of the problem: "Getting healthcare is often the easy part — finishing it is where things fall apart:
people book the appointment and skip the follow-up, fill the prescription and stop taking it, get the
referral and never make the call." League closes that gap by "identifying what each person needs to do
next, clearing what's in their way, and getting it done." Named customers span payers (Manulife, SCAN,
Geisinger, Medibank) and providers (Baptist, Shoppers Drug Mart), plus a well-publicised Highmark
Health / Google Cloud "digital front door" partnership. Delivery increasingly uses AI personalisation
and "agent teams" across voice, SMS and digital channels.

How they describe themselves: Public positioning is "one of the fastest-growing technology companies
in Canada and the leading healthcare experience platform." The about page centres health equity —
they say they are "intentional about building a platform that ensures everyone has equitable and just
access to the care they deserve" — and empowering people to live healthier lives through integrated
consumer experiences. Internally the loudest stated cultural principle in current JDs is being an
**"AI-native organization"**: "We expect all employees regardless of role or level to thoughtfully
leverage AI to improve the quality, speed, and impact of their work" — with an explicit ladder
(ICs use AI for personal productivity; senior ICs/managers integrate it into team workflows; leaders
drive org-wide adoption) and a screening criterion of "demonstrated experience using AI tools in a
practical, responsible way." They also foreground security responsibilities (secure coding practice,
incident notification) in JD boilerplate, consistent with a regulated-health-data vendor. Recruiting
process is described transparently ("A recruiter (not a computer) reviews all applications"), and
they publish an AI-in-hiring policy disclosing that AI tools may assist in screening applicants.

Size / stage / funding: Private, founded ~2014-2015 ("11 years since founding"). **$285M USD raised
to date**, most notably a $95M Series C to "build world's leading healthcare CX platform." Platform
reach stated as 63M+ members on the about page and "70 million+ people whose care already runs
through our platform" in current JDs. Headcount is not published; board additions include a former
Providence president and a former Workday EVP of Corporate Strategy, signalling enterprise
go-to-market maturity. Venture-backed and not stated to be profitable.

Locations / HQ: HQ in downtown Toronto, Ontario. Markets served: Canada, United States, and a recent
expansion into the United Kingdom & Ireland.

Remote policy: Mixed, and stated precisely in their JD boilerplate: "We have a mix of office-centric
roles based in our vibrant Toronto office, and remote-eligible roles based anywhere in Canada or US.
Each job posting will indicate where the role will be based. Regardless of the role's posted location,
**all Toronto-area Leaguers (living within 65 km of our downtown HQ) collaborate in-office Monday
through Thursday.** Depending on your distance to the office, you'll enjoy 10 or 20 Flexible Remote
Days each quarter." So: hybrid-mandatory inside the Toronto 65 km radius, genuinely remote outside it.

Remote-Canada eligibility: **Yes — verified.** The live Applied AI Scientist posting is listed
"Canada - Remote" and carries a CANADA-APPLICANTS-ONLY pay range in CAD, and the work-location policy
explicitly covers "remote-eligible roles based anywhere in Canada." Kimberley BC is far outside the
65 km Toronto radius, so the in-office Monday-Thursday rule does not apply. Caveat: the company is
Toronto-centric and Eastern-Time anchored, so meeting hours will skew early for Mountain Time; no
async-first commitment is stated anywhere.

Engineering & tech: The AI Models team works on small language models (1-10B parameters) —
fine-tuning, distillation, quantization, PEFT (LoRA/QLoRA, adapter tuning), RLHF/RLAIF and reward
modelling, plus training-data curation, labelling pipeline design and synthetic data generation.
Tooling named: NeMo, Hugging Face Transformers, Axolotl; serving via vLLM or Triton with inference
optimisation; cloud on GCP/Vertex AI or AWS with GPU resource management. Adjacent named orgs are
"Platform Engineering" and "AI Orchestration," implying a real internal AI-platform group beside the
research-flavoured AI Models team. Domain constraints are real: HIPAA, FHIR and clinical ontologies.
No public engineering blog or handbook was found.

Compensation (objective): The Applied AI Scientist posting states a Canada-only base range of
**$151,600 – $160,000 CAD**, exclusive of bonus, equity and benefits, and notes the band spans the
role's whole career progression. The (now-closed) VP, AI Platform Engineering posting supplied the
upper anchor in the registry's existing rollup band. A band row already exists in
data/company-comp.jsonl (ml_eng / unspecified, CAD 179,950 / 222,900 / 276,250, jd_rollup) and the
work-list surfaced no comp slot for this company, so no new row was written.

Notable / other: Long-running Canadian scale-up with brand-name enterprise logos; the Highmark +
Google Cloud partnership is the flagship reference. Publishes an applicant privacy notice and an
anti-recruitment-scam warning. Press placements in Forbes and Fast Company on "platformization of
healthcare."

Open relevant roles (sample): Applied AI Scientist (Canada - Remote, live); VP, AI Platform
Engineering (Canada, no longer live).

Sources:
- https://job-boards.greenhouse.io/leagueinc/jobs/5972947004 (JD text, from local registry body — cited, not fetched)
- https://league.com/about/
