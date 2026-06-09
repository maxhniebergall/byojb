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
const DEFAULT_MAX_PER_SEARCH = 100;

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
    if (postings.length < PAGE_SIZE || offset + PAGE_SIZE >= total) break;
  }
  return out;
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
          location: p.locationsText || '',
        });
      }
    }
    return jobs.filter(j => j.title && j.url);
  },
};
