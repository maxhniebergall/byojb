// Deterministic bulk JD-body fetcher (PURE HTTP — no LLM). Populates
// data/posting-research/<sk(key)>.md for postings that lack a captured body, and flips
// has_body=true in data/posting-research.jsonl so --emit-research links the file.
//
// Usage: node fetch-jd-bodies.mjs <minRank> [maxCount]
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sk, loadJsonl, saveJsonl } from './posting-core.mjs';

const ROOT = process.cwd();
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'postings-personal.jsonl');
const BODY_DIR = join(ROOT, 'data', 'posting-research');


const minRank = Number(process.argv[2] || 3);
const maxCount = Number(process.argv[3] || 100000);

// A 403/404 from an ATS *JSON* endpoint means the requisition was removed, not that we
// were blocked — Workday answers dead reqs with {"errorCode":"S22","httpStatus":403}.
// That inference is only safe for the authenticated-feeling JSON APIs. Scraped HTML pages
// (Indeed especially) answer 403 for anti-bot reasons while the job is very much alive,
// so for those only a 404 counts as gone.
const httpErr = (status, gone) => Object.assign(new Error('http ' + status), { status, gone });
const apiErr = (status) => httpErr(status, status === 403 || status === 404);
const pageErr = (status) => httpErr(status, status === 404);
const isGone = (e) => e?.gone === true;

const stripHtml = (h) => (h || '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&rdquo;|&ldquo;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

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

async function fetchGeneric(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' }, redirect: 'follow' });
  if (!r.ok) throw pageErr(r.status);
  const html = await r.text();
  return { title: '', body: stripHtml(html) };
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

async function fetchBody(url) {
  const host = new URL(url).hostname;
  if (/\.myworkdayjobs\.com$/i.test(host)) return fetchWorkday(url);
  if (/\.bamboohr\.com$/i.test(host)) return fetchBamboo(url);
  if (/smartrecruiters\.com$/i.test(host)) return fetchSmartRecruiters(url);
  return fetchGeneric(url);
}

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

const todo = personal
  .filter(p => live(p) && p.decision === 'undecided' && (p.llm_rank ?? 0) >= minRank)
  .filter(p => {
    const r = rByKey.get(p.key);
    if (!r) return false;
    if (refreshFirstParty) return r.url && !ATS_HOST.test(r.url);
    return !r.has_body && !r.extracted;
  })
  .sort((a, b) => (b.llm_rank - a.llm_rank))
  .slice(0, maxCount);

console.error(`Fetching ${todo.length} JD bodies (minRank ${minRank})…`);

let ok = 0, fail = 0, gone = 0, done = 0, skippedShorter = 0;
const fails = [];
const stamp = new Date().toISOString();
const CONC = 8;
let idx = 0;
async function worker() {
  while (idx < todo.length) {
    const p = todo[idx++];
    const r = rByKey.get(p.key);
    const path = join(BODY_DIR, sk(p.key) + '.md');
    try {
      const { title, body } = await fetchBody(r.url);
      if (!body || body.length < 120) throw new Error('empty/short body (' + body.length + ')');
      // Never trade a longer body for a shorter one. A first-party page can render as a JS shell,
      // and overwriting good ATS content with "You need to enable JavaScript" would lose real data.
      if (refreshFirstParty && existsSync(path)) {
        const cur = readFileSync(path, 'utf-8');
        if (body.length <= cur.length) { skippedShorter++; continue; }
      }
      writeFileSync(path, `${title || r.title || ''}\n${r.url}\n${body}\n`);
      r.has_body = true; ok++;
    } catch (e) {
      // Requisition pulled from the board — retire it so it stops occupying the queue.
      // Cheaper and more accurate than the Playwright --verify pass in scan.mjs.
      if (isGone(e)) { r.live = false; gone++; }
      else fail++;
      fails.push(`${stamp}\t${r.company} — ${r.title}\t${r.url}\t${e.message}${isGone(e) ? '\t(retired)' : ''}`);
    }
    if (++done % 25 === 0) console.error(`  ${done}/${todo.length} (ok=${ok} gone=${gone} fail=${fail})`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
saveJsonl(RESEARCH, research);
console.error(`\n✓ done: ${ok} ok, ${gone} retired (403/404), ${fail} failed${skippedShorter ? `, ${skippedShorter} kept (first-party page was shorter)` : ''}`);
// Append, don't truncate: a single-run view understated a multi-thousand-posting gap.
if (fails.length) appendFileSync(join(ROOT, 'data', 'fetch-jd-fails.tsv'), fails.join('\n') + '\n');
