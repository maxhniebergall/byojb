#!/usr/bin/env node
// web/server.mjs — the SINGLE BYOJB dashboard (read+write, localhost-only).
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
import {
  loadContacts, loadOutreach, upsertContact, upsertOutreach, resolveContact, contactKey,
  nextThreadKey, linkApplication, threadTiming, syncOutreachMdWithPostings, validateOutreachStatus,
  isOpenOutreach, isStrongTie, OUTREACH_STATES, ARCHETYPES, RELATIONSHIPS, CHANNELS, INTENTS, OUTCOMES,
  ACTIVITY_LEVELS,
} from '../outreach-core.mjs';
import { classifyForm, classifyField, normLabel, PROFILE_KEYS } from '../autofill-fields.mjs';
import { validateBandRow } from '../comp-core.mjs';
import { TITLE_FAMILIES, LEVEL_LADDER } from '../title-family.mjs';

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
const C_COMP = P('data', 'company-comp.jsonl');
const C_COMP_DIR = P('data', 'company-comp');
const C_AGG = P('data', 'company-aggregates.jsonl');
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
// Classify a posting's named technologies against the rubric's preference lists.
//
// Exact matching means a JD that says "MLOps" does not match a list entry of "ML" — that gap used
// to cost the posting score silently, and was only ever found by reading one row by hand. Surfacing
// the classification makes the gap visible at the point it matters, on the posting itself.
function classifyStack(ex, prefs) {
  const L = prefs?.languages || {}, T = prefs?.technologies || {};
  const bucket = (names) => new Set((names || []).map(x => String(x).toLowerCase()));
  const love = bucket([...(L.love || []), ...(T.love || [])]);
  const ok = bucket([...(L.ok || []), ...(T.ok || [])]);
  const avoid = bucket([...(L.avoid || []), ...(T.avoid || [])]);
  const neutral = bucket([...(L.neutral || []), ...(T.neutral || [])]);
  const out = { love: [], ok: [], avoid: [], neutral: [], unrecognized: [] };
  for (const item of [...(ex.languages || []), ...(ex.technologies || [])]) {
    const k = String(item).toLowerCase();
    if (avoid.has(k)) out.avoid.push(item);
    else if (love.has(k)) out.love.push(item);
    else if (ok.has(k)) out.ok.push(item);
    else if (neutral.has(k)) out.neutral.push(item);
    else out.unrecognized.push(item);
  }
  return out;
}

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
  // Read once, not per row: classifyStack runs for every posting.
  const prefs = loadRubric().preferences || {};
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
      first_seen: r.first_seen || null,
      researched: !!r.extracted, has_body: !!r.has_body,
      // application/cap state
      applied: hasApplied || p.decision === 'applied', company_open_count: open_count, capped: open_count >= max_open_per_company,
      // facets surfaced for filtering/columns
      seniority: ex.seniority || null, yoe_min: ex.yoe_min ?? null, yoe_max: ex.yoe_max ?? null,
      languages: ex.languages || [], technologies: ex.technologies || [],
      // How each named technology was CLASSIFIED against the rubric. Shipped so the postings page
      // can show WHY a stack scored what it did, and so unrecognised terms are visible as
      // candidates to add — the preference list can only improve if its gaps are legible.
      stack_match: classifyStack(ex, prefs),
      remote_policy: ex.remote_policy || null, geo_eligibility: ex.geo_eligibility || null,
      employment_type: ex.employment_type || null, comp: ex.comp || r.comp || null,
      // Comp PROVENANCE. `comp_imputed` is deliberately a SEPARATE field from `comp` so the UI
      // physically cannot render a company-band estimate in the listed-comp column by accident.
      comp_source: p.comp_source ?? null,
      comp_imputed: (p.comp_source || '').startsWith('company_') ? (p.comp_band_ref || null) : null,
      on_call: ex.on_call ?? null, domain: ex.domain || null,
      autonomy: ex.autonomy || null, culture: ex.culture || null, company_stage: ex.company_stage || null,
      // scores
      dim_scores: p.dim_scores || null, computed_score: p.computed_score ?? null,
      manual_score: p.manual_score ?? null, llm_rank: p.llm_rank ?? null,
      llm_holistic_fit: p.llm_holistic_fit ?? null, relevance_score: p.relevance_score ?? 0,
      display_score: display, hard_excluded: !!p.hard_excluded,
      // One opening published per-city is one opening. dup_of names the row that represents the
      // group; dup_count tells the canonical row how many listings it stands for.
      dup_of: p.dup_of || null, dup_count: p.dup_count || null,
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
  // Posting-derived signals (company-aggregates.mjs). Shipped to the browser so the client can
  // re-sort by them; the SERVER's default sort stays the existing tier→score→relevance ordering,
  // which remains the single authority on "what should I look at next".
  const agg = new Map(loadJsonl(C_AGG).map(a => [a.key, a]));
  return personal.filter(p => !p.excluded_by_type).map(p => {
    const r = research.get(p.key) || {};
    const a = agg.get(p.key) || {};
    const score = p.llm_fit ?? p.llm_rank ?? null;
    const tier = p.llm_fit != null ? 2 : p.llm_rank != null ? 1 : 0;
    return { key: p.key, name: p.name || r.name, provider: p.provider || r.provider,
      company_type: r.company_type || 'unknown', remote_relevant: r.remote_relevant ?? null,
      score, tier, relevance_score: p.relevance_score ?? 0, llm_fit: p.llm_fit ?? null, llm_rank: p.llm_rank ?? null,
      decision: p.decision || 'undecided', researched: !!p.fit_brief, reason: p.llm_reason || '',
      live_relevant: a.live_relevant ?? 0, live_relevant_no_comp: a.live_relevant_no_comp ?? 0,
      best_posting_score: a.best_posting_score ?? null, comp_band_rows: a.comp_band_rows ?? 0,
      comp_band_best_confidence: a.comp_band_best_confidence ?? null,
      comp_band_best_derivation: a.comp_band_best_derivation ?? null,
      comp_band_as_of: a.comp_band_as_of ?? null };
  }).sort((a, b) => (b.tier - a.tier) || ((b.score ?? -1) - (a.score ?? -1)) || (b.relevance_score - a.relevance_score));
}

