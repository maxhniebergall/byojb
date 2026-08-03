#!/usr/bin/env node
// board-repair.mjs — find the real career board for companies whose board is broken.
//
// A `gone` board (404/410/DNS) is not a company that stopped existing. It is a company we have
// LOST TRACK OF: Tailscale still hires — it moved from BambooHR to Greenhouse, and until the
// registry follows, every one of its openings is invisible to us. A `blocked` board (401/403)
// tells us even less: we were refused at the door, which is not evidence about the employer.
//
// So neither is a verdict; both are a research task. This emits that task for an agent and
// applies the answer back to the registry.
//
//   node board-repair.mjs --emit 20        # work-list of broken boards (JSON)
//   node board-repair.mjs --apply fix.json # apply the agent's findings
//   node board-repair.mjs --stats
//
// The agent returns one of three outcomes per company, and the distinction is the whole point:
//
//   relocated — the company hires at a NEW url (often a different ATS). Update and rescan; the
//               employer comes back into view with all its openings.
//   defunct   — the company genuinely no longer exists (acquired and absorbed, shut down). Record
//               WHY, and stop scanning it. This is the only outcome that removes a company.
//   unknown   — could not determine. Recorded with a backoff so effort is not repeated daily, but
//               never treated as defunct. Absence of evidence is not evidence of absence, and
//               guessing here silently deletes a real employer from the search.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadProbes, REPAIR_STATES, brokenFromScans } from './board-health.mjs';
import { probeCompany, providerFor } from './probe-boards.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const C_PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');
const C_RESEARCH = join(ROOT, 'data', 'company-research.jsonl');
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
export const REPAIR_LEDGER = join(ROOT, 'data', 'board-repair-ledger.tsv');

// How long before re-attempting a company the agent could not resolve. Long enough not to burn
// effort re-deciding the same unknowable case, short enough that a company which later publishes
// a findable board is picked up.
export const RETRY_DAYS = 45;

