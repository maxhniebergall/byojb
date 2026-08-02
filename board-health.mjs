#!/usr/bin/env node
// board-health.mjs — report the state of every career board we scan.
//
// EVERY board gets scanned, every time. An empty board is not a problem to be optimised away:
// small companies hire sporadically, and 19 of 250 boards that had never produced a job in the
// scan ledger were actively hiring when probed. Skipping them to save a fetch would trade the
// cheapest thing we have for the only thing that matters.
//
// What DOES need action is a board that is broken:
//
//   gone    — 404/410/DNS. The company moved ATS (Tailscale left BambooHR for Greenhouse) or the
//             slug was never theirs. Nothing will ever come from this URL again, and leaving it in
//             place means the employer is invisible to us for as long as it stands.
//   blocked — 401/403. We were refused. This says nothing about the employer, so it must not be
//             read as absence; it needs a different route in, not a verdict.
//
// Both are REPAIRABLE, and repairing them is the point: a gone board is a company we have lost
// track of, not a company that stopped existing. See board-repair.mjs.
//
// State comes from two sources, combined here:
//   data/scan-ledger.tsv  — every scan, with jobs_found (does this board ever yield?)
//   data/board-probe.tsv  — probe verdicts from probe-boards.mjs (does this board still exist?)
//
//   node board-health.mjs            # summary
//   node board-health.mjs --list     # boards needing repair
//   node board-health.mjs --json
//
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const SCAN_LEDGER = join(ROOT, 'data', 'scan-ledger.tsv');
export const PROBE_PATH = join(ROOT, 'data', 'board-probe.tsv');

// States that mean "this board is broken and a human/agent must find the real one".
export const REPAIR_STATES = new Set(['gone', 'blocked']);

// company name → { scans, firstAt, lastAt, maxJobs }
// Keyed by NAME because that is what scan.mjs writes; the probe ledger is keyed by company key.
export function loadScanHistory(path = SCAN_LEDGER) {
  const by = new Map();
  if (!existsSync(path)) return by;
  const lines = readFileSync(path, 'utf-8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const [company, at, jobs, status, url] = line.split('\t');
    if (!company || !at) continue;
    const n = Number(jobs) || 0;
    const cur = by.get(company);
    if (!cur) by.set(company, { scans: 1, firstAt: at, lastAt: at, maxJobs: n, lastStatus: status || 'ok', lastUrl: url || null });
    else {
      cur.scans++;
      if (at < cur.firstAt) cur.firstAt = at;
      if (at > cur.lastAt) cur.lastAt = at;
      if (n > cur.maxJobs) cur.maxJobs = n;
      // Latest verdict wins: a board that 404'd yesterday and answers today is fixed, and a board
      // that worked last week and 404s now is the case this whole system exists to catch.
      if (at >= cur.lastAt) { cur.lastStatus = status || 'ok'; cur.lastUrl = url || cur.lastUrl; }
    }
  }
  return by;
}

// company key → latest probe verdict. Later rows win, so re-probing a repaired board supersedes
// the old verdict without anyone editing history.
export function loadProbes(path = PROBE_PATH) {
  const by = new Map();
  if (!existsSync(path)) return by;
  const lines = readFileSync(path, 'utf-8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const [key, at, state, detail] = line.split('\t');
    if (!key || !state) continue;
    const cur = by.get(key);
    if (!cur || at > cur.at) by.set(key, { at, state, detail: detail || '' });
  }
  return by;
}

// Broken boards as the SCANNER saw them, keyed by careers_url.
//
// This is the primary source, not the probe. scan.mjs already discovers a dead board every run —
// it catches the 404 and prints it — so the information exists at the natural moment and costs
// nothing extra. probe-boards.mjs is now a way to CHECK a board on demand, not the way we find out.
// Read the ledger directly rather than going through the name-keyed history. Two companies in this
// registry are both called "Alma" — one 404s, one serves 12 jobs — and rolling them up by name let
// the healthy one's status mask the broken one's. The URL is the board's identity; the name is not.
export function brokenFromScans(path = SCAN_LEDGER) {
  const latest = new Map();
  if (!existsSync(path)) return new Map();
  const lines = readFileSync(path, 'utf-8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const [name, at, , status, url] = line.split('\t');
    if (!url || !at) continue;           // rows written before the url column carry no identity
    const cur = latest.get(url);
    if (!cur || at > cur.at) latest.set(url, { name, at, status: status || 'ok' });
  }
  const out = new Map();
  for (const [url, r] of latest) if (REPAIR_STATES.has(r.status)) out.set(url, { name: r.name, state: r.status, at: r.at });
  return out;
}

function main() {
  const probes = loadProbes();
  const hist = loadScanHistory();
  const counts = {};
  const repair = [];
  for (const [key, p] of probes) {
    counts[p.state] = (counts[p.state] || 0) + 1;
    if (REPAIR_STATES.has(p.state)) repair.push({ key, ...p });
  }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(repair, null, 2)); return; }

  console.log(`scan ledger: ${hist.size} companies scanned`);
  const neverYielded = [...hist.values()].filter(h => h.maxJobs === 0).length;
  console.log(`  ${neverYielded} have never yielded a job — these are still scanned every run, by design\n`);
  console.log(`probe verdicts: ${probes.size} board(s) probed`);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(6)}  ${k}`);
  const fromScans = brokenFromScans();
  console.log(`\nbroken boards seen by the SCANNER: ${fromScans.size}`);
  for (const [url, b] of [...fromScans].slice(0, 8)) console.log(`  ${b.state.padEnd(8)} ${b.name.slice(0, 34).padEnd(36)} ${url}`);
  console.log(`\n${repair.length + fromScans.size} board(s) need repair (gone/blocked) → node board-repair.mjs --emit`);
  if (process.argv.includes('--list')) {
    console.log('');
    for (const r of repair) console.log(`  ${r.state.padEnd(8)} ${r.key.padEnd(48)} ${r.detail}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
