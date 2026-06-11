#!/usr/bin/env node
// web/server.mjs — the SINGLE career-ops dashboard (read+write, localhost-only).
//
// Unifies the former two UIs:
//   • POSTINGS  — the faceted ranking queue over the postings registry: facet search/filter,
//                 hard-filter toggle, LIVE rubric-weight sliders (re-sort without re-running the
//                 LLM), inline score override, shortlist/skip, JD body, fit verdict, and the
//                 lifecycle Status joined from applications.md by URL.
//   • COMPANIES — the company decision console (queue, keep/skip, re-rank, edit notes/links).
// Plus the active rubric and a markdown report viewer.
//
//   npm run dashboard:web        →  http://localhost:4173   (dashboard:decisions points here too)

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';
import { loadJsonl, saveJsonl, sk, canonicalUrl } from '../posting-core.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.DASHBOARD_PORT || process.env.DECISIONS_PORT || 4173);

const P = (...x) => join(ROOT, ...x);
const POST_RESEARCH = P('data', 'posting-research.jsonl');
const POST_PERSONAL = P('data', 'postings-personal.jsonl');
const POST_BODY_DIR = P('data', 'posting-research');
const POST_FIT_DIR = P('data', 'posting-fit');
const C_PERSONAL = P('data', 'companies-personal.jsonl');
const C_RESEARCH = P('data', 'company-research.jsonl');
const C_RESEARCH_DIR = P('data', 'company-research');
const C_FIT_DIR = P('data', 'company-fit');
const REPORTS_DIR = P('reports');
const APPLICATIONS = P('data', 'applications.md');
const RUBRIC = P('config', 'rubric.yml');

const readMd = (p) => existsSync(p) ? readFileSync(p, 'utf8') : '';
const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });

function loadRubric() {
  try { return yaml.load(readFileSync(RUBRIC, 'utf8')) || { dimensions: [] }; } catch { return { dimensions: [] }; }
}