function loadJsonl(p) {
  const out = [];
  if (!existsSync(p)) return out;
  for (const l of readFileSync(p, 'utf-8').split('\n')) if (l) try { out.push(JSON.parse(l)); } catch {}
  return out;
}
function saveJsonl(p, rows) {
  writeFileSync(p, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
}

// key → { at, outcome }. Latest wins.
export function loadRepairLedger(path = REPAIR_LEDGER) {
  const by = new Map();
  if (!existsSync(path)) return by;
  const lines = readFileSync(path, 'utf-8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const [key, at, outcome, note] = l.split('\t');
    if (!key) continue;
    const cur = by.get(key);
    if (!cur || at > cur.at) by.set(key, { at, outcome, note: note || '' });
  }
  return by;
}

function emit(n, { signalOnly = false } = {}) {
  const probes = loadProbes();
  const ledger = loadRepairLedger();
  const personal = new Map();
  for (const c of loadJsonl(C_PERSONAL)) if (!personal.has(c.key)) personal.set(c.key, c);
  const research = new Map();
  for (const c of loadJsonl(C_RESEARCH)) if (!research.has(c.key)) research.set(c.key, c);

  // The titles this company USED to post are the strongest clue to which employer it is — the
  // registry name is often just an ATS slug ("upboundext", "gtp-software-inc").
  const titlesByKey = new Map();
  for (const r of loadJsonl(RESEARCH)) {
    if (!r?.company_key || !r.title) continue;
    if (!titlesByKey.has(r.company_key)) titlesByKey.set(r.company_key, new Set());
    const s = titlesByKey.get(r.company_key);
    if (s.size < 6) s.add(r.title);
  }

  // Merge both sources. The SCAN is the primary one — it sees a board break during the run that
  // would have used it — while an explicit probe is how you check a board on demand. Keyed by
  // company key, with the scan's careers_url mapped back through the registry.
  const urlToKey = new Map();
  for (const c of personal.values()) if (c.careers_url) urlToKey.set(c.careers_url, c.key);
  const broken = new Map();
  for (const [key, p] of probes) if (REPAIR_STATES.has(p.state)) broken.set(key, { state: p.state, detail: p.detail, via: 'probe' });
  for (const [url, b] of brokenFromScans()) {
    const key = urlToKey.get(url);
    if (key) broken.set(key, { state: b.state, detail: `scan ${b.at.slice(0, 10)}`, via: 'scan' });
  }

  // Repair the boards that cost us most first. A broken board hides a whole employer, so one
  // belonging to a company already rated 5 is worth more than one nobody has looked at — and a
  // truncated run should have covered those. dbt Labs sat at fit 5, 404, and invisible.
  const value = (key) => {
    const c = personal.get(key) || {};
    return (c.llm_fit ?? 0) * 10 + (c.llm_rank ?? 0);
  };
  const ordered = [...broken].sort((a, b) => value(b[0]) - value(a[0]) || String(a[0]).localeCompare(String(b[0])));

  const now = Date.now();
  const out = [];
  for (const [key, p] of ordered) {
    const prev = ledger.get(key);
    if (prev?.outcome === 'relocated' || prev?.outcome === 'defunct') continue;   // already settled
    if (prev?.outcome === 'unknown' && (now - Date.parse(prev.at)) / 86400000 < RETRY_DAYS) continue;
    const c = personal.get(key) || {};
    const r = research.get(key) || {};
    // A broken board is only worth an agent if there is evidence a real employer is behind it.
    // 395 of 431 in this queue have no titles, no postings ever seen and no rank: they are
    // slug-enumeration artifacts (bamboohr:efea, :els, :epts...), not companies we lost. An agent
    // cannot identify a bare slug with nothing to search on, and the mode rightly forbids guessing,
    // so every one of them costs a research slot to return "unknown".
    const titles = [...(titlesByKey.get(key) || [])];
    const hasSignal = titles.length > 0 || (r.total ?? 0) > 0 || c.llm_fit != null || c.llm_rank != null;
    if (signalOnly && !hasSignal) continue;
    out.push({
      key,
      name: c.name || r.name || key,
      probe_state: p.state,
      probe_detail: p.detail,
      found_by: p.via,
      current_url: c.careers_url || r.careers_url || null,
      provider: c.provider || r.provider || null,
      llm_rank: c.llm_rank ?? null,
      llm_fit: c.llm_fit ?? null,
      known_titles: titles,
      previously_seen_postings: r.total ?? null,
    });
    if (out.length >= n) break;
  }
  console.log(JSON.stringify(out, null, 2));
  console.error(`emitted ${out.length} broken board(s) for repair`);
}

// Some "gone" boards announce their own replacement. nrb.recruitee.com 302s to
// keyes.recruitee.com, which serves 58 live jobs — the ATS is telling us the company renamed its
// slug. Following that redirect resolves the relocation outright, so it never needs an agent.
//
// Only a redirect to a DIFFERENT slug on the same ATS counts. A redirect to a marketing page or a
// generic "careers_not_hosted" lander is not a relocation, and recording one would replace a dead
// URL with a URL that merely looks alive — worse than leaving it broken, because nothing would
// flag it again.
async function auto(limit) {
  const personal = loadJsonl(C_PERSONAL);
  const byKey = new Map();
  for (const c of personal) if (!byKey.has(c.key)) byKey.set(c.key, c);
  const ledger = loadRepairLedger();

  const probes = loadProbes();
  const urlToKey = new Map();
  for (const c of byKey.values()) if (c.careers_url) urlToKey.set(c.careers_url, c.key);
  // Widen beyond gone/blocked: a board that RENAMED usually shows up as `error`, because the
  // provider follows the redirect and then fails parsing the wrong tenant's response rather than
  // getting a clean 404. nrb.recruitee.com is exactly that — it 302s to keyes.recruitee.com, which
  // serves 58 jobs. Checking `error` too is safe because this step is self-validating: it only
  // records a relocation when the redirect target actually returns jobs.
  const queue = [];
  for (const [key, p] of probes) if (REPAIR_STATES.has(p.state) || p.state === 'error') queue.push(key);
  for (const [url, b] of brokenFromScans({ includeErrors: true })) { const k = urlToKey.get(url); if (k) queue.push(k); }

  const seen = new Set();
  const fixes = [];
  let checked = 0;
  for (const key of queue) {
    if (seen.has(key)) continue;
    seen.add(key);
    const prev = ledger.get(key);
    if (prev?.outcome === 'relocated' || prev?.outcome === 'defunct') continue;
    const c = byKey.get(key);
    if (!c?.careers_url) continue;
    if (checked++ >= limit) break;
    try {
      // Follow the API url, not the careers page. A renamed tenant redirects its API path to the
      // new tenant (nrb.recruitee.com/api/offers → keyes.recruitee.com), while the careers page
      // redirects to the company's own marketing domain (keyescareers.eu) — which reveals nothing
      // about the ATS slug we need.
      const provider = await providerFor(c);
      const apiUrl = provider?.detect?.(c)?.url || c.careers_url;
      const res = await fetch(apiUrl, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'byojb/1.0' } });
      const finalUrl = res.url || '';
      if (!finalUrl || finalUrl === apiUrl) continue;
      const a = new URL(apiUrl), b = new URL(finalUrl);
      // Same ATS, different tenant → a rename. Anything else is not evidence of relocation.
      const sameAts = a.hostname.split('.').slice(-2).join('.') === b.hostname.split('.').slice(-2).join('.');
      if (!sameAts || a.hostname === b.hostname) continue;
      const candidate = `${b.protocol}//${b.hostname}`;
      const probe = await probeCompany({ ...c, careers_url: candidate }, { countJobs: true });
      if (probe.state !== 'alive') continue;
      fixes.push({ key, outcome: 'relocated', careers_url: candidate, provider: c.provider,
        note: `board redirected ${a.hostname} → ${b.hostname}; ${probe.detail}` });
    } catch { /* unreachable → leave it for the agent */ }
  }
  console.error(`checked ${checked} broken board(s), ${fixes.length} resolved by following redirects`);
  if (!fixes.length) return;
  const tmp = join(ROOT, 'data', '.auto-repair.json');
  writeFileSync(tmp, JSON.stringify(fixes, null, 2), 'utf-8');
  apply(tmp);
}

