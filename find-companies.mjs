#!/usr/bin/env node
// find-companies.mjs (NEW) — the deterministic engine behind the company finder.
//
// The *discovery* of which companies match your criteria is LLM web-research, driven
// by modes/find-companies.md inside Claude Code / Gemini CLI (subscription, zero API
// billing). This script is the zero-token, no-LLM part: given a company NAME, it
// resolves the company to a live ATS job board by probing the public board APIs, and
// can append confirmed companies to portals.yml so the scanner picks them up.
//
// Usage:
//   node find-companies.mjs --resolve "Acme AI"            # probe one company, print JSON
//   node find-companies.mjs --resolve-file names.txt       # one name per line → JSON array
//   node find-companies.mjs --append resolved.json         # append resolved hits to portals.yml
//   node find-companies.mjs --resolve-file n.txt --append - # resolve then append in one go
//
// A "resolved" company looks like:
//   { name, resolved:true, provider, careers_url, api, count }
// Unresolved (no public board found — use JobSpy by name instead):
//   { name, resolved:false }

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORTALS_PATH = process.env.CAREER_OPS_PORTALS || join(ROOT, 'portals.yml');
const FETCH_TIMEOUT_MS = 8000;

function slugCandidates(name) {
  const lower = String(name).toLowerCase().trim();
  const compact = lower.replace(/[^a-z0-9]+/g, '');
  const hyphen = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const firstWord = lower.split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
  // strip common suffixes (inc, llc, ai, labs, technologies) for an extra guess
  const stripped = compact.replace(/(inc|llc|ltd|corp|technologies|labs|ai|io)$/g, '');
  return [...new Set([compact, hyphen, firstWord, stripped].filter(s => s && s.length >= 2))];
}

async function getJson(url, { method = 'GET', body, headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, body, headers, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Each prober returns {careers_url, api, count} on a hit, else null.
const PROVIDERS = {
  async greenhouse(slug) {
    for (const host of ['boards-api.greenhouse.io', 'boards-api.eu.greenhouse.io']) {
      const api = `https://${host}/v1/boards/${slug}/jobs`;
      const json = await getJson(api);
      const count = Array.isArray(json?.jobs) ? json.jobs.length : 0;
      if (count > 0) {
        const brand = host.includes('.eu.') ? 'job-boards.eu.greenhouse.io' : 'job-boards.greenhouse.io';
        return { provider: 'greenhouse', careers_url: `https://${brand}/${slug}`, api, count };
      }
    }
    return null;
  },
  async ashby(slug) {
    const api = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    const json = await getJson(api);
    const count = Array.isArray(json?.jobs) ? json.jobs.length : 0;
    if (count > 0) return { provider: 'ashby', careers_url: `https://jobs.ashbyhq.com/${slug}`, api, count };
    return null;
  },
  async lever(slug) {
    const api = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    const json = await getJson(api);
    const count = Array.isArray(json) ? json.length : 0;
    if (count > 0) return { provider: 'lever', careers_url: `https://jobs.lever.co/${slug}`, api, count };
    return null;
  },
  async smartrecruiters(slug) {
    const api = `https://api.smartrecruiters.com/v1/companies/${slug}/postings`;
    const json = await getJson(api);
    const count = Number(json?.totalFound) || (Array.isArray(json?.content) ? json.content.length : 0);
    if (count > 0) return { provider: 'smartrecruiters', careers_url: `https://careers.smartrecruiters.com/${slug}`, api, count };
    return null;
  },
  async recruitee(slug) {
    const api = `https://${slug}.recruitee.com/api/offers/`;
    const json = await getJson(api);
    const count = Array.isArray(json?.offers) ? json.offers.length : 0;
    if (count > 0) return { provider: 'recruitee', careers_url: `https://${slug}.recruitee.com`, api, count };
    return null;
  },
};

async function resolveCompany(name) {
  const slugs = slugCandidates(name);
  // Probe in order of how common the ATS is; first hit with live jobs wins.
  for (const probe of ['greenhouse', 'ashby', 'lever', 'smartrecruiters', 'recruitee']) {
    for (const slug of slugs) {
      const hit = await PROVIDERS[probe](slug);
      if (hit) return { name, resolved: true, ...hit };
    }
  }
  return { name, resolved: false };
}

// ── Workday + careers-URL resolution ────────────────────────────────
// Workday/Taleo/etc. can't be guessed from a name, so the finder supplies the careers_url
// (the LLM web-search step finds it). We classify + validate that URL instead.

const WORKDAY_HOST_RE = /^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/i;
const LOCALE_RE = /^[a-z]{2}-[A-Z]{2}$/;
// Default source-side searches for big Workday boards (your green-list titles).
const DEFAULT_WORKDAY_SEARCH = [
  'backend engineer', 'platform engineer', 'infrastructure engineer',
  'mlops', 'data engineer', 'cloud engineer', 'devops engineer',
];

function parseWorkdayUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const m = parsed.hostname.match(WORKDAY_HOST_RE);
  if (!m) return null;
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments[0] && LOCALE_RE.test(segments[0])) segments.shift();
  const site = segments[0];
  if (!site) return null;
  return { hostname: parsed.hostname, tenant: m[1], site, cxs: `https://${parsed.hostname}/wday/cxs/${m[1]}/${site}/jobs` };
}

