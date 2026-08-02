#!/usr/bin/env node
// probe-boards.mjs — ask each empty board whether it still EXISTS.
//
// The scan ledger records jobs_found, which collapses two very different states into one zero:
//
//   EMPTY — the board answers normally and lists no openings. A real employer between hires
//           (37signals, Grayscale and Carbon Health all return HTTP 200 with an empty array).
//           It will hire again; skipping it is a temporary, reversible optimisation.
//   GONE  — the board is not there: 404, 410, or the host does not resolve. The company moved ATS
//           (Tailscale left BambooHR for Greenhouse) or the slug was never theirs. Re-probing it
//           forever is pure waste, and it should be retired, not merely paused.
//
// Only a live request can tell these apart, so this classifies each board once and writes the
// verdict to data/board-probe.tsv for board-health.mjs to consume. It reuses each provider's own
// detect() to build the URL, so it stays correct as providers change.
//
//   node probe-boards.mjs --empty-only [--limit N]   # probe boards the ledger says are empty
//   node probe-boards.mjs --all --limit 200
//
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadScanHistory } from './board-health.mjs';
import { makeHttpCtx } from './providers/_http.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const C_PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');
export const PROBE_PATH = join(ROOT, 'data', 'board-probe.tsv');

function loadJsonl(p) {
  const out = [];
  if (!existsSync(p)) return out;
  for (const l of readFileSync(p, 'utf-8').split('\n')) if (l) try { out.push(JSON.parse(l)); } catch {}
  return out;
}

// Probe by running the provider's OWN fetch() and counting what comes back.
//
// The first attempt reconstructed each provider's API URL from detect(), which returns the human
// board URL for several providers — so 148 of 200 probes read HTML and classified as "unknown".
// Driving the real fetch() removes that whole class of error: whatever the scanner would see, the
// probe sees, and it cannot drift when a provider changes its endpoints.
async function providerFor(entry) {
  const id = String(entry.provider || '').toLowerCase();
  if (!id || id === 'local-parser') return null;
  try { return (await import(join(ROOT, 'providers', `${id}.mjs`))).default || null; } catch { return null; }
}

// Use the scanner's own HTTP context, not a hand-rolled one. My first version supplied only
// fetchJson, so every provider needing fetchText failed with "ctx.fetchText is not a function" --
// 116 of 200 probes, which would have been read as 116 broken boards. The probe must run the
// provider exactly as the scanner does or its verdicts are about the probe, not the board.

// Per-host pacing. Global concurrency is the wrong lever: at 8 workers we still sent every Ashby
// request to one host, and Ashby 429'd 105 of 600 probes while every other provider was fine.
// Rate limits are enforced per host, so spacing must be too — this lets unrelated hosts stay fully
// parallel while a strict host is queued behind a minimum gap.
// Ashby is markedly stricter than the rest: at a 350ms gap it still 429'd 49 of 326. Rather than
// slow every host to its pace, give the strict ones their own. Measured, not guessed — each value
// is the gap at which that host stopped returning 429.
const HOST_GAP_MS = 350;
const HOST_GAP_OVERRIDE = [[/ashbyhq\.com$/i, 1200]];
const gapFor = (host) => (HOST_GAP_OVERRIDE.find(([re]) => re.test(host))?.[1]) ?? HOST_GAP_MS;
const lastHit = new Map();
async function pace(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return; }
  const gap = gapFor(host);
  const prev = lastHit.get(host) || 0;
  const wait = prev + gap - Date.now();
  // Reserve this slot BEFORE awaiting, so concurrent callers queue behind each other rather than
  // all reading the same stale timestamp and firing together.
  lastHit.set(host, Math.max(Date.now(), prev + gap));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

