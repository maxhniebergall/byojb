# Host-aware scan scheduling

Status: **implemented** 2026-08-17. Three things changed during the build; see "As built" at the
end for what deviated from the plan below and why.

## The problem

`scan.mjs` puts every company into one FIFO array and drains it with a fixed pool of
`CONCURRENCY = 10` workers (`parallelFetch`). Rate limiting is per-host, applied one layer down in
`providers/_http.mjs` via `acquireHostSlot`, which **blocks the calling worker** (`await sleep(wait)`,
or up to `MAX_SLOT_WAIT_MS = 20_000` queued on `gate.waiters`) when a host is saturated.

A shared FIFO plus a blocking per-host gate gives head-of-line blocking: a worker parked on
Greenhouse is a dead slot, and the item behind it — for an idle host — waits too.

The host distribution makes this acute. Workday gives every tenant its own hostname, so it
contributes ~6,000 buckets of one item, while Greenhouse/Ashby/Lever put thousands of companies
behind a single hostname each:

| host | items |
| --- | --- |
| workday (~6,000 distinct tenant hosts) | 6,613 |
| job-boards.greenhouse.io | 6,401 |
| jobs.ashbyhq.com | 2,894 |
| jobs.lever.co | 2,365 |
| smartrecruiters | 1,329 |
| workable / bamboohr / breezy / rippling / recruitee | 462–232 each |

(Counts from `data/scan-history.tsv`, cumulative across runs.)

### Baseline measurement

From the 2026-08-17 run, companies completed per minute (`data/scan-ledger.tsv`):

| window | rate |
| --- | --- |
| first 25 min | ~374/min |
| next 33 min | ~86/min |
| steady state | ~77/min |

The 4x decay is the scheduler, not the network. The per-tenant Workday hosts parallelise freely and
drain first; what remains is shared-host work where all ten workers serialise on a handful of gates.

### What the theoretical floor is

Each host needs `bucket / its own throughput` seconds, and those run concurrently. Effective per-host
rate is `min(cwnd / latency, 1000 / gap)`. At the current `MAX_PER_HOST = 3` and ~1s latency,
concurrency binds at 3 req/s:

| host | items | floor at cwnd=3 | floor at gap floor (150ms) |
| --- | --- | --- | --- |
| greenhouse | 6,401 | ~36 min | ~16 min |
| ashby | 2,894 | ~16 min | ~7 min |
| lever | 2,365 | ~13 min | ~6 min |
| workday singletons | 6,613 | trivially parallel | trivially parallel |

So the critical path is Greenhouse at ~36 min today, and ~16 min if per-host concurrency were free to
grow until the 150ms gap floor became the binding constraint. The run is taking ~3 hours. Essentially
all of that gap is parked workers.

Note the interaction: raising `cwnd` past `latency * 1000 / gap` buys nothing, because the gap then
binds. Both knobs are needed and neither alone is sufficient.

## Design

Two distinct layers, and both need to change. Conflating them is the main trap here.

### Layer 1 — request-level per-host limiting (`providers/_http.mjs`)

Stays where it is. This must remain **per request, not per company**: providers paginate, so a single
company scan can issue many requests to the same host. Moving the limiter up to company granularity
would let a paginating company burst straight through the rate limit.

Changes:

1. Replace the hand-rolled gate mechanics — `gate.inFlight`, `gate.waiters`, `acquireHostSlot`'s
   race against `MAX_SLOT_WAIT_MS`, `releaseHostSlot` — with one `PQueue` per host.
2. Replace the fixed `MAX_PER_HOST = 3` with a per-host congestion window under AIMD, written into
   `queue.concurrency` (documented as runtime-settable):
   - start at 2, floor 1, ceiling 8
   - on success: `cwnd += 1 / cwnd` (takes `cwnd` successes to gain a slot)
   - on 429/503: `cwnd = max(1, cwnd / 2)`