// Every pay band on record for one company, plus the free-text comp dossier. OBJECTIVE tier —
// shareable alongside data/company-research/, unlike the private fit verdict.
const cCompPath = (key) => join(C_COMP_DIR, sk(key) + '.md');
function companyComp(key) {
  return {
    comp_bands: loadJsonl(C_COMP).filter(r => r.key === key)
      .sort((x, y) => String(x.title_family).localeCompare(String(y.title_family))
        || LEVEL_LADDER.indexOf(y.ladder_level) - LEVEL_LADDER.indexOf(x.ladder_level)),
    comp_note: readMd(cCompPath(key)),
    aggregates: loadJsonl(C_AGG).find(a => a.key === key) || null,
  };
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
      has_posting: research.has(a.key),
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
    has_posting: !!r.key,
  };
}

// ── OUTREACH ────────────────────────────────────────────────────────
// contacts.jsonl × outreach.jsonl × posting-research.jsonl → the Outreach-tab queue.
// Joins are denormalized here (not stored) so a renamed company or re-scanned posting is
// picked up on the next request — same approach as applicationsQueue().
function outreachQueue() {
  const contacts = new Map(loadContacts().map(c => [c.key, c]));
  const rows = loadOutreach();
  const wanted = new Set(rows.map(r => r.posting_key).filter(Boolean));
  const postings = new Map();
  if (wanted.size) for (const p of loadJsonl(POST_RESEARCH_PATH)) if (wanted.has(p.key)) postings.set(p.key, p);
  return rows.map(r => {
    const c = contacts.get(r.contact_key) || {};
    const p = postings.get(r.posting_key) || {};
    return {
      ...r, ...threadTiming(r),
      contact_name: c.name || '', contact_title: c.title || '', linkedin_url: c.linkedin_url || '',
      archetype: c.archetype || 'other', relationship: c.relationship || 'cold', strong_tie: isStrongTie(c.relationship),
      relevance: c.relevance ?? null, activity: c.activity || 'unknown', contact_notes: c.notes || '',
      // Prefer a real display name; the raw "provider:slug" key is a last resort, not a label.
      company: c.company || p.company || r.company_key || '', company_key: r.company_key || c.company_key || '',
      posting_title: p.title || '', posting_url: p.url || '',
      open: isOpenOutreach(r.status),
    };
  }).sort((a, b) => String(b.last_updated || '').localeCompare(String(a.last_updated || '')));
}

