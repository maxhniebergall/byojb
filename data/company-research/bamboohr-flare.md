# Flare — research
Provider/key: bamboohr:flare | company_type: product

**Evidence note, read first.** Only the registry's local data was verifiable this session. The BambooHR careers board returns HTTP 403 to fetches, none of Flare's postings had a JD body captured, the web-search budget for the session was exhausted, and the mode forbids guessing a company URL. Everything below is split explicitly into **[registry]** (verified from local data) and **[prior knowledge — UNVERIFIED]** (from the model's background knowledge, not confirmed against any page this session). Treat the second category as a lead to confirm, not as fact.

What they do: **[prior knowledge — UNVERIFIED]** Flare (Flare Systems) is a Montréal-based cybersecurity company selling threat-exposure management: it continuously monitors the clear web, dark web and illicit Telegram/marketplace channels for a customer's leaked credentials, exposed data and infrastructure, and surfaces the results as prioritised alerts. This identification is inferred from the slug plus the Montréal locations and bilingual French/English titles in the registry — **it has not been confirmed against the company's own site, and "Flare" is a heavily-colliding name** (there is also Flare Network in crypto, Flare the mortgage/fintech brands, and others). Confirm the entity before acting on anything here.

How they describe themselves: **not available.** No values, mission, handbook or culture text could be read — no JD bodies were captured and no first-party page was reachable. Unknown.

Size / stage / funding: **[registry]** 9 total open postings, 3 relevant — a small hiring footprint, consistent with a small-to-mid company. **[prior knowledge — UNVERIFIED]** venture-backed, roughly Series B scale, on the order of 100 employees. Not confirmed.

Locations / HQ: **[registry]** The one posting with a location states **Montréal, Quebec**. All four registry titles are written bilingually in French and English (e.g. *"Développeur·euse sénior, Plateforme Agentique / Senior Software Developer, Agentic Platform"*), including inclusive-form French (*Développeur·euse*, *Chef·effe*), which is a strong indicator of a Québec-based employer operating in French. **[prior knowledge — UNVERIFIED]** HQ Montréal.

Remote policy: **Unknown.** No remote policy statement was reachable. **[registry]** the aggregate record shows `relevant: 3, remote_relevant: 0` — i.e. none of Flare's relevant postings were classified as remote by the scanner, and the one posting with a location field names Montréal rather than "Remote".

Remote-Canada eligibility: **Canada-employing: yes, effectively certain — a Québec employer posting Montréal roles in French plainly has a Canadian entity and no work-authorisation obstacle. Remote-from-BC eligibility: unverified, and the available signals point against it.** No posting is marked remote, the located posting is Montréal, and there is a separate practical barrier: **the job titles are published in French first**, which suggests working French is expected or required. Québec's language-of-work legislation (Charter of the French Language) makes French-language working environments common at Montréal employers. There is also a 2-hour timezone gap between Eastern and Mountain time. None of this is disqualifying on its face, but "remote across Canada" is unsupported by the evidence and should be asked directly.

Engineering & tech: **[registry]** The visible role structure is informative even without bodies. Two of the four roles sit on an explicitly-named **"Plateforme Agentique / Agentic Platform"** team — a Senior Software Developer and a Software Development Team Lead — and one is a Senior Software Developer on **Identity**. So they run a named agentic-platform team and an identity team. Stack, languages, cloud and engineering practices are **unknown** (no JD bodies captured).

Notable / other: The presence of a dedicated Agentic Platform *team* (not a single AI feature owner) at a company this small is the most interesting signal in the record — it implies real investment in agent infrastructure rather than a bolted-on chatbot. The registry's comp slot classifies the Team Lead role as `ml_eng / senior`.

Open relevant roles (sample), all from the registry:
- Chef·effe d'équipe en développement logiciel, Plateforme Agentique / Software Development Team Lead, Agentic Platform — Montréal, Quebec (live)
- Développeur·euse sénior, Plateforme Agentique / Senior Software Developer, Agentic Platform
- Développeur·euse sénior, Identitée / Senior Software Developer, Identity
- Développeur·euse logiciel / Software Developer

Sources:
- Local registry: `data/company-research.jsonl`, `data/posting-research.jsonl`, `data/postings/raw-latest.jsonl`
- Careers board (cited, not fetched): https://flare.bamboohr.com/careers — BambooHR returned **HTTP 403**.
- **No first-party page was fetched.** Web-search budget exhausted for the session; URL-guessing is disallowed. This dossier should be re-run when search budget is available — it is the thinnest one in this batch.