3. Keep the adaptive gap in-house rather than using p-queue's `interval` / `intervalCap`. Two
   reasons: those are fixed-window options set in the constructor and are not documented as runtime
   mutable, and the existing gap logic encodes real operational history (see the comment at
   `_http.mjs:40` — multiplicative back-off with additive recovery, after a run logged 19,804
   rate-limited responses and throughput fell 900→25/min). Enforce it as today, with a per-host
   `nextStart` timestamp checked inside the queued task.

Keep unchanged: `withHardTimeout`, the retry loop in `fetchWithTimeout`, `penalizeHost` /
`rewardHost`, `cooldownUntil`, `parseRetryAfter`, `backoffMs`. These are policy and watchdogs,
orthogonal to the queueing mechanics.

`MAX_SLOT_WAIT_MS` goes away. It exists to escape exactly the bookkeeping drift a real queue
prevents; keeping it alongside p-queue would mean two mechanisms disagreeing about who holds a slot.
The hard fetch watchdog is separate and stays.

### Layer 2 — work distribution (`scan.mjs`)

Delete the shared FIFO. Partition companies by host and run one async chain per host, so a saturated
host delays only its own chain:

```js
const byHost = groupBy(targets, targetHost);
await Promise.all([...byHost].map(([host, companies]) =>
  runSequentially(companies, scanOne)   // per-request concurrency comes from layer 1
));
```

Per-host chains can be sequential at this layer: `cwnd` inside `_http.mjs` already provides the
per-host request concurrency, and driving companies sequentially per host keeps the progress ledger
and pagination straightforward.

Consequences:

- `interleaveByHost` is deleted. Ordering stops mattering once queues are partitioned; the
  depth-proportional spreading currently on this branch was a static approximation of a scheduler.
- `parallelFetch` is deleted.
- `CONCURRENCY = 10` is deleted as a scheduling parameter. It was the real throughput ceiling, and it
  was low precisely because raising it made contention worse under a shared FIFO.

The company→host partition uses `targetHost` (`api || careers_url`). A provider whose API host
differs from its careers host will be partitioned imperfectly; that is acceptable because correctness
still comes from the request-level limiter, and the partition is only a work-distribution heuristic.

### Layer 3 — global ceiling as a backstop

Total in-flight becomes `Σ min(cwnd_host, ...)` over hosts with pending work. During the Workday
stretch that is ~6,000 concurrent requests, which no socket budget accommodates, so a global ceiling
is required — but strictly as a resource guardrail, never as a throttle.

This matters more than it sounds: **a contended global semaphore re-couples the hosts we just
decoupled.** If Greenhouse ever waits on the global cap, it is waiting behind Workday, and that is
head-of-line blocking rebuilt one layer up. Two requirements follow:

1. **Admit by remaining backlog under contention.** Otherwise Greenhouse queues behind thousands of
   trivially-parallel Workday singletons. This is the only place bucket depth legitimately enters the
   design — as a priority tiebreak on a contended semaphore, not as a spreading ratio.
2. **Instrument it.** Count acquisitions that actually waited, and report the count at end of run. A
   nonzero count for a rate-limited host is a bug signal, not a tuning knob. Without this, "it should
   never bind in practice" is an assumption rather than a measurement.

Suggested initial ceiling: 256. High enough that per-host limits bind first for every shared-host
ATS; low enough to bound sockets and memory.

## Dependencies

### Recommendation: add `p-queue` only

`p-queue` is the non-trivial piece — a priority queue with runtime-settable concurrency and correct
in-flight bookkeeping, which is precisely the hand-rolled code being removed.

**Do not add `p-limit`.** The global backstop is a counting semaphore of maybe 15 lines, it is
specified never to bind in normal operation, and it needs backlog-priority admission that `p-limit`
does not provide anyway. Writing it avoids two packages for no loss.

### What was considered