function outreachDetail(key) {
  const r = loadOutreach().find(x => x.key === key);
  if (!r) return null;
  const contact = loadContacts().find(c => c.key === r.contact_key) || {};
  const p = r.posting_key ? (loadJsonl(POST_RESEARCH_PATH).find(x => x.key === r.posting_key) || {}) : {};
  const app = r.application_key ? (loadApplications().find(a => a.key === r.application_key) || null) : null;
  return {
    ...r, ...threadTiming(r), contact, strong_tie: isStrongTie(contact.relationship),
    posting: { key: p.key || '', title: p.title || '', url: p.url || '', apply_url: p.apply_url || '', company: p.company || '', location: p.location || '' },
    application: app ? { key: app.key, status: app.status, tracker_num: app.tracker_num } : null,
    vocab: { states: OUTREACH_STATES, archetypes: ARCHETYPES, relationships: RELATIONSHIPS, channels: CHANNELS, intents: INTENTS, outcomes: OUTCOMES, activity_levels: ACTIVITY_LEVELS },
  };
}

// Contacts list with a per-person thread rollup, so the Contacts tab can show "3 threads,
// last touched X" without a second round trip.
function contactsQueue() {
  const threads = loadOutreach();
  return loadContacts().map(c => {
    const mine = threads.filter(t => t.contact_key === c.key);
    return {
      ...c, strong_tie: isStrongTie(c.relationship),
      // Default at READ time rather than migrating the file: contacts captured before these
      // fields existed simply have no key, and the UI must not tell them apart from a contact
      // you deliberately left unrated.
      relevance: c.relevance ?? null,
      activity: c.activity || 'unknown',
      relationship: c.relationship || 'cold',
      archetype: c.archetype || 'other',
      thread_count: mine.length,
      open_threads: mine.filter(t => isOpenOutreach(t.status)).length,
      last_touched: mine.reduce((m, t) => String(t.last_updated || '') > m ? String(t.last_updated) : m, ''),
    };
  }).sort((a, b) => String(b.last_touched || b.last_updated || '').localeCompare(String(a.last_touched || a.last_updated || '')));
}

