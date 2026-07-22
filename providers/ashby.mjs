// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Ashby provider — hits the public GraphQL non-user-graphql endpoint.
// This is robust against companies that have disabled REST API access.

const ASHBY_TIMEOUT_MS = 30_000;

function resolveCompanySlug(entry) {
  const url = entry.careers_url || '';
  const match = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  return match ? match[1] : null;
}

const BROAD_TECH_REGEX = /(engineer|developer|platform|infra|backend|data|systems|mlops|devops|cloud|inference|java|architect|programmer|reliability|technical)/i;

/** @type {Provider} */
export default {
  id: 'ashby',

  detect(entry) {
    const slug = resolveCompanySlug(entry);
    return slug ? { url: `https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams` } : null;
  },

  async fetch(entry, ctx) {
    const slug = resolveCompanySlug(entry);
    if (!slug) throw new Error(`ashby: cannot derive slug for ${entry.name}`);

    const listBody = {
      operationName: "ApiJobBoardWithTeams",
      variables: { organizationHostedJobsPageName: slug },
      query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
        jobBoard: jobBoardWithTeams(
          organizationHostedJobsPageName: $organizationHostedJobsPageName
        ) {
          jobPostings {
            id
            title
            locationName
            workplaceType
            employmentType
            secondaryLocations {
              locationName
            }
            compensationTierSummary
          }
        }
      }`
    };

    const listJson = await ctx.fetchJson("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(listBody),
      timeoutMs: ASHBY_TIMEOUT_MS
    });

    const rawJobs = listJson?.data?.jobBoard?.jobPostings || [];

    // Filter to only tech/relevant roles to avoid fetching JDs for unrelated roles in parallel
    const candidateJobs = rawJobs.filter(j => BROAD_TECH_REGEX.test(j.title));

    // Fetch JDs for candidates in parallel
    const jds = new Map();
    await Promise.all(candidateJobs.map(async (j) => {
      try {
        const detailBody = {
          operationName: "ApiJobPosting",
          variables: { organizationHostedJobsPageName: slug, jobPostingId: j.id },
          query: `query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
            jobPosting(
              organizationHostedJobsPageName: $organizationHostedJobsPageName
              jobPostingId: $jobPostingId
            ) {
              descriptionHtml
            }
          }`
        };
        const detailJson = await ctx.fetchJson("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(detailBody),
          timeoutMs: ASHBY_TIMEOUT_MS
        });
        const desc = detailJson?.data?.jobPosting?.descriptionHtml || '';
        jds.set(j.id, desc);
      } catch (e) {
        // ignore errors for individual JD fetches
      }
    }));

    return rawJobs.map((j) => {
      const locs = [j.locationName, ...(j.secondaryLocations || []).map(x => x.locationName)].filter(Boolean);
      return {
        title: j.title || '',
        url: `https://jobs.ashbyhq.com/${slug}/${j.id}`,
        company: entry.name,
        location: locs.join(', '),
        description: jds.get(j.id) || '',
        department: '',
        date_posted: '',
        comp: j.compensationTierSummary || null,
        employment_type: j.employmentType || '',
      };
    });
  },
};
