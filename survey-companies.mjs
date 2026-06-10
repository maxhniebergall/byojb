#!/usr/bin/env node
// survey-companies.mjs (NEW) — landscape survey across thousands of ATS boards.
//
// For every company in data/ats-companies/<provider>.csv, fetch its public board and count:
//   total       — all open postings
//   relevant    — postings matching portals.yml title_filter (your green list)
//   remote_ca   — relevant postings that also pass the location_filter (remote-Canada-eligible)
// Writes one JSON line per company to data/survey/results.jsonl (resumable — reruns skip
// companies already recorded). Zero-token, no LLM. This answers "how many companies have
// these roles, and how many are relevant to me."
//
//   node survey-companies.mjs [provider ...]   # default: greenhouse ashby lever smartrecruiters recruitee
//   node survey-companies.mjs --report          # aggregate results.jsonl → data/survey/landscape.md
//   node survey-companies.mjs greenhouse --limit 200   # test on a slice

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(ROOT, 'data', 'ats-companies');
const OUT = join(ROOT, 'data', 'survey', 'results.jsonl');
const REPORT = join(ROOT, 'data', 'survey', 'landscape.md');
const CONCURRENCY = 25;
const TIMEOUT_MS = 9000;
const ALL_PROVIDERS = ['greenhouse', 'ashby', 'lever', 'smartrecruiters', 'recruitee'];
// Workday is opt-in (heavier: enterprise boards are huge, so we run targeted searches
// instead of fetching every posting). Run with: node survey-companies.mjs workday
const WORKDAY_SEARCHES = ['backend engineer', 'platform engineer', 'infrastructure engineer', 'data engineer', 'mlops', 'devops engineer'];

// ── matchers (replicated from scan.mjs for consistency) ─────────────
function buildTitleFilter(tf) {
  const pos = (tf?.positive || []).map(k => k.toLowerCase());
  const neg = (tf?.negative || []).map(k => k.toLowerCase());
  return (title) => {
    const l = (title || '').toLowerCase();
    return (pos.length === 0 || pos.some(k => l.includes(k))) && !neg.some(k => l.includes(k));
  };
}
function normList(v) {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter(k => typeof k === 'string').map(k => k.toLowerCase().trim()).filter(Boolean);
}
function buildLocationFilter(lf) {
  if (!lf) return () => true;
  const aa = normList(lf.always_allow), allow = normList(lf.allow), block = normList(lf.block);
  return (loc) => {
    if (typeof loc !== 'string' || loc.trim() === '') return true;
    const l = loc.toLowerCase();
    if (aa.length && aa.some(k => l.includes(k))) return true;
    if (block.length && block.some(k => l.includes(k))) return false;
    if (allow.length === 0) return true;
    return allow.some(k => l.includes(k));
  };
}

// ── HTTP ─────────────────────────────────────────────────────────────
async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'career-ops-survey/1.0', accept: 'application/json' }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) return { __error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) { return { __error: String(e.name || e.message || e).slice(0, 40) }; }
  finally { clearTimeout(t); }
}

// ── per-provider fetchers → array of {title, location} ──────────────
const FETCH = {
  async greenhouse(slug) {
    const j = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    if (j.__error) return j;
    return (j.jobs || []).map(x => ({ title: x.title, location: x.location?.name || '' }));
  },
  async ashby(slug) {
    const j = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    if (j.__error) return j;
    return (j.jobs || []).map(x => ({ title: x.title, location: x.location || x.locationName || '' }));
  },
  async lever(slug) {
    const j = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (j.__error) return j;
    if (!Array.isArray(j)) return { __error: 'not-array' };
    return j.map(x => ({ title: x.text, location: x.categories?.location || x.workplaceType || '' }));
  },
  async smartrecruiters(slug) {
    const out = [];
    for (let offset = 0; offset < 600; offset += 100) {
      const j = await getJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=${offset}`);
      if (j.__error) return offset === 0 ? j : out;
      const content = j.content || [];
      for (const x of content) {
        const loc = x.location || {};
        out.push({ title: x.name, location: [loc.city, loc.region, loc.country].filter(Boolean).join(', ') + (loc.remote ? ' Remote' : '') });
      }
      if (content.length < 100) break;
    }
    return out;
  },
  async recruitee(slug) {
    const j = await getJson(`https://${slug}.recruitee.com/api/offers/`);
    if (j.__error) return j;
    return (j.offers || []).map(x => ({ title: x.title, location: x.location || [x.city, x.country].filter(Boolean).join(', ') }));
  },
  async workday(_slug, url) {
    const m = String(url).match(/^https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:([a-z]{2}-[A-Z]{2})\/)?([^/?#]+)/i);
    if (!m) return { __error: 'unparseable-url' };
    const [, tenant, , , site] = m;
    const host = `${tenant}.${m[2]}.myworkdayjobs.com`;
    const cxs = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
    const seen = new Set(), out = [];
    let anyOk = false;
    for (const term of WORKDAY_SEARCHES) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let j;
      try {
        const res = await fetch(cxs, { method: 'POST', signal: ctrl.signal,
          headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'career-ops-survey/1.0' },
          body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: term }) });
        if (res.ok) { j = await res.json(); anyOk = true; }
      } catch {} finally { clearTimeout(t); }
      for (const p of (j?.jobPostings || [])) {
        if (p?.externalPath && !seen.has(p.externalPath)) { seen.add(p.externalPath); out.push({ title: p.title, location: p.locationsText || '' }); }
      }
    }
    return anyOk ? out : { __error: 'no-response' };
  },
};

