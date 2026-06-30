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
import { loadJsonl, saveJsonl, sk, canonicalUrl, deriveCompanyKey, ghJobId } from '../posting-core.mjs';
import {
  loadApplications, saveApplications, upsertApplication, syncTrackerMd, validateStatus,
  CANONICAL_STATES, today, APPLICATIONS_JSONL, OPEN_STATUSES, isOpen,
} from '../application-core.mjs';
import { classifyForm, classifyField, normLabel, PROFILE_KEYS } from '../autofill-fields.mjs';

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
const PROFILE_YML = P('config', 'profile.yml');
const AUTOFILL_MAP = P('config', 'autofill-mapping.json');
const ANSWER_MEMORY = P('config', 'answer-memory.json');
const ESSAY_ANSWERS = P('data', 'essay-answers.jsonl');
const POST_RESEARCH_PATH = POST_RESEARCH;
const SNAPSHOT_DIR = P('data', 'application-snapshots');

const readMd = (p) => existsSync(p) ? readFileSync(p, 'utf8') : '';
const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });

function loadRubric() {
  try { return yaml.load(readFileSync(RUBRIC, 'utf8')) || { dimensions: [] }; } catch { return { dimensions: [] }; }
}

// Workflow knobs (live in rubric.yml under `workflow:`; defaults if absent).
function workflowCfg() {
  const w = (loadRubric().workflow) || {};
  return { max_open_per_company: Number(w.max_open_per_company) || 3, apply_floor: Number(w.apply_floor) || 3.5 };
}

// company_key for an application: stored value wins, else join via posting-research, else derive
// from the apply/url (deriveCompanyKey parses the slug regardless of provider).
function companyKeyForApp(a, researchMap) {
  if (a.company_key) return a.company_key;
  const r = researchMap.get(a.key);
  if (r && r.company_key) return r.company_key;
  return deriveCompanyKey('', a.apply_url || a.key || '');
}

// { company_key: # of OPEN applications } — drives the per-company cap.
function openCountByCompany(researchMap = new Map(loadJsonl(POST_RESEARCH).map(r => [r.key, r]))) {
  const counts = {};
  for (const a of loadApplications()) {
    if (!isOpen(a.status)) continue;
    const ck = companyKeyForApp(a, researchMap);
    if (ck) counts[ck] = (counts[ck] || 0) + 1;
  }
  return counts;
}

// Funnel for the "what's next" panel: how much actionable work is left, and what feeds the queue.
function funnelStats(rows) {
  const { apply_floor, max_open_per_company } = workflowCfg();
  const live = rows.filter(r => r.live).length;
  const actionable = rows.filter(r => r.live && !r.hard_excluded && !r.capped && !r.applied && (r.display_score ?? -1) >= apply_floor).length;
  const open_apps = loadApplications().filter(a => isOpen(a.status)).length;
  const research = new Map(loadJsonl(POST_RESEARCH).map(r => [r.key, r]));
  const capped_companies = Object.values(openCountByCompany(research)).filter(n => n >= max_open_per_company).length;
  // company funnel: kept companies with no live postings yet, and researched-but-undecided ones
  const liveCompanyKeys = new Set([...research.values()].filter(r => r.live !== false).map(r => r.company_key));
  const cpersonal = loadJsonl(C_PERSONAL);
  const companies_kept_unscanned = cpersonal.filter(c => c.decision === 'keep' && !liveCompanyKeys.has(c.key)).length;
  const companies_to_research = cpersonal.filter(c => c.decision === 'undecided' && c.llm_fit != null && !c.excluded_by_type).length;
  // Lever C — just-in-time vetting queue: undecided companies that already have a shortlisted live
  // posting. These earned a vetting decision by surfacing a role you liked.
  const undecidedKeys = new Set(cpersonal.filter(c => c.decision === 'undecided').map(c => c.key));
  const pendingVetKeys = new Set(rows.filter(r => r.decision === 'shortlist' && r.live && undecidedKeys.has(r.company_key)).map(r => r.company_key));
  const companies_pending_vet = pendingVetKeys.size;
  return { live, actionable, open_apps, capped_companies, companies_kept_unscanned, companies_to_research, companies_pending_vet };
}