`bottleneck` is the textbook fit for this problem — `Bottleneck.Group` auto-creates and reaps a
limiter per key, `maxConcurrent` / `minTime` are exactly cwnd and gap, `chain()` gives a parent
limiter with correct "must satisfy both" backstop semantics, `schedule({priority})` gives the backlog
tiebreak, and `updateSettings()` allows runtime AIMD. Every requirement above maps to a feature.

Rejected on maintenance: latest is 2.19.5, last published **2023-02-22**. Three and a half years
static is not acceptable for a package that would wrap every outbound request in the scanner.

`crawlee` (AutoscaledPool, adaptive concurrency, per-domain limits) solves the whole problem, but
adopting a crawler framework is far more than this needs. For reference, the mature implementations
of the adaptive-concurrency half are Netflix's `concurrency-limits` (Java; gradient/Vegas) and
Scrapy's `AUTOTHROTTLE` (Python). There is no equivalent off-the-shelf in Node, so the AIMD policy
stays in-house — which is correct, since it is the only genuinely domain-specific part.

### Security evaluation

Resolved tree for `p-queue@9.3.3` — 3 packages, ~168 KB unpacked:

| package | version | last published | maintainers | unpacked | install script |
| --- | --- | --- | --- | --- | --- |
| p-queue | 9.3.3 | 2026-07-22 | sindresorhus | 84.5 KB | none |
| eventemitter3 | 5.0.4 | 2026-01-19 | 3rd-Eden, lpinca | 74.4 KB | none |
| p-timeout | 7.0.1 | 2025-10-07 | sindresorhus | 13.0 KB | none |

For comparison, adding `p-limit` would bring `p-limit@7.3.1` + `yocto-queue@1.2.2` for 5 packages
and ~190 KB.

Verified:

- **No transitive dependencies** beyond the table. The tree is closed at depth 2.
- **No install/postinstall scripts** on any package (`hasInstallScript` unset for all five
  candidates) — nothing executes at install time.
- **`npm audit`: 0 vulnerabilities** against a throwaway manifest resolving both candidates.
- **All MIT licensed.** Project is MIT, so no conflict.
- **All actively maintained**, published within the last ~10 months.
- **`engines: node >= 20`**; local Node is v24.16.0. Both are ESM-only, which suits a `.mjs` project.
- Maintainer reputation: sindresorhus for `p-queue`/`p-timeout`; `eventemitter3` by 3rd-Eden and
  lpinca (the `ws` maintainer). All long-established.

Risks and gaps:

- **No build provenance.** All five have an npm registry signature but **no SLSA/provenance
  attestations**, so the published tarball cannot be cryptographically tied to the stated GitHub
  source. This is the most substantive finding. It is common for packages on older publish
  pipelines, but it means trust rests on the registry and the maintainer account rather than on a
  verifiable build.
- **Blast radius is not trivial.** `p-queue` would sit in the path of every outbound HTTP request the
  scanner makes. A compromised release could observe or exfiltrate every URL and response body,
  including any credentialed provider calls. The packages are pure JS with no native code and no
  filesystem or network access of their own, so the risk is entirely supply-chain, not the code as it
  stands.
- **Sindresorhus concentration.** Two of three packages share one maintainer account; a single
  account compromise reaches most of the tree.

Mitigations to apply with the change:

1. Pin exact versions in `package.json` (no `^`), and commit `package-lock.json`. The repo has no
   lockfile committed today — worth fixing regardless of this change.
2. Install with `npm ci --ignore-scripts` in any automated path.
3. Review the resolved tree on every lockfile change; it should stay at 3 packages.
4. Enable Dependabot (or a scheduled `npm audit`) on the repo.

Given the blast radius, note the honest alternative: a per-key concurrency queue is ~60 lines, and
writing it keeps the dependency count at zero. The argument for `p-queue` is that the hand-rolled
version of exactly this is what produced the current bug, and a maintained implementation with real
test coverage is more trustworthy than a second attempt. That trade is a judgement call, not a
foregone conclusion — flagging it explicitly for a decision before install.

