// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// HiBob provider — the careers site at https://{slug}.careers.hibob.com/jobs is an
// Angular SPA, but the list it renders comes from a single unauthenticated JSON
// call to /api/job-ad on the same host, which returns every published job ad
// WITH its full HTML body (no per-job requests needed).
//
// Two headers are mandatory and neither is obvious:
//   * `companyIdentifier` — the SPA installs an HttpInterceptor that appends this
//     header (value = the careers subdomain) to every API request. Without it the
//     backend cannot resolve the tenant and answers 401 Unauthorized, even though
//     the subdomain is already in the URL. This is the header, not a query param.
//   * `accept: application/json` — the Jersey backend content-negotiates strictly:
//     an `Accept: text/html` (i.e. any browser-shaped header set) gets 406 Not
//     Acceptable. Pinning it to JSON keeps us immune to the shared default UA
//     headers ever gaining an HTML-preferring Accept.
// Dropping either one silently breaks the provider, so keep both.

function slugFrom(entry) {
  const m = String(entry.careers_url || '').match(/^https?:\/\/([a-z0-9-]+)\.careers\.hibob\.com/i);
  return m ? m[1] : null;
}

// Pay transparency is optional per job ad; all five fields are null when the
// company hasn't opted in, so only build a string when there's a real range.
function compFrom(j) {
  const min = j.payTransparencyMinSalary;
  const max = j.payTransparencyMaxSalary;
  if (min == null && max == null) return null;
  const currency = j.payTransparencySalaryCurrency || '';
  const period = j.payTransparencySalaryPayPeriod || '';
  const range = [min, max].filter(v => v != null).join(' - ');
  return [currency, range, period && `per ${period}`].filter(Boolean).join(' ').trim();
}

/** @type {Provider} */
export default {
  id: 'hibob',

  detect(entry) {
    const slug = slugFrom(entry);
    return slug ? { url: `https://${slug}.careers.hibob.com/api/job-ad` } : null;
  },

  async fetch(entry, ctx) {
    const slug = slugFrom(entry);
    if (!slug) throw new Error(`hibob: cannot parse careers_url for ${entry.name}`);
    const json = await ctx.fetchJson(`https://${slug}.careers.hibob.com/api/job-ad`, {
      headers: { accept: 'application/json', companyIdentifier: slug },
    });
    const jobs = Array.isArray(json?.jobAdDetails) ? json.jobAdDetails : [];
    return jobs.filter(j => j.id && j.title).map(j => {
      // `site` is the office name and `country` its country — they're frequently
      // identical ("South Africa" / "South Africa"), so dedupe before joining.
      const parts = [...new Set([j.site, j.country].filter(Boolean))];
      const remote = /remote/i.test(String(j.workspaceType || ''));
      return {
        title: j.title,
        url: `https://${slug}.careers.hibob.com/jobs/${j.id}`,
        company: entry.name,
        location: parts.join(', ') + (remote ? (parts.length ? ' ' : '') + 'Remote' : ''),
        // additive (postings registry) — undefined when absent; never breaks the base shape
        description: j.description || '',              // HTML body, returned by the list call
        department: j.department || '',
        date_posted: j.publishedAt || '',
        comp: compFrom(j),
        employment_type: j.employmentType || '',
      };
    });
  },
};