// ── lifecycle join: posting URL → applications.md Status (via reports' **URL:**) ──
function lifecycleByUrl() {
  const map = new Map();
  if (!existsSync(REPORTS_DIR)) return map;
  // report file → its posting URL + score
  const reportInfo = new Map();
  for (const f of readdirSync(REPORTS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const t = readFileSync(join(REPORTS_DIR, f), 'utf8');
    const u = (t.match(/\*\*URL:\*\*\s*(\S+)/) || [])[1];
    const num = (f.match(/^(\d+)/) || [])[1];
    if (u) reportInfo.set(f, { url: canonicalUrl(u), num });
  }
  // applications.md: Report column link → Status column
  const statusByNum = new Map();
  if (existsSync(APPLICATIONS)) {
    for (const line of readFileSync(APPLICATIONS, 'utf8').split('\n')) {
      const cells = line.split('|').map(c => c.trim());
      if (cells.length < 8) continue;
      // … | Score | Status | PDF | Report | Notes  — Report holds [num](…/reports/num-…md)
      const repCell = cells.find(c => /\]\(.*reports\//.test(c));
      const num = repCell && (repCell.match(/(\d+)\]/) || [])[1];
      const statusCell = cells[6]; // # Date Company Role Score Status … (0-indexed incl leading '')
      if (num) statusByNum.set(num, statusCell);
    }
  }
  for (const [f, info] of reportInfo) {
    map.set(info.url, { status: statusByNum.get(info.num) || 'Evaluated', report: f });
  }
  return map;
}

// company own-domain links (carried over from the decision console)
function extractLinks(md, name = '') {
  if (!md) return [];
  let urls = [...md.matchAll(/https?:\/\/[^\s,)<>"'\]]+/g)].map(m => m[0].replace(/[.,;)]+$/, ''));
  if (urls.length === 0) {
    const src = (md.match(/^Sources:.*/im) || [''])[0];
    urls = [...src.matchAll(/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,]*)?/gi)].map(m => 'https://' + m[0].replace(/[.,;]+$/, ''));
  }
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const mainLabel = (h) => { const p = h.split('.'); return p.length >= 2 ? p[p.length - 2] : h; };
  const nameNorm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isOwn = (u) => { const ml = mainLabel(host(u)); return ml.length >= 3 && nameNorm.length >= 3 && (nameNorm.includes(ml) || ml.includes(nameNorm.slice(0, 8))); };
  let kept = urls.filter(isOwn); if (kept.length === 0) kept = urls;
  const label = (u) => { const s = u.replace(/^https?:\/\//, '').replace(/\/$/, ''); const tag = /career|job/i.test(u) ? 'careers' : /about|values|culture|handbook|life-?at|company/i.test(u) ? 'about' : /blog|engineering/i.test(u) ? 'blog' : ''; return { url: u, label: s.length > 48 ? s.slice(0, 47) + '…' : s, tag }; };
  const seen = new Set();
  return kept.filter(u => !seen.has(u) && seen.add(u)).slice(0, 8).map(label);
}

// ── POSTINGS endpoints ──────────────────────────────────────────────
function postingsQueue() {
  const research = new Map(loadJsonl(POST_RESEARCH).map(r => [r.key, r]));
  const personal = loadJsonl(POST_PERSONAL);
  const life = lifecycleByUrl();
  return personal.map(p => {
    const r = research.get(p.key) || {};
    const ex = r.extracted || {};
    const display = p.manual_score ?? p.computed_score ?? (p.llm_rank != null ? p.llm_rank : null);
    return {
      key: p.key, url: r.url, company: r.company, title: r.title, provider: r.provider,
      location: r.location, department: r.department, date_posted: r.date_posted, live: r.live !== false,
      researched: !!r.extracted, has_body: !!r.has_body,
      // facets surfaced for filtering/columns
      seniority: ex.seniority || null, yoe_min: ex.yoe_min ?? null, yoe_max: ex.yoe_max ?? null,
      languages: ex.languages || [], technologies: ex.technologies || [],
      remote_policy: ex.remote_policy || null, geo_eligibility: ex.geo_eligibility || null,
      employment_type: ex.employment_type || null, comp: ex.comp || r.comp || null,
      on_call: ex.on_call ?? null, domain: ex.domain || null,
      // scores
      dim_scores: p.dim_scores || null, computed_score: p.computed_score ?? null,
      manual_score: p.manual_score ?? null, llm_rank: p.llm_rank ?? null,
      llm_holistic_fit: p.llm_holistic_fit ?? null, relevance_score: p.relevance_score ?? 0,
      display_score: display, hard_excluded: !!p.hard_excluded,
      decision: p.decision || 'undecided', reason: p.llm_reason || '',
      status: life.get(p.key)?.status || null, report: life.get(p.key)?.report || null,
    };
  });
}

function postingDetail(key) {
  const r = (loadJsonl(POST_RESEARCH).find(x => x.key === key)) || {};
  const p = (loadJsonl(POST_PERSONAL).find(x => x.key === key)) || {};
  const fitPath = p.fit_brief ? P(p.fit_brief) : join(POST_FIT_DIR, sk(key) + '.md');
  return {
    ...r, ...p, key,
    jd_body: readMd(join(POST_BODY_DIR, sk(key) + '.md')),
    fit_verdict: readMd(fitPath),
  };
}

// ── COMPANIES endpoints (folded in from decision-server.mjs) ────────
const cResearchPath = (key) => join(C_RESEARCH_DIR, sk(key) + '.md');
const cFitPath = (key, prow) => prow?.fit_brief ? P(prow.fit_brief) : join(C_FIT_DIR, sk(key) + '.md');
function companiesQueue() {
  const personal = loadJsonl(C_PERSONAL);
  const research = new Map(loadJsonl(C_RESEARCH).map(r => [r.key, r]));
  return personal.filter(p => !p.excluded_by_type).map(p => {
    const r = research.get(p.key) || {};
    const score = p.llm_fit ?? p.llm_rank ?? null;
    const tier = p.llm_fit != null ? 2 : p.llm_rank != null ? 1 : 0;
    return { key: p.key, name: p.name || r.name, provider: p.provider || r.provider,
      company_type: r.company_type || 'unknown', remote_relevant: r.remote_relevant ?? null,
      score, tier, relevance_score: p.relevance_score ?? 0, llm_fit: p.llm_fit ?? null, llm_rank: p.llm_rank ?? null,
      decision: p.decision || 'undecided', researched: !!p.fit_brief, reason: p.llm_reason || '' };
  }).sort((a, b) => (b.tier - a.tier) || ((b.score ?? -1) - (a.score ?? -1)) || (b.relevance_score - a.relevance_score));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ----- POSTINGS -----
  if (path === '/api/postings') return json(res, { rubric: loadRubric(), rows: postingsQueue() });
  if (path === '/api/posting') {
    const key = url.searchParams.get('key');
    const d = postingDetail(key);
    if (!d.title && !d.company) return json(res, { error: 'not found' }, 404);
    return json(res, d);
  }
  if (req.method === 'POST' && path === '/api/posting/decision') {
    const { key, decision } = await body(req);
    if (!['shortlist', 'skip', 'undecided'].includes(decision)) return json(res, { error: 'bad decision' }, 400);
    const rows = loadJsonl(POST_PERSONAL); const p = rows.find(x => x.key === key);
    if (!p) return json(res, { error: 'not found' }, 404);
    p.decision = decision; p.last_reviewed = 'web'; saveJsonl(POST_PERSONAL, rows);
    return json(res, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/posting/override') {
    const { key, manual_score } = await body(req);
    const rows = loadJsonl(POST_PERSONAL); const p = rows.find(x => x.key === key);
    if (!p) return json(res, { error: 'not found' }, 404);
    if (manual_score === null || manual_score === '') p.manual_score = null;
    else { const v = Number(manual_score); if (!(v >= 0 && v <= 5)) return json(res, { error: 'score must be 0-5' }, 400); p.manual_score = v; }
    saveJsonl(POST_PERSONAL, rows);
    return json(res, { ok: true });
  }

  // ----- COMPANIES -----
  if (path === '/api/companies') return json(res, companiesQueue());
  if (path === '/api/company') {
    const key = url.searchParams.get('key');
    const p = loadJsonl(C_PERSONAL).find(x => x.key === key);
    if (!p) return json(res, { error: 'not found' }, 404);
    const r = (loadJsonl(C_RESEARCH).find(x => x.key === key)) || {};
    const note = readMd(cResearchPath(key));
    return json(res, { key, name: p.name || r.name, provider: p.provider || r.provider, careers_url: r.careers_url || p.careers_url || '',
      company_type: r.company_type, total: r.total, relevant: r.relevant, remote_relevant: r.remote_relevant,
      sample_titles: r.sample_titles || [], llm_fit: p.llm_fit ?? null, llm_rank: p.llm_rank ?? null,
      relevance_score: p.relevance_score ?? null, decision: p.decision || 'undecided', reason: p.llm_reason || '',
      research_note: note, fit_verdict: readMd(cFitPath(key, p)), links: extractLinks(note, p.name || r.name || '') });
  }
  if (req.method === 'POST' && path === '/api/company/decision') {
    const { key, decision } = await body(req);
    if (!['keep', 'skip', 'undecided'].includes(decision)) return json(res, { error: 'bad decision' }, 400);
    const rows = loadJsonl(C_PERSONAL); const p = rows.find(x => x.key === key);
    if (!p) return json(res, { error: 'not found' }, 404);
    p.decision = decision; p.last_reviewed = 'web'; saveJsonl(C_PERSONAL, rows);
    return json(res, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/company/rank') {
    const { key, llm_fit } = await body(req);
    const rows = loadJsonl(C_PERSONAL); const p = rows.find(x => x.key === key);
    if (!p) return json(res, { error: 'not found' }, 404);
    const v = Number(llm_fit); if (!(v >= 0 && v <= 5)) return json(res, { error: 'rank 0-5' }, 400);
    p.llm_fit = v; saveJsonl(C_PERSONAL, rows);
    return json(res, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/company/report') {
    const { key, which, content } = await body(req);
    if (!['research', 'fit'].includes(which)) return json(res, { error: 'bad type' }, 400);
    const rows = loadJsonl(C_PERSONAL); const p = rows.find(x => x.key === key);
    if (!p) return json(res, { error: 'not found' }, 404);
    const dir = which === 'research' ? C_RESEARCH_DIR : C_FIT_DIR; mkdirSync(dir, { recursive: true });
    const fp = which === 'research' ? cResearchPath(key) : cFitPath(key, p);
    writeFileSync(fp, String(content), 'utf8');
    if (which === 'fit' && !p.fit_brief) { p.fit_brief = fp.replace(ROOT + '/', ''); saveJsonl(C_PERSONAL, rows); }
    return json(res, { ok: true });
  }

  // ----- report viewer -----
  if (path === '/report') {
    const f = url.searchParams.get('f') || '';
    if (!/^[\w.\-]+\.md$/.test(f) || !existsSync(join(REPORTS_DIR, f))) { res.writeHead(404); return res.end('not found'); }
    const md = readFileSync(join(REPORTS_DIR, f), 'utf8');
    const esc = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta charset=utf-8><title>${esc(f)}</title><style>body{font:14px/1.6 -apple-system,system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;background:#0f1020;color:#e8e9f3}pre{white-space:pre-wrap}a{color:#7c8cff}</style><p><a href="/">← dashboard</a></p><pre>${esc(md)}</pre>`);
  }

  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'index.html'), 'utf8')); }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, () => console.log(`career-ops dashboard → http://localhost:${PORT}`));
