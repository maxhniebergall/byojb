// HTTP transport helpers shared across providers.
// Files prefixed with _ are never loaded as providers by scan.mjs.
//
// Rate-limit resilience
// ─────────────────────
// The scanner tracks 1000s of companies but most of them are hosted on a
// handful of shared ATS hosts (boards-api.greenhouse.io, api.ashbyhq.com,
// api.lever.co, …). Blasting those hosts with the scan-level concurrency
// gets us throttled (HTTP 429). Two mechanisms defend against that:
//   1. A per-host gate that caps in-flight requests to a host and enforces a
//      minimum gap between request starts on that host.
//   2. Retry-with-backoff on 429/503, honoring the Retry-After header.
// Both are tunable via env vars so a run against a stubborn host can be slowed
// down without code changes.

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; byojb/1.3)';

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Tunables (env-overridable).
const MAX_PER_HOST = envInt('BYOJB_HTTP_HOST_CONCURRENCY', 3);   // in-flight requests per host
const MIN_HOST_GAP_MS = envInt('BYOJB_HTTP_HOST_GAP_MS', 150);   // floor for the adaptive per-host gap
const MAX_HOST_GAP_MS = envInt('BYOJB_HTTP_HOST_GAP_MAX_MS', 8000); // ceiling for the adaptive gap
const MAX_RETRIES = envInt('BYOJB_HTTP_MAX_RETRIES', 8);         // retry attempts on 429/503
const RETRY_BASE_MS = envInt('BYOJB_HTTP_RETRY_BASE_MS', 750);   // base for exponential backoff
const RETRY_MAX_MS = envInt('BYOJB_HTTP_RETRY_MAX_MS', 30_000);  // cap for a single backoff wait

const RETRYABLE_STATUS = new Set([429, 503]);

// AIMD (additive-increase / multiplicative-decrease-of-rate) constants.
// On a 429 the host gap is multiplied (slow down); on each success it decays
// (speed back up). Decay is brisk so one 429 burst doesn't park the host at the
// ceiling for the rest of a long run.
// A 429 multiplies the gap; a success SHRINKS IT ADDITIVELY. That asymmetry is the whole point of
// AIMD and it was missing: decay was multiplicative at 0.75, so two successes (0.75^2 = 0.56) more
// than undid one 429's 1.5x penalty. Because successes vastly outnumber 429s on any given host,
// the gap collapsed to the floor within a few requests and we slammed the host again — a full scan
// logged 19,804 rate-limited responses against 22,767 successes, and throughput fell from 900
// companies/min to 25 as the run degenerated into retry churn.
//
// Multiplicative back-off, additive recovery: the gap now rises fast under pressure and returns to
// the floor slowly, so a host settles at a sustainable rate instead of oscillating around it.
const GAP_GROWTH = 2.0;          // multiply gap by this on a 429 — back off hard
const GAP_RECOVERY_MS = envInt('BYOJB_HTTP_GAP_RECOVERY_MS', 8);  // shave this per success
// Hard ceiling on how long a single request may wait for its host slot. Without
// this, nextStart/cooldown accumulation on a saturated host (thousands queued)
// parks workers for minutes and the run appears to stall. Capping guarantees
// forward progress; over-eager fires are re-throttled reactively by 429→cooldown.
const MAX_SLOT_WAIT_MS = envInt('BYOJB_HTTP_MAX_SLOT_WAIT_MS', 20_000);
// Absolute ceiling on one fetchJson/fetchText call across ALL its slot waits and
// retries. A hard guarantee that a single company can never wedge its worker.
const OVERALL_DEADLINE_MS = envInt('BYOJB_HTTP_OVERALL_DEADLINE_MS', 120_000);

// Live counters so the scanner can surface throttling in its progress line —
// mid-run 429s are otherwise invisible (they're retried, not logged).
export const httpStats = { requests: 0, rateLimited: 0, retries: 0, failures: 0, byHost: new Map() };

// Per-host counters. Without these a run reports 19,804 rate-limited responses and no way to tell
// whether that was one strict host or every host — which is the difference between a tuning problem
// and a concurrency problem.
function noteHost(host, field) {
  let h = httpStats.byHost.get(host);
  if (!h) { h = { requests: 0, rateLimited: 0 }; httpStats.byHost.set(host, h); }
  h[field]++;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Per-host gate ───────────────────────────────────────────────────
// One record per host: how many requests are in flight, the earliest time the
// next request may start (advanced by MIN_HOST_GAP_MS on each dispatch), and a
// FIFO queue of waiters when we're at the concurrency cap.
const hostGates = new Map();

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url; // fall back to the raw string; still gives per-target grouping
  }
}

function getGate(host) {
  let gate = hostGates.get(host);
  if (!gate) {
    // `gap` is the adaptive per-host spacing; it grows on 429 and decays on
    // success. `cooldownUntil` is a hard floor applied to every request start
    // after a 429, so the whole host — not just the failing request — pauses.
    gate = { inFlight: 0, nextStart: 0, waiters: [], gap: MIN_HOST_GAP_MS, cooldownUntil: 0 };
    hostGates.set(host, gate);
  }
  return gate;
}

