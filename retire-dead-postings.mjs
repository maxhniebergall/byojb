#!/usr/bin/env node
// retire-dead-postings.mjs (NEW) — remove listings that are gone, on evidence.
//
// THE GAP THIS FILLS
//
// rank-postings.mjs retires a posting when its board was scanned and the posting didn't come back.
// That only works when the board's scan produced postings at all: `scannedCompanyKeys` is inferred
// from the scan's own output, so a board that was read fine but returned nothing MATCHING is never
// recognised as scanned, and its listings are carried forward as live on every subsequent run —
// forever. Measured: 1,931 live postings last seen 31-60 days ago, 368 of them on boards the
// ledger records as `ok` with 0 jobs. Nothing in the pipeline could ever remove them.
//
// WHY THIS DOESN'T JUST TRUST THE LEDGER
//
// The obvious fix — "the ledger says the board was re-read OK after we last saw this posting,
// therefore the posting is gone" — is wrong, and expensively so. `raw-latest.jsonl` is the
// TITLE/LOCATION-FILTERED capture, so a posting can be absent from it while still sitting on the
// board; it merely stopped matching the filter. Probing a stratified sample of the 835 postings
// that rule selects, against the authoritative ATS APIs: 35 genuinely gone, 35 STILL LISTED
// (Saviynt, Invoca, comfy-org). A ~50% false-positive rate.
//
// Retiring a real opening is the worse error. A dead posting costs a wasted click; a wrongly
// retired one hides a job permanently, which is the single thing this tool exists not to do. So:
//
//   the ledger SELECTS candidates; the ATS API DECIDES.
//
// Same principle as hard exclusion (docs/hard-exclusion-plan.md): absence of evidence is not
// evidence. A posting we cannot check stays live and unretired.
//
// A THIRD way a posting dies, which neither of the above catches: the URL still answers 200 and
// renders a page, but the page is a TOMBSTONE — Workday's "The page you are looking for doesn't
// exist", or an ATS quietly redirecting a removed req to its careers index. fetch-jd-bodies.mjs
// detects those, but only when a body fetch SUCCEEDS; a posting whose fetch fails outright keeps no
// body and is never classified, so it sits live forever with facets and no text behind them.
// `--bodyless` closes that hole: it probes exactly the live postings that have no body on disk.
//
//   node retire-dead-postings.mjs             # dry run — report only, writes nothing
//   node retire-dead-postings.mjs --apply     # retire the confirmed-gone
//   node retire-dead-postings.mjs --all-live  # check every live posting, not just stale candidates
//   node retire-dead-postings.mjs --bodyless  # probe live postings that have NO body on disk
//   node retire-dead-postings.mjs --limit 500 # cap how many get probed

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadJsonl, saveJsonl, deriveCompanyKey, sk } from './posting-core.mjs';
import { isGonePage } from './jd-fetch-lib.mjs';

// Aggregator links can never be probed: Indeed and LinkedIn answer "Additional Verification
// Required" behind Cloudflare to a real headless browser, not just to a bare fetch. 64 of the 80
// bodyless postings are these. They are NOT evidence of death — RBC, Affirm, Okta and Speechify are
// all here with live reqs — so they must be excluded from the candidate set rather than probed and
// mistaken for gone.
const AGGREGATOR = /(^|\.)(indeed\.[a-z.]+|linkedin\.com)$/i;

const ROOT = dirname(fileURLToPath(import.meta.url));
const LEDGER = join(ROOT, 'data', 'scan-ledger.tsv');
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const COMPANY_RESEARCH = join(ROOT, 'data', 'company-research.jsonl');

const CONC = 8;

// A page that loads fine but says the role is closed. Kept in sync with fetch-jd-bodies.mjs's
// detection — a closed posting is dead whether we notice it while fetching a body or while
// sweeping. Deliberately NOT matching "applications close on…", which is a live posting with a
// deadline.
const CLOSED_RE = /position closed|no longer accepting|this job is closed|has been filled|posting is closed|job (?:post(?:ing)?|opening) (?:is )?(?:no longer|has been) (?:available|removed)/i;

