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

function existingPortalNames() {
  if (!existsSync(PORTALS_PATH)) return new Set();
  const text = readFileSync(PORTALS_PATH, 'utf-8');
  const names = new Set();
  for (const m of text.matchAll(/^\s*-\s*name:\s*(.+?)\s*$/gm)) {
    names.add(m[1].replace(/^["']|["']$/g, '').toLowerCase());
  }
  return names;
}

function appendToPortals(resolved) {
  const have = existingPortalNames();
  const toAdd = resolved.filter(r => r.resolved && !have.has(String(r.name).toLowerCase()));
  if (toAdd.length === 0) {
    console.error('No new resolved companies to append (all duplicates or unresolved).');
    return 0;
  }
  const block = '\n' + toAdd.map(r =>
    `  - name: ${r.name}\n` +
    `    careers_url: ${r.careers_url}\n` +
    `    api: ${r.api}\n` +
    `    enabled: true\n` +
    `    notes: "added by find-companies (${r.provider}, ${r.count} live jobs)"\n`
  ).join('\n');
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
  const appendArg = args.includes('--append') ? (get('--append') || '-') : null;

  let resolved = [];
  if (one) {
    resolved = [await resolveCompany(one)];
  } else if (file) {
    const names = readFileSync(file, 'utf-8').split('\n').map(s => s.trim()).filter(Boolean);
    console.error(`Resolving ${names.length} companies...`);
    for (const n of names) {
      const r = await resolveCompany(n);
      console.error(`  ${r.resolved ? '✓' : '·'} ${n}${r.resolved ? ` → ${r.provider} (${r.count})` : ' (no public board)'}`);
      resolved.push(r);
    }
  } else if (appendArg && appendArg !== '-') {
    resolved = JSON.parse(readFileSync(appendArg, 'utf-8'));
  } else {
    console.error('Usage: node find-companies.mjs --resolve "Name" | --resolve-file file.txt [--append -]');
    process.exit(1);
  }

  if (appendArg) {
    appendToPortals(resolved);
  } else {
    console.log(JSON.stringify(resolved, null, 2));
  }
}

main();
