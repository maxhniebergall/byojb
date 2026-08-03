# Proposal: growing the technology vocabulary from the search itself

## The problem, stated precisely

`preferences.languages` and `preferences.technologies` are hand-maintained lists compared by
**exact string equality**. Two consequences follow, and both are silent:

1. **A miss looks like a neutral.** A JD saying "MLOps" does not match a list entry of "ML". Before
   this was fixed, that also *cost* score; now it merely contributes nothing. Either way the rubric
   is quietly failing to express a preference it actually holds.
2. **The gap is invisible where it matters.** The lists live in a file; the evidence lives in
   postings. Nobody edits a YAML list while reading a job. So the vocabulary only improves when
   somebody notices a wrong score and traces it back by hand — which is exactly how the Stripe ML
   Infrastructure case surfaced, and only because a single row was questioned.

The vocabulary is the most under-maintained part of the rubric, and it is under-maintained for a
structural reason, not a lack of diligence.

## Principle

> The vocabulary should grow as a **by-product of searching**, from the words real postings actually
> use, with the human deciding meaning and the machine doing the noticing.

Three roles, kept separate:

- **The corpus proposes.** It already contains every term, with frequencies.
- **The LLM interprets.** It reads a term in context and says what kind of work it implies.
- **The human decides.** love / ok / avoid / neutral is a statement of preference, not a fact.

## Stage 1 — make gaps visible (BUILT)

Each posting row now colours its technologies by classification: `love` green, `ok` blue, `avoid`
red, unrecognised as a dashed outline. Clicking an unrecognised chip files it into a list via
`POST /api/rubric/technology`.

This alone changes the economics: classifying a term costs one click at the moment you are already
looking at the evidence.

## Stage 2 — a vocabulary review queue

A one-click-per-term flow does not help with the *backlog*. Add a **Vocabulary** panel that ranks
unrecognised terms by how much they are costing:

```
node vocab-report.mjs            # unrecognised terms, ranked by impact
```

Impact = number of live, reachable postings using the term, weighted by their score. A term on 40
high-scoring Canadian remote postings matters; one on a single hard-excluded role does not.

Each row shows the term, its frequency, up to three example postings, and four buttons. The queue
is finite and shrinks — unlike a YAML file, which has no notion of "done".

## Stage 3 — LLM-proposed classification, human-confirmed

Rather than substring matching (which cannot distinguish "C" the language from "C" in "CI/CD"), have
the LLM propose a classification with a reason, from the term **plus the JD sentences it appears in**:

```json
{ "term": "MLOps",
  "proposed": "love",
  "why": "platform work: pipelines, model deployment, monitoring — the infrastructure other
          teams' models run on",
  "seen_in": ["Stripe — ML Infrastructure", "Grafana — MLE, Developer Experience"],
  "near": "ML, model serving" }
```

Presented pre-filled in the Stage-2 queue; accepting is one keystroke. The LLM never writes to the
rubric directly — a preference is the user's to state, and an LLM guessing "avoid" would silently
suppress whole categories of job.

`near` is doing real work here: it says *"you already love `ML`; this is the same thing spelled
differently"*, which is the actual reason most of these gaps exist.

## Stage 4 — synonym groups instead of flat strings

The deeper fix. Today `ML`, `MLOps`, `machine learning` and `ML infrastructure` are four unrelated
strings. Model them as one concept with surface forms:

```yaml
technologies:
  love:
    - concept: ml-platform
      terms: [ML, MLOps, LLMOps, machine learning, ML infrastructure, model training,
              model serving, model deployment, feature store, feature engineering]
```

Scoring matches any surface form; the UI shows the concept. Adding a synonym is then a genuinely
one-time act, and the list stops growing linearly with the corpus's vocabulary.

Backwards compatible: a bare string is a concept with one term.

## Stage 5 — close the loop with outcomes

Once decisions accumulate, the vocabulary can be checked against behaviour rather than intention:

- terms frequent in postings you **shortlist** but absent from `love` → suggest promoting
- terms frequent in postings you **skip** despite a high score → suggest `avoid`
- terms in `love` that never appear in anything you shortlist → suggest demoting

Surfaced as *suggestions with evidence*, never applied automatically. The point is to catch the case
where the stated rubric and the revealed preference have drifted apart — which is a thing worth
knowing on its own.

## What NOT to do

**Substring matching.** Tempting and wrong: `"C"` matches "Cloud", "CI/CD" and "ClickHouse", and the
`avoid` list is precisely where a false positive is most damaging — it caps a stack at 1.5. If
matching must be loosened, do it per-entry (`{ term: agent, match: substring }`), never globally.

**Auto-applying LLM classifications.** `avoid` suppresses jobs. A model that decides "Ruby" is an
avoid because the user dislikes Rails would quietly remove a category of work, and nothing
downstream would question it.

**Inferring preference from a single posting.** One JD using a term is not evidence you want that
work. Stage 2's impact ranking exists so the vocabulary grows from patterns, not anecdotes.

## Order

1. Stage 1 — **built**.
2. Stage 2 — `vocab-report.mjs` plus the panel. Highest value: it makes the backlog finite.
3. Stage 3 — LLM proposals into that queue. Removes the thinking from each decision.
4. Stage 5 — outcome feedback. Needs a decision history to be worth anything.
5. Stage 4 — synonym groups. The right model, but a scoring-path change; do it once the vocabulary
   has stopped churning.

## Measuring whether it worked

- unrecognised-term rate across live postings, tracked over time — should fall
- number of postings whose `tech_stack` is driven by *zero* recognised terms — should approach zero
- disagreements between stated `love` and actually-shortlisted postings (Stage 5) — should shrink
