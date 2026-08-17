// Per-host request scheduling for the scanner.
//
// Why this is its own module
// ─────────────────────────
// The scanner tracks 1000s of companies, but they are not spread evenly across hosts. Workday
// gives every tenant its own hostname (~6k hosts of one company each) while Greenhouse, Ashby and
// Lever put thousands of companies behind a single hostname. So "be polite to each host" and
// "keep the run busy" are two different problems, and the second one used to be solved by
// ordering the work list — which cannot work, because the sustainable rate for a host is
// discovered at runtime, not known when the list is built.
//
// The shape here is the standard one for the problem: ONE QUEUE PER HOST, each with its own
// concurrency limit and its own minimum spacing, plus a global ceiling that exists only to bound
// resource use. A saturated host then delays its own queue and nothing else.
//
// Three levels, acquired in this order (and released in reverse), which is what keeps it
// deadlock-free — nothing ever waits on a host slot while holding a global one:
//
//   1. a slot in the host's queue        — bounds concurrency per host  (adaptive, see cwnd)
//   2. the host's minimum gap + cooldown — bounds request RATE per host (adaptive, see gap)
//   3. a slot in the global semaphore    — bounds total sockets, nothing more
//
// The gap is waited out BEFORE taking a global slot. A request sleeping off its host's spacing
// must not occupy global capacity that another host could be using.

import PQueue from 'p-queue';

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// ── Per-host rate (the gap) ─────────────────────────────────────────
// AIMD (additive-increase / multiplicative-decrease-of-rate). On a 429 the gap is multiplied
// (slow down); on each success it decays (speed back up).
//
// A 429 multiplies the gap; a success SHRINKS IT ADDITIVELY. That asymmetry is the whole point of
// AIMD and it was once missing: decay was multiplicative at 0.75, so two successes (0.75^2 = 0.56)
// more than undid one 429's 1.5x penalty. Because successes vastly outnumber 429s on any given
// host, the gap collapsed to the floor within a few requests and we slammed the host again — a
// full scan logged 19,804 rate-limited responses against 22,767 successes, and throughput fell
// from 900 companies/min to 25 as the run degenerated into retry churn.
//
// Multiplicative back-off, additive recovery: the gap rises fast under pressure and returns to the
// floor slowly, so a host settles at a sustainable rate instead of oscillating around it.
const MIN_HOST_GAP_MS = envInt('BYOJB_HTTP_HOST_GAP_MS', 150);       // floor for the adaptive gap
const MAX_HOST_GAP_MS = envInt('BYOJB_HTTP_HOST_GAP_MAX_MS', 8000);  // ceiling for the adaptive gap
const GAP_GROWTH = 2.0;                                             // multiply gap on a 429
const GAP_RECOVERY_MS = envInt('BYOJB_HTTP_GAP_RECOVERY_MS', 8);     // shave per success

// ── Per-host concurrency (the congestion window) ────────────────────
// This replaced a fixed cap of 3 in-flight per host. A constant cannot be right for every host:
// too low wastes a fast host's headroom, too high pushes a strict one into 429s. So the window
// follows the same AIMD discipline as the gap — additive increase, multiplicative decrease — and
// each host discovers its own sustainable concurrency.
//
// Increase is `+= 1/cwnd`, so it takes cwnd consecutive successes to gain one slot: opening up is
// deliberately slower the wider the window already is.
//
// Note what bounds the payoff. Effective per-host rate is min(cwnd / latency, 1000 / gap), so
// growing cwnd past latency * 1000 / gap buys nothing — the gap binds instead. The two knobs are
// not redundant: a slow host is concurrency-limited, a fast one is rate-limited.
//
// The initial value matters more than it looks. ~6k Workday tenants hold exactly one company
// each, and a host with one company never gets the repeat successes the window needs to grow, so
// for most hosts CWND_INIT *is* the concurrency for the whole run. Keep it conservative.
const CWND_INIT = envInt('BYOJB_HTTP_CWND_INIT', 2);
const CWND_MIN = 1;
const CWND_MAX = envInt('BYOJB_HTTP_CWND_MAX', 8);

