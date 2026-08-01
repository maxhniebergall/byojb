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

// Lever does NOT return the job description in one field. `descriptionPlain` is only the opening
// paragraph (~400 chars); the substance lives in `lists[]` — sections like "What You'll Do",
// "Who You Are" and, critically, "Where You'll Be" — with `additionalPlain` holding the closing
// block that usually carries the pay-transparency range.
//
// Reading `descriptionPlain` alone captured roughly 15% of each JD and silently dropped every
// requirement, every eligibility clause and every posted salary. That is why Spotify's "Toronto,
// remote" could not be resolved to a country: the section that answers it was never stored.
function leverBody(j) {
  const parts = [j.descriptionPlain || j.description || ''];
  for (const s of j.lists || []) {
    // `content` is HTML (usually <li> items); comp-core and the extractor both strip tags, and
    // keeping the section heading preserves the "Where You'll Be" / "Requirements" framing that
    // makes an eligibility line interpretable rather than a floating sentence.
    if (s?.text) parts.push(`\n## ${s.text}`);
    if (s?.content) parts.push(s.content);
  }
  if (j.additionalPlain || j.additional) parts.push('\n' + (j.additionalPlain || j.additional));
  return parts.filter(Boolean).join('\n').trim();
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
      // j.country is an ISO code Lever states independently of the city and of workplaceType —
      // the one place the API separates "which country is this role in" from "is it remote".
      // We were dropping it, leaving geo triage to guess a country from a bare city name.
      location: Array.from(new Set([
        j.categories?.location,
        j.workplaceType,
        ...(j.categories?.allLocations || []),
        j.country,
      ])).filter(Boolean).join(', '),
      // additive (postings registry) — all present in the same postings call
      description: leverBody(j),
      department: j.categories?.team || j.categories?.department || '',
      date_posted: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : '',
      comp: j.salaryRange || null,
      employment_type: j.categories?.commitment || '',
    }));
  },
};