// Only an unambiguous "not there" counts as GONE. A 403 means we were blocked, which says nothing
// about whether the employer exists — BambooHR 403s automated agents while serving its JSON fine,
// and treating that as gone would retire live boards.
//
// EXISTENCE is all this needs to establish, and that is one cheap request. Running each provider's
// full fetch() instead cost 7 paginated searches per Workday board and ran at 9 boards/minute --
// 54 hours for the registry. It also conflated two questions: whether the board is THERE, and
// whether it currently lists jobs. The scan ledger already answers the second one every run.
// So probe for existence by default, and only count jobs when explicitly asked.
export async function probeCompany(entry, { countJobs = false } = {}) {
  const provider = await providerFor(entry);
  if (!provider) return { state: 'no-provider', detail: String(entry.provider || '') };

  if (!countJobs) {
    const url = provider.detect?.(entry)?.url || entry.careers_url;
    if (!url) return { state: 'no-provider', detail: 'no url' };
    try {
      // 429 is OUR fault, not the board's — at concurrency 24 we rate-limited ourselves on 154 of
      // 600 probes. Back off once and retry rather than recording a verdict about a board we never
      // actually reached; an unclassified board is fine, a wrongly-classified one is not.
      let res;
      for (let attempt = 0; attempt < 2; attempt++) {
        await pace(url);
        res = await fetch(url, {
          headers: { accept: 'application/json, text/html', 'user-agent': 'byojb/1.0' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        if (res.status !== 429) break;
        await new Promise(r => setTimeout(r, 1500 + attempt * 2000));
      }
      if (res.status === 404 || res.status === 410) return { state: 'gone', detail: `HTTP ${res.status}` };
      if (res.status === 401 || res.status === 403) return { state: 'blocked', detail: `HTTP ${res.status}` };
      if (!res.ok) return { state: 'error', detail: `HTTP ${res.status}` };
      return { state: 'exists', detail: `HTTP ${res.status}` };
    } catch (e) {
      const msg = String(e?.message || e);
      if (/ENOTFOUND|getaddrinfo|ERR_NAME|DNS/i.test(msg)) return { state: 'gone', detail: 'DNS' };
      if (/timeout|aborted/i.test(msg)) return { state: 'error', detail: 'timeout' };
      return { state: 'error', detail: msg.slice(0, 44) };
    }
  }

  try {
    const jobs = await provider.fetch(entry, makeHttpCtx());
    const n = Array.isArray(jobs) ? jobs.length : 0;
    return n > 0 ? { state: 'alive', detail: `${n} jobs` } : { state: 'empty', detail: '0 jobs' };
  } catch (e) {
    const msg = String(e?.message || e);
    const status = e?.status || Number((msg.match(/HTTP (\d{3})/) || [])[1]) || 0;
    if (status === 404 || status === 410) return { state: 'gone', detail: `HTTP ${status}` };
    if (status === 403 || status === 401) return { state: 'blocked', detail: `HTTP ${status}` };
    if (/ENOTFOUND|getaddrinfo|ERR_NAME|DNS/i.test(msg)) return { state: 'gone', detail: 'DNS' };
    if (/timeout|aborted/i.test(msg)) return { state: 'error', detail: 'timeout' };
    return { state: 'error', detail: msg.slice(0, 44) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
  const emptyOnly = args.includes('--empty-only');
  const countJobs = args.includes('--count-jobs');

  const hist = loadScanHistory();
  const seen = new Set();
  const targets = [];
  for (const c of loadJsonl(C_PERSONAL)) {
    if (!c?.key || seen.has(c.key)) continue;
    seen.add(c.key);
    if (emptyOnly) {
      const h = hist.get(c.name);
      if (!h || h.maxJobs > 0) continue;      // never scanned, or has produced jobs → not our subject
    }
    targets.push(c);
  }
  // Probe what matters first. A broken board costs us in proportion to the company behind it:
  // dbt Labs (llm_fit 5) being 404 hides a whole employer we rated top-tier, while an unranked
  // slug nobody has looked at costs nothing until someone does. A truncated run should therefore
  // have covered the valuable boards, not an alphabetical prefix.
  const weight = (c) => (c.llm_fit != null ? 2 : 0) + (c.llm_rank != null ? 1 : 0);
  targets.sort((a, b) => weight(b) - weight(a) || String(a.key).localeCompare(String(b.key)));
  if (targets.length > limit) targets.length = limit;
  console.error(`probing ${targets.length} board(s)…`);

  if (!existsSync(PROBE_PATH)) writeFileSync(PROBE_PATH, 'key\tprobed_at\tstate\tdetail\n', 'utf-8');
  const stamp = new Date().toISOString();
  const counts = {};
  let done = 0;
  const CONC = 12;
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const c = targets[idx++];
      const r = await probeCompany(c, { countJobs });
      counts[r.state] = (counts[r.state] || 0) + 1;
      appendFileSync(PROBE_PATH, `${c.key}\t${stamp}\t${r.state}\t${r.detail}\n`);
      if (++done % 50 === 0) console.error(`  ${done}/${targets.length} ${JSON.stringify(counts)}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.error(`\ndone: ${JSON.stringify(counts)}`);
  console.error(`→ ${PROBE_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