// Upsert a person from a loose payload (dashboard form or extension capture), reusing an
// existing row whenever any identity handle matches so re-capturing a profile never forks it.
function upsertContactFromPayload(c = {}) {
  const existing = resolveContact(c);
  const key = existing ? existing.key : contactKey(c);
  if (!key) return null;
  const patch = {};
  for (const f of ['name', 'company_key', 'company', 'title', 'archetype', 'relationship', 'activity', 'linkedin_url', 'email', 'phone', 'source', 'notes']) {
    if (c[f] !== undefined && c[f] !== '') patch[f] = c[f];
  }
  // relevance is passed through even when blank, so clearing the box un-rates the contact.
  // (The loop above skips '' precisely so a partial capture can't blank a field you filled in.)
  if (c.relevance !== undefined) patch.relevance = c.relevance;
  return upsertContact(key, patch);
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
  if (path === '/api/postings') { const rows = postingsQueue(); return json(res, { rubric: loadRubric(), workflow: workflowCfg(), funnel: funnelStats(rows), rows, today: today() }); }
  if (path === '/api/posting') {
    const key = url.searchParams.get('key');
    const d = postingDetail(key);
    if (!d.title && !d.company) return json(res, { error: 'not found' }, 404);
    return json(res, { ...d, rubric: loadRubric() });
  }
  // Add a technology to a rubric preference list, from the postings page.
  //
  // The lists are the single most under-maintained part of the rubric: they are edited by hand, in
  // a file, away from the evidence. Every unrecognised term the UI shows is a term some real
  // posting used, so classifying it should be one click at the moment you see it — otherwise the
  // gap persists and silently mis-scores every future posting that uses the same word.
  if (req.method === 'POST' && path === '/api/rubric/technology') {
    const { term, list, group } = await body(req);
    if (!term || !['love', 'ok', 'avoid', 'neutral'].includes(list)) return json(res, { error: 'bad list' }, 400);
    const grp = group === 'languages' ? 'languages' : 'technologies';
    const cfg = loadRubric() || {};
    cfg.preferences = cfg.preferences || {};
    cfg.preferences[grp] = cfg.preferences[grp] || {};
    const cur = cfg.preferences[grp][list] || [];
    const already = cur.some(x => String(x).toLowerCase() === String(term).toLowerCase());
    if (already) return json(res, { ok: true, already: true });
    // Rewrite via YAML rather than string-splicing so the file stays valid; comments in the
    // preferences block are lost, which is why the block documents itself in rubric.example.yml.
    cfg.preferences[grp][list] = [...cur, term];
    writeFileSync(RUBRIC, yaml.dump(cfg, { lineWidth: 120 }), 'utf-8');
    return json(res, { ok: true, added: term, list, group: grp, rescore_needed: true });
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
      research_note: note, fit_verdict: readMd(cFitPath(key, p)), links: extractLinks(note, p.name || r.name || ''),
      ...companyComp(key) });
  }
  // Pay bands are OBJECTIVE data about a company (like headcount), so they are written to the
  // shareable layer. Every row is validated against the same contract llm-triage --apply-comp
  // and doctor.mjs use: a mislabeled derivation, an uncited claim, or a ToS-barred source is
  // rejected here rather than silently stored.
  if (req.method === 'POST' && path === '/api/company/comp') {
    const { key, rows: incoming, note } = await body(req);
    if (!key) return json(res, { error: 'key required' }, 400);
    if (note != null) {
      mkdirSync(C_COMP_DIR, { recursive: true });
      writeFileSync(cCompPath(key), String(note), 'utf8');
      return json(res, { ok: true });
    }
    if (!Array.isArray(incoming)) return json(res, { error: 'rows[] or note required' }, 400);
    const errors = [];
    incoming.forEach((row, i) => {
      const errs = validateBandRow({ ...row, key }, { families: TITLE_FAMILIES });
      if (errs.length) errors.push({ i, errs });
    });
    if (errors.length) return json(res, { error: 'invalid band rows', errors }, 400);
    const stamp = today();
    const clean = incoming.map(r => ({ ...r, key, first_seen: r.first_seen || stamp, last_seen: stamp }));
    // Replace only this company's rows; every other company is untouched.
    saveJsonl(C_COMP, [...loadJsonl(C_COMP).filter(r => r.key !== key), ...clean]);
    return json(res, { ok: true, saved: clean.length });
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
    const { fields: cf, allStandard, counts } = classifyForm(fields, userMap);
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
    const unresolved = out.filter(f => f.required && !String(f.value || '').trim()).map(f => f.label);
    return json(res, { fields: out, allStandard, counts, requiredUnresolved: unresolved, default_resume: profile.default_resume || '', profile_keys: PROFILE_KEYS });
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

  // Controlled vocabularies, so the Chrome extension renders the SAME options the registry
  // validates against instead of keeping its own copy that silently drifts out of date.
  if (path === '/api/vocab') {
    return json(res, {
      archetypes: ARCHETYPES, relationships: RELATIONSHIPS, activity_levels: ACTIVITY_LEVELS,
      channels: CHANNELS, intents: INTENTS, outcomes: OUTCOMES, outreach_states: OUTREACH_STATES,
    });
  }

  // ----- CONTACTS -----
  if (path === '/api/contacts') {
    const ck = url.searchParams.get('company_key') || '';
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let rows = contactsQueue();
    if (ck) rows = rows.filter(c => c.company_key === ck);
    if (q) rows = rows.filter(c => [c.name, c.company, c.title, c.notes, c.email].filter(Boolean).join(' ').toLowerCase().includes(q));
    return json(res, { rows, vocab: { archetypes: ARCHETYPES, relationships: RELATIONSHIPS, activity_levels: ACTIVITY_LEVELS } });
  }
  // Does this person already exist? The extension asks before rendering its capture panel so it
  // can prefill and EDIT rather than blindly re-create — otherwise every re-capture overwrites the
  // ratings and notes you'd already set.
  if (path === '/api/contact/lookup') {
    const c = resolveContact({
      key: url.searchParams.get('key') || '',
      linkedin_url: url.searchParams.get('linkedin_url') || '',
      email: url.searchParams.get('email') || '',
      name: url.searchParams.get('name') || '',
      company_key: url.searchParams.get('company_key') || '',
    });
    if (!c) return json(res, { found: false });
    const mine = loadOutreach().filter(t => t.contact_key === c.key);
    return json(res, {
      found: true,
      contact: {
        ...c,
        relevance: c.relevance ?? null, activity: c.activity || 'unknown',
        relationship: c.relationship || 'cold', archetype: c.archetype || 'other',
      },
      thread_count: mine.length,
      open_threads: mine.filter(t => isOpenOutreach(t.status)).length,
    });
  }
  if (req.method === 'POST' && path === '/api/contact') {
    const b = await body(req);
    const row = upsertContactFromPayload(b);
    if (!row) return json(res, { error: 'need a linkedin_url, email, or name' }, 400);
    return json(res, { ok: true, key: row.key, contact: row });
  }

  // ----- OUTREACH -----
  if (path === '/api/outreach') {
    let rows = outreachQueue();
    const st = url.searchParams.get('status'), ck = url.searchParams.get('company_key'), pk = url.searchParams.get('posting_key');
    if (st) rows = rows.filter(r => r.status === st);
    if (ck) rows = rows.filter(r => r.company_key === ck);
    if (pk) rows = rows.filter(r => r.posting_key === canonicalUrl(pk));
    return json(res, { rows, vocab: { states: OUTREACH_STATES, archetypes: ARCHETYPES, relationships: RELATIONSHIPS, channels: CHANNELS, intents: INTENTS, outcomes: OUTCOMES, activity_levels: ACTIVITY_LEVELS } });
  }
  if (path === '/api/outreach/thread') {
    const d = outreachDetail(url.searchParams.get('key') || '');
    if (!d) return json(res, { error: 'not found' }, 404);
    return json(res, d);
  }
  // Create a thread. Accepts either an existing contact_key or an inline `contact` object
  // (the extension always sends the latter — it has a LinkedIn profile, not a BYOJB key).
  if (req.method === 'POST' && path === '/api/outreach/create') {
    const b = await body(req);
    let ckey = b.contact_key || '';
    let contact = null;
    if (!ckey) {
      contact = upsertContactFromPayload(b.contact || {});
      if (!contact) return json(res, { error: 'contact_key or contact{} required' }, 400);
      ckey = contact.key;
    } else {
      contact = loadContacts().find(c => c.key === ckey) || null;
      if (!contact) return json(res, { error: 'unknown contact_key' }, 404);
    }
    // Fall back to the posting's company so a thread started from a posting is always grouped.
    let companyKey = b.company_key || contact.company_key || '';
    const pk = b.posting_key ? canonicalUrl(b.posting_key) : '';
    if (pk && !companyKey) {
      const p = loadJsonl(POST_RESEARCH_PATH).find(x => x.key === pk);
      if (p) companyKey = p.company_key || '';
    }
    const key = nextThreadKey(ckey);
    const row = upsertOutreach(key, {
      contact_key: ckey, company_key: companyKey, posting_key: pk,
      channel: b.channel, intent: b.intent, notes: b.notes,
      status: b.status || 'Drafted',
      ...(b.body ? { message: { direction: 'out', body: b.body, sent_at: b.sent_at } } : {}),
    });
    syncOutreachMdWithPostings();
    return json(res, { ok: true, key: row.key, contact_key: ckey });
  }
  if (req.method === 'POST' && path === '/api/outreach/message') {
    const b = await body(req);
    if (!loadOutreach().some(r => r.key === b.key)) return json(res, { error: 'not found' }, 404);
    // Logging an outbound message on a thread that's already been sent is a follow-up; the
    // status shouldn't silently regress, so only advance it.
    const cur = loadOutreach().find(r => r.key === b.key);
    let status = b.status;
    if (!status && b.direction !== 'in') status = cur.status === 'Drafted' ? 'Sent' : (cur.status === 'Sent' ? 'Followed Up' : cur.status);
    if (!status && b.direction === 'in') status = 'Responded';
    const row = upsertOutreach(b.key, { message: { direction: b.direction, body: b.body, sent_at: b.sent_at, note: b.note }, status });
    syncOutreachMdWithPostings();
    return json(res, { ok: true, status: row.status, message_count: (row.messages || []).length });
  }
  if (req.method === 'POST' && path === '/api/outreach/status') {
    const b = await body(req);
    if (!loadOutreach().some(r => r.key === b.key)) return json(res, { error: 'not found' }, 404);
    const row = upsertOutreach(b.key, { status: validateOutreachStatus(b.status), ...(b.outcome !== undefined ? { outcome: b.outcome } : {}) });
    syncOutreachMdWithPostings();
    return json(res, { ok: true, status: row.status, outcome: row.outcome });
  }
  if (req.method === 'POST' && path === '/api/outreach/meta') {
    const b = await body(req);
    if (!loadOutreach().some(r => r.key === b.key)) return json(res, { error: 'not found' }, 404);
    const patch = {};
    for (const k of ['next_action', 'next_action_date', 'notes', 'channel', 'intent', 'outcome', 'posting_key', 'company_key']) if (k in b) patch[k] = b[k];
    upsertOutreach(b.key, patch);
    syncOutreachMdWithPostings();
    return json(res, { ok: true });
  }
  // Turn a converted thread into a tracked application, reusing the existing create path so
  // applications.jsonl stays the single source of truth for anything actually submitted.
  if (req.method === 'POST' && path === '/api/outreach/convert') {
    const b = await body(req);
    const t = loadOutreach().find(r => r.key === b.key);
    if (!t) return json(res, { error: 'not found' }, 404);
    const rk = b.posting_key ? canonicalUrl(b.posting_key) : t.posting_key;
    if (!rk) return json(res, { error: 'thread has no posting_key — set one first' }, 400);
    const r = loadJsonl(POST_RESEARCH_PATH).find(x => x.key === rk) || {};
    const au = r.apply_url || r.url || rk;
    upsertApplication(rk, {
      status: 'Applied', company: r.company, title: r.title, apply_url: au,
      company_key: r.company_key || deriveCompanyKey('', au),
      notes: `Came in via outreach (${t.channel}) — thread ${t.key}`,
    });
    syncTrackerMd();
    linkApplication(t.key, rk);
    syncOutreachMdWithPostings();
    return json(res, { ok: true, application_key: rk });
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

  if (path === '/postings') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'postings.html'), 'utf8')); }
  if (path === '/companies') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'companies.html'), 'utf8')); }
  if (path === '/applications') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'applications.html'), 'utf8')); }
  if (path === '/outreach') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'outreach.html'), 'utf8')); }
  if (path === '/contacts') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'contacts.html'), 'utf8')); }
  if (path === '/posting') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'posting.html'), 'utf8')); }
  if (path === '/compare') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(readFileSync(P('web', 'posting-comparison.html'), 'utf8')); }
  if (path === '/') { res.writeHead(302, { 'location': '/postings' }); return res.end(); }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, () => console.log(`Build Your Own Job Board (BYOJB) dashboard → http://localhost:${PORT}`));
