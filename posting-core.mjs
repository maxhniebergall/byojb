// posting-core.mjs (NEW) — shared helpers for the job-postings pipeline.
//
// Used by scan.mjs (raw capture), rank-postings.mjs (registry), score-postings.mjs
// (recomputable scoring), llm-triage-jobs.mjs (ranking driver), and web/server.mjs.
// Keep this dependency-light (only Node built-ins) so every consumer can import it.

import { readFileSync, writeFileSync, existsSync } from 'fs';

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
  for (const k of [...u.searchParams.keys()]) {
    if (/^utm_/i.test(k) || /^(gh_src|gh_jid_src|src|ref|source)$/i.test(k)) u.searchParams.delete(k);
  }
  // normalize: no trailing slash on a non-root path
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  let out = u.toString();
  if (out.endsWith('/') && u.pathname === '/' && !u.search) out = out.slice(0, -1);
  return out;
}

// slug-safe filename fragment (matches the company console's sk()).
export const sk = (key) => key.replace(/[:/]/g, '-');

// ── jsonl io ────────────────────────────────────────────────────────
export function loadJsonl(path) {
  const out = [];
  if (!existsSync(path)) return out;
  for (const l of readFileSync(path, 'utf-8').split('\n')) {
    if (l) { try { out.push(JSON.parse(l)); } catch {} } // tolerate a partial final line
  }
  return out;
}
export function saveJsonl(path, rows) {
  writeFileSync(path, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
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
