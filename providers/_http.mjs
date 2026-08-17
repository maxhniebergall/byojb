// HTTP transport helpers shared across providers.
// Files prefixed with _ are never loaded as providers by scan.mjs.
//
// Rate-limit resilience
// ─────────────────────
// The scanner tracks 1000s of companies but most of them are hosted on a
// handful of shared ATS hosts (boards-api.greenhouse.io, api.ashbyhq.com,
// api.lever.co, …). Blasting those hosts with the scan-level concurrency
// gets us throttled (HTTP 429). Two mechanisms defend against that:
//   1. Per-host scheduling — adaptive concurrency and spacing per host, plus a
//      global socket ceiling. Lives in _host-scheduler.mjs.
//   2. Retry-with-backoff on 429/503, honoring the Retry-After header.
// Both are tunable via env vars so a run against a stubborn host can be slowed
// down without code changes.
//
// This file owns the retry/timeout policy; the scheduler owns pacing. Keeping them
// apart matters because they operate at different granularities: ONE fetchJson call
// may make up to MAX_RETRIES attempts, and each attempt is scheduled separately, so
// a retry waits its turn behind other traffic to that host instead of jumping it.

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; byojb/1.3)';

import { schedule, penalizeHost, rewardHost, hostOf } from './_host-scheduler.mjs';

export { schedulerSnapshot, hostState, resetScheduler } from './_host-scheduler.mjs';

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Tunables (env-overridable). Per-host pacing constants live in _host-scheduler.mjs
// alongside the code that applies them.
const MAX_RETRIES = envInt('BYOJB_HTTP_MAX_RETRIES', 8);         // retry attempts on 429/503
const RETRY_BASE_MS = envInt('BYOJB_HTTP_RETRY_BASE_MS', 750);   // base for exponential backoff
const RETRY_MAX_MS = envInt('BYOJB_HTTP_RETRY_MAX_MS', 30_000);  // cap for a single backoff wait

const RETRYABLE_STATUS = new Set([429, 503]);

// Absolute ceiling on one fetchJson/fetchText call across ALL its scheduling waits
// and retries. A hard guarantee that a single company can never wedge the run.
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
  // Derive the host HERE. `host` lives in fetchWithTimeout's scope, and referencing it from this
  // function threw a ReferenceError on the 429 path — replacing the retryable error with a
  // programming error, which short-circuited the entire retry loop. A whole scan reported
  // "2223 rate-limited, 0 retries, 0 gave up": the zero was the tell.
  const host = hostOf(url);
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

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, method = 'GET', body = null, redirect = 'follow', backlog = 0 } = {}) {
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
    try {
      // The scheduler releases this attempt's host and global slots as soon as the
      // fetch settles, so a retry's backoff below is never spent holding either.
      const res = await schedule(host, () => withHardTimeout(
        doFetch(url, { timeoutMs, headers, method, body, redirect }),
        timeoutMs + 5000,
      ), backlog);
      rewardHost(host);
      return res;
    } catch (err) {
      lastErr = err;
      const retryable = RETRYABLE_STATUS.has(err.status);
      if (!retryable || attempt === MAX_RETRIES) {
        if (retryable) httpStats.failures++;
        throw err;
      }
    }
    // Retryable failure: slow the whole host, then back off before retrying.
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

// `backlog` is how many companies remain on this company's host. It rides along on every
// request so the global ceiling, if it is ever contended, admits the hosts on the critical
// path first. Providers pass their own opts, which must not be able to drop it.
export function makeHttpCtx({ backlog = 0 } = {}) {
  return {
    transport: 'http',
    fetchJson: (url, opts = {}) => fetchJson(url, { ...opts, backlog }),
    fetchText: (url, opts = {}) => fetchText(url, { ...opts, backlog }),
  };
}