// ── CSV ──────────────────────────────────────────────────────────────
function loadSlugs(provider) {
  const path = join(CSV_DIR, `${provider}.csv`);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const rows = [];
  for (const line of lines.slice(1)) {
    // name,slug,url — name may contain commas only if quoted; these CSVs are simple.
    const parts = line.split(',');
    const name = parts[0];
    const slug = (parts[1] || '').trim();
    const url = (parts[2] || '').trim();
    if (slug || url) rows.push({ name, slug, url });
  }
  return rows;
}

function loadDone() {
  const done = new Set();
  if (!existsSync(OUT)) return done;
  for (const line of readFileSync(OUT, 'utf-8').split('\n')) {
    if (!line) continue;
    try { const r = JSON.parse(line); done.add(`${r.provider}:${r.slug}`); } catch {}
  }
  return done;
}

// ── survey ───────────────────────────────────────────────────────────
async function survey(providers, limit) {
  const portals = yaml.load(readFileSync(join(ROOT, 'portals.yml'), 'utf-8'));
  const titleMatch = buildTitleFilter(portals.title_filter);
  const locMatch = buildLocationFilter(portals.location_filter);
  const done = loadDone();

  const tasks = [];
  for (const p of providers) {
    let rows = loadSlugs(p);
    if (limit) rows = rows.slice(0, limit);
    for (const r of rows) if (!done.has(`${p}:${r.slug}`)) tasks.push({ provider: p, ...r });
  }
  console.error(`Surveying ${tasks.length} companies across ${providers.join(', ')} (${done.size} already done)...`);

  let i = 0, completed = 0, withRelevant = 0, withRemoteCa = 0, totalRemoteCa = 0, errors = 0;
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++];
      const jobs = await FETCH[task.provider](task.slug, task.url);
      let rec;
      if (jobs && jobs.__error) {
        errors++;
        rec = { provider: task.provider, slug: task.slug, name: task.name, error: jobs.__error };
      } else {
        const relevant = jobs.filter(j => titleMatch(j.title));
        const remoteCa = relevant.filter(j => locMatch(j.location));
        if (relevant.length) withRelevant++;
        if (remoteCa.length) { withRemoteCa++; totalRemoteCa += remoteCa.length; }
        rec = {
          provider: task.provider, slug: task.slug, name: task.name,
          total: jobs.length, relevant: relevant.length, remote_ca: remoteCa.length,
          samples: remoteCa.slice(0, 3).map(j => j.title),
        };
      }
      appendFileSync(OUT, JSON.stringify(rec) + '\n');
      if (++completed % 250 === 0) {
        console.error(`  ${completed}/${tasks.length} | ${withRelevant} have relevant | ${withRemoteCa} have remote-CA relevant (${totalRemoteCa} openings) | ${errors} errors`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.error(`\n✓ done: ${completed} surveyed | ${withRelevant} with relevant | ${withRemoteCa} with remote-CA relevant (${totalRemoteCa} openings) | ${errors} errors`);
}

// ── report ───────────────────────────────────────────────────────────
function report() {
  const rows = readFileSync(OUT, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const ok = rows.filter(r => !r.error);
  const errs = rows.filter(r => r.error);
  const withRel = ok.filter(r => r.relevant > 0);
  const withCa = ok.filter(r => r.remote_ca > 0);
  const totalCaOpenings = withCa.reduce((s, r) => s + r.remote_ca, 0);
  const byProvider = {};
  for (const r of ok) { (byProvider[r.provider] ??= { surveyed: 0, withCa: 0 }); byProvider[r.provider].surveyed++; if (r.remote_ca > 0) byProvider[r.provider].withCa++; }
  const top = [...withCa].sort((a, b) => b.remote_ca - a.remote_ca).slice(0, 60);

  const md = [
    '# Company landscape survey',
    '',
    `Surveyed **${ok.length}** company boards (${errs.length} unreachable/empty).`,
    '',
    `- Companies with ≥1 relevant (green-list) opening: **${withRel.length}** (${(100 * withRel.length / ok.length).toFixed(1)}%)`,
    `- Companies with ≥1 **remote-Canada-eligible** relevant opening: **${withCa.length}** (${(100 * withCa.length / ok.length).toFixed(1)}%)`,
    `- Total remote-Canada-eligible relevant openings: **${totalCaOpenings}**`,
    '',
    '## By ATS provider',
    '',
    '| Provider | Surveyed | With remote-CA relevant |',
    '|---|---|---|',
    ...Object.entries(byProvider).map(([p, v]) => `| ${p} | ${v.surveyed} | ${v.withCa} |`),
    '',
    '## Top companies by remote-Canada-eligible relevant openings',
    '',
    '| Company | Provider | Remote-CA relevant | Relevant | Total | Sample titles |',
    '|---|---|---|---|---|---|',
    ...top.map(r => `| ${r.name} | ${r.provider} | ${r.remote_ca} | ${r.relevant} | ${r.total} | ${(r.samples || []).join('; ').replace(/\|/g, '/')} |`),
    '',
    '_Shortlist for Tier-2 LLM fit reports: companies with remote-CA relevant > 0._',
  ].join('\n');
  writeFileSync(REPORT, md, 'utf-8');
  console.log(md.split('\n').slice(0, 14).join('\n'));
  console.log(`\n✓ full report → ${REPORT} (${withCa.length} companies in shortlist)`);
}

// ── main ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--report')) {
  report();
} else {
  const limIdx = args.indexOf('--limit');
  const limit = limIdx >= 0 ? Number(args[limIdx + 1]) : 0;
  const provs = args.filter(a => [...ALL_PROVIDERS, 'workday'].includes(a));
  await survey(provs.length ? provs : ALL_PROVIDERS, limit);
}
