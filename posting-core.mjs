// posting-core.mjs (NEW) — shared helpers for the job-postings pipeline.
//
// Used by scan.mjs (raw capture), rank-postings.mjs (registry), score-postings.mjs
// (recomputable scoring), llm-triage-jobs.mjs (ranking driver), and web/server.mjs.
// Keep this dependency-light (only Node built-ins) so every consumer can import it.

import { readFileSync, writeFileSync, existsSync, openSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';

// ── canonical posting URL ───────────────────────────────────────────
// The posting URL is the registry key and the join key to reports (`**URL:**`).
// It MUST be derived identically everywhere, or live/expired tracking and the
// lifecycle join silently miss. Rules: lowercase scheme+host, drop the #fragment,
// strip tracking params (utm_*, gh_src), drop a trailing slash on the path.
// Query params that actually identify the posting (Workday/SmartRecruiters encode
// the job there) are PRESERVED.
export function canonicalUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  let u;
  try { u = new URL(raw.trim()); } catch { return raw.trim(); }
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';
  // Greenhouse embedded application iframe (used by company-hosted apply pages) →
  // canonical job-board URL, so it joins the scanned posting and derives the right company.
  // e.g. job-boards.greenhouse.io/embed/job_app?for=acme&token=123 → job-boards.greenhouse.io/acme/jobs/123
  if (/greenhouse\.io$/i.test(u.hostname) && /\/embed\/job_app/i.test(u.pathname)) {
    const forC = (u.searchParams.get('for') || '').toLowerCase();
    const token = u.searchParams.get('token') || '';
    if (forC && /^\d+$/.test(token)) return `https://job-boards.greenhouse.io/${forC}/jobs/${token}`;
  }
  for (const k of [...u.searchParams.keys()]) {
    if (/^utm_/i.test(k) || /^(gh_src|gh_jid_src|src|ref|source)$/i.test(k)) u.searchParams.delete(k);
  }
  // Strip /apply or /application suffix from individual job paths (e.g. /company/job-id/apply)
  const pathSegments = u.pathname.split('/').filter(Boolean);
  if (pathSegments.length > 1) {
    const last = pathSegments[pathSegments.length - 1];
    if (last === 'apply' || last === 'application') {
      u.pathname = '/' + pathSegments.slice(0, -1).join('/');
    }
  }
  // normalize: no trailing slash on a non-root path
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  let out = u.toString();
  if (out.endsWith('/') && u.pathname === '/' && !u.search) out = out.slice(0, -1);
  return out;
}

// slug-safe filename fragment (matches the company console's sk()).
// Long keys (e.g. Workday apply URLs with big query strings) can exceed the OS's
// 255-byte filename limit, so cap the slug and append a short hash of the full key
// to keep it deterministic and collision-safe. Short keys are unchanged for
// backward compatibility with already-written files.
export const sk = (key) => {
  const slug = key.replace(/[:/]/g, '-');
  // Leave headroom for the caller's extension (.md/.txt) under the 255-byte limit.
  const MAX = 200;
  if (slug.length <= MAX) return slug;
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 12);
  return slug.slice(0, MAX - hash.length - 1) + '-' + hash;
};

// The Greenhouse job id is the one stable value across every URL shape a posting can take:
// native (.../jobs/123), company-hosted (...?gh_jid=123 or .../roles/123), and the embed
// iframe (...?token=123). Used to join a submitted application back to its scanned posting.
export function ghJobId(raw) {
  if (typeof raw !== 'string' || !raw) return '';
  try {
    const u = new URL(raw);
    const q = u.searchParams.get('token') || u.searchParams.get('gh_jid');
    if (q && /^\d+$/.test(q)) return q;
    const m = u.pathname.match(/\/(?:jobs|roles)\/(\d+)/);
    if (m) return m[1];
  } catch {}
  return '';
}

// ── jsonl io ────────────────────────────────────────────────────────
export function loadJsonl(path) {
  const out = [];
  if (!existsSync(path)) return out;
  for (const l of readFileSync(path, 'utf-8').split('\n')) {
    if (l) { try { out.push(JSON.parse(l)); } catch {} } // tolerate a partial final line
  }
  return out;
}
// ATOMIC. The registries are 8-16MB and are written by the CLI and by web/server.mjs
// concurrently, so a plain writeFileSync leaves a truncated file if either is interrupted
// mid-write — and a truncated registry is silent, permanent data loss.
//
// Two details matter:
//   • The temp name carries pid+seq. A shared "<path>.tmp" would let two writers clobber
//     each other's partial output and rename the wreckage into place.
//   • fsync BEFORE rename is what makes this durable across a power loss rather than only
//     across a process kill. rename(2) is atomic within a filesystem, and the temp is
//     always a sibling of the target, so it never crosses one.
let _tmpSeq = 0;
export function saveJsonl(path, rows) {
  const tmp = `${path}.tmp.${process.pid}.${_tmpSeq++}`;
  const body = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
  let fd;
  try {
    writeFileSync(tmp, body);
    fd = openSync(tmp, 'r+'); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(tmp, path);
  } catch (e) {
    try { if (fd !== undefined) closeSync(fd); } catch { /* already closed */ }
    try { unlinkSync(tmp); } catch { /* never created */ }
    throw e;
  }
}

// ── company_key derivation ──────────────────────────────────────────
// Postings carry their company's careers_url + provider id. The company registry
// (company-research.jsonl) is keyed "provider:slug". Prefer an exact careers_url
// join (the watchlist was generated from that registry, so URLs match); fall back
// to parsing the slug out of the careers_url per known ATS host.
const SLUG_PATTERNS = [
  [/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/i, 'greenhouse'],
  [/boards\.greenhouse\.io\/([^/?#]+)/i, 'greenhouse'],
  [/jobs\.ashbyhq\.com\/([^/?#]+)/i, 'ashby'],
  [/jobs\.lever\.co\/([^/?#]+)/i, 'lever'],
  [/([^/.]+)\.recruitee\.com/i, 'recruitee'],
  [/([^/.]+)\.breezy\.hr/i, 'breezy'],
  [/([^/.]+)\.bamboohr\.com/i, 'bamboohr'],
  [/apply\.workable\.com\/([^/?#]+)/i, 'workable'],
  [/ats\.rippling\.com\/([^/?#]+)/i, 'rippling'],
  [/careers\.smartrecruiters\.com\/([^/?#]+)/i, 'smartrecruiters'],
];
export function deriveCompanyKey(provider, careersUrl) {
  const url = careersUrl || '';
  for (const [re, prov] of SLUG_PATTERNS) {
    const m = url.match(re);
    if (m && (!provider || provider === prov)) return `${prov}:${m[1].toLowerCase()}`;
  }
  // last resort: provider + host (keeps something stable to group by)
  try { return `${provider || 'unknown'}:${new URL(url).hostname.replace(/^www\./, '')}`; }
  catch { return `${provider || 'unknown'}:${url}`; }
}
