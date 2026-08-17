// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Workday provider (NEW) — hits the public Workday CXS JSON endpoint.
// Workday powers most large/enterprise employers (banks, telecom, big tech). Unlike the
// single-slug ATSs, a Workday board is identified by tenant + data-center + site, which
// can't be guessed from a company name — so the company's careers_url MUST be provided in
// portals.yml. Example careers_url forms this parses:
//   https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite
//   https://rbc.wd3.myworkdayjobs.com/en-US/RBCEXTERNAL
//
// Optional per-entry field `workday_search` (string or array) narrows huge boards at the
// source via Workday's searchText (recommended — enterprise boards can have 1000s of jobs).

const HOST_RE = /^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/i;
const LOCALE_RE = /^[a-z]{2}-[A-Z]{2}$/;
const PAGE_SIZE = 20;          // Workday caps `limit` at 20
// Ceiling per search, not a target. It used to be 100, which silently dropped the tail of any
// board bigger than that: Clio publishes 154 postings, so 54 were never fetched — and because
// Workday's result ORDER is not stable between calls, *which* 54 changed run to run. Coverage of
// a big board was effectively a per-scan sample with no signal that anything was missing.
// 2000 clears every board seen; a search that reaches it is reported, never swallowed.
const DEFAULT_MAX_PER_SEARCH = 2000;

function parseWorkday(entry) {
  const url = entry.careers_url || entry.api || '';
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const m = parsed.hostname.match(HOST_RE);
  if (!m) return null;
  const tenant = m[1];
  const segments = parsed.pathname.split('/').filter(Boolean);
  let locale = '';
  if (segments[0] && LOCALE_RE.test(segments[0])) locale = segments.shift();
  const site = segments[0];
  if (!site) return null;
  return {
    hostname: parsed.hostname,
    tenant,
    site,
    locale,
    cxs: `https://${parsed.hostname}/wday/cxs/${tenant}/${site}/jobs`,
  };
}

function jobUrl(info, externalPath) {
  if (!externalPath) return '';
  const prefix = info.locale ? `/${info.locale}` : '';
  return `https://${info.hostname}${prefix}/${info.site}${externalPath}`;
}

async function searchPages(ctx, info, searchText, maxResults) {
  const out = [];
  let reportedTotal = 0;
  for (let offset = 0; offset < maxResults; offset += PAGE_SIZE) {
    let json;
    try {
      json = await ctx.fetchJson(info.cxs, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, limit: PAGE_SIZE, offset, searchText }),
        redirect: 'error',
      });
    } catch {
      break; // network/4xx — stop paginating this search
    }
    const postings = Array.isArray(json?.jobPostings) ? json.jobPostings : [];
    out.push(...postings);
    const total = Number(json?.total) || 0;
    if (total) reportedTotal = total;
    // Compare against reportedTotal, NOT this page's `total`. Workday reports the count on the
    // FIRST page and then sends total: 0 for every page after it, so `offset + PAGE_SIZE >= total`
    // was 40 >= 0 on the second page — trivially true. Every Workday board stopped at 40 postings
    // no matter how high the ceiling went, which silently neutered raising it from 100 to 2000.
    // A short page is the honest end-of-results signal; the total is only a shortcut to stop early.
    if (postings.length < PAGE_SIZE) break;
    if (reportedTotal && offset + PAGE_SIZE >= reportedTotal) break;
  }
  // A board bigger than the ceiling is a partial scan. Say so — the old silent version made
  // "we found N jobs" indistinguishable from "we found the first N of M jobs".
  if (reportedTotal > out.length) {
    const term = searchText ? ` (search "${searchText}")` : '';
    console.warn(`  ⚠️  workday ${info.tenant}/${info.site}${term}: fetched ${out.length} of `
      + `${reportedTotal} postings — ${reportedTotal - out.length} NOT scanned. `
      + `Raise workday_max, or set workday_search to narrow the board at the source.`);
  }
  return out;
}

// Workday collapses a multi-site requisition's locationsText to the literal string "2 Locations"
// / "47 Locations" — 2,099 of 4,539 live Workday postings, 46%, carry that placeholder and nothing
// else. Geo triage is blind to all of them, and a "3 Locations" string reads as flexibility when
// the underlying req may be four-days-in-office in one named city.
//
// The primary location survives in externalPath: /job/<Location>/<Title>_<ReqId>. Workday encodes
// spaces as "-" and an existing " - " as "---", so decode longest-first. The count is kept as a
// suffix because "this req spans several sites" is itself real information.
function slugLocation(externalPath) {
  const m = String(externalPath || '').match(/\/job\/([^/]+)\//);
  if (!m) return '';
  return decodeURIComponent(m[1])
    .replace(/---/g, ' - ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function resolveLocation(p) {
  const text = p?.locationsText || '';
  if (!/^\d+\s+locations?$/i.test(text.trim())) return text;
  const fromSlug = slugLocation(p?.externalPath);
  return fromSlug ? `${fromSlug} (+${text.trim()})` : text;
}

/** @type {Provider} */
export default {
  id: 'workday',

  detect(entry) {
    const info = parseWorkday(entry);
    return info ? { url: info.cxs } : null;
  },

  async fetch(entry, ctx) {
    const info = parseWorkday(entry);
    if (!info) throw new Error(`workday: cannot parse careers_url for ${entry.name}`);

    const raw = entry.workday_search;
    const searches = Array.isArray(raw) ? raw : (raw ? [raw] : ['']);
    const maxPerSearch = Number(entry.workday_max || DEFAULT_MAX_PER_SEARCH);

    const seen = new Set();
    const jobs = [];
    for (const term of searches) {
      const postings = await searchPages(ctx, info, String(term), maxPerSearch);
      for (const p of postings) {
        if (!p?.externalPath || seen.has(p.externalPath)) continue;
        seen.add(p.externalPath);
        jobs.push({
          title: p.title || '',
          url: jobUrl(info, p.externalPath),
          company: entry.name,
          location: resolveLocation(p),
        });
      }
    }
    return jobs.filter(j => j.title && j.url);
  },
};