// ─── candidate selection ────────────────────────────────────────────────────
// Latest SUCCESSFUL read per board, as company_key → YYYY-MM-DD.
//
// Only `ok` rows. `gone`/`blocked`/`error` mean we failed to read the board — that is a repair-queue
// problem (board-repair.mjs), never grounds to retire what it used to list.
//
// Truncated to a day because `last_seen` has day resolution. Comparing a full ISO timestamp against
// a bare `2026-08-02` makes every same-day scan sort as "after" it, which selected 11,756 of 16,454
// live postings instead of 835.
function loadBoardScans(companyByUrl) {
  if (!existsSync(LEDGER)) return new Map();
  const out = new Map();
  for (const line of readFileSync(LEDGER, 'utf-8').split('\n')) {
    const [, scanned_at, , status, careers_url] = line.split('\t');
    if (status !== 'ok' || !careers_url || !scanned_at) continue;
    const ck = companyByUrl.get(careers_url) || deriveCompanyKey(null, careers_url);
    if (!ck) continue;
    const day = scanned_at.slice(0, 10);
    const prev = out.get(ck);
    if (!prev || day > prev) out.set(ck, day);
  }
  return out;
}

// ─── verification ───────────────────────────────────────────────────────────
// One board fetch answers for every posting on it, so board listings are cached per run. With
// ~490 stale companies behind 835 postings that is the difference between 835 requests and ~490.
const boardCache = new Map();
async function boardIds(kind, slug) {
  const ck = `${kind}:${slug}`;
  if (boardCache.has(ck)) return boardCache.get(ck);
  const url = kind === 'ashby'
    ? `https://api.ashbyhq.com/posting-api/job-board/${slug}`
    : `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  let ids = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const j = await res.json();
      // A board that answers with an EMPTY list is meaningful: it exists and lists nothing, so
      // everything we hold for it is gone. A board that errors tells us nothing (ids = null).
      ids = new Set((j.jobs || []).map(x => String(kind === 'ashby' ? x.id : x.id)));
    }
  } catch { /* unreachable → inconclusive, handled by the null */ }
  boardCache.set(ck, ids);
  return ids;
}

// → 'gone' | 'live' | null (null = we could not tell, so leave it alone)
async function checkPosting(url) {
  let m;
  try {
    // Lever answers per posting, and 404s cleanly when the listing is pulled.
    if ((m = url.match(/jobs\.lever\.co\/([^/]+)\/([^/?#]+)/))) {
      const res = await fetch(`https://api.lever.co/v0/postings/${m[1]}/${m[2]}`, { signal: AbortSignal.timeout(20_000) });
      return res.status === 404 || res.status === 410 ? 'gone' : res.ok ? 'live' : null;
    }
    // Ashby and Greenhouse posting PAGES render client-side and return 200 with an empty shell for
    // a dead listing — checking them over HTTP reports every one of them as alive. It has to be the
    // board's job list. (This is exactly the mistake that made an earlier probe of mine read
    // 46 postings as live when the APIs said they were gone.)
    if ((m = url.match(/jobs\.ashbyhq\.com\/([^/]+)\/([0-9a-f-]{36})/i))) {
      const ids = await boardIds('ashby', m[1]);
      return ids ? (ids.has(m[2]) ? 'live' : 'gone') : null;
    }
    if ((m = url.match(/(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/))) {
      const ids = await boardIds('gh', m[1]);
      return ids ? (ids.has(m[2]) ? 'live' : 'gone') : null;
    }
    // BambooHR renders its posting page client-side, so the raw HTML never contains the "Current
    // Openings" text that gives away a removed req — only a real browser sees the redirect to the
    // careers index. Its detail API answers directly and cheaply instead.
    if ((m = url.match(/^https:\/\/([^.]+)\.bamboohr\.com\/careers\/(\d+)/i))) {
      const res = await fetch(`https://${m[1]}.bamboohr.com/careers/${m[2]}/detail`,
        { headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' }, signal: AbortSignal.timeout(20_000) });
      if (res.status === 404 || res.status === 403) return 'gone';
      if (!res.ok) return null;
      const j = await res.json().catch(() => null);
      // A 200 with no jobOpening is the removed-req shape.
      return j?.result?.jobOpening?.jobOpeningName ? 'live' : 'gone';
    }
    // Workday answers a REMOVED requisition with 403 (`{"errorCode":"S22","httpStatus":403}`) or
    // 404 on its CXS JSON API, while the HTML page still renders 200 and only reveals "The page you
    // are looking for doesn't exist" after JS runs. Asking the API is both cheaper and more certain
    // than rendering the page — the 403 here means gone, not blocked, which is the opposite of what
    // a 403 means on a scraped HTML page.
    if ((m = url.match(/^https:\/\/([^.]+)\.(wd\d+)\.myworkdayjobs\.com\/([^/]+)\/job\/(.+)$/))) {
      const [, tenant, wd, site, rest] = m;
      const res = await fetch(`https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/job/${rest}`,
        { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
      if (res.status === 403 || res.status === 404) return 'gone';
      return res.ok ? 'live' : null;
    }
    // Everything else: a real HTTP check. 404/410 is proof; a closed-page body is proof; anything
    // else (403, 5xx, timeout, a shell we can't interpret) is not, and returns null.
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) return null;
    const text = (await res.text()).slice(0, 6000);
    // isGonePage catches the tombstones that answer 200: an ATS not-found page, or a removed req
    // quietly redirected to the careers index (servicecore.bamboohr.com/careers/194 renders the
    // full "Current Openings" list, which does not include the job).
    return (CLOSED_RE.test(text) || isGonePage(text)) ? 'gone' : 'live';
  } catch { return null; }
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const allLive = argv.includes('--all-live');
  const bodyless = argv.includes('--bodyless');
  const li = argv.indexOf('--limit');
  const limit = li >= 0 ? Number(argv[li + 1]) : 0;

  const research = loadJsonl(RESEARCH);
  const companyByUrl = new Map();
  for (const c of loadJsonl(COMPANY_RESEARCH)) if (c.careers_url) companyByUrl.set(c.careers_url, c.key);
  const boardScans = loadBoardScans(companyByUrl);

  const liveRows = research.filter(r => r.live !== false && r.url);
  const hostOk = (u) => { try { return !AGGREGATOR.test(new URL(u).hostname); } catch { return false; } };
  // A live posting with no body on disk was never classified by fetch-jd-bodies (its detector only
  // runs when a fetch SUCCEEDS), so a tombstone URL sits live indefinitely, carrying facets with no
  // text behind them. Probe exactly those.
  let candidates = bodyless
    ? liveRows.filter(r => !existsSync(join(ROOT, 'data', 'posting-research', sk(r.key) + '.md')) && hostOk(r.url))
    : allLive ? liveRows : liveRows.filter(r => {
    const okAt = boardScans.get(r.company_key);
    return okAt && r.last_seen && okAt > String(r.last_seen).slice(0, 10);
  });
  // Oldest first: the longer a posting has gone unconfirmed, the likelier it is dead, so a capped
  // run spends its budget where the hit rate is highest.
  candidates.sort((a, b) => String(a.last_seen || '').localeCompare(String(b.last_seen || '')));
  if (limit > 0) candidates = candidates.slice(0, limit);

  console.log(`${liveRows.length} live postings · ${candidates.length} to verify` +
    (bodyless ? ' (no body on disk; aggregator links excluded — they cannot be probed)'
      : allLive ? ' (--all-live)' : ' (board re-read OK since the posting was last seen)'));
  if (!candidates.length) { console.log('nothing to check.'); return; }

  let done = 0;
  const verdicts = await mapLimit(candidates, CONC, async (r) => {
    const v = await checkPosting(r.url);
    if (++done % 100 === 0) process.stdout.write(`  ${done}/${candidates.length}\r`);
    return v;
  });

  const gone = [], stillLive = [], unknown = [];
  candidates.forEach((r, i) => (verdicts[i] === 'gone' ? gone : verdicts[i] === 'live' ? stillLive : unknown).push(r));

  console.log(`\n  confirmed gone : ${gone.length}`);
  console.log(`  still listed   : ${stillLive.length}   (left live — the filter, not the board, dropped them)`);
  console.log(`  inconclusive   : ${unknown.length}   (left live — absence of evidence is not evidence)`);

  const byCompany = {};
  for (const r of gone) byCompany[r.company || r.company_key] = (byCompany[r.company || r.company_key] || 0) + 1;
  const top = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) {
    console.log('\n  most affected employers:');
    for (const [c, n] of top) console.log(`    ${String(n).padStart(4)}  ${c}`);
  }

  if (!apply) { console.log('\nDry run. Re-run with --apply to retire the confirmed-gone.'); return; }
  if (!gone.length) { console.log('\nNothing to retire.'); return; }

  const goneKeys = new Set(gone.map(r => r.key));
  const today = new Date().toISOString().slice(0, 10);
  for (const r of research) {
    if (!goneKeys.has(r.key)) continue;
    r.live = false;
    // Why it was retired, not just that it was — the same auditability Change 2 of the
    // hard-exclusion plan asks for. A bare `live:false` cannot be reviewed or reversed with
    // confidence later.
    r.retired_at = today;
    r.retired_reason = 'verified-gone';
  }
  saveJsonl(RESEARCH, research);
  console.log(`\n✓ retired ${gone.length} postings (live:false, retired_reason: verified-gone)`);
  console.log(`  → ${RESEARCH}`);
  console.log(`  re-run \`node score-postings.mjs\` to refresh the dashboard.`);
}

main();
