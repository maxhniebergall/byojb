// Pure helpers shared by fetch-jd-bodies.mjs and its tests. No I/O, no top-level side effects —
// fetch-jd-bodies.mjs is a script (it runs on import), so anything a test needs to assert on lives
// here instead.

// A body this short is not a job description. 363 live postings sit under this line and 55 of them
// are literally "You need to enable JavaScript" — the threshold that decides "escalate a tier".
export const THIN = 900;
export const JS_SHELL = /you need to enable javascript|enable javascript to run this app|please enable js/i;

// 30 short bodies say the req is gone in words rather than in a status code — the page still
// answers 200, so the 404 path never saw them and they stayed live:true forever.
export const CLOSED = /position closed|no longer accepting|this job is closed|has been filled|posting is closed/i;

// A page that answers 200 and renders fine, but is a TOMBSTONE — the requisition is gone and the ATS
// is showing its generic not-found or its careers index instead. Browser-rendering these was the
// plan for the 800 bodyless postings until a probe showed what they actually contain: Workday
// returns "The page you are looking for doesn't exist." and BambooHR silently redirects to the
// careers index (which does not list the job). Neither is blocked and neither is slow — there is
// simply nothing there, so escalating to a browser only fetches a tombstone more expensively.
//
// Deliberately anchored on the ATS's own not-found wording. A JD legitimately containing the phrase
// "page not found" is not plausible, but "we don't exist to..." marketing copy is — hence the
// specific phrasings rather than a bare /not found/.
export const GONE_PAGE = /the page you are looking for doesn'?t exist|page (?:you requested )?(?:was )?not found|this (?:job|position|posting|opening) (?:is )?(?:no longer|has been) (?:available|posted|removed)|job (?:posting )?not found|we can'?t find the page/i;

// The careers-INDEX tell: an ATS that drops a removed req onto its listing page. The page is real
// and long enough to pass the thin check, so only its content gives it away.
export const INDEX_PAGE = /thanks for checking out our job openings|current openings\s*\n|see something that interests you/i;

// Is this fetched text a tombstone rather than a job description?
export const isGonePage = (text) => {
  const t = String(text || '');
  if (!t) return false;
  return GONE_PAGE.test(t) || (INDEX_PAGE.test(t) && t.length < 4000);
};

export const isThin = (text) => !text || text.length < THIN || JS_SHELL.test(text);

export const decodeEntities = (s) => (s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

export const stripHtml = (h) => (h || '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;|&rdquo;|&ldquo;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

// Greenhouse: the requisition id travels either as `?gh_jid=NNN` on the company's own careers page
// or as `/<board>/jobs/NNN` on a greenhouse host. The board slug is only in the URL for the second
// form; for the first we take it from the record's `company_key` ("greenhouse:nebius"), which the
// scan already stamped from portals.yml — all 1,765 gh_jid postings in the registry carry one.
export function greenhouseTarget(url, companyKey) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const jid = u.searchParams.get('gh_jid');
  const pathHit = u.pathname.match(/\/([^/]+)\/jobs\/(\d+)/);
  const onGreenhouse = /(^|\.)greenhouse\.io$/i.test(u.hostname);
  const id = jid || (onGreenhouse && pathHit ? pathHit[2] : null);
  if (!id) return null;
  const board = (onGreenhouse && pathHit ? pathHit[1] : null)
    || (/^greenhouse:(.+)$/.exec(companyKey || '') || [])[1];
  if (!board) return null;
  return `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`;
}

export function leverTarget(url) {
  const m = (url || '').match(/jobs\.lever\.co\/([^/?#]+)\/([^/?#]+)/);
  return m ? `https://api.lever.co/v0/postings/${m[1]}/${m[2]}` : null;
}

// The single place that decides what happens to a fetched body, shared by every tier so no tier can
// bypass either rule:
//   closed      → retire the posting (live=false), store nothing
//   kept-shorter→ never trade a longer stored body for a shorter fresh one. 345 first-party pages
//                 render as JS shells shorter than the ATS content already on disk; overwriting
//                 them would have destroyed real JDs.
//   authoritative → the one exemption: a tier-1 ATS API body replacing a stored body we have
//                 positively identified as the WRONG page (a client-rendered careers index shared
//                 verbatim by several sibling postings — 8 Nebius postings all stored the same
//                 28k-char "Open positions at Nebius" listing). Length is meaningless there: the
//                 index is longer than any real JD, so plain longer-wins would keep the junk.
export function commitDecision({ body, current, authoritative = false }) {
  if (CLOSED.test(body || '')) return { action: 'closed' };
  // A tombstone is as dead as an explicitly-closed posting, and must be caught BEFORE the length
  // guard: a careers-index render is often longer than the (absent) stored body, so store-if-longer
  // would happily write the tombstone in as the JD.
  if (isGonePage(body)) return { action: 'closed' };
  if (!authoritative && current != null && (body || '').length <= current.length) return { action: 'kept-shorter' };
  return { action: 'store' };
}

// A body that several live postings of the same company share byte-for-byte is not a job
// description — it is the listing page every one of those URLs rendered to. Returns the set of keys
// whose stored body is shared with at least one sibling.
export function sharedBodyKeys(rows) {
  const byCompany = new Map();
  for (const { key, company, body } of rows) {
    if (!body) continue;
    const bucket = byCompany.get(company) || new Map();
    // First 2k chars is plenty to identify the same rendered page; avoids hashing 28k × 16k rows.
    const fingerprint = body.slice(0, 2000);
    bucket.set(fingerprint, [...(bucket.get(fingerprint) || []), key]);
    byCompany.set(company, bucket);
  }
  const out = new Set();
  for (const bucket of byCompany.values()) {
    for (const keys of bucket.values()) if (keys.length > 1) for (const k of keys) out.add(k);
  }
  return out;
}
