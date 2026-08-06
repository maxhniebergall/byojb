// Deterministic bulk JD-body fetcher (PURE HTTP first — no LLM). Populates
// data/posting-research/<sk(key)>.md for postings that lack a captured body, and flips
// has_body=true in data/posting-research.jsonl so --emit-research links the file.
//
// THREE TIERS, escalating only as far as it has to:
//   1. ATS JSON API derived from the posting URL   (~200ms, richest content)
//   2. plain HTTP with a browser UA                (~200ms)
//   3. Playwright/Chromium                         (1-3s — last resort, opt-out via --no-browser)
//
// Why tier 1 exists, concretely: 8 Nebius postings are stored as `careers.nebius.com/?gh_jid=NNN`.
// That page renders client-side, so the HTTP fetch captured the careers INDEX page as the "body" —
// a complete-looking record with none of the job in it. `boards-api.greenhouse.io/v1/boards/nebius/
// jobs/<gh_jid>` returns the real 3.3k-char JD with no browser at all. Same story on Lever: of 35
// live short (<900ch) `jobs.lever.co` postings sampled, 21 had >900 chars sitting in the per-posting
// Lever API we never called.
//
// Usage: node fetch-jd-bodies.mjs <minRank> [maxCount] [--refresh-first-party|--refresh-thin|--all-missing] [--no-browser]
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sk, loadJsonl, saveJsonl } from './posting-core.mjs';
import { leverBody } from './providers/lever.mjs';
import {
  CLOSED, isThin, decodeEntities, stripHtml, sharedBodyKeys,
  greenhouseTarget, leverTarget, commitDecision,
} from './jd-fetch-lib.mjs';

const ROOT = process.cwd();
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'postings-personal.jsonl');
const BODY_DIR = join(ROOT, 'data', 'posting-research');

const minRank = Number(process.argv[2] || 3);
const maxCount = Number(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 100000);

// A 403/404 from an ATS *JSON* endpoint means the requisition was removed, not that we
// were blocked — Workday answers dead reqs with {"errorCode":"S22","httpStatus":403}.
// That inference is only safe for the authenticated-feeling JSON APIs. Scraped HTML pages
// (Indeed especially) answer 403 for anti-bot reasons while the job is very much alive,
// so for those only a 404 counts as gone.
const httpErr = (status, gone) => Object.assign(new Error('http ' + status), { status, gone });
const apiErr = (status) => httpErr(status, status === 403 || status === 404);
const pageErr = (status) => httpErr(status, status === 404);
const isGone = (e) => e?.gone === true;

// ── Tier 1: ATS JSON APIs derived from the posting URL ──────────────

async function fetchWorkday(url) {
  const u = new URL(url);
  const tenant = u.hostname.split('.')[0];
  const segs = u.pathname.split('/').filter(Boolean);
  // locale segment (xx-XX) may precede the site
  if (/^[a-z]{2}-[A-Z]{2}$/.test(segs[0])) segs.shift();
  const site = segs[0];
  const jobPath = '/' + segs.slice(1).join('/');
  const cxs = `https://${u.hostname}/wday/cxs/${tenant}/${site}${jobPath}`;
  const r = await fetch(cxs, { headers: { accept: 'application/json' }, redirect: 'follow' });
  if (!r.ok) throw apiErr(r.status);
  const j = await r.json();
  const info = j.jobPostingInfo || {};
  const body = stripHtml(info.jobDescription);
  const loc = info.location || (Array.isArray(info.additionalLocations) ? info.additionalLocations.join('; ') : '');
  return { title: info.title || '', body: (loc ? `Location: ${loc}\n\n` : '') + body };
}

