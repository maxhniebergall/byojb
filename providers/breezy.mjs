// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Breezy provider (NEW) — public JSON at https://{slug}.breezy.hr/json.

function slugFrom(entry) {
  const m = String(entry.careers_url || '').match(/^https?:\/\/([a-z0-9-]+)\.breezy\.hr/i);
  return m ? m[1] : null;
}

/** @type {Provider} */
export default {
  id: 'breezy',

  detect(entry) {
    const slug = slugFrom(entry);
    return slug ? { url: `https://${slug}.breezy.hr/json` } : null;
  },

  async fetch(entry, ctx) {
    const slug = slugFrom(entry);
    if (!slug) throw new Error(`breezy: cannot parse careers_url for ${entry.name}`);
    const json = await ctx.fetchJson(`https://${slug}.breezy.hr/json`);
    if (!Array.isArray(json)) return [];
    return json.filter(j => j.name && j.friendly_id).map(j => {
      const loc = j.location || {};
      return {
        title: j.name,
        url: j.url || `https://${slug}.breezy.hr/p/${j.friendly_id}`,
        company: entry.name,
        location: (loc.name || [loc.city?.name, loc.country?.name].filter(Boolean).join(', ')) + (loc.is_remote ? ' Remote' : ''),
      };
    });
  },
};
