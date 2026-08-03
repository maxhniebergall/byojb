# Plan: rework hard exclusion so it never fires on missing data

## The bug that prompted this

Stripe, *Software Engineer, Machine Learning Infrastructure*, Toronto — **remote in Canada**, ML
infrastructure, Data Platform team. It was `hard_excluded: true` and invisible.

Nothing about it was wrong in the data we held. The chain was:

1. The Greenhouse record Stripe publishes contains the word "remote" **zero times** — it ends at
   "Preferred qualifications". The hybrid/remote policy exists only on `stripe.com`.
2. So `remote_policy` extracted as `unclear`.
3. `deriveRemotePolicy` fell through to its last rule: *a location naming a specific city, with no
   remote signal anywhere, is ONSITE*.
4. `work_eligible` composed `onsite` + Canada → `no`.
5. `hard_filters` excluded it.

Step 3 is a **ranking heuristic** being used as **exclusion evidence**. That is the defect, and it
is not specific to Stripe: any employer whose ATS record is thinner than their careers page hits it,
and the posting disappears silently — there is no "excluded because we didn't know" signal anywhere.

## Principle

> **Hard exclusion requires positive evidence. Absence of evidence may lower a score; it must never
> remove a posting.**

A hard filter answers "is this categorically unavailable to me?". Only a statement can answer that.
Silence answers a different question — "do we know?" — and the honest answer is no.

Ranking is where uncertainty belongs: an unverified posting should sit below a confirmed one, not
vanish beneath it.

## Audit: every current hard filter against that principle

`config/rubric.yml → hard_filters`

| filter | fires on | evidence-based? | verdict |
|---|---|---|---|
| `geo_eligibility ∈ {us_only, eu_only, india}` | LLM-extracted enum | yes — the extractor only writes these when the JD says so | **keep** |
| `remote_policy ∈ {onsite}` | LLM-extracted enum | yes — reads `extracted.remote_policy`, not the derived value | **keep** |
| `employment_type ∈ {internship, contract}` | LLM-extracted enum | yes | **keep** |
| `yoe_min > 10` | extracted number | yes | **keep** |
| `work_eligible ∈ {no}` | **composed** | **NO** — inherits `deriveRemotePolicy`'s city-default | **fix** ← the bug |

Only the composed filter is unsound. The four facet filters read values the extractor writes *from
the JD*, and it is instructed to use `unclear` rather than guess. They are fine as they are.

## Change 1 — `workEligible` ignores a defaulted policy (APPLIED, uncommitted)

`deriveRemotePolicy` already returns a `source` alongside the policy; it was being discarded.
Thread it through as `_remote_policy_source` and treat `city-default` / `none` as "unknown" for
exclusion purposes, while still using it for scoring.

Result:

| case | before | after |
|---|---|---|
| city named, no remote signal (Stripe) | `no` → excluded | **`unclear` → visible** |
| JD states onsite | `no` | `no` |
| JD states hybrid | `no` | `no` |
| confirmed remote + Canada | `yes` | `yes` |
| remote but US-only | `no` | `no` |

Measured: **hard-excluded 2,301 → 2,053 (248 postings restored)**. Stripe now scores 2.99, visible.
258 unit + 25 e2e tests green.

## Change 2 — make "excluded" auditable

Today `hard_excluded` is a bare boolean in the personal layer; `hard_reason` is computed and thrown
away. Persist it. Without it there is no way to answer "what did we drop, and on what grounds?" —
which is exactly the question that went unasked until a posting was spotted by hand.

- persist `hard_reason` alongside `hard_excluded`
- surface it in the dashboard row (a `⊘ geo_eligibility ∈ us_only` chip)
- add `score-postings.mjs --excluded-report` summarising counts by reason

Cheap, and it turns a silent drop into a reviewable decision.

## Change 3 — separate "unavailable" from "unverified" in the UI

`work_eligible` has three values but the dashboard reads a boolean. Distinguish them:

- **`no`** — evidenced unavailable → hidden by default (today's behaviour)
- **`unclear`** — unknown → **shown, ranked below**, marked `? eligibility unverified`
- **`yes`** — confirmed → shown

This is where an ATS-silent posting like Stripe belongs: present, honestly labelled, and beneath the
roles that state their policy.

## Change 4 — fix the data gap at its source (partially built)

Exclusion logic was only half the problem; the other half is that we never had Stripe's remote
policy. The scan stores the ATS API content as the body, which sets `has_body: true`, so
`fetch-jd-bodies.mjs` — which only fetched postings *lacking* a body — never revisited it. A
complete-looking body hid a truncated one.

`--refresh-first-party` (written, not yet run at scale) re-fetches postings whose URL is the
company's own site rather than an ATS host, and keeps whichever body is longer so a JS shell can
never overwrite good ATS content.

Scope: 1,064 of 16,475 live postings carry a first-party URL.

Note `stripe.com/jobs/search?gh_jid=…` **redirects** to the real listing page — following redirects
with a browser user-agent returns 171 KB including the policy. An earlier probe of mine reported
"0 bytes" because it did not follow the redirect; that measurement was wrong.

## Rejected: parse schema.org JSON-LD

Stripe publishes `jobLocationType: TELECOMMUTE` and
`applicantLocationRequirements: [{Country: Canada}]` — exactly the missing fields, in the standard
Google-for-Jobs format.

Tempting, but measured coverage is poor: **1 of 14** sampled first-party career hosts carried a
`JobPosting` block (most render client-side), and **no ATS page carries it at all**. Estimated yield
~75 postings for a fetch-plus-parser on every one. Change 4 gets the same content more reliably by
just reading the page.

Worth revisiting only if we add a headless-browser fetch path, which would also fix the JS-shell
cases.

## Order of work

1. **Change 1** — applied, needs review + commit. Fixes the live bug.
2. **Change 2** — small, makes every future exclusion reviewable. Do next.
3. **Change 4** — run `--refresh-first-party` over the 1,064, measure how many bodies grow.
4. **Change 3** — UI, once 1 and 2 have settled.

## How we will know it worked

- No posting is excluded without a stated reason (Change 2 makes this checkable).
- Re-running the Stripe case stays visible.
- Spot-check: sample 20 hard-excluded postings and confirm each has a JD sentence supporting it.
  Any that rest on a default are regressions.
