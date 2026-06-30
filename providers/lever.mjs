// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Lever provider — hits the public postings endpoint.
// Auto-detects from careers_url pattern `https://jobs.lever.co/<slug>`.

function resolveApiUrl(entry) {
  const url = entry.careers_url || '';
  const match = url.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (!match) return null;
  return `https://api.lever.co/v0/postings/${match[1]}`;
}

/** @type {Provider} */
export default {
  id: 'lever',

  detect(entry) {
    const apiUrl = resolveApiUrl(entry);
    return apiUrl ? { url: apiUrl } : null;
  },

  async fetch(entry, ctx) {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`lever: cannot derive API URL for ${entry.name}`);
    const json = await ctx.fetchJson(apiUrl);
    if (!Array.isArray(json)) return [];
    return json.map(j => ({
      title: j.text || '',
      url: j.hostedUrl || '',
      company: entry.name,
      location: Array.from(new Set([
        j.categories?.location,
        j.workplaceType,
        ...(j.categories?.allLocations || [])
      ])).filter(Boolean).join(', '),
      // additive (postings registry) — all present in the same postings call
      description: j.descriptionPlain || j.description || '',
      department: j.categories?.team || j.categories?.department || '',
      date_posted: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : '',
      comp: j.salaryRange || null,
      employment_type: j.categories?.commitment || '',
    }));
  },
};
