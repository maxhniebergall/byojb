#!/usr/bin/env node

/**
 * scan.mjs — Zero-token portal scanner with a plugin-based provider layer.
 *
 * Providers live in providers/*.mjs and are loaded at startup. Each provider
 * exports a default object with:
 *   - id: string — matched against `provider:` in portals.yml
 *   - detect(entry): {url}|null — optional auto-detection from careers_url
 *   - fetch(entry, ctx): [{title,url,company,location}] — required
 *
 * Files prefixed with _ are shared helpers (e.g. _http.mjs) and are never
 * loaded as providers. Adding a new HTTP/API source = drop a *.mjs into
 * providers/. Local executable parsers use `providers/local-parser.mjs` when
 * `parser.command` + `parser.script` are set in portals.yml.
 *
 * A tracked_companies entry can set `provider:` explicitly to bypass
 * URL-based auto-detection. The `transport:` field is reserved for future
 * transports — Phase A only ships the http transport.
 *
 * Zero Claude API tokens — pure HTTP + JSON.
 *
 * Usage:
 *   node scan.mjs                  # scan all enabled companies
 *   node scan.mjs --dry-run        # preview without writing files
 *   node scan.mjs --company Cohere # scan a single company
 *   node scan.mjs --verify         # Playwright-check each new URL; drop expired postings
 *   node scan.mjs --rescan         # ignore the 24h skip window; re-scan every company
 *   node scan.mjs --no-rank        # skip the post-scan rank-postings.mjs registry rebuild
 *
 * Resumability: each successfully scanned company is appended to data/scan-ledger.tsv,
 * and companies scanned within BYOJB_SCAN_SKIP_HOURS (default 24) are skipped. A long
 * run that dies partway can simply be re-run — it picks up where it left off.
 *
 * On completion scan.mjs runs rank-postings.mjs to refresh the postings registry that
 * the triage commands read (scan itself only writes data/postings/raw-latest.jsonl).
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

import { makeHttpCtx, httpStats } from './providers/_http.mjs';
import { canonicalUrl } from './posting-core.mjs';

const parseYaml = yaml.load;

// ── Config ──────────────────────────────────────────────────────────

const PORTALS_PATH = process.env.BYOJB_PORTALS || process.env.CAREER_OPS_PORTALS || 'portals.yml';
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';
const PIPELINE_PATH = 'data/pipeline.md';
const APPLICATIONS_PATH = 'data/applications.md';
// Raw capture for the postings registry — the FULL set of title/location-passing
// postings this scan (with JD bodies), regardless of dedup. rank-postings.mjs reads
// this to build/refresh data/posting-research.jsonl + data/postings-personal.jsonl.
const POSTINGS_RAW_PATH = 'data/postings/raw-latest.jsonl';
// Append-only ledger of when each company was last scanned. Powers resumable /
// incremental scans: a company scanned within the skip window is skipped, so a
// crashed 24h run resumes roughly where it left off and a same-day re-run only
// hits stale boards. Written incrementally (see checkpointing) so it survives a
// mid-run crash.
const SCAN_LEDGER_PATH = 'data/scan-ledger.tsv';
const PROVIDERS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'providers');

// Ensure required directories exist (fresh setup)
mkdirSync('data', { recursive: true });

const CONCURRENCY = 10;

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Flush results to disk every N completed companies so a long (multi-hour) run
// is durable against crashes. 0 disables mid-run checkpoints (write only at end).
const CHECKPOINT_EVERY = envInt('BYOJB_SCAN_CHECKPOINT_EVERY', 100);
// Skip companies scanned within this many hours. 0 disables skipping.
const SKIP_HOURS = envInt('BYOJB_SCAN_SKIP_HOURS', 24);

// ── Provider loading ────────────────────────────────────────────────

async function loadProviders(dir) {
  const providers = new Map();
  if (!existsSync(dir)) return providers;
  // Alphabetical order so detect() priority is deterministic across machines.
  const entries = readdirSync(dir)
    .filter(f => f.endsWith('.mjs') && !f.startsWith('_'))
    .sort();
  for (const file of entries) {
    const full = path.join(dir, file);
    let mod;
    try {
      mod = await import(pathToFileURL(full).href);
    } catch (err) {
      console.error(`⚠️  ${file}: failed to load — ${err.message}`);
      continue;
    }
    const p = mod.default;
    if (!p || typeof p.fetch !== 'function' || !p.id) {
      console.error(`⚠️  ${file}: skipping — default export must be { id, fetch }`);
      continue;
    }
    if (providers.has(p.id)) {
      console.error(`⚠️  ${file}: duplicate provider id "${p.id}" — keeping first`);
      continue;
    }
    providers.set(p.id, p);
  }
  return providers;
}

// Resolve which provider handles a tracked_companies entry.
// 1. Explicit `provider:` field wins (skips detect()).
// 2. local-parser when parser.command + script are configured (before API detect).
// 3. Otherwise each provider's detect() runs in load order; first hit wins.
function resolveProvider(entry, providers, { skipIds = [] } = {}) {
  if (entry.provider) {
    const p = providers.get(entry.provider);
    if (!p) return { error: `unknown provider: ${entry.provider}` };
    return { provider: p };
  }

  const localParser = providers.get('local-parser');
  if (localParser && !skipIds.includes('local-parser')) {
    try {
      const hit = localParser.detect?.(entry);
      if (hit) return { provider: localParser };
    } catch (err) {
      console.error(`⚠️  local-parser: detect() threw for "${entry.name}" — ${err.message}`);
    }
  }

  for (const p of providers.values()) {
    if (skipIds.includes(p.id)) continue;
    let hit;
    try {
      hit = p.detect?.(entry);
    } catch (err) {
      console.error(`⚠️  ${p.id}: detect() threw for "${entry.name}" — ${err.message}`);
      continue;
    }
    if (hit) return { provider: p };
  }
  return null;
}

// ── Title filter ────────────────────────────────────────────────────

function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());

  return (title) => {
    const lower = title.toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(k => lower.includes(k));
    const hasNegative = negative.some(k => lower.includes(k));
    return hasPositive && !hasNegative;
  };
}

// ── Location filter ─────────────────────────────────────────────────
// Optional. If `location_filter` is absent from portals.yml, all locations pass.
// Semantics (case-insensitive substring, in this order):
//   - Empty / whitespace-only / non-string location → pass (don't penalize
//     missing or malformed provider data)
//   - `always_allow` matches → pass (takes precedence over `block` — lets a
//     multi-location string like "Remote, Belgium or France" through because
//     the home region is an option, even though "france" is blocked)
//   - `block` matches → reject
//   - `allow` empty → pass (already cleared block)
//   - `allow` non-empty → must match at least one keyword

// Normalize a keyword list from portals.yml: tolerates a bare string
// (wrapped to a 1-item array), null/undefined (→ []), and non-string
// entries (filtered out). Survivors are lowercased, trimmed, and any
// resulting empty strings are dropped — an empty keyword would otherwise
// match every location via String.includes(''), silently bypassing the
// other tiers.
function normalizeKeywordList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .filter(k => typeof k === 'string')
    .map(k => k.toLowerCase().trim())
    .filter(Boolean);
}

export function buildLocationFilter(locationFilter) {
  if (!locationFilter) return () => true;
  const alwaysAllow = normalizeKeywordList(locationFilter.always_allow);
  const allow = normalizeKeywordList(locationFilter.allow);
  const block = normalizeKeywordList(locationFilter.block);

  return (location) => {
    if (typeof location !== 'string' || location.trim() === '') return true;
    const lower = location.toLowerCase();
    if (alwaysAllow.length > 0 && alwaysAllow.some(k => lower.includes(k))) return true;
    if (block.length > 0 && block.some(k => lower.includes(k))) return false;
    if (allow.length > 0 && allow.some(k => lower.includes(k))) return true;
    if (allow.length === 0) return true;
    return false;
  };
}

// ── Dedup ───────────────────────────────────────────────────────────

function loadSeenUrls() {
  const seen = new Set();

  // scan-history.tsv
  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
    for (const line of lines.slice(1)) { // skip header
      const url = line.split('\t')[0];
      if (url) seen.add(url);
    }
  }

  // pipeline.md — extract URLs from checkbox lines
  if (existsSync(PIPELINE_PATH)) {
    const text = readFileSync(PIPELINE_PATH, 'utf-8');
    for (const match of text.matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)) {
      seen.add(match[1]);
    }
  }

  // applications.md — extract URLs from report links and any inline URLs
  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0]);
    }
  }

  return seen;
}

function loadSeenCompanyRoles() {
  const seen = new Set();
  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    // Parse markdown table rows: | # | Date | Company | Role | ...
    for (const match of text.matchAll(/\|[^|]+\|[^|]+\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)) {
      const company = match[1].trim().toLowerCase();
      const role = match[2].trim().toLowerCase();
      if (company && role && company !== 'company') {
        seen.add(`${company}::${role}`);
      }
    }
  }
  return seen;
}

// ── Pipeline writer ─────────────────────────────────────────────────

function appendToPipeline(offers) {
  if (offers.length === 0) return;

  let text = readFileSync(PIPELINE_PATH, 'utf-8');

  // Find "## Pendientes" section and append after it
  const marker = '## Pendientes';
  const idx = text.indexOf(marker);
  if (idx === -1) {
    // No Pendientes section — append at end before Procesadas
    const procIdx = text.indexOf('## Procesadas');
    const insertAt = procIdx === -1 ? text.length : procIdx;
    const block = `\n${marker}\n\n` + offers.map(o =>
      `- [ ] ${o.url} | ${o.company} | ${o.title}`
    ).join('\n') + '\n\n';
    text = text.slice(0, insertAt) + block + text.slice(insertAt);
  } else {
    // Find the end of existing Pendientes content (next ## or end)
    const afterMarker = idx + marker.length;
    const nextSection = text.indexOf('\n## ', afterMarker);
    const insertAt = nextSection === -1 ? text.length : nextSection;

    const block = '\n' + offers.map(o =>
      `- [ ] ${o.url} | ${o.company} | ${o.title}`
    ).join('\n') + '\n';
    text = text.slice(0, insertAt) + block + text.slice(insertAt);
  }

  writeFileSync(PIPELINE_PATH, text, 'utf-8');
}

function appendToScanHistory(offers, date, status = 'added') {
  // Ensure file + header exist. Location appended as 7th column for non-breaking
  // backward compat — older scan-history.tsv files with 6 columns still parse fine
  // since loadSeenUrls only reads column 0. `status` is parameterized so callers
  // can record verify outcomes (`skipped_expired`, etc.) without the legacy
  // `(expired)` suffix in `source`.
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n', 'utf-8');
  }

  const lines = offers.map(o =>
    `${o.url}\t${date}\t${o.source}\t${o.title}\t${o.company}\t${status}\t${o.location || ''}`
  ).join('\n') + '\n';

  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

// Classify a failed fetch into a status worth PERSISTING.
//
// The scanner already knows a board is dead — it catches the 404 and prints
// "✗ Hexagon US Federal: HTTP 404" at the end of the run. But that went only to stdout, and
// because the ledger recorded successes only, the company then simply vanished from the data.
// Downstream that is indistinguishable from "this company has no openings", which is how
// dbt Labs (fit 5) and Affinity.co (rank 5) dropped out of the search unnoticed.
//
// So record WHY, not just that it failed:
//   gone    — 404/410/DNS. The URL is dead; the company is hiring somewhere else, or nowhere.
//   blocked — 401/403. We were refused. This says nothing about the employer.
//   error   — transient (timeout, 429, 5xx). Nothing to conclude, retry next run.
function classifyScanError(message) {
  const m = String(message || '');
  if (/\b(404|410)\b/.test(m)) return 'gone';
  if (/ENOTFOUND|getaddrinfo|ERR_NAME|DNS/i.test(m)) return 'gone';
  if (/\b(401|403)\b/.test(m)) return 'blocked';
  return 'error';
}

// ── Scan ledger (resumability) ──────────────────────────────────────

// name(lowercased) → most-recent scan time (epoch ms). Only successful scans
// are recorded, so a company that errored (e.g. 429 exhausted) retries next run.
function loadScanLedger() {
  const seen = new Map();
  if (!existsSync(SCAN_LEDGER_PATH)) return seen;
  const lines = readFileSync(SCAN_LEDGER_PATH, 'utf-8').split('\n');
  for (const line of lines.slice(1)) { // skip header
    if (!line) continue;
    const [name, ts, , status] = line.split('\t');
    if (!name || !ts) continue;
    // Only successful scans hold off a retry. Failures are recorded now (see classifyScanError),
    // but a board that errored must still be retried next run rather than skipped as "seen".
    if (status && status !== 'ok') continue;
    const t = Date.parse(ts);
    if (!Number.isFinite(t)) continue;
    const key = name.toLowerCase();
    const prev = seen.get(key);
    if (prev == null || t > prev) seen.set(key, t);
  }
  return seen;
}

function appendToScanLedger(entries) {
  if (!entries.length) return;
  if (!existsSync(SCAN_LEDGER_PATH)) {
    writeFileSync(SCAN_LEDGER_PATH, 'company\tscanned_at\tjobs_found\tstatus\tcareers_url\n', 'utf-8');
  }
  // careers_url identifies the board unambiguously; the name does not. Three separate companies
  // are called "Affinity" in this registry, so a repair tool keying on name cannot tell which one
  // just 404'd. Appended as a 5th column so every existing row (and every existing reader) stays
  // valid — the loader treats it as optional.
  const rows = entries.map(e => `${e.name}\t${e.at}\t${e.found}\t${e.status}\t${e.url || ''}`).join('\n') + '\n';
  appendFileSync(SCAN_LEDGER_PATH, rows, 'utf-8');
}

// ── Raw postings snapshot (carry-forward for skipped/un-scanned boards) ──

// Load the prior raw cache grouped by a per-company carry key. Rows for
// companies NOT scanned this run are re-emitted verbatim so rank-postings.mjs
// (which expires a posting only when its company reappears in the snapshot)
// never falsely expires a board we simply skipped.
function loadPriorRawByKey() {
  const byKey = new Map();
  if (!existsSync(POSTINGS_RAW_PATH)) return byKey;
  for (const line of readFileSync(POSTINGS_RAW_PATH, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row._meta || !row.url) continue;
    const key = row.careers_url || row.company || row.url;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  return byKey;
}

const rawCarryKey = (m) => m.careers_url || m.company || m.url;

// Write raw-latest.jsonl atomically (temp + rename) so a crash mid-write never
// leaves a truncated snapshot. Content = fresh postings from companies scanned
// this run + carried postings for every other company.
function writeRawSnapshot(matched, priorByKey, meta) {
  mkdirSync('data/postings', { recursive: true });
  const freshKeys = new Set(matched.map(rawCarryKey));
  const carried = [];
  for (const [key, rows] of priorByKey) {
    if (freshKeys.has(key)) continue; // a fresh scan replaces this company's rows
    for (const r of rows) carried.push(r);
  }
  const all = [...carried, ...matched];
  const lines = [JSON.stringify({ _meta: meta }), ...all.map(m => JSON.stringify(m))];
  const tmp = POSTINGS_RAW_PATH + '.tmp';
  writeFileSync(tmp, lines.join('\n') + '\n', 'utf-8');
  renameSync(tmp, POSTINGS_RAW_PATH);
  return { carried: carried.length, fresh: matched.length };
}

// ── Interleave targets by host ──────────────────────────────────────
// portals.yml groups companies by provider, so thousands of consecutive entries
// share one host (job-boards.greenhouse.io, jobs.ashbyhq.com, …). Scanned in that
// order, all CONCURRENCY workers pile onto the same host and serialize on its
// per-host rate limiter — concurrency is wasted and the run crawls. Round-robin
// the targets across their hosts so the workers hit many distinct hosts at once.
function targetHost(t) {
  const u = t.api || t.careers_url || '';
  try { return new URL(u).hostname; } catch { return t._provider?.id || 'other'; }
}

function interleaveByHost(items) {
  const groups = new Map();
  for (const it of items) {
    const k = targetHost(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const buckets = [...groups.values()];
  const out = [];
  for (let i = 0; out.length < items.length; i++) {
    for (const b of buckets) if (i < b.length) out.push(b[i]);
  }
  return out;
}

// ── Parallel fetch with concurrency limit ───────────────────────────

async function parallelFetch(tasks, limit) {
  const results = [];
  let i = 0;

  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// ── Main ────────────────────────────────────────────────────────────

async function verifyOffers(offers) {
  // Dynamic imports keep the default zero-token path free of Playwright startup
  let chromium;
  let checkUrlLiveness;
  try {
    ({ chromium } = await import('playwright'));
    ({ checkUrlLiveness } = await import('./liveness-browser.mjs'));
  } catch (err) {
    throw new Error(
      `--verify requires Playwright with Chromium (run "npx playwright install chromium"): ${err.message}`,
      { cause: err },
    );
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    throw new Error(
      `--verify could not launch Chromium (run "npx playwright install chromium" or re-run without --verify): ${err.message}`,
      { cause: err },
    );
  }

  // Three permanent buckets + one transient passthrough:
  //   verified  → active pages and transient nav errors (retry next scan)
  //   expired   → classifier-confirmed dead postings (HTTP 4xx, redirect markers,
  //               body patterns, listing pages, insufficient content)
  //   dropped   → page loaded but classifier saw no Apply control. --verify is an
  //               opt-in stricter filter; keeping these defeats the purpose.
  //   invalid   → up-front URL guard rejections (malformed / non-http / private)
  const verified = [];
  const expired = [];
  const dropped = [];
  const invalid = [];

  try {
    const page = await browser.newPage();
    // Sequential — project rule: never Playwright in parallel
    for (const offer of offers) {
      const { result, code, reason } = await checkUrlLiveness(page, offer.url);
      if (result === 'expired') {
        expired.push({ ...offer, reason });
        console.log(`  ❌ expired   ${offer.company} | ${offer.title} (${reason})`);
      } else if (result === 'uncertain' && GUARD_CODES.has(code)) {
        // Guard failures are permanent (not transient like a timeout) — record them
        // separately so they don't end up in pipeline.md but DO appear in scan-history
        // with a precise status, dedup-blocking them on subsequent scans.
        invalid.push({ ...offer, code, reason });
        console.log(`  ⛔ invalid   ${offer.company} | ${offer.title} (${reason})`);
      } else if (result === 'uncertain' && code === 'no_apply_control') {
        // Page loaded but classifier could not find an Apply control. Treat like
        // expired for routing — drop from pipeline AND record in scan-history so
        // we don't burn a verify cycle on the same URL next scan.
        dropped.push({ ...offer, reason });
        console.log(`  ⚠️ no-apply  ${offer.company} | ${offer.title} (${reason})`);
      } else {
        // 'active' or 'uncertain' due to navigation_error (transient — retry next scan)
        verified.push(offer);
        const icon = result === 'active' ? '✅' : '⚠️';
        console.log(`  ${icon} ${result.padEnd(9)} ${offer.company} | ${offer.title}`);
      }
    }
  } finally {
    await browser.close();
  }

  return { verified, expired, dropped, invalid };
}

// Stable codes from liveness-browser's up-front URL guard. Routing dispatches
// on these codes (not on regex over reason strings) so wording can change
// without breaking the pipeline.
const GUARD_CODES = new Set(['invalid_url', 'unsupported_protocol', 'blocked_host']);

// guardStatusFor maps a guard code to the canonical scan-history status string.
function guardStatusFor(code) {
  if (code === 'blocked_host') return 'skipped_blocked_host';
  // invalid_url and unsupported_protocol both surface as malformed input
  return 'skipped_invalid_url';
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verify = args.includes('--verify');
  const rescan = args.includes('--rescan'); // ignore the skip window; scan everything
  const noRank = args.includes('--no-rank'); // skip the post-scan registry rebuild
  const companyFlag = args.indexOf('--company');
  const filterCompany = companyFlag !== -1 ? args[companyFlag + 1]?.toLowerCase() : null;
  // --provider <id> scans only boards served by one provider. Needed whenever a provider's parsing
  // changes: the fix only affects FUTURE fetches, so the stored bodies for that provider are stale
  // and have to be refetched, without re-walking all ~28k companies on every other ATS.
  const providerFlag = args.indexOf('--provider');
  const filterProvider = providerFlag !== -1 ? args[providerFlag + 1]?.toLowerCase() : null;

  // 1. Load providers
  const providers = await loadProviders(PROVIDERS_DIR);
  if (providers.size === 0) {
    console.error('Error: no providers loaded from providers/');
    process.exit(1);
  }

  // 1.5. Regenerate watchlist from registry
  try {
    const cmd = dryRun ? 'node generate-watchlist.mjs --dry-run' : 'node generate-watchlist.mjs';
    execSync(cmd, { stdio: 'inherit' });
    console.log(); // empty line for clean formatting
  } catch (err) {
    console.warn(`⚠️  Failed to regenerate watchlist: ${err.message}`);
  }

  // 2. Read portals.yml
  if (!existsSync(PORTALS_PATH)) {
    console.error('Error: portals.yml not found. Run onboarding first.');
    process.exit(1);
  }

  const config = parseYaml(readFileSync(PORTALS_PATH, 'utf-8'));
  const companies = config.tracked_companies || [];
  const titleFilter = buildTitleFilter(config.title_filter);
  const locationFilter = buildLocationFilter(config.location_filter);

  // 3. Resolve a provider for each enabled company
  // Skip window: a company scanned within SKIP_HOURS is skipped so long runs are
  // resumable and same-day re-runs only touch stale boards. Disabled by
  // --rescan, by --company (an explicit request), or SKIP_HOURS=0.
  const scanLedger = SKIP_HOURS > 0 && !rescan && !filterCompany && !filterProvider ? loadScanLedger() : new Map();
  const skipCutoff = Date.now() - SKIP_HOURS * 3600_000;
  const targets = [];
  let skippedCount = 0;
  let skippedRecent = 0;
  const resolveErrors = [];
  for (const company of companies) {
    if (!company || typeof company !== 'object') continue;
    if (company.enabled === false) continue;
    if (typeof company.name !== 'string' || !company.name.trim()) {
      console.error(`⚠️  Skipping entry — missing or non-string 'name' field: ${JSON.stringify(company)}`);
      continue;
    }
    if (filterCompany && !company.name.toLowerCase().includes(filterCompany)) continue;
    const last = scanLedger.get(company.name.toLowerCase());
    if (last != null && last >= skipCutoff) { skippedRecent++; continue; }
    const resolved = resolveProvider(company, providers);
    if (!resolved) { skippedCount++; continue; }
    if (resolved.error) { resolveErrors.push({ company: company.name, error: resolved.error }); continue; }
    if (filterProvider && String(resolved.provider?.id || '').toLowerCase() !== filterProvider) continue;
    targets.push({ ...company, _provider: resolved.provider });
  }

  const localParserCount = targets.filter(t => t._provider.id === 'local-parser').length;
  const skipNote = skippedRecent > 0 ? `; ${skippedRecent} skipped — scanned <${SKIP_HOURS}h ago` : '';
  console.log(`Scanning ${targets.length} companies via providers (${localParserCount} local parser; ${skippedCount} skipped — no provider matched${skipNote})`);
  if (skippedRecent > 0) console.log(`(resumable: use --rescan to force a full re-scan)`);
  if (dryRun) console.log('(dry run — no files will be written)\n');

  // Prior raw postings, for carrying forward boards we skip / don't scan.
  const priorByKey = dryRun ? new Map() : loadPriorRawByKey();

  // 4. Load dedup sets
  const seenUrls = loadSeenUrls();
  const seenCompanyRoles = loadSeenCompanyRoles();

  // 5. Fetch from each target
  const date = new Date().toISOString().slice(0, 10);
  let totalFound = 0;
  let totalFilteredTitle = 0;
  let totalFilteredLocation = 0;
  let totalDupes = 0;
  const newOffers = [];
  const matched = [];   // ALL title/location-passing postings (with JD bodies) → registry raw cache
  const errors = [...resolveErrors];

  // Checkpointing: periodically flush results so a multi-hour run survives a
  // crash. Guarded by a flag (JS is single-threaded, and every flush op is
  // synchronous, so this only prevents re-entrancy across the done%N trigger).
  let writtenOffers = 0;         // offers already appended to pipeline/history
  const pendingLedger = [];      // completed-company rows not yet flushed
  let flushing = false;
  let carriedCount = 0;
  const checkpoint = () => {
    if (dryRun || flushing) return;
    flushing = true;
    try {
      // New offers → pipeline + history (verify path writes these itself later).
      if (!verify) {
        const slice = newOffers.slice(writtenOffers);
        if (slice.length) {
          appendToPipeline(slice);
          appendToScanHistory(slice, date);
          writtenOffers += slice.length;
        }
      }
      if (pendingLedger.length) appendToScanLedger(pendingLedger.splice(0));
      const meta = { scanned_at: date, companies: targets.map(t => t.name), partial: !!filterCompany || !!filterProvider || skippedRecent > 0 };
      ({ carried: carriedCount } = writeRawSnapshot(matched, priorByKey, meta));
    } finally {
      flushing = false;
    }
  };

  // Live progress: scanning 1000s of portals is slow, so emit a heartbeat as
  // each company finishes. Rewrites a single line on a TTY; prints periodic
  // lines otherwise (e.g. piped to a file/CI). Set BYOJB_SCAN_QUIET=1 to mute.
  const total = targets.length;
  let done = 0;
  let okCount = 0;
  let errCount = 0;
  const isTty = process.stdout.isTTY;
  const quiet = process.env.BYOJB_SCAN_QUIET === '1';
  const reportProgress = (name, ok, found, errMessage, url) => {
    done++;
    if (ok) { okCount++; pendingLedger.push({ name, at: new Date().toISOString(), found, status: 'ok', url }); }
    else {
      errCount++;
      // Persist the failure and its reason. Previously only successes were written, so a board
      // that 404s left no trace anywhere except a console line that scrolled past.
      pendingLedger.push({ name, at: new Date().toISOString(), found: 0, status: classifyScanError(errMessage), url });
    }
    if (CHECKPOINT_EVERY > 0 && done % CHECKPOINT_EVERY === 0) checkpoint();
    if (quiet) return;
    const line = `  [${done}/${total}] ok:${okCount} err:${errCount} new:${newOffers.length} 429:${httpStats.rateLimited} — ${name}`;
    if (isTty) {
      process.stdout.write('\r\x1b[2K' + line.slice(0, (process.stdout.columns || 120) - 1));
    } else if (done === total || done % 25 === 0) {
      console.log(line);
    }
  };

  // Round-robin across hosts so workers don't all pile onto one shared ATS host.
  const scanOrder = interleaveByHost(targets);
  const tasks = scanOrder.map(company => async () => {
    let provider = company._provider;
    const ctx = makeHttpCtx();
    let sourceName = provider.id === 'local-parser' ? 'local-parser' : `${provider.id}-api`;
    let taskOk = false;
    let taskError = null;
    let jobsFound = 0;
    try {
      let jobs;
      try {
        jobs = await provider.fetch(company, ctx);
      } catch (parserErr) {
        if (provider.id !== 'local-parser') throw parserErr;
        const fallback = resolveProvider(company, providers, { skipIds: ['local-parser'] });
        if (!fallback || fallback.error) throw parserErr;
        provider = fallback.provider;
        sourceName = `${provider.id}-api`;
        jobs = await provider.fetch(company, ctx);
        errors.push({
          company: company.name,
          error: `local parser failed, used API fallback: ${parserErr.message}`,
        });
      }
      if (!Array.isArray(jobs)) {
        throw new Error(`${provider.id}: fetch() did not return an array`);
      }
      totalFound += jobs.length;
      jobsFound = jobs.length;

      for (const job of jobs) {
        if (!titleFilter(job.title)) {
          totalFilteredTitle++;
          continue;
        }
        if (!locationFilter(job.location)) {
          totalFilteredLocation++;
          continue;
        }
        // Capture EVERY relevant live posting (pre-dedup) for the registry — the raw
        // cache is the current full set so rank-postings can mark dropped postings expired.
        matched.push({
          url: canonicalUrl(job.url),
          // For greenhouse/lever/ashby the posting URL IS the apply form; providers that
          // expose a distinct apply link set job.apply_url. The autofill extension opens this.
          apply_url: job.apply_url || job.url,
          title: job.title,
          company: job.company,
          location: job.location || '',
          description: job.description || '',
          department: job.department || '',
          date_posted: job.date_posted || '',
          comp: job.comp || null,
          employment_type: job.employment_type || '',
          provider: provider.id,
          careers_url: company.careers_url || '',
          source: sourceName,
        });
        if (seenUrls.has(job.url)) {
          totalDupes++;
          continue;
        }
        const key = `${job.company.toLowerCase()}::${job.title.toLowerCase()}`;
        if (seenCompanyRoles.has(key)) {
          totalDupes++;
          continue;
        }
        // Mark as seen to avoid intra-scan dupes
        seenUrls.add(job.url);
        seenCompanyRoles.add(key);
        newOffers.push({ ...job, source: sourceName });
      }
      taskOk = true;
    } catch (err) {
      errors.push({ company: company.name, error: err.message });
      taskError = err.message;
    } finally {
      reportProgress(company.name, taskOk, jobsFound, taskError, company.careers_url);
    }
  });

  await parallelFetch(tasks, CONCURRENCY);
  if (isTty && !quiet && total > 0) process.stdout.write('\n');

  // 5.4. Final checkpoint — flush any remaining new offers (non-verify path),
  // the scan ledger, and the raw postings snapshot for rank-postings.mjs. Carries
  // forward postings for skipped/un-scanned boards so they aren't falsely expired.
  if (!dryRun) {
    checkpoint();
    console.log(`  registry raw cache: ${matched.length} fresh + ${carriedCount} carried → ${POSTINGS_RAW_PATH}`);
  }

  // 5.5. Optional liveness verification — drop expired and guard-rejected postings
  let verifiedOffers = newOffers;
  let expiredOffers = [];
  let droppedOffers = [];
  let invalidOffers = [];
  if (verify && newOffers.length > 0) {
    console.log(`\nVerifying liveness of ${newOffers.length} new offer(s) with Playwright (sequential)...`);
    const result = await verifyOffers(newOffers);
    verifiedOffers = result.verified;
    expiredOffers = result.expired;
    droppedOffers = result.dropped;
    invalidOffers = result.invalid;
  }

  // 6. Write results
  // Non-verify offers were already flushed incrementally by checkpoint(). Only the
  // verify path — which filters newOffers down to verifiedOffers — writes here.
  if (!dryRun && verify && verifiedOffers.length > 0) {
    appendToPipeline(verifiedOffers);
    appendToScanHistory(verifiedOffers, date);
  }
  if (!dryRun && expiredOffers.length > 0) {
    appendToScanHistory(expiredOffers, date, 'skipped_expired');
  }
  // Pages that loaded but had no Apply control: record so we don't re-verify
  // them next scan, but never let them reach pipeline.md.
  if (!dryRun && droppedOffers.length > 0) {
    appendToScanHistory(droppedOffers, date, 'skipped_no_apply_control');
  }
  // Guard-rejected URLs (invalid / unsupported protocol / blocked host) are
  // recorded with a precise status so subsequent scans dedup-skip them via
  // loadSeenUrls, but they never reach pipeline.md.
  if (!dryRun && invalidOffers.length > 0) {
    // Group by code so the TSV reflects the actual reason category.
    const byStatus = new Map();
    for (const o of invalidOffers) {
      const status = guardStatusFor(o.code);
      if (!byStatus.has(status)) byStatus.set(status, []);
      byStatus.get(status).push(o);
    }
    for (const [status, group] of byStatus) {
      appendToScanHistory(group, date, status);
    }
  }

  // 7. Print summary
  console.log(`\n${'━'.repeat(45)}`);
  console.log(`Portal Scan — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Companies scanned:     ${targets.length}`);
  if (skippedRecent > 0) console.log(`Skipped (recent):      ${skippedRecent} (scanned <${SKIP_HOURS}h ago)`);
  console.log(`Total jobs found:      ${totalFound}`);
  console.log(`Filtered by title:     ${totalFilteredTitle} removed`);
  console.log(`Filtered by location:  ${totalFilteredLocation} removed`);
  console.log(`Duplicates:            ${totalDupes} skipped`);
  console.log(`HTTP 429s (retried):   ${httpStats.rateLimited} rate-limited, ${httpStats.retries} retries, ${httpStats.failures} gave up`);
  // Name the hosts doing the throttling. A bare total cannot distinguish one strict host from a
  // global concurrency problem, and those need opposite fixes.
  if (httpStats.rateLimited > 0) {
    const worst = [...httpStats.byHost]
      .filter(([, h]) => h.rateLimited > 0)
      .sort((a, b) => b[1].rateLimited - a[1].rateLimited)
      .slice(0, 5);
    for (const [host, h] of worst) {
      console.log(`    ${host.padEnd(34)} ${h.rateLimited} of ${h.requests} throttled (${Math.round(100 * h.rateLimited / h.requests)}%)`);
    }
  }
  if (verify) {
    console.log(`Expired (verified):    ${expiredOffers.length} dropped`);
    console.log(`No apply control:      ${droppedOffers.length} dropped`);
    console.log(`Invalid (guarded):     ${invalidOffers.length} dropped`);
  }
  console.log(`New offers added:      ${verifiedOffers.length}`);

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) {
      console.log(`  ✗ ${e.company}: ${e.error}`);
    }
  }

  if (verifiedOffers.length > 0) {
    console.log('\nNew offers:');
    for (const o of verifiedOffers) {
      console.log(`  + ${o.company} | ${o.title} | ${o.location || 'N/A'}`);
    }
    if (dryRun) {
      console.log('\n(dry run — run without --dry-run to save results)');
    } else {
      console.log(`\nResults saved to ${PIPELINE_PATH} and ${SCAN_HISTORY_PATH}`);
    }
  }

  // 8. Rebuild the postings registry from the raw cache we just wrote.
  // scan.mjs only produces data/postings/raw-latest.jsonl; the triage commands read
  // data/posting-research.jsonl + data/postings-personal.jsonl, which rank-postings.mjs
  // derives from it. Running it here keeps the registry current so "→ /byojb-triage-jobs"
  // is actually true — otherwise triage silently reads a pre-scan snapshot.
  // Skipped on --dry-run (nothing was written) and via --no-rank.
  if (!dryRun && !noRank) {
    console.log('\nRebuilding postings registry (rank-postings.mjs)...');
    try {
      execSync('node rank-postings.mjs', { stdio: 'inherit' });
    } catch (err) {
      console.warn(`⚠️  Failed to rebuild postings registry: ${err.message}`);
      console.warn('   Run "node rank-postings.mjs" manually before triaging.');
    }
  }

  console.log(`\n→ Run /byojb-triage-jobs to evaluate new offers.`);
  console.log('→ Share results and get help: https://discord.gg/8pRpHETxa4');
}

// Only run main() when invoked directly (`node scan.mjs`), not when imported by tests.
// `|| ''` guards the case where Node is invoked without a script arg (e.g. `node -e`).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
