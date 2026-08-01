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
    const json = await ctx.fetchJson(`https://${slug}.bamboohr.com/careers/list`);
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
