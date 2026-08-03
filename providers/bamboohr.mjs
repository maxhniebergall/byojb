// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// BambooHR provider (NEW) — public careers JSON at https://{slug}.bamboohr.com/careers/list.

function slugFrom(entry) {
  const m = String(entry.careers_url || '').match(/^https?:\/\/([a-z0-9-]+)\.bamboohr\.com/i);
  return m ? m[1] : null;
}

/** @type {Provider} */
export default {
  id: 'bamboohr',

  detect(entry) {
    const slug = slugFrom(entry);
    return slug ? { url: `https://${slug}.bamboohr.com/careers/list` } : null;
  },

  async fetch(entry, ctx) {
    const slug = slugFrom(entry);
    if (!slug) throw new Error(`bamboohr: cannot parse careers_url for ${entry.name}`);
    // /careers/list is the right endpoint when the tenant's public portal is ON. When it is OFF the
    // request 302s to login.php and returns HTML, which reads as a broken board — 127 boards were
    // classified `blocked` on that basis and queued for repair they did not need.
    //
    // /jobs/embed2.php answers for those tenants, and its BODY (not its status, which is always 200
    // after redirects) tells the two apart: real board markup means the tenant exists, an empty body
    // means it does not. So fall back to it before concluding anything is wrong.
    let json;
    try {
      json = await ctx.fetchJson(`https://${slug}.bamboohr.com/careers/list`);
    } catch (err) {
      const embed = await ctx.fetchText(`https://${slug}.bamboohr.com/jobs/embed2.php`).catch(() => '');
      if (!embed.trim()) throw err;                       // no tenant at all — genuinely gone
      // Tenant exists with the portal disabled. It publishes nothing we can read, but it is not
      // broken and must not enter the repair queue.
      return [];
    }
    const jobs = Array.isArray(json?.result) ? json.result : [];
    return jobs.filter(j => j.id && j.jobOpeningName).map(j => {
      // BambooHR populates EITHER `location` OR `atsLocation`, per job, never both — and only
      // atsLocation carries a country (and uses `province` where the other uses `state`). Reading
      // just `location` left 169 of 334 live postings with an empty location string, which made
      // geo triage blind to them: samsters' one opening is Edmonton, Alberta, CANADA and showed
      // up as "". Merge the two, preferring whichever is actually populated.
      const loc = j.location || {};
      const ats = j.atsLocation || {};
      const isRemote = j.isRemote === 'yes' || ats.isRemote;
      const parts = [
        loc.city || ats.city,
        loc.state || ats.state || ats.province,
        loc.country || ats.country,
      ].filter(Boolean);
      return {
        title: j.jobOpeningName,
        url: `https://${slug}.bamboohr.com/careers/${j.id}`,
        company: entry.name,
        location: parts.join(', ') + (isRemote ? (parts.length ? ' ' : '') + 'Remote' : ''),
      };
    });
  },
};