## Implementation steps

Ordered so each step is independently testable.

1. **Commit the current state.** The branch has an uncommitted `interleaveByHost` rewrite plus
   unrelated modifications to `dump-jd-batch.mjs`, `modes/research-jobs.md`, `package.json`,
   `providers/workday.mjs`, `test-all.mjs`. Land or stash those first so this change is reviewable.
2. **Add a lockfile and the dependency.** `npm install --save-exact p-queue`, commit
   `package-lock.json`, confirm the resolved tree is 3 packages.
3. **Rewrite the gate in `_http.mjs`.** Swap `hostGates`' `inFlight`/`waiters` for a
   `Map<host, PQueue>`; keep `gap`, `cooldownUntil`, and the AIMD functions. Delete
   `acquireHostSlot` / `releaseHostSlot` / `MAX_SLOT_WAIT_MS`. Route `fetchWithTimeout`'s single
   attempt through `queue.add(...)`. Behaviour should be unchanged at this point — same fixed
   concurrency of 3, just managed by a real queue.
4. **Add the cwnd AIMD.** Introduce the congestion window with the constants above, and have
   `penalizeHost` / `rewardHost` write `queue.concurrency` alongside the existing gap adjustment.
   Export per-host cwnd in `httpStats.byHost` so it is observable.
5. **Add the global semaphore** with backlog-priority admission and a `globalWaits` counter in
   `httpStats`. Ceiling 256, overridable via `BYOJB_HTTP_GLOBAL_MAX`.
6. **Repartition `scan.mjs`.** Replace `interleaveByHost` + `parallelFetch` with per-host chains.
   Delete `CONCURRENCY`. `reportProgress`, `pendingLedger`, `newOffers`, and `checkpoint()` are
   shared mutable state called per company — order-independent and safe under single-threaded Node,
   but confirm `checkpoint()`'s `done % CHECKPOINT_EVERY` trigger still behaves at higher
   concurrency.
7. **Surface the new signals in the progress line.** The existing heartbeat already shows
   `429:${httpStats.rateLimited}`; add aggregate in-flight and global-wait count so a regression is
   visible during a run rather than after it.

## Testing and verification

- Unit: cwnd AIMD math (growth takes `cwnd` successes; a 429 halves; floor 1, ceiling 8); semaphore
  admission order under contention prefers the larger backlog; gap enforcement still spaces
  same-host dispatches.
- `node test-all.mjs`. Current baseline is **311 passed, 5 failed** — the 5 are pre-existing
  hardcoded-absolute-path failures in `extract-script.mjs`, unrelated to this work. Do not count them
  as regressions, and do not let them mask new ones.
- Integration: `scan.mjs --provider greenhouse` on a bounded slice, checking that per-host request
  spacing still respects the gap and that 429 counts do not rise.
- Full-run comparison against the baseline above. Success criteria: the per-minute completion rate
  stays roughly flat instead of decaying 374→77, total 429s do not increase, and `globalWaits` is
  zero for shared-host ATS hosts.

## Risks

- **Higher aggregate concurrency provokes more 429s.** This is the main behavioural risk, and the
  reason cwnd starts at 2 with a ceiling of 8 rather than opening wide. The AIMD is the control; the
  full-run 429 comparison is the check.
- **cwnd cannot learn on singleton hosts.** ~6,000 Workday tenants have exactly one item each, so
  their window never moves off its initial value. Dynamic concurrency is effectively a
  Greenhouse/Ashby/Lever/SmartRecruiters feature. That is fine — those are the only hosts where it
  matters — but it means the *initial* cwnd governs the majority of hosts and should stay
  conservative.
- **Memory: one `PQueue` per host, ~6,000 instances.** No regression; `hostGates` already retains
  ~6,000 gate objects today. `Bottleneck.Group` would reap idle keys automatically, `p-queue` will
  not, so add reaping only if measurement shows it matters.
