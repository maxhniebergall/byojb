# OLIX — research
Provider/key: ashby:olix | company_type: product

Entity check: The OLIX in this registry is an **AI inference-accelerator silicon startup** building
the "OLIX Decode Accelerator 1 (DX-1)", hiring in London UK / Austin TX / Toronto. This is NOT the
Korean biotech OLIX Pharmaceuticals (KOSDAQ) — a common name collision. Confirmed from the JD text
itself, which describes chip/compiler/runtime work. No independent first-party website could be
verified this session (web search budget exhausted; the only registry URLs are Ashby board pages,
which are client-rendered and off-limits to fetch), so everything below comes from OLIX's own job
descriptions as captured in the registry.

What they do: Custom silicon for LLM inference — specifically the *decode* phase. In their words:
"AI is growing faster than any technology in history and the explosion in demand has created a
massive infrastructure gap; we can no longer build chips or power stations fast enough to keep up.
The industry is still leaning on a ten-year-old hardware blueprint that has reached its limit."
Their product claim: "The OLIX Decode Accelerator 1 (DX-1) is the first accelerator architected
specifically for decode. Rack-scale co-design of logic, data movement, packaging, optics and
interconnect enables a step change in system level performance." The software stack they are
building around it comprises a compiler, runtime, simulator and framework integration.

How they describe themselves: Ambitious and explicitly world-historical — "the biggest economic
opportunity of the next century" and "the most important company of the next decade." That is
strong hype framing. Against that, the actual role copy is unusually grounded and specific about
engineering craft: "This is a build-and-test role, not product-serving SRE"; impact is defined as
"the velocity of every engineer who depends on this system: how fast they get a trustworthy signal,
how rarely they wait on a machine or a flaky run, and how much they can self-serve without coming to
you"; and they say leverage "through the standards, platforms, and shared resource model others
build on, is what we're hiring for far more than any single system you ship." Stated engineering
values include "a reproducible, safe-by-default mindset, including hermetic builds, least privilege,
fail-closed defaults, and blast radius control," and influencing "without relying on formal
authority." No "fast-paced"/"wear many hats"/"hustle" vocabulary appears.

Size / stage / funding: Early-stage hardware startup (facet extraction: `company_stage: startup`).
Headcount, funding round and investors are UNVERIFIED. Building custom silicon implies substantial
capital and a long, capital-intensive pre-revenue runway.

Locations / HQ: London, UK appears on every posting and is the apparent centre of gravity; also
Austin, TX and Toronto, Canada.

Remote policy: **Hybrid**, per facet extraction on both JDs with bodies. Postings name specific
cities rather than "remote," and the work is intrinsically tied to physical hardware — the DevOps
role is explicitly about "simulator and emulator boxes alongside DX-1 and prototype-platform boards"
and "hardware-in-the-loop testing," which is difficult to do from anywhere but a lab.

Remote-Canada eligibility: **NO — effectively disqualifying.** The one Canada-touching role,
"Staff / Senior Software DevOps Engineer," is listed as "Toronto, CAN, London, UK" and classified
hybrid. It is a Toronto office/lab seat, not remote-within-Canada, and the hardware-in-the-loop
nature of the work makes a Kimberley BC arrangement implausible. Eastern-time Toronto hours are also
two hours off Mountain.

Engineering & tech: Two distinct tracks. (1) Systems/compiler: PyTorch, JAX, vLLM, SGLang,
TensorRT-LLM, distributed inference, KV-cache optimisation, ASIC/FPGA. (2) Build & test
infrastructure: CI/CD at scale (GitHub Actions or comparable), heterogeneous runner fleets across
cloud and on-prem (VMs, containers, bare metal), content-addressed caching, staged test lanes with
real isolation, scarce-resource scheduling and reservations for FPGA/prototype rigs, performance
regression baselines on pinned hardware with rolling baselines and sound metric aggregation
(geometric/arithmetic mean, median), deterministic testing, bisection/attribution, observability
stacks (Prometheus/Grafana, Datadog, columnar warehouses), Python plus a systems language, Linux,
AWS. Adjacent depth welcomed in HPC/cluster batch scheduling, release engineering and
developer-productivity platforms. A bachelor's degree or higher in CS/EE/Maths is listed as
required. Their test suite "asserts token-exact correctness against golden references."

Notable / other: Compensation is described only as "Competitive Salary: Commensurate with your
experience, skills, and location" plus equity. One live posting ("Architect/Staff Systems Software
Engineer", London) carries a posted figure of £337K, and an "Infrastructure Engineer" posting
(London / Austin) shows £88K with "Multiple Ranges" — the spread suggests the £337K figure may be a
total-package or multi-component number rather than base; treat with caution.

Open relevant roles (sample): Architect/Staff Systems Software Engineer (London, UK);
Staff / Senior Software DevOps Engineer (Toronto, CAN / London, UK); Infrastructure Engineer
(London, UK / Austin, TX).

Sources:
- https://jobs.ashbyhq.com/olix/1918a1c8-a72e-4823-aa93-5cf3f465b06d (JD body from local registry; cited, not fetched)
- https://jobs.ashbyhq.com/olix/6395ee1d-73f9-444d-ba70-799ed0da475d (JD body from local registry; cited, not fetched)
- https://jobs.ashbyhq.com/olix/065b264f-7815-428b-8ccf-aef2aeb3d233 (registry record)
- No first-party corporate site verified; web search unavailable this session.