async function validateWorkday(url) {
  const info = parseWorkdayUrl(url);
  if (!info) return null;
  const json = await getJson(info.cxs, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
  });
  const count = Number(json?.total) || (Array.isArray(json?.jobPostings) ? json.jobPostings.length : 0);
  if (count > 0) return { provider: 'workday', careers_url: url, count };
  return null;
}

// Classify a careers_url to a provider (Workday first, then the slug ATSs by their host).
async function resolveByUrl(name, url) {
  const wd = await validateWorkday(url);
  if (wd) return { name, resolved: true, ...wd };
  // slug ATSs embedded in the URL
  const patterns = [
    [/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/, 'greenhouse'],
    [/jobs\.ashbyhq\.com\/([^/?#]+)/, 'ashby'],
    [/jobs\.lever\.co\/([^/?#]+)/, 'lever'],
    [/([^.]+)\.recruitee\.com/, 'recruitee'],
  ];
  for (const [re, provider] of patterns) {
    const m = url.match(re);
    if (m) { const hit = await PROVIDERS[provider](m[1]); if (hit) return { name, resolved: true, ...hit }; }
  }
  return { name, resolved: false, careers_url: url };
}

function existingPortalNames() {
  if (!existsSync(PORTALS_PATH)) return new Set();
  const text = readFileSync(PORTALS_PATH, 'utf-8');
  const names = new Set();
  for (const m of text.matchAll(/^\s*-\s*name:\s*(.+?)\s*$/gm)) {
    names.add(m[1].replace(/^["']|["']$/g, '').toLowerCase());
  }
  return names;
}

function appendToPortals(resolved, minFit = 0) {
  const have = existingPortalNames();
  let toAdd = resolved.filter(r => r.resolved && !have.has(String(r.name).toLowerCase()));
  // Vetting gate: if --min-fit is set, drop companies whose fit_score is below it.
  // Entries with no fit_score are kept (not yet vetted) so the gate never silently
  // discards un-scored companies.
  if (minFit > 0) {
    const before = toAdd.length;
    toAdd = toAdd.filter(r => r.fit_score == null || Number(r.fit_score) >= minFit);
    const dropped = before - toAdd.length;
    if (dropped) console.error(`(--min-fit ${minFit}: dropped ${dropped} company(ies) below the fit threshold)`);
  }
  if (toAdd.length === 0) {
    console.error('No new resolved companies to append (all duplicates, unresolved, or below min-fit).');
    return 0;
  }
  const block = '\n' + toAdd.map(r => {
    const head = `  - name: ${r.name}\n    careers_url: ${r.careers_url}\n`;
    const fit = r.fit_score != null ? `, fit ${r.fit_score}/5` : '';
    const tail = `    enabled: true\n    notes: "added by find-companies (${r.provider}, ${r.count} live jobs${fit})"\n`;
    if (r.provider === 'workday') {
      // Workday is identified by careers_url; narrow huge boards at the source.
      const search = JSON.stringify(DEFAULT_WORKDAY_SEARCH);
      return head + `    provider: workday\n    workday_search: ${search}\n` + tail;
    }
    return head + `    api: ${r.api}\n` + tail;
  }).join('\n');
  // tracked_companies is the last top-level key, so appending at EOF extends its list.
  writeFileSync(PORTALS_PATH, readFileSync(PORTALS_PATH, 'utf-8').trimEnd() + '\n' + block, 'utf-8');
  console.error(`✓ appended ${toAdd.length} companies to ${PORTALS_PATH}: ${toAdd.map(r => r.name).join(', ')}`);
  return toAdd.length;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

  const one = get('--resolve');
  const file = get('--resolve-file');
  const oneUrl = get('--resolve-url');        // "Company Name|https://careers-url"
  const urlsFile = get('--urls-file');         // lines: "Company Name<TAB>careers_url"
  const appendArg = args.includes('--append') ? (get('--append') || '-') : null;

  const splitNameUrl = (s, sep) => { const i = s.indexOf(sep); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; };

  let resolved = [];
  if (one) {
    resolved = [await resolveCompany(one)];
  } else if (file) {
    const names = readFileSync(file, 'utf-8').split('\n').map(s => s.trim()).filter(Boolean);
    console.error(`Resolving ${names.length} companies by name...`);
    for (const n of names) {
      const r = await resolveCompany(n);
      console.error(`  ${r.resolved ? '✓' : '·'} ${n}${r.resolved ? ` → ${r.provider} (${r.count})` : ' (no public board)'}`);
      resolved.push(r);
    }
  } else if (oneUrl) {
    const [n, u] = splitNameUrl(oneUrl, '|');
    resolved = [await resolveByUrl(n, u)];
  } else if (urlsFile) {
    const rows = readFileSync(urlsFile, 'utf-8').split('\n').map(s => s.trim()).filter(Boolean);
    console.error(`Resolving ${rows.length} companies by careers_url...`);
    for (const row of rows) {
      const [n, u] = row.includes('\t') ? splitNameUrl(row, '\t') : splitNameUrl(row, ' ');
      const r = await resolveByUrl(n, u);
      console.error(`  ${r.resolved ? '✓' : '·'} ${n}${r.resolved ? ` → ${r.provider} (${r.count})` : ' (could not validate)'}`);
      resolved.push(r);
    }
  } else if (appendArg && appendArg !== '-') {
    resolved = JSON.parse(readFileSync(appendArg, 'utf-8'));
  } else {
    console.error('Usage:\n' +
      '  --resolve "Name"                  resolve one slug-ATS company by name\n' +
      '  --resolve-file names.txt          resolve many by name (Greenhouse/Ashby/Lever/SR/Recruitee)\n' +
      '  --resolve-url "Name|careers_url"   resolve one company by careers URL (Workday + slug ATSs)\n' +
      '  --urls-file rows.txt              resolve many by "Name<TAB>careers_url"\n' +
      '  --append <file.json> [--min-fit N] append resolved hits to portals.yml (optionally gated\n' +
      '                                    by a fit_score field >= N from the vetting step)');
    process.exit(1);
  }

  if (appendArg) {
    const minFit = Number(get('--min-fit') || 0);
    appendToPortals(resolved, minFit);
  } else {
    console.log(JSON.stringify(resolved, null, 2));
  }
}

main();
