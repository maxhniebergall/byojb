# Outreach LLM stages — design (not implemented)

Two proposed pipeline stages that would sit alongside the outreach tracking that already ships
(`outreach-core.mjs`, `data/contacts.jsonl`, `data/outreach.jsonl`, the dashboard Outreach tab,
and LinkedIn capture in the Chrome extension).

**Status: design only.** No `modes/` file, no skill, no `.mjs` helper has been written for
either of these. This document is the spec to build from when the tracking side has enough real
data to be worth automating against.

---

## Why these two, and why not more

Direct outreach converts far better than public applications, but only when the message is
specific and the target is right. Those are two different problems, so they're two stages:

- **Targeting** is a ranking problem over data BYOJB already has (company fit, live postings,
  pay bands). It's cheap, batchy, and the answer is structured.
- **Drafting** is a writing problem that needs the full dossier for one contact at a time. It's
  expensive per item and the answer is prose that you must edit before it goes anywhere.

Everything else that looked tempting — auto-discovering who the hiring manager is, auto-sending,
auto-following-up — is deliberately excluded. Discovery has no reliable zero-fetch data source,
and anything that sends on your behalf destroys the exact credibility the strategy depends on.

---

## Stage: `byojb-outreach-targets`

Answers: *which companies deserve outreach effort this week, and who should I aim at?*

### Inputs (all local, zero fetch)

| Source | What it contributes |
|---|---|
| `data/companies-personal.jsonl` | `decision === 'keep'`, `llm_fit`, `llm_rank` — the companies you've already vetted in |
| `data/company-aggregates.jsonl` | `live_relevant`, `best_posting_score` — is there anything actually open worth pitching against |
| `data/company-comp.jsonl` | `bandFor()` band + `derivation` — don't spend outreach effort on a company that can't pay |
| `data/company-research/<key>.md` | the dossier — tech stack, stage, what they're building |
| `data/outreach.jsonl` | **exclusion set** — companies where a thread already exists |

### Helper contract — `outreach-targets.mjs`

Follows the established `--emit` / `--apply` / `--stats` triad (see `llm-triage.mjs`):

```
node outreach-targets.mjs --emit 25      # → JSON batch of company context
node outreach-targets.mjs --apply /tmp/outreach-targets.json
node outreach-targets.mjs --apply-append /tmp/one.json   # per-item checkpoint
node outreach-targets.mjs --stats
```

Emitted item:

```json
{ "company_key": "greenhouse:acme", "name": "Acme", "llm_fit": 4.2,
  "live_relevant": 3, "best_posting_title": "Senior Backend Engineer",
  "band": { "mid": 210000, "currency": "USD", "derivation": "inferred" },
  "dossier_excerpt": "…first 1200 chars of the research md…",
  "existing_threads": 0 }
```

Model returns:

```json
{ "company_key": "greenhouse:acme", "target_archetype": "hiring_manager",
  "angle": "They just moved search off Elasticsearch — that's the migration I led at X.",
  "priority": 4, "reason": "…" }
```

Applied to a new `data/outreach-targets.jsonl` (derived, regenerable — it is a work queue, not a
record of anything that happened). The dashboard would surface it as a "who to approach" panel;
you still create every thread by hand.

### The re-emit trap

`llm-triage.mjs` filters its queue on `llm_fit == null`, which means an item the model scored but
that never got recorded comes back forever. Whatever field this stage keys its queue on, it needs
`--apply-append` per-item checkpointing and a `--record-fail <key> "<reason>"` backoff path, or a
single unparseable response re-emits that company on every run.

---

## Stage: `byojb-outreach-draft`

Answers: *what do I actually say to this specific person?*

### Inputs

| Source | What it contributes |
|---|---|
| `data/contacts.jsonl` | the person: name, title, **archetype**, **relationship** |
| `data/outreach.jsonl` | the thread so far — `messages[]`, so a follow-up isn't a cold restart |
| `data/posting-research/<sk(key)>.md` | the JD body — the specific stack and problems to match against |
| `data/posting-research.jsonl` `extracted` | technologies, seniority, remote policy |
| `data/company-research/<key>.md` | what the company is building |
| `modes/_profile.md` | your narrative framing and target archetypes |
| `data/essay-answers.jsonl` | **voice corpus** — 38 answers you actually wrote, so drafts sound like you and not like an LLM |

### Archetype drives the template, not just the tone

This is the whole point of storing `archetype` and `relationship` as structured fields rather than
notes. Four genuinely different messages:

- **`hiring_manager`** — 100–150 words. Context (their team/product, specifically), two or three
  quantifiable senior achievements matched to their stack, low-friction CTA (share a resume, or a
  short screen). No cover-letter throat-clearing.
- **`recruiter`** — bulleted, not prose. YOE, core stack, location/remote constraint, the exact Job
  ID. No architecture discussion; they're screening for structural match and availability.
- **`peer_engineer`** — technical and non-transactional. A real question about an architectural
  decision or their OSS work. **Never** ask for a referral in a first message; that asks a stranger
  to stake their internal credibility on you, and the usual answer is silence.
- **`former_colleague` / `alumni`** — reconnect first. Shared context is the whole opening. Ask for
  a warm intro, not a portal submission — an employee who confirms direct working history produces
  a *strong* referral that skips recruiter screens, while a "never worked together" submission is
  tagged unverified and lands back in the same queue as a cold application.

### Helper contract — `outreach-draft.mjs`

```
node outreach-draft.mjs --emit 10        # threads with status 'Drafted' and no messages yet
node outreach-draft.mjs --apply /tmp/outreach-drafts.json
```

`--apply` writes the draft as a `messages[]` entry with `direction: 'out'` **and leaves the thread
at `Drafted`**. It never advances to `Sent`. The status only moves when you log the message you
actually sent, from the dashboard or the extension. A draft in the registry is a draft; nothing in
BYOJB can put words in front of a human but you.

### Length and the honesty constraint

The draft must not assert experience the profile doesn't support. A fabricated "I scaled X to
10M QPS" is worse than a generic message — it fails on the first screen. The mode file should
instruct: every quantified claim must trace to `modes/_profile.md` or the essay corpus, and if
there's no matching achievement for their stack, say so in the reason field and produce a shorter,
honest message instead.

---

## Wiring (identical to every other stage)

Each stage would need the standard three layers, plus one contract update:

1. `modes/outreach-targets.md` / `modes/outreach-draft.md` — the prompt: goal, pipeline position,
   the hard **SUBSCRIPTION ONLY** rule (score/write it yourself, never call an LLM API, never spawn
   script-based subagents), a `## Loop`, and `Arguments: {{args}}`.
2. `.agents/skills/byojb-outreach-{targets,draft}/SKILL.md` + `.gemini/commands/*.toml`.
3. The `.mjs` helper — deterministic plumbing over `loadJsonl`/`saveJsonl`, never an LLM caller.
4. `DATA_CONTRACT.md` — add `data/outreach-targets.jsonl` to the gitignored user-data table.

---

## Explicitly out of scope

- **Auto-send anything.** Not from the extension, not from a mode, not ever.
- **Automated follow-up scheduling.** `next_action_date` is recorded and displayed; nothing reads
  it to nag. That was a deliberate product decision, not an omission.
- **Bulk contact discovery / scraping people lists.** The extension captures one profile you are
  already looking at. Iterating a search-results page is how you get a LinkedIn account restricted,
  and mass-identical outreach is what the whole strategy exists to avoid.