// ── Global ceiling ──────────────────────────────────────────────────
// A guardrail on sockets and memory, NOT a throttle. Total demand is the sum of every active
// host's window, and during the Workday stretch that is thousands of concurrent requests, so some
// ceiling is required.
//
// It must not bind in normal operation, and the reason is subtle: a contended global semaphore
// re-couples the hosts this module exists to decouple. If Greenhouse ever waits on the global cap
// it is waiting behind Workday, which is the head-of-line blocking we removed, rebuilt one layer
// up. Two consequences, both implemented below:
//
//   • Admission under contention is by REMAINING BACKLOG, so a host with thousands of companies
//     left is never queued behind thousands of one-company hosts. This is the only place bucket
//     depth legitimately enters scheduling — a tiebreak on a contended semaphore.
//     The backlog travels WITH the request rather than being attached to a host key, because the
//     two are not the same string: companies are partitioned by their careers_url host, but the
//     request may go to a different API host (job-boards.greenhouse.io vs boards-api.greenhouse.io).
//     Keying the backlog by host would silently file it under a gate no request ever uses.
//   • `globalWaits` counts acquisitions that actually had to wait. Report it. A non-zero count for
//     a shared-host ATS means the ceiling is throttling and needs raising, and without the counter
//     "it never binds in practice" is an assumption rather than a measurement.
const GLOBAL_MAX = envInt('BYOJB_HTTP_GLOBAL_MAX', 256);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const schedulerStats = { globalWaits: 0, globalPeak: 0 };

// ── Waiter heap: max-heap on backlog, FIFO within equal backlog ──────
// A plain array scanned for the maximum would be O(n) per release with n up to the number of
// waiting requests (thousands during the Workday stretch), on every single completion.
class WaiterHeap {
  #a = [];
  #seq = 0;

