// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Gem provider — hits the public GraphQL endpoint.
// Auto-detects from careers_url pattern `https://jobs.gem.com/<boardId>`.

function resolveBoardId(entry) {
  const url = entry.careers_url || '';
  const match = url.match(/jobs\.gem\.com\/([^/?#]+)/);
  return match ? match[1] : null;
}

/** @type {Provider} */
export default {
  id: 'gem',

  detect(entry) {
    const boardId = resolveBoardId(entry);
    return boardId ? { url: `https://jobs.gem.com/${boardId}` } : null;
  },

  async fetch(entry, ctx) {
    const boardId = resolveBoardId(entry);
    if (!boardId) throw new Error(`gem: cannot derive boardId for ${entry.name}`);

    const query = `
      query JobBoardList($boardId: String!) {
        oatsExternalJobPostings(boardId: $boardId) {
          jobPostings {
            id
            extId
            title
            descriptionHtml
            locations {
              id
              name
              city
              isoCountry
              isRemote
              extId
            }
            job {
              id
              locationType
              employmentType
              department {
                id
                name
                extId
              }
            }
          }
        }
      }
    `;

    const body = JSON.stringify([{
      operationName: "JobBoardList",
      variables: { boardId },
      query
    }]);

    const res = await ctx.fetchJson('https://jobs.gem.com/api/public/graphql/batch', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body
    });

    const data = res?.[0]?.data;
    const postings = data?.oatsExternalJobPostings?.jobPostings;
    if (!Array.isArray(postings)) return [];

    return postings.map((j) => ({
      title: j.title || '',
      url: `https://jobs.gem.com/${boardId}/${j.extId}`,
      company: entry.name,
      location: (j.locations || []).map((l) => l.name).join(' • '),
      description: j.descriptionHtml || '',
      department: j.job?.department?.name || '',
      employment_type: j.job?.employmentType || '',
    }));
  },
};