// Acquire a slot for `host`, respecting the concurrency cap, the current
// adaptive gap, and any host-wide cooldown. Returns once it's safe to fire.
//
// The wait for a free slot is BOUNDED (MAX_SLOT_WAIT_MS): if a slot never frees
// — e.g. inFlight bookkeeping drifts under extreme same-host saturation — the
// worker proceeds anyway rather than blocking forever. Over-subscribing a host
// briefly is harmless (a 429 just gets retried); a permanent stall is not.
async function acquireHostSlot(host) {
  const gate = getGate(host);
  if (gate.inFlight >= MAX_PER_HOST) {
    let resolver;
    const waited = new Promise(resolve => { resolver = resolve; gate.waiters.push(resolve); });
    let timer;
    const timeout = new Promise(r => { timer = setTimeout(r, MAX_SLOT_WAIT_MS); timer.unref?.(); });
    await Promise.race([waited, timeout]);
    clearTimeout(timer);
    // Drop our resolver if we bailed on the timeout, so a later release doesn't
    // spend its wakeup on a waiter that has already moved on.
    const idx = gate.waiters.indexOf(resolver);
    if (idx !== -1) gate.waiters.splice(idx, 1);
  }
  gate.inFlight++;
  const now = Date.now();
  // Bound how far ahead we schedule so accumulated gap/cooldown can never park a
  // worker indefinitely — progress is guaranteed within MAX_SLOT_WAIT_MS.
  const startAt = Math.min(Math.max(now, gate.nextStart, gate.cooldownUntil), now + MAX_SLOT_WAIT_MS);
  gate.nextStart = startAt + gate.gap;
  const wait = startAt - now;
  if (wait > 0) await sleep(wait);
}

function releaseHostSlot(host) {
  const gate = getGate(host);
  gate.inFlight--;
  const next = gate.waiters.shift();
  if (next) next();
}

// Slow the whole host down after a 429/503: widen the adaptive gap and impose
// a shared cooldown so queued/in-flight requests also wait out `waitMs`.
function penalizeHost(host, waitMs) {
  const gate = getGate(host);
  gate.gap = Math.min(gate.gap * GAP_GROWTH, MAX_HOST_GAP_MS);
  gate.cooldownUntil = Math.max(gate.cooldownUntil, Date.now() + waitMs);
}

// A clean response nudges the host's gap back down toward the floor — ADDITIVELY, so recovery is
// gradual and one burst of successes cannot erase a host's learned rate limit.
function rewardHost(host) {
  const gate = getGate(host);
  gate.gap = Math.max(MIN_HOST_GAP_MS, gate.gap - GAP_RECOVERY_MS);
}

// Parse Retry-After (delta-seconds or HTTP-date). Returns ms, or null.
function parseRetryAfter(res) {
  const raw = res?.headers?.get?.('retry-after');
  if (!raw) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(raw);
  if (Number.isFinite(when)) return Math.max(0, when - Date.now());
  return null;
}

function backoffMs(attempt, retryAfterMs) {
  // Honor server guidance when present; otherwise exponential backoff with jitter.
  if (retryAfterMs != null) return Math.min(retryAfterMs, RETRY_MAX_MS);
  const exp = RETRY_BASE_MS * 2 ** attempt;
  const jitter = Math.random() * RETRY_BASE_MS;
  return Math.min(exp + jitter, RETRY_MAX_MS);
}

async function doFetch(url, { timeoutMs, headers, method, body, redirect }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'user-agent': DEFAULT_USER_AGENT, ...headers },
      body,
      redirect,
      signal: controller.signal,
    });
    if (!res.ok) {
      const responseText = await res.text().catch(() => '');
      const snippet = responseText.replace(/\s+/g, ' ').trim().slice(0, 300);
      const err = new Error(snippet ? `HTTP ${res.status}: ${snippet}` : `HTTP ${res.status}`);
      err.status = res.status;
      err.body = responseText;
      err.retryAfterMs = parseRetryAfter(res);
      if (RETRYABLE_STATUS.has(res.status)) { httpStats.rateLimited++; noteHost(host, 'rateLimited'); }
      throw err;
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Hard watchdog: guarantees settlement even if fetch's AbortController never
// fires (observed with some Cloudflare-fronted hosts, where a stuck request
// otherwise holds its per-host slot forever and stalls the whole run). Races
// the fetch against a timer that rejects `graceMs` after the abort deadline.
function withHardTimeout(promise, ms) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`hard timeout after ${ms}ms (request did not abort)`);
      e.status = 0; // non-retryable — treat as a dead host, retry next scan
      reject(e);
    }, ms);
    timer.unref?.(); // don't keep the process alive on this timer alone
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, method = 'GET', body = null, redirect = 'follow' } = {}) {
  const host = hostOf(url);
  let lastErr;
  httpStats.requests++;
  noteHost(host, 'requests');
  const deadline = Date.now() + OVERALL_DEADLINE_MS;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (Date.now() >= deadline) {
      const e = lastErr || new Error(`overall deadline exceeded (${OVERALL_DEADLINE_MS}ms)`);
      throw e;
    }
    await acquireHostSlot(host);
    try {
      const res = await withHardTimeout(
        doFetch(url, { timeoutMs, headers, method, body, redirect }),
        timeoutMs + 5000,
      );
      rewardHost(host);
      return res;
    } catch (err) {
      lastErr = err;
      const retryable = RETRYABLE_STATUS.has(err.status);
      if (!retryable || attempt === MAX_RETRIES) {
        if (retryable) httpStats.failures++;
        throw err;
      }
    } finally {
      releaseHostSlot(host);
    }
    // Retryable failure: slow the whole host, then back off before retrying.
    // The slot is released first so we don't hold it idle while waiting.
    httpStats.retries++;
    const wait = backoffMs(attempt, lastErr?.retryAfterMs);
    penalizeHost(host, wait);
    await sleep(wait);
  }
  throw lastErr;
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  return await res.json();
}

export async function fetchText(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  return await res.text();
}

export function makeHttpCtx() {
  return {
    transport: 'http',
    fetchJson,
    fetchText,
  };
}