  // Is x lower priority than y? Larger backlog wins; ties go to whoever queued first, so equal
  // hosts stay FIFO instead of starving by insertion order.
  #lower(x, y) {
    if (x.backlog !== y.backlog) return x.backlog < y.backlog;
    return x.seq > y.seq;
  }

  push(backlog, resolve) {
    const a = this.#a;
    a.push({ backlog, seq: this.#seq++, resolve });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.#lower(a[p], a[i])) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.#a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.#lower(a[m], a[l])) m = l;
        if (r < a.length && this.#lower(a[m], a[r])) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }

  get size() { return this.#a.length; }
}

let globalInFlight = 0;
let globalWaiters = new WaiterHeap();

// The slot is TRANSFERRED to a waiter rather than released and re-acquired. If release decremented
// the counter and then woke a waiter, the wake-up is a microtask, so a caller hitting the fast path
// synchronously in between could take the freed slot and push in-flight over the ceiling. Handing
// the slot over directly keeps the count exact.
async function acquireGlobal(backlog) {
  if (globalInFlight < GLOBAL_MAX && globalWaiters.size === 0) {
    globalInFlight++;
    if (globalInFlight > schedulerStats.globalPeak) schedulerStats.globalPeak = globalInFlight;
    return;
  }
  schedulerStats.globalWaits++;
  await new Promise(resolve => globalWaiters.push(backlog, resolve));
  // A slot was handed to us; globalInFlight already accounts for it.
}

function releaseGlobal() {
  const next = globalWaiters.pop();
  if (next) { next.resolve(); return; }  // transfer, count unchanged
  globalInFlight--;
}

// ── Per-host gates ──────────────────────────────────────────────────
const gates = new Map();

export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url; // fall back to the raw string; still gives per-target grouping
  }
}

function getGate(host) {
  let gate = gates.get(host);
  if (!gate) {
    gate = {
      queue: new PQueue({ concurrency: Math.max(CWND_MIN, Math.round(CWND_INIT)) }),
      cwnd: CWND_INIT,
      gap: MIN_HOST_GAP_MS,
      nextStart: 0,      // earliest time the next request to this host may start
      cooldownUntil: 0,  // hard host-wide floor applied after a 429
    };
    gates.set(host, gate);
  }
  return gate;
}

function applyCwnd(gate) {
  gate.queue.concurrency = Math.max(CWND_MIN, Math.round(gate.cwnd));
}

// Run `fn` under this host's concurrency limit, spacing and the global ceiling.
// `backlog` is how much work remains behind this request; it only matters if the global
// ceiling is contended, where higher goes first.
export function schedule(host, fn, backlog = 0) {
  const gate = getGate(host);
  return gate.queue.add(async () => {
    // Spacing and cooldown, waited out before we hold anything global.
    //
    // There is deliberately no ceiling on this wait, unlike the version this replaced. That code
    // let every worker pile into the gate at once, each one pushing nextStart further out, so
    // accumulated spacing could park a worker for minutes and a 20s escape hatch was needed to
    // guarantee progress. Only `concurrency` requests per host can be in this phase now, so
    // nextStart cannot run away from the clock, and cooldownUntil is bounded by the retry backoff
    // cap. Two mechanisms disagreeing about who holds a slot was the bug, not the fix.
    const now = Date.now();
    const startAt = Math.max(now, gate.nextStart, gate.cooldownUntil);
    gate.nextStart = startAt + gate.gap;
    const wait = startAt - now;
    if (wait > 0) await sleep(wait);

    await acquireGlobal(backlog);
    try {
      return await fn();
    } finally {
      releaseGlobal();
    }
  });
}

// Slow the whole host down after a 429/503: widen the gap, halve the window, and impose a shared
// cooldown so queued requests also wait out `waitMs` rather than only the one that was refused.
export function penalizeHost(host, waitMs) {
  const gate = getGate(host);
  gate.gap = Math.min(gate.gap * GAP_GROWTH, MAX_HOST_GAP_MS);
  gate.cooldownUntil = Math.max(gate.cooldownUntil, Date.now() + waitMs);
  gate.cwnd = Math.max(CWND_MIN, gate.cwnd / 2);
  applyCwnd(gate);
}

// A clean response nudges the gap down toward the floor and opens the window slightly. Both
// recoveries are additive, so one burst of successes cannot erase a host's learned limit.
export function rewardHost(host) {
  const gate = getGate(host);
  gate.gap = Math.max(MIN_HOST_GAP_MS, gate.gap - GAP_RECOVERY_MS);
  gate.cwnd = Math.min(CWND_MAX, gate.cwnd + 1 / gate.cwnd);
  applyCwnd(gate);
}

export function hostState(host) {
  const gate = gates.get(host);
  if (!gate) return null;
  return {
    cwnd: gate.cwnd,
    concurrency: gate.queue.concurrency,
    gap: gate.gap,
    pending: gate.queue.pending,
    queued: gate.queue.size,
  };
}

export function schedulerSnapshot() {
  let queued = 0;
  let pending = 0;
  for (const gate of gates.values()) {
    queued += gate.queue.size;
    pending += gate.queue.pending;
  }
  return {
    hosts: gates.size,
    inFlight: globalInFlight,
    queued,
    pending,
    globalWaits: schedulerStats.globalWaits,
    globalPeak: schedulerStats.globalPeak,
    globalMax: GLOBAL_MAX,
  };
}

// Tests only: drop all learned state so one case cannot leak a widened gap into the next.
export function resetScheduler() {
  gates.clear();
  globalInFlight = 0;
  globalWaiters = new WaiterHeap();
  schedulerStats.globalWaits = 0;
  schedulerStats.globalPeak = 0;
}

export const schedulerTunables = {
  MIN_HOST_GAP_MS, MAX_HOST_GAP_MS, GAP_GROWTH, GAP_RECOVERY_MS,
  CWND_INIT, CWND_MIN, CWND_MAX, GLOBAL_MAX,
};