async function fetchBamboo(url) {
  const u = new URL(url);
  const id = (u.pathname.match(/careers\/(\d+)/) || [])[1];
  if (!id) throw new Error('no bamboo id');
  const r = await fetch(`${u.origin}/careers/${id}/detail`, { headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' } });
  if (!r.ok) throw apiErr(r.status);
  const j = await r.json();
  const o = j?.result?.jobOpening || {};
  const loc = o.location ? `Location: ${[o.location.city, o.location.state, o.location.addressCountry].filter(Boolean).join(', ')}\n` : '';
  const comp = o.compensation ? `Compensation: ${o.compensation}\n` : '';
  return { title: o.jobOpeningName || '', body: `${loc}${o.employmentStatusLabel || ''}\n${comp}\n${stripHtml(o.description)}` };
}

async function fetchSmartRecruiters(url) {
  const segs = new URL(url).pathname.split('/').filter(Boolean); // [company, postings, id-slug] or [company, id-slug]
  const company = segs[0];
  const idPart = segs[segs.length - 1];
  const id = (idPart.match(/^(\d+)/) || [])[1] || idPart;
  const r = await fetch(`https://api.smartrecruiters.com/v1/companies/${company}/postings/${id}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw apiErr(r.status);
  const j = await r.json();
  const s = j?.jobAd?.sections || {};
  const parts = [s.jobDescription, s.qualifications, s.additionalInformation].map(x => stripHtml(x?.text)).filter(Boolean);
  const loc = j.location ? `Location: ${[j.location.city, j.location.region, j.location.country].filter(Boolean).join(', ')}${j.location.remote ? ' (remote)' : ''}\n\n` : '';
  return { title: j.name || '', body: loc + parts.join('\n\n') };
}

async function fetchGreenhouse(url, rec) {
  const api = greenhouseTarget(url, rec?.company_key);
  if (!api) throw new Error('no greenhouse id/board');
  const r = await fetch(api, { headers: { accept: 'application/json' } });
  if (!r.ok) throw apiErr(r.status);
  const j = await r.json();
  const loc = j?.location?.name ? `Location: ${j.location.name}\n\n` : '';
  // `content` is HTML *entity-encoded* HTML (&lt;p&gt;…): decode once, then strip tags.
  return { title: j.title || '', body: loc + stripHtml(decodeEntities(j.content)) };
}

// Lever's per-posting endpoint. Body assembly is providers/lever.mjs's leverBody() verbatim —
// descriptionPlain alone is ~15% of the JD (the opening paragraph); lists[] holds the requirements
// and "Where You'll Be", additionalPlain the pay-transparency block.
async function fetchLever(url) {
  const api = leverTarget(url);
  if (!api) throw new Error('no lever id');
  const r = await fetch(api, { headers: { accept: 'application/json' } });
  if (!r.ok) throw apiErr(r.status);
  const j = await r.json();
  const loc = j?.categories?.location ? `Location: ${j.categories.location}\n\n` : '';
  return { title: j.text || '', body: loc + stripHtml(leverBody(j)) };
}

function tier1Fetcher(url, rec) {
  let host;
  try { host = new URL(url).hostname; } catch { return null; }
  if (/\.myworkdayjobs\.com$/i.test(host)) return () => fetchWorkday(url);
  if (/\.bamboohr\.com$/i.test(host)) return () => fetchBamboo(url);
  if (/smartrecruiters\.com$/i.test(host)) return () => fetchSmartRecruiters(url);
  if (leverTarget(url)) return () => fetchLever(url);
  if (greenhouseTarget(url, rec?.company_key)) return () => fetchGreenhouse(url, rec);
  return null;
}

// ── Tier 2: plain HTTP ───────────────────────────────────────────────

async function fetchGeneric(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' }, redirect: 'follow' });
  if (!r.ok) throw pageErr(r.status);
  const html = await r.text();
  return { title: '', body: stripHtml(html) };
}

// ── Tier 3: Playwright ───────────────────────────────────────────────
// One browser for the whole run, pages reused per worker, torn down in a finally. Kept strictly
// last: a page load is 1-3s against ~200ms for HTTP, so a full-corpus browser pass would cost hours.
// scan.mjs --verify runs Chromium strictly sequentially; here we allow 2 in flight because these are
// plain reads with no classifier state, and nothing else contends for the browser.
const BROWSER_CONC = 2;

async function launchBrowser() {
  // Dynamic import keeps the default HTTP-only path free of Playwright startup cost, and lets a
  // machine without Chromium installed still run tiers 1-2 instead of dying at require time.
  try {
    const { chromium } = await import('playwright');
    return await chromium.launch({ headless: true });
  } catch (err) {
    console.error(`  (tier 3 disabled — no Chromium: ${err.message.split('\n')[0]})`);
    return null;
  }
}

async function fetchWithPage(page, url) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  const status = resp?.status();
  if (status && status >= 400) throw pageErr(status);
  // Client-rendered boards paint the JD after hydration; a short settle beats a networkidle wait
  // on pages that keep long-poll connections open.
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const body = text && text.length > 200 ? text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    : stripHtml(await page.content());
  return { title: '', body };
}

// ── Selection ────────────────────────────────────────────────────────

const personal = loadJsonl(PERSONAL);
const research = loadJsonl(RESEARCH);
const rByKey = new Map(research.map(r => [r.key, r]));
const live = (p) => rByKey.get(p.key)?.live !== false;

// An ATS record is not always the whole posting. Stripe's Greenhouse content ends at "Preferred
// qualifications" and contains the word "remote" ZERO times, while the same job on stripe.com
// carries a "Hybrid work at Stripe" section stating it is available remotely in Canada. The scan
// stores the ATS content as the body, which sets has_body=true, so this script — which only ever
// fetched postings LACKING a body — never revisited it. A complete-looking body hid a truncated one.
//
// --refresh-first-party re-fetches postings whose URL is the company's OWN site (not an ATS host),
// where that richer page exists, and keeps whichever version is longer.
const ATS_HOST = /greenhouse\.io|lever\.co|ashbyhq\.com|bamboohr\.com|myworkdayjobs\.com|smartrecruiters\.com|workable\.com|recruitee\.com|breezy\.hr|rippling\.com|indeed\.com|linkedin\.com|hibob\.com/i;
const refreshFirstParty = process.argv.includes('--refresh-first-party');
const refreshThin = process.argv.includes('--refresh-thin');
const allMissing = process.argv.includes('--all-missing');
const noBrowser = process.argv.includes('--no-browser');

const bodyPath = (key) => join(BODY_DIR, sk(key) + '.md');
function storedBody(key) {
  const path = bodyPath(key);
  if (!existsSync(path)) return null;
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

// Postings whose stored "body" is really the company's careers INDEX page, identified by several
// live siblings sharing the identical text (the Nebius case). --refresh-thin picks these up too:
// they are long, so the thin test misses them, and only a tier-1 API call can fix them.
const candidates = personal.filter(p => live(p) && p.decision === 'undecided' && (p.llm_rank ?? 0) >= minRank);
// Stored files are `title\nurl\nbody`; the first two lines differ per posting, so fingerprint the
// body alone or every sibling looks unique.
const bodyText = (file) => (file == null ? null : file.split('\n').slice(2).join('\n'));
const indexPageKeys = refreshThin
  ? sharedBodyKeys(candidates.map(p => ({ key: p.key, company: rByKey.get(p.key)?.company || '', body: bodyText(storedBody(p.key)) })))
  : new Set();

const todo = candidates
  .filter(p => {
    const r = rByKey.get(p.key);
    if (!r) return false;
    // --refresh-thin is about bodies we DID capture but that are stubs (the 363 short + 55 JS-shell
    // set) or the wrong page entirely. Postings with no file at all are the default mode's job.
    if (refreshThin) {
      const cur = storedBody(p.key);
      return !!r.url && cur != null && (isThin(cur) || indexPageKeys.has(p.key));
    }
    if (refreshFirstParty) return r.url && !ATS_HOST.test(r.url);
    // Default skips postings that already have facets, on the assumption that a researched posting
    // needs nothing more. That assumption breaks for 477 rows which have facets and NO body on disk:
    // their facts were read from the ATS location field (Cronometer's "Revelstoke, British Columbia"
    // → canada, fair enough) or from nothing at all (ServiceCore asserts remote + canada with an
    // EMPTY location, and its URL is a BambooHR tombstone). 229 of them claim Canadian eligibility.
    // --all-missing includes them: fetching settles it, and because a fetch stamps `body_fetched_at`
    // against their absent `extracted_at`, they then show up in `dump-jd-batch --stale` for
    // re-extraction against real text.
    return !r.has_body && (allMissing || !r.extracted);
  })
  .sort((a, b) => (b.llm_rank - a.llm_rank))
  .slice(0, maxCount);

const mode = refreshThin ? 'refresh-thin' : refreshFirstParty ? 'refresh-first-party' : 'missing-body';
console.error(`Fetching ${todo.length} JD bodies (minRank ${minRank}, ${mode}${noBrowser ? ', no browser' : ''})…`);

// ── Run ──────────────────────────────────────────────────────────────

const stats = { tier1: 0, tier2: 0, tier3: 0, closed: 0, gone: 0, fail: 0, keptShorter: 0 };
const fails = [];
const stamp = new Date().toISOString();
let done = 0;

function record(p, r, res, tier) {
  const cur = storedBody(p.key);
  // Only a tier-1 ATS API answer is allowed to overwrite a longer stored body, and only when that
  // stored body was identified as a shared careers-index page. Everything else obeys longer-wins.
  const d = commitDecision({ body: res.body, current: cur, authoritative: tier === 1 && indexPageKeys.has(p.key) });
  if (d.action === 'closed') {
    // Dead in words rather than in a status code — retire it exactly as the 404 path does.
    r.live = false; stats.closed++;
    fails.push(`${stamp}\t${r.company} — ${r.title}\t${r.url}\tclosed-posting text\t(retired)`);
    return;
  }
  if (d.action === 'kept-shorter') { stats.keptShorter++; return; }
  writeFileSync(bodyPath(p.key), `${res.title || r.title || ''}\n${r.url}\n${res.body}\n`);
  r.has_body = true;
  // Provenance so a later pass can tell an ATS-API body from a scraped page without re-fetching.
  r.body_src = ['', 'ats-api', 'http', 'browser'][tier];
  // WHEN the body was captured, so stale facets are detectable. `extracted` holds facts read OUT of
  // a body; replacing that body silently invalidates them, and the score is computed from the facts,
  // not the text — so a posting can carry a confident score derived from a JD that no longer exists
  // on disk. Without this timestamp there is no way to ask "which facets predate their body?".
  // One corpus refresh created 368 such rows before this field existed.
  r.body_fetched_at = new Date().toISOString().slice(0, 10);
  stats[`tier${tier}`]++;
}

// Phase A — HTTP tiers, 8 wide. Anything still thin afterwards is queued for the browser.
const browserQueue = [];
const CONC = 8;
let idx = 0;
async function httpWorker() {
  while (idx < todo.length) {
    const p = todo[idx++];
    const r = rByKey.get(p.key);
    let best = null, bestTier = 0, goneSeen = false, lastErr = null;

    const t1 = tier1Fetcher(r.url, r);
    for (const [tier, fn] of [[1, t1], [2, () => fetchGeneric(r.url)]]) {
      if (!fn) continue;
      // Tier 1 answered with a full JD — don't spend a second request on the HTML page.
      if (best && !isThin(best.body)) break;
      try {
        const res = await fn();
        if (res?.body && res.body.length >= 120 && (!best || res.body.length > best.body.length)) { best = res; bestTier = tier; }
      } catch (e) {
        if (isGone(e)) goneSeen = true;
        lastErr = e;
      }
    }

    if (best && !isThin(best.body)) record(p, r, best, bestTier);
    else if (best && CLOSED.test(best.body)) record(p, r, best, bestTier); // retire on the closed text even when short
    else if (!noBrowser) browserQueue.push({ p, r, best, bestTier, goneSeen, lastErr });
    else if (best) record(p, r, best, bestTier);
    else if (goneSeen) {
      // Requisition pulled from the board — retire it so it stops occupying the queue.
      r.live = false; stats.gone++;
      fails.push(`${stamp}\t${r.company} — ${r.title}\t${r.url}\t${lastErr.message}\t(retired)`);
    } else {
      stats.fail++;
      fails.push(`${stamp}\t${r.company} — ${r.title}\t${r.url}\t${lastErr?.message || 'empty body'}`);
    }
    if (++done % 25 === 0) console.error(`  ${done}/${todo.length} (t1=${stats.tier1} t2=${stats.tier2} gone=${stats.gone} fail=${stats.fail})`);
  }
}
await Promise.all(Array.from({ length: Math.min(CONC, todo.length) }, httpWorker));

// Phase B — Playwright, only for what tiers 1-2 could not answer.
if (browserQueue.length) {
  console.error(`Escalating ${browserQueue.length} to tier 3 (browser)…`);
  const browser = await launchBrowser();
  if (!browser) {
    for (const t of browserQueue) settleWithoutBrowser(t);
  } else {
    let bi = 0;
    const bworker = async () => {
      const page = await browser.newPage({ userAgent: 'Mozilla/5.0' });
      try {
        while (bi < browserQueue.length) {
          const t = browserQueue[bi++];
          try {
            const res = await fetchWithPage(page, t.r.url);
            if (res.body && res.body.length >= 120 && (!t.best || res.body.length > t.best.body.length)) {
              record(t.p, t.r, res, 3);
              continue;
            }
          } catch (e) {
            if (isGone(e)) t.goneSeen = true;
            t.lastErr = e;
          }
          settleWithoutBrowser(t);
        }
      } finally {
        await page.close().catch(() => {});
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(BROWSER_CONC, browserQueue.length) }, bworker));
    } finally {
      await browser.close().catch(() => {});
    }
  }
}

function settleWithoutBrowser(t) {
  if (t.best) { record(t.p, t.r, t.best, t.bestTier); return; }
  if (t.goneSeen) {
    t.r.live = false; stats.gone++;
    fails.push(`${stamp}\t${t.r.company} — ${t.r.title}\t${t.r.url}\t${t.lastErr.message}\t(retired)`);
    return;
  }
  stats.fail++;
  fails.push(`${stamp}\t${t.r.company} — ${t.r.title}\t${t.r.url}\t${t.lastErr?.message || 'empty body'}`);
}

// Single writer, at the end — data/posting-research.jsonl is the shared registry.
saveJsonl(RESEARCH, research);
const stored = stats.tier1 + stats.tier2 + stats.tier3;
console.error(`\n✓ done: ${stored} bodies stored — tier1(ATS API) ${stats.tier1}, tier2(HTTP) ${stats.tier2}, tier3(browser) ${stats.tier3}`);
console.error(`  retired: ${stats.gone} (403/404), ${stats.closed} (closed-posting text)`);
console.error(`  ${stats.keptShorter} kept (new fetch was shorter), ${stats.fail} failed`);
// Append, don't truncate: a single-run view understated a multi-thousand-posting gap.
if (fails.length) appendFileSync(join(ROOT, 'data', 'fetch-jd-fails.tsv'), fails.join('\n') + '\n');