function apply(file) {
  const fixes = JSON.parse(readFileSync(file, 'utf-8'));
  if (!Array.isArray(fixes)) throw new Error('expected an array');
  const personal = loadJsonl(C_PERSONAL);
  const byKey = new Map();
  for (const c of personal) if (!byKey.has(c.key)) byKey.set(c.key, c);

  if (!existsSync(REPAIR_LEDGER)) writeFileSync(REPAIR_LEDGER, 'key\tat\toutcome\tnote\n', 'utf-8');
  const stamp = new Date().toISOString();
  let relocated = 0, defunct = 0, unknown = 0, missing = 0;

  for (const f of fixes) {
    const c = byKey.get(f?.key);
    if (!c) { missing++; continue; }
    const outcome = String(f.outcome || '').toLowerCase();
    if (outcome === 'relocated') {
      if (!f.careers_url) { missing++; continue; }
      c.careers_url = f.careers_url;
      if (f.provider) c.provider = f.provider;
      // Clearing the probe is not needed: probe-boards writes a fresh row and the latest wins.
      relocated++;
    } else if (outcome === 'defunct') {
      // The ONLY outcome that stops us scanning a company. Recorded as a typed exclusion with a
      // reason so it is auditable and reversible, never a silent delete.
      c.excluded_by_type = true;
      c.company_type = 'defunct';
      c.decision = 'skip';
      c.llm_reason = f.note || 'company no longer exists';
      defunct++;
    } else {
      unknown++;
    }
    appendFileSync(REPAIR_LEDGER, `${f.key}\t${stamp}\t${outcome || 'unknown'}\t${String(f.note || '').replace(/\s+/g, ' ').slice(0, 160)}\n`);
  }
  saveJsonl(C_PERSONAL, personal);
  console.error(`✓ ${relocated} relocated, ${defunct} marked defunct, ${unknown} unresolved${missing ? `, ${missing} skipped (unknown key or missing url)` : ''}`);
  if (relocated) console.error('  → run `node scan.mjs` to pick up the relocated boards');
}

function stats() {
  const probes = loadProbes();
  const ledger = loadRepairLedger();
  const fromScans = brokenFromScans();
  const broken = [...probes].filter(([, p]) => REPAIR_STATES.has(p.state));
  console.log(`broken boards seen by the scanner: ${fromScans.size}`);
  const settled = broken.filter(([k]) => ['relocated', 'defunct'].includes(ledger.get(k)?.outcome));
  const byState = {};
  for (const [, p] of broken) byState[p.state] = (byState[p.state] || 0) + 1;
  console.log(`broken boards: ${broken.length}  ${JSON.stringify(byState)}`);
  console.log(`  settled:   ${settled.length}`);
  console.log(`  to repair: ${broken.length - settled.length}`);
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--emit');
  if (i !== -1) return emit(Number(args[i + 1]) || 20, { signalOnly: args.includes('--with-signal') });
  const j = args.indexOf('--apply');
  if (j !== -1) return apply(args[j + 1]);
  const k = args.indexOf('--auto');
  if (k !== -1) return auto(Number(args[k + 1]) || 200);
  return stats();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