// ── lifecycle join: posting URL → application Status ──
// applications.jsonl (keyed by canonicalUrl) is authoritative; fall back to the legacy
// report-scan (reports' **URL:** → applications.md Status) for postings with no record.
function lifecycleByUrl() {
  const map = new Map();
  const ghMap = new Map();
  for (const a of loadApplications()) {
    if (!a.key) continue;
    const reportFile = (String(a.report || '').match(/([\w.\-]+\.md)/) || [])[1] || null;
    const val = { status: a.status || null, report: reportFile };
    map.set(canonicalUrl(a.key), val);
    const gid = ghJobId(a.key);
    if (gid) ghMap.set(gid, val);
  }
  if (!existsSync(REPORTS_DIR)) {
    return {
      get(key) {
        if (map.has(key)) return map.get(key);
        const gid = ghJobId(key);
        if (gid && ghMap.has(gid)) return ghMap.get(gid);
        return undefined;
      }
    };
  }
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
    if (map.has(info.url)) continue; // applications.jsonl already has the authoritative status
    const val = { status: statusByNum.get(info.num) || 'Evaluated', report: f };
    map.set(info.url, val);
    const gid = ghJobId(info.url);
    if (gid) ghMap.set(gid, val);
  }
  return {
    get(key) {
      if (map.has(key)) return map.get(key);
      const gid = ghJobId(key);
      if (gid && ghMap.has(gid)) return ghMap.get(gid);
      return undefined;
    }
  };
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
  const openByCo = openCountByCompany(research);
  const { max_open_per_company } = workflowCfg();
  // company_key → vetting state (Lever C badge + Lever B transparency on each posting row).
  const companyByKey = new Map(loadJsonl(C_PERSONAL).map(c => [c.key, c]));
  return personal.map(p => {
    const r = research.get(p.key) || {};
    const ex = r.extracted || {};
    const display = p.manual_score ?? p.computed_score ?? (p.llm_rank != null ? p.llm_rank : null);
    const lc = life.get(p.key);
    const hasApplied = lc && lc.status !== 'Evaluated';
    const open_count = openByCo[r.company_key] || 0;
    const co = companyByKey.get(r.company_key) || {};
    return {
      key: p.key, url: r.url, apply_url: r.apply_url || r.url, company: r.company, company_key: r.company_key || null,
      company_decision: co.decision || 'undecided', company_fit: co.llm_fit ?? null,
      title: r.title, provider: r.provider,
      location: r.location, department: r.department, date_posted: r.date_posted, live: r.live !== false,
      researched: !!r.extracted, has_body: !!r.has_body,
      // application/cap state
      applied: hasApplied || p.decision === 'applied', company_open_count: open_count, capped: open_count >= max_open_per_company,
      // facets surfaced for filtering/columns
      seniority: ex.seniority || null, yoe_min: ex.yoe_min ?? null, yoe_max: ex.yoe_max ?? null,
      languages: ex.languages || [], technologies: ex.technologies || [],
      remote_policy: ex.remote_policy || null, geo_eligibility: ex.geo_eligibility || null,
      employment_type: ex.employment_type || null, comp: ex.comp || r.comp || null,
      on_call: ex.on_call ?? null, domain: ex.domain || null,
      autonomy: ex.autonomy || null, culture: ex.culture || null, company_stage: ex.company_stage || null,
      // scores
      dim_scores: p.dim_scores || null, computed_score: p.computed_score ?? null,
      manual_score: p.manual_score ?? null, llm_rank: p.llm_rank ?? null,
      llm_holistic_fit: p.llm_holistic_fit ?? null, relevance_score: p.relevance_score ?? 0,
      display_score: display, hard_excluded: !!p.hard_excluded,
      decision: hasApplied ? 'applied' : (p.decision || 'undecided'),
      reason: p.llm_reason || '',
      status: life.get(p.key)?.status || null, report: life.get(p.key)?.report || null,
    };
  });
}