- **Rollback.** Steps 3–6 are separable commits; each can be reverted independently. Keeping step 3
  behaviour-neutral means a bisect can distinguish "the queue swap broke it" from "the dynamic
  concurrency broke it".

## Open question

Whether to take the `p-queue` dependency at all, given the provenance gap and the blast radius, or
to write the ~60-line per-key queue in-house and stay at zero dependencies. Needs a decision before
step 2.

Resolved: took `p-queue`, pinned exactly, lockfile committed. Resolved tree is the predicted three
packages. `package-lock.json` had to be removed from `.gitignore` to make that pinning meaningful.

## As built

Three deviations from the plan above, all found during implementation or validation.

### 1. Per-host groups run FANOUT companies at a time, not one

The plan said each host's chain could be sequential, on the reasoning that per-host request
concurrency already comes from `cwnd`. That was wrong, and the single-company smoke test showed it:
`peak in-flight 1`. A company's own requests are awaited in sequence (pagination, then one search
term after another), so with one company in flight per host, a host holds exactly one request at a
time. The window would never have more than one request to admit — `cwnd` would be dead code — and
Greenhouse's ~6.4k companies would drain single-file at roughly a second each, about 107 minutes,
*worse* than the shared FIFO being replaced.

Each host now runs `HOST_FANOUT` companies concurrently, defaulting to `CWND_MAX`. Fanout does not
need tuning for politeness: it only decides how much work is offered to a host, while the host's own
window and gap decide how much is dispatched. Offering more than `CWND_MAX` cannot help.

### 2. Backlog rides on the request instead of being keyed by host

`setHostBacklog(host, n)` would have filed the backlog under the wrong gate. Companies are
partitioned by their `careers_url` host, but requests may go to a different API host
(`job-boards.greenhouse.io` vs `boards-api.greenhouse.io`), so the declared key and the key requests
actually use are not the same string. The backlog is now a parameter on `makeHttpCtx`, carried
through `fetchWithTimeout` into `schedule()`, so it always reaches the gate that arbitrates.

### 3. A Workday pagination bug, found while validating

Unrelated to scheduling, but it neutered the ceiling raise committed earlier the same day. Workday
reports `total` on the FIRST page of a search and then sends `total: 0` on every page after it. The
loop's break test compared against that per-page value, so on page two `offset + PAGE_SIZE >= total`
was `40 >= 0` — trivially true. **Every Workday board stopped at 40 postings**, no matter whether the
ceiling was 100 or 2000. The sticky `reportedTotal` was already being tracked but was only used for
the warning, not the break.

Fixed by treating a short page as the end-of-results signal and using `reportedTotal` for the
early-stop shortcut. On Autodesk alone this took the scan from 149 to 341 jobs found and surfaced 15
new postings that the cap had been hiding.

### Measured result

Greenhouse in isolation (`--dry-run --provider greenhouse`): 2,650 companies in ~400s, about **400
companies/min**, with `429:0` and `gwait:0`. In-flight sat at 1–4, which is the 150ms gap floor
binding rather than the window — i.e. that host is running at its configured maximum rate. The
pre-change baseline was 374/min at the very start of a run decaying to 77/min for the entire scan.

Test suite: 322 passed, 5 failed. The 5 are the pre-existing hardcoded-absolute-path failures in
`extract-script.mjs`, unchanged from the 311/5 baseline. The 11 new tests are section 27.

### Not yet done

A full production run has not been made against the new scheduler — the pre-change scan was still
running throughout this work, and starting a second full scan would have double-hit every host.
Validation was a single-company dry run plus a bounded Greenhouse provider slice. The success
criteria in "Testing and verification" that need a full run — flat per-minute rate, no rise in total
429s, `globalWaits` zero for shared-host ATS — remain to be confirmed.
