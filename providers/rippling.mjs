// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Rippling ATS provider (NEW) — board is a Next.js page; jobs are embedded in __NEXT_DATA__
// under pageProps.dehydratedState.queries[*].state.data.items (with id/name/url/locations).

function slugFrom(entry) {
  const url = String(entry.careers_url || '');
  const m = url.match(/ats\.rippling\.com\/([^/?#]+)/i);
  return m ? m[1] : null;
}

function locString(locations) {
  if (!Array.isArray(locations)) return '';
  return locations
    .map(l => [l.city, l.state, l.country].filter(Boolean).join(', ') + (l.workplaceType === 'REMOTE' ? ' Remote' : ''))
    .join('; ');
}

/** @type {Provider} */
export default {
  id: 'rippling',

  detect(entry) {
    const slug = slugFrom(entry);
    return slug ? { url: `https://ats.rippling.com/${slug}/jobs` } : null;
  },

  async fetch(entry, ctx) {
    const slug = slugFrom(entry);
    if (!slug) throw new Error(`rippling: cannot parse careers_url for ${entry.name}`);
    const base = `https://ats.rippling.com/${slug}/jobs`;
    const html = await ctx.fetchText(base);
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return [];
    let data; try { data = JSON.parse(m[1]); } catch { return []; }
    const queries = data?.props?.pageProps?.dehydratedState?.queries || [];
    for (const q of queries) {
      const items = q?.state?.data?.items;
      if (Array.isArray(items) && items.length && items[0] && items[0].url) {
        return items.filter(x => x.name && x.url).map(x => ({
          title: x.name,
          url: new URL(x.url, base).href,
          company: entry.name,
          location: locString(x.locations),
        }));
      }
    }
    return [];
  },
};