function postingDetail(key) {
  const r = (loadJsonl(POST_RESEARCH).find(x => x.key === key)) || {};
  const p = (loadJsonl(POST_PERSONAL).find(x => x.key === key)) || {};
  const fitPath = p.fit_brief ? P(p.fit_brief) : join(POST_FIT_DIR, sk(key) + '.md');
  const life = lifecycleByUrl();
  const lc = life.get(key);
  const hasApplied = lc && lc.status !== 'Evaluated';
  return {
    ...r, ...p, key,
    decision: hasApplied ? 'applied' : (p.decision || 'undecided'),
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

// ── APPLICATIONS + AUTOFILL ─────────────────────────────────────────
const reportFileOf = (a) => (String(a.report || '').match(/([\w.\-]+\.md)/) || [])[1] || null;

// applications.jsonl × posting-research.jsonl (by key) → the Applications-tab queue.
function applicationsQueue() {
  const research = new Map(loadJsonl(POST_RESEARCH_PATH).map(r => [r.key, r]));
  return loadApplications().map(a => {
    const r = research.get(a.key) || {};
    return {
      key: a.key, tracker_num: a.tracker_num, company: a.company || r.company || '', title: a.title || r.title || '',
      status: a.status, date_applied: a.date_applied, cv_pdf: a.cv_pdf || '',
      apply_url: a.apply_url || r.apply_url || r.url || '', url: r.url || '',
      provider: r.provider || '', location: r.location || '',
      recruiter: a.recruiter || {}, confirmation: a.confirmation || '', notes: a.notes || '',
      report: reportFileOf(a), has_body: !!r.has_body, last_updated: a.last_updated || '',
    };
  }).sort((x, y) => String(y.date_applied || '').localeCompare(String(x.date_applied || '')) || (y.tracker_num - x.tracker_num));
}

function applicationDetail(key) {
  const a = loadApplications().find(x => x.key === key);
  if (!a) return null;
  const r = loadJsonl(POST_RESEARCH_PATH).find(x => x.key === key) || {};
  return {
    ...a, company: a.company || r.company || '', title: a.title || r.title || '',
    provider: r.provider || '', location: r.location || '', url: r.url || '',
    apply_url: a.apply_url || r.apply_url || r.url || '',
    jd_body: r.has_body ? readMd(join(POST_BODY_DIR, sk(key) + '.md')) : '',
    report_file: reportFileOf(a),
  };
}

function loadAppProfile() {
  try { return (yaml.load(readFileSync(PROFILE_YML, 'utf8')) || {}).application_profile || {}; } catch { return {}; }
}
function loadUserMap() {
  try { return JSON.parse(readFileSync(AUTOFILL_MAP, 'utf8')).mappings || {}; } catch { return {}; }
}
// answer memory: normalized question → the exact answer the user gave last time (learned from
// what they fill/submit). Auto-fills identical questions, no profile-key mapping needed.
function loadAnswerMemory() {
  try { return JSON.parse(readFileSync(ANSWER_MEMORY, 'utf8')).answers || {}; } catch { return {}; }
}
// Only memorize answers the profile DOESN'T already cover — custom (unmapped), EEO (demographic),
// and free-text (essay) questions. Keeps identity fields (name/email) sourced from the profile, not stale memory.
function learnableAnswers(fields = [], userMap = loadUserMap()) {
  return fields.filter(f => {
    if (!String(f.value || '').trim()) return false;
    const k = classifyField(f.label, f.type, f, userMap).kind;
    return k === 'unmapped' || k === 'demographic' || k === 'free_text';
  }).map(f => ({ label: f.label, value: f.value, type: f.type }));
}
function rememberAnswers(items = []) {
  let j = { answers: {} };
  try { j = JSON.parse(readFileSync(ANSWER_MEMORY, 'utf8')); } catch { /* seed fresh */ }
  j.answers = j.answers || {};
  let saved = 0;
  for (const { label, value, type } of items) {
    const norm = normLabel(label);
    const val = value == null ? '' : (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value));
    if (!norm || !val.trim()) continue;
    j.answers[norm] = { value: val, type: type || '', label: String(label || ''), updated: today() };
    saved++;
  }
  if (saved) writeFileSync(ANSWER_MEMORY, JSON.stringify(j, null, 2) + '\n');
  return saved;
}

const server = createServer(async (req, res) => {
  // Permissive CORS so the Chrome extension can call these localhost endpoints.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  // Disable caching for API and dynamic content — fresh data on every request
  if (String(req.url).startsWith('/api/') || String(req.url).startsWith('/posting') || String(req.url).startsWith('/compare') || String(req.url) === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ----- POSTINGS -----
  if (path === '/api/postings') { const rows = postingsQueue(); return json(res, { rubric: loadRubric(), workflow: workflowCfg(), funnel: funnelStats(rows), rows }); }
  if (path === '/api/posting') {
    const key = url.searchParams.get('key');
    const d = postingDetail(key);
    if (!d.title && !d.company) return json(res, { error: 'not found' }, 404);
    return json(res, { ...d, rubric: loadRubric() });
  }
  if (req.method === 'POST' && path === '/api/posting/decision') {
    const { key, decision } = await body(req);
    if (!['shortlist', 'skip', 'applied', 'undecided'].includes(decision)) return json(res, { error: 'bad decision' }, 400);
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

  // ----- APPLICATIONS -----
  if (path === '/api/applications') return json(res, applicationsQueue());
  if (path === '/api/application') {
    const d = applicationDetail(url.searchParams.get('key'));
    if (!d) return json(res, { error: 'not found' }, 404);
    return json(res, { ...d, states: CANONICAL_STATES });
  }
  if (req.method === 'POST' && path === '/api/application/status') {
    const { key, status } = await body(req);
    if (!loadApplications().some(a => a.key === key)) return json(res, { error: 'not found' }, 404);
    const v = validateStatus(status);
    upsertApplication(key, { status: v }); syncTrackerMd();
    return json(res, { ok: true, status: v });
  }
  if (req.method === 'POST' && path === '/api/application/meta') {
    const b = await body(req);
    if (!loadApplications().some(a => a.key === b.key)) return json(res, { error: 'not found' }, 404);
    const patch = {};
    for (const k of ['recruiter', 'confirmation', 'notes', 'cv_pdf', 'apply_url', 'company', 'title']) if (k in b) patch[k] = b[k];
    upsertApplication(b.key, patch); syncTrackerMd();
    return json(res, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/application/create') {
    const { key, apply_url } = await body(req);
    const rk = key || (apply_url ? canonicalUrl(apply_url) : '');
    if (!rk) return json(res, { error: 'key or apply_url required' }, 400);
    const r = loadJsonl(POST_RESEARCH_PATH).find(x => x.key === rk) || {};
    const au = apply_url || r.apply_url || r.url;
    const row = upsertApplication(rk, { status: 'Applied', company: r.company, title: r.title, apply_url: au, company_key: r.company_key || deriveCompanyKey('', au || rk) });
    syncTrackerMd();
    return json(res, { ok: true, tracker_num: row.tracker_num });
  }
  // The extension posts here after you submit: records the application + harvests free-text Q&A.
  if (req.method === 'POST' && path === '/api/application/submitted') {
    const { apply_url, company, title, fields = [], resume_name, submitted_at, snapshot, page_title } = await body(req);
    if (!apply_url) return json(res, { error: 'apply_url required' }, 400);
    const key = canonicalUrl(apply_url);
    // Join by exact key/url first, then by Greenhouse job id — company-hosted postings are keyed
    // by their careers URL (?gh_jid=) while the iframe submits ?token=, so only the id matches.
    const ghId = ghJobId(apply_url);
    const r = loadJsonl(POST_RESEARCH_PATH).find(x =>
      x.key === key || x.url === apply_url || canonicalUrl(x.apply_url || '') === key
      || (ghId && (ghJobId(x.key) === ghId || ghJobId(x.url) === ghId || ghJobId(x.apply_url) === ghId))) || {};
    const realKey = r.key || key;
    // For an un-scanned posting (no record), recover the company from the embed's ?for= param.
    let forCompany = '';
    try { forCompany = new URL(apply_url).searchParams.get('for') || ''; } catch {}

    // Derive fallback company if missing
    const coKey = r.company_key || deriveCompanyKey('', realKey);
    let derivedCompany = '';
    if (coKey && coKey.includes(':')) {
      const slug = coKey.split(':')[1];
      if (slug) {
        derivedCompany = slug.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    const finalCompany = company || r.company || forCompany || derivedCompany || undefined;

    // Derive fallback title from page title if missing
    let finalTitle = title || r.title || undefined;
    if (!finalTitle && page_title) {
      let t = page_title.trim();
      const coName = finalCompany || '';
      if (coName) {
        const escapedCo = coName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        t = t.replace(new RegExp(`\\b${escapedCo}\\b`, 'gi'), '');
      }
      t = t.replace(/\b(careers|job application|apply|recruiting|hiring|workday|ashby|greenhouse|lever)\b/gi, '');
      t = t.replace(/^[^a-zA-Z0-9(]+|[^a-zA-Z0-9)]+$/g, '').trim();
      finalTitle = t || page_title.trim();
    }

    const userMap = loadUserMap();
    // Harvest free-text answers into the essay corpus (deferred drafting feature).
    const essays = [];
    for (const f of fields) {
      if (classifyField(f.label, f.type, f, userMap).kind === 'free_text' && String(f.value || '').trim()) {
        essays.push({ key: realKey, company: finalCompany || '', title: finalTitle || '', question: f.label, answer: f.value, date: String(submitted_at || '').slice(0, 10) || today() });
      }
    }
    if (essays.length) saveJsonl(ESSAY_ANSWERS, [...loadJsonl(ESSAY_ANSWERS), ...essays]);
    // Auto-learn reusable gap answers (custom selects, EEO) so identical questions auto-fill next
    // time. learnableAnswers skips profile-covered fields, essays, files, and salary.
    const learned = rememberAnswers(learnableAnswers(fields, userMap));
    let snapPath;
    if (snapshot) { mkdirSync(SNAPSHOT_DIR, { recursive: true }); snapPath = join('data', 'application-snapshots', sk(realKey) + '.txt'); writeFileSync(P(snapPath), String(snapshot)); }
    const row = upsertApplication(realKey, {
      status: 'Applied', company: finalCompany, title: finalTitle,
      company_key: coKey, apply_url,
      cv_pdf: resume_name || undefined, submitted_fields: fields, submitted_snapshot: snapPath,
      date_applied: String(submitted_at || '').slice(0, 10) || undefined,
    });
    syncTrackerMd();
    return json(res, { ok: true, tracker_num: row.tracker_num, key: realKey, essays_captured: essays.length, answers_learned: learned });
  }

  // ----- AUTOFILL (used by the Chrome extension) -----
  // The extension enumerates the form's fields and posts them; we classify + attach fill values.
  if (req.method === 'POST' && path === '/api/autofill/plan') {
    const { fields = [] } = await body(req);
    const profile = loadAppProfile(); const userMap = loadUserMap(); const memory = loadAnswerMemory();
    const { fields: cf, allStandard, counts, requiredUnresolved } = classifyForm(fields, userMap);
    const out = cf.map(f => {
      // 1) standard profile value wins for identity fields it covers
      if (f.kind === 'standard' && f.profileKey) {
        const v = profile[f.profileKey];
        return { name: f.name, label: f.label, type: f.type, required: !!f.required, kind: 'standard', profileKey: f.profileKey, value: v == null ? '' : v };
      }
      // 2) else a remembered answer for this exact question (learned from past forms) fills the gap
      const mem = memory[normLabel(f.label)];
      if (mem && f.kind !== 'file') {
        return { name: f.name, label: f.label, type: f.type, required: !!f.required, kind: 'remembered', profileKey: null, value: mem.value };
      }
      // 3) else the heuristic classification (free_text / salary / demographic / unmapped / file)
      return { name: f.name, label: f.label, type: f.type, required: !!f.required, kind: f.kind, profileKey: f.profileKey, value: '' };
    });
    return json(res, { fields: out, allStandard, counts, requiredUnresolved: requiredUnresolved.map(f => f.label), default_resume: profile.default_resume || '', profile_keys: PROFILE_KEYS });
  }
  // Memorize answers the user picked, so identical questions auto-fill next time. Bulk or single.
  if (req.method === 'POST' && path === '/api/autofill/remember') {
    const b = await body(req);
    const items = Array.isArray(b.answers) ? b.answers : (b.label != null ? [{ label: b.label, value: b.value, type: b.type }] : []);
    const saved = rememberAnswers(learnableAnswers(items));
    return json(res, { ok: true, saved });
  }
  if (req.method === 'POST' && path === '/api/autofill/mapping') {
    const { label, profileKey } = await body(req);
    if (!PROFILE_KEYS.includes(profileKey)) return json(res, { error: 'unknown profileKey' }, 400);
    const norm = normLabel(label);
    if (!norm) return json(res, { error: 'empty label' }, 400);
    let j = { mappings: {} };
    try { j = JSON.parse(readFileSync(AUTOFILL_MAP, 'utf8')); } catch { /* seed fresh */ }
    j.mappings = j.mappings || {}; j.mappings[norm] = profileKey;
    writeFileSync(AUTOFILL_MAP, JSON.stringify(j, null, 2) + '\n');
    return json(res, { ok: true, normalized: norm });
  }
  if (path === '/api/autofill/profile') return json(res, { profile: loadAppProfile(), profile_keys: PROFILE_KEYS });

  // ----- report viewer -----
  if (path === '/report') {
    const f = url.searchParams.get('f') || '';
    if (!/^[\w.\-]+\.md$/.test(f) || !existsSync(join(REPORTS_DIR, f))) { res.writeHead(404); return res.end('not found'); }
    const md = readFileSync(join(REPORTS_DIR, f), 'utf8');
    const esc = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta charset=utf-8><title>${esc(f)}</title><style>body{font:14px/1.6 -apple-system,system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;background:#0f1020;color:#e8e9f3}pre{white-space:pre-wrap}a{color:#7c8cff}</style><p><a href="/">← dashboard</a></p><pre>${esc(md)}</pre>`);
  }

  if (path === '/postings') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'postings.html'), 'utf8')); }
  if (path === '/companies') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'companies.html'), 'utf8')); }
  if (path === '/applications') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'applications.html'), 'utf8')); }
  if (path === '/posting') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'posting.html'), 'utf8')); }
  if (path === '/compare') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'posting-comparison.html'), 'utf8')); }
  if (path === '/') { res.writeHead(302, { 'location': '/postings' }); return res.end(); }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, () => console.log(`Build Your Own Job Board (BYOJB) dashboard → http://localhost:${PORT}`));
