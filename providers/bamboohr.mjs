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
      const loc = j.location || {};
      const isRemote = j.isRemote === 'yes' || j.atsLocation?.isRemote;
      return {
        title: j.jobOpeningName,
        url: `https://${slug}.bamboohr.com/careers/${j.id}`,
        company: entry.name,
        location: [loc.city, loc.state, loc.country].filter(Boolean).join(', ') + (isRemote ? ' Remote' : ''),
      };
    });
  },
};
