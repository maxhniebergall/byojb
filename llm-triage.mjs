#!/usr/bin/env node
// llm-triage.mjs (NEW) — feed company metadata to an LLM for a fast first-pass ranking.
//
// The LLM (this session, or the Gemini CLI via modes/triage-companies.md) scores each
// eligible company 1-5 for fit vs the rubric using NAME + company_type + its real relevant
// job titles + world knowledge — NO per-company web fetch. This is the broad, cheap pass
// (target ~100 LLM rankings per 1 manual decision); manual deep-vetting then works the top.
//
//   node llm-triage.mjs --emit 50 [--offset 0]   # print next 50 un-triaged eligible companies (JSON)
//   node llm-triage.mjs --apply scores.json       # merge [{key, llm_rank, llm_reason}] into personal layer
//   node llm-triage.mjs --queue 30                # top-N eligible by llm_rank, for manual vetting
//   node llm-triage.mjs --stats                   # triage progress
//
// llm_rank/llm_reason live in the PERSONAL layer (a judgement vs YOUR rubric).

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';
import { saveJsonl, sk } from './posting-core.mjs';
import {
  loadResearchLedger, appendResearchAttempts, inBackoff, backoffHours,
  RESEARCH_LEDGER_PATH, DEFAULT_SKIP_HOURS,
} from './research-ledger.mjs';
import { validateBandRow, DERIVATION_RANK, CONFIDENCE_RANK, normalizeComp } from './comp-core.mjs';
import { TITLE_FAMILIES, normalizeTitle } from './title-family.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(ROOT, 'data', 'survey', 'results.jsonl');
const RESEARCH = join(ROOT, 'data', 'company-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');
const AGGREGATES = join(ROOT, 'data', 'company-aggregates.jsonl');
const COMP = join(ROOT, 'data', 'company-comp.jsonl');
const LEDGER = join(ROOT, RESEARCH_LEDGER_PATH);
// Uncheckpointed --apply-append results. Folded into PERSONAL on every entry point, so a
// session killed mid-batch self-heals on the next command instead of losing the work.
const PENDING = join(ROOT, 'data', 'company-research-pending.jsonl');

const EXCLUDED_TYPES = new Set(['consulting', 'outsourcing', 'staffing', 'unresolved']);

function loadJsonl(path) {
  const out = [];
  if (!existsSync(path)) return out;
  for (const l of readFileSync(path, 'utf-8').split('\n')) { if (l) try { out.push(JSON.parse(l)); } catch {} }
  return out;
}
function buildTitleFilter(tf) {
  const pos = (tf?.positive || []).map(k => k.toLowerCase());
  const neg = (tf?.negative || []).map(k => k.toLowerCase());
  return (t) => { const l = (t || '').toLowerCase(); return (pos.length === 0 || pos.some(k => l.includes(k))) && !neg.some(k => l.includes(k)); };
}

// relevant titles per company key, from the stored raw titles in results.jsonl
function relevantTitlesByKey() {
  const tf = buildTitleFilter(yaml.load(readFileSync(join(ROOT, 'portals.yml'), 'utf-8')).title_filter);
  const map = new Map();
  for (const r of loadJsonl(RESULTS)) {
    if (r.error || !Array.isArray(r.jobs)) continue;
    const titles = [...new Set(r.jobs.filter(j => tf(j.t)).map(j => j.t))].slice(0, 12);
    if (titles.length) map.set(`${r.provider}:${r.slug}`, titles);
  }
  return map;
}

// The (title_family, ladder_level) slots a company's LIVE POSTINGS actually occupy.
//
// This exists because a band is only ever READ through normalizeTitle(): score-postings.mjs
// classifies each posting deterministically and asks bandFor() for that exact slot. If research
// files a band under a family the classifier never produces for this company, the band is
// unreachable — 108 of 1573 existing rows are already in that state. Handing the LLM the real
// slots turns "guess a taxonomy" into "fill in these boxes", which is both easier and correct.
function compSlotsByCompany() {
  const research = loadJsonl(join(ROOT, 'data', 'posting-research.jsonl'));
  // An `estimated` band is a model's guess, not coverage. Counting it as `has_band` suppressed the
  // slot from the comp-research queue while containing no evidence at all — Lookout's estimate
  // happened to equal the range printed on its own JD, but the pipeline had never checked.
  // Only verifiable evidence marks a slot covered.
  const banded = new Set(loadJsonl(COMP)
    .filter(b => b.derivation === 'direct' || b.derivation === 'inferred')
    .map(b => `${b.key}|${b.title_family}|${b.ladder_level}`));
  const out = new Map();
  for (const r of research) {
    if (!r?.company_key || r.live === false) continue;
    const { title_family, ladder_level } = normalizeTitle(r.title, r.extracted || {});
    if (!ladder_level) continue;                       // no level → no usable band slot
    if (!out.has(r.company_key)) out.set(r.company_key, new Map());
    const m = out.get(r.company_key);
    const k = `${title_family}|${ladder_level}`;
    if (!m.has(k)) {
      m.set(k, {
        title_family, ladder_level, postings: 0, example_titles: [],
        has_band: banded.has(`${r.company_key}|${title_family}|${ladder_level}`),
        // A posting that already states its own pay needs no band — flag it so research effort
        // goes to the slots that are actually blind.
        needs_comp: false,
      });
    }
    const slot = m.get(k);
    slot.postings++;
    if (slot.example_titles.length < 3 && r.title) slot.example_titles.push(r.title);
    if (!normalizeComp(r.extracted?.comp) && !normalizeComp(r.comp)) slot.needs_comp = true;
  }
  // has_band and needs_comp answer different questions ("do we hold a band?" vs "does some posting
  // omit its pay?"), so a slot could carry both — which reads as a contradiction and sent several
  // research passes hunting for comp that had already been ingested. needs_comp is the ACTIONABLE
  // flag, so narrow it to what it's used for: a gap research could actually close.
  for (const m of out.values()) for (const slot of m.values()) if (slot.has_band) slot.needs_comp = false;
  return out;
}

// llm_rank is a BOOST, not a gate. Postings are ground truth about what a company is actually
// offering; the Stage-2 prerank is a cheap name-level prior that was itself computed on a 23k-way
// relevance_score tie, so it gets a vote rather than a veto. Untriaged (llm_rank == null) MUST be
// neutral — otherwise the 400+ high-scoring companies Stage 2 never reached stay invisible.
// The ±0.6 span against a 0-5 score range moves a company ~a dozen places in the top 100 rather
// than re-imposing rank as the primary key.
const RANK_BOOST = { 5: 0.60, 4: 0.30, 3: 0, 2: -0.30, 1: -0.60 };

// How good is this company's best open role? Prefer the rubric score of a RESEARCHED posting;
// fall back to the Stage-2 triage rank when nothing has been researched yet.
//
// The discount is the point. A computed_score is a full rubric evaluation of extracted facets;
// an llm_rank is a world-knowledge guess from a title and a 600-char excerpt. They share a 1-5
// scale but not a confidence level, so an unresearched rank-5 sits just behind a researched 4.9
// rather than tying with it. Without this fallback the queue would only ever contain companies
// whose JDs were already researched — 590 of 4,096 — which makes company research depend on job
// research finishing first, exactly backwards.
export function postingQuality(a, { rankDiscount = 0.25 } = {}) {
  if (a.best_posting_score != null) return { value: a.best_posting_score, basis: 'researched' };
  if (a.best_posting_rank != null) return { value: Math.max(0, a.best_posting_rank - rankDiscount), basis: 'triaged' };
  return { value: null, basis: null };
}

// THE Stage-3 queue predicate + ordering. Exported and shared by --emit-research, --stats and
// --queue-research so the queue and its own progress report provably cannot drift apart.
export function researchEligible(personal, agg, ledger, opts = {}) {
  const { minLive = 1, needsComp = false, rescan = false, rankWeight = 1, research = new Map(), now = Date.now() } = opts;
  const remoteOf = (p) => (research.get(p.key) || {}).remote_relevant || 0;
  const quality = (p) => postingQuality(agg(p.key), opts);
  const queueScore = (p) => (quality(p).value ?? 0) + (RANK_BOOST[p.llm_rank] ?? 0) * rankWeight;

  // companies-personal.jsonl holds 34k rows but only 29k unique keys (273 keys duplicated,
  // e.g. greenhouse:reddit as both "Reddit" and "Reddit, Inc."). Without dedup the queue emits
  // the same company twice and the LLM burns double the fetches on it.
  const seen = new Set();
  return personal
    .filter(p => { if (seen.has(p.key)) return false; seen.add(p.key); return true; })
    .filter(p => !p.excluded_by_type && p.decision === 'undecided' && p.llm_fit == null)
    // Requiring a quality signal does triple duty: it ranks the queue, filters staffing agencies
    // (whose generic reqs score low), and guarantees `titles` is non-empty. company-aggregates
    // counts only live, non-hard_excluded, scored postings — so a company with nothing worth
    // applying to, or whose every posting is hard-excluded, cannot enter the queue at all.
    .filter(p => quality(p).value != null && agg(p.key).live_relevant >= minLive)
    .filter(p => !needsComp || (agg(p.key).live_relevant_no_comp > 0 && agg(p.key).comp_band_rows === 0))
    .filter(p => rescan || !inBackoff(ledger.get(p.key), DEFAULT_SKIP_HOURS, now))
    .sort((a, b) => (queueScore(b) - queueScore(a))
      || (agg(b.key).live_relevant - agg(a.key).live_relevant)
      || (remoteOf(b) - remoteOf(a))
      || String(a.key).localeCompare(String(b.key)));   // deterministic final tiebreak
}

// Merge score objects into the personal layer and persist. Shared by --apply, --apply-append's
// checkpoint, --flush-pending, and the startup auto-fold, so every path writes identically.
function applyScores(scoreList, personal, research, { verbose = false } = {}) {
  const scores = new Map(scoreList.map(s => [s.key, s]));
  let rows = 0, typeChanged = false, reclassified = 0;
  const matched = new Set();
  for (const p of personal) {
    const s = scores.get(p.key);
    if (!s) continue;
    // set only the fields provided: prerank (llm_rank) or research (llm_fit/fit_brief)
    if (s.llm_rank != null) p.llm_rank = s.llm_rank;
    if (s.llm_fit != null) p.llm_fit = s.llm_fit;
    if (s.fit_brief) p.fit_brief = s.fit_brief;
    if (s.llm_reason != null) p.llm_reason = s.llm_reason;
    // optional company_type correction → updates the OBJECTIVE layer + re-derives exclusion.
    // Lets the LLM permanently flag staffing/gig/outsourcing the name-heuristic missed.
    if (s.company_type) {
      const r = research.get(p.key);
      if (r && r.company_type !== s.company_type) { r.company_type = s.company_type; typeChanged = true; }
      p.excluded_by_type = EXCLUDED_TYPES.has(s.company_type);
      if (EXCLUDED_TYPES.has(s.company_type)) reclassified++;
    }
    rows++; matched.add(p.key);
  }
  saveJsonl(PERSONAL, personal);
  if (typeChanged) saveJsonl(RESEARCH, [...research.values()]);

  if (verbose) {
    // rows != companies for the 273 duplicated keys — report both so that isn't confusing.
    console.error(`✓ applied ${matched.size} companies (${rows} rows)${reclassified ? ` — ${reclassified} reclassified as consulting/outsourcing/staffing → landscape-only` : ''}`);
    // Previously these were dropped in silence, so a typo'd key looked like a success.
    const unknown = [...scores.keys()].filter(k => !matched.has(k));
    if (unknown.length) {
      console.error(`  ⚠ ${unknown.length} key(s) NOT in companies-personal.jsonl — nothing was written for:`);
      for (const k of unknown.slice(0, 20)) console.error(`      ${k}`);
      if (unknown.length > 20) console.error(`      …and ${unknown.length - 20} more`);
    }
  }
  return { rows, companies: matched.size };
}

function main() {
  const args = process.argv.slice(2);
  const num = (flag, d) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : d; };
  const research = new Map(loadJsonl(RESEARCH).map(r => [r.key, r]));
  let personal = loadJsonl(PERSONAL);
  // Posting-derived queue signals (company-aggregates.mjs). Absent file → all-zero defaults, so
  // every command still works before the aggregates have ever been built.
  const aggByKey = new Map(loadJsonl(AGGREGATES).map(a => [a.key, a]));
  const AGG0 = { live_relevant: 0, live_relevant_no_comp: 0, best_posting_score: null, comp_band_rows: 0 };
  const agg = (key) => aggByKey.get(key) || AGG0;
  const ledger = loadResearchLedger(LEDGER);

  // SELF-HEAL: fold in anything a previous session left uncheckpointed. Runs on every entry
  // point (except the append itself, which manages its own checkpoint), so a killed run costs
  // nothing — the next command you type recovers it.
  if (!args.includes('--apply-append')) {
    const orphaned = loadJsonl(PENDING);
    if (orphaned.length) {
      console.error(`↻ recovering ${orphaned.length} uncheckpointed result(s) from a previous session…`);
      applyScores(orphaned, personal, research, { verbose: true });
      writeFileSync(PENDING, '');
    }
  }

  if (args.includes('--apply')) {
    const file = args[args.indexOf('--apply') + 1];
    applyScores(JSON.parse(readFileSync(file, 'utf-8')), personal, research, { verbose: true });
    return;
  }

  // --apply-append <file>: the RESUMABLE apply. Call it after EACH company rather than once at
  // the end of a batch — otherwise a session that dies after researching 20 companies loses all
  // 20. Results are appended to a tiny pending file and folded into the 8MB registry every
  // CHECKPOINT_EVERY companies, so worst-case loss is one company's work.
  if (args.includes('--apply-append')) {
    const file = args[args.indexOf('--apply-append') + 1];
    const incoming = JSON.parse(readFileSync(file, 'utf-8'));
    const rows = Array.isArray(incoming) ? incoming : [incoming];
    appendFileSync(PENDING, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
    // Ledger first: the company leaves the queue immediately, even before the registry write,
    // so an interrupted run never re-researches something it already finished.
    appendResearchAttempts(rows.map(r => ({
      key: r.key, status: 'ok', detail: r.llm_fit != null ? `llm_fit=${r.llm_fit}` : '',
    })), LEDGER);

    const pending = loadJsonl(PENDING);
    const every = Number(process.env.BYOJB_RESEARCH_CHECKPOINT_EVERY ?? 5);
    if (pending.length >= every) {
      applyScores(pending, personal, research, { verbose: true });
      writeFileSync(PENDING, '');
      console.error(`  ↳ checkpointed ${pending.length} → ${PERSONAL}`);
    } else {
      console.error(`✓ queued ${rows.length} (${pending.length}/${every} until checkpoint)`);
    }
    return;
  }

  if (args.includes('--flush-pending')) {
    const pending = loadJsonl(PENDING);
    if (!pending.length) { console.error('nothing pending'); return; }
    applyScores(pending, personal, research, { verbose: true });
    writeFileSync(PENDING, '');
    return;
  }

  if (args.includes('--stats')) {
    const uniq = (rows) => { const s = new Set(); return rows.filter(p => !s.has(p.key) && s.add(p.key)); };
    const eligible = uniq(personal.filter(p => !p.excluded_by_type && p.decision === 'undecided'));
    const triaged = eligible.filter(p => p.llm_rank != null);
    const N = (x) => String(x).padStart(7);
    console.log(`eligible (undecided, not redlisted): ${N(eligible.length)}`);
    console.log(`  Stage 2 preranked (llm_rank):      ${N(triaged.length)}  | remaining: ${eligible.length - triaged.length}`);

    // Stage 3 uses the SAME predicate as --emit-research, so these numbers can't drift from it.
    const opts = { research, minLive: num('--min-live', 1) };
    const queue = researchEligible(personal, agg, ledger, opts);
    const noBackoff = researchEligible(personal, agg, ledger, { ...opts, rescan: true });
    const researched = uniq(personal.filter(p => !p.excluded_by_type && p.llm_fit != null));
    console.log(`Stage 3 research queue (has scored postings):`);
    console.log(`  ready now:                         ${N(queue.length)}`);
    console.log(`  blocked by backoff window:         ${N(noBackoff.length - queue.length)}`);
    console.log(`  researched (llm_fit set):          ${N(researched.length)}`);
    const failing = [...ledger.values()].filter(e => e.fails >= 2).length;
    if (failing) console.log(`  failed >=2 attempts:               ${N(failing)}`);
    const pending = loadJsonl(PENDING).length;
    if (pending) console.log(`  pending (uncheckpointed):          ${N(pending)}`);

    const decided = uniq(personal.filter(p => p.decision !== 'undecided')).length;
    console.log(`manual decisions made: ${decided}`);
    return;
  }

  // --queue-research: the human-readable counterpart to --emit-research (which emits JSON).
  if (args.includes('--queue-research')) {
    const n = num('--queue-research', 30);
    const queue = researchEligible(personal, agg, ledger, {
      research, minLive: num('--min-live', 1),
      needsComp: args.includes('--needs-comp'), rescan: args.includes('--rescan'),
    });
    console.log(`Top ${Math.min(n, queue.length)} of ${queue.length} to research (by best live posting):`);
    for (const p of queue.slice(0, n)) {
      const a = agg(p.key), q = postingQuality(a);
      // Show WHICH evidence produced the number — a researched rubric score and a triage rank
      // share a 1-5 scale but not a confidence level, and the queue must not blur them.
      const tag = q.basis === 'researched' ? ' ' : '~';
      console.log(`  ${tag}${String(q.value.toFixed(2)).padEnd(5)} ${String(a.live_relevant).padStart(3)} live  ${String(a.live_relevant_no_comp).padStart(3)} no-pay  ${(q.basis || '').padEnd(10)} ${p.name}`);
    }
    return;
  }

  if (args.includes('--queue')) {
    const n = num('--queue', 30);
    const ranked = personal.filter(p => !p.excluded_by_type && p.decision === 'undecided' && p.llm_rank != null)
      .sort((a, b) => b.llm_rank - a.llm_rank);
    console.log(`Top ${n} by llm_rank (for manual vetting):`);
    for (const p of ranked.slice(0, n)) console.log(`  ${p.llm_rank}  ${p.name} [${p.provider}] — ${p.llm_reason || ''}`);
    return;
  }

  // --emit-research: the Stage-3 work queue, ordered by how good a company's ACTUAL POSTINGS are.
  //
  //   node llm-triage.mjs --emit-research 20 [--min-live N] [--needs-comp] [--rescan] [--rank-weight W]
  //
  // This used to require llm_rank != null (a Stage-2 prerank). That gate was actively harmful:
  // only 49 companies ever received a rank, and they were picked from a 23,102-way tie on a
  // hardcoded relevance_score of 50 — so the queue emitted zero-posting companies in ALPHABETICAL
  // order ("3E, Abe, Adthena…") while Redis, DuckDuckGo and 400 others with 4.8-scoring live
  // postings were invisible. llm_rank is now a BOOST, not a gate (boost-not-gate, as elsewhere).
  if (args.includes('--emit-research')) {
    const n = num('--emit-research', 20);
    const titles = relevantTitlesByKey();
    const slots = compSlotsByCompany();
    const todo = researchEligible(personal, agg, ledger, {
      minLive: num('--min-live', 1),
      needsComp: args.includes('--needs-comp'),
      rescan: args.includes('--rescan'),
      rankWeight: num('--rank-weight', 1),
      research,
    }).slice(0, n);

    console.log(JSON.stringify(todo.map(p => {
      const r = research.get(p.key) || {}, a = agg(p.key), l = ledger.get(p.key);
      return {
        key: p.key, name: p.name || r.name, careers_url: r.careers_url || p.careers_url || '',
        llm_rank: p.llm_rank ?? null, titles: titles.get(p.key) || (r.sample_titles || []),
        live_relevant: a.live_relevant, live_relevant_no_comp: a.live_relevant_no_comp,
        best_posting_score: a.best_posting_score, best_posting_rank: a.best_posting_rank ?? null,
        // 'researched' = rubric score from extracted JD facets; 'triaged' = coarser Stage-2 rank.
        quality_basis: postingQuality(a).basis, comp_band_rows: a.comp_band_rows,
        // The ONLY (title_family, ladder_level) pairs a pay band may be filed under for this
        // company — derived from its live postings by the same classifier that reads them back.
        comp_slots: [...(slots.get(p.key)?.values() || [])].sort((x, y) => y.postings - x.postings).slice(0, 8),
        // So the LLM knows this is a retry and why the last one failed.
        attempts: l?.fails || 0, last_attempt_status: l?.status || null,
      };
    }), null, 1));
    return;
  }

// Turn a stored JD body into the most informative ~1200 chars available.
//
// Two things were wasting most of the budget. Raw markup (`<div class="content-intro">`, Word's
// `data-ccp-charstyle` blobs) ate a large share of every Greenhouse excerpt; and the first ~600
// chars are almost always mission/about-us marketing, so the scope and remote-eligibility
// sentences — the two things the screen actually weighs — usually fell past the cut.
const RE_SECTION = /\b(about the role|about this role|what you'?ll do|what you will do|the role|responsibilities|your impact|role overview|position summary)\b/i;
function cleanExcerpt(body) {
  let t = String(body || '')
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/enable JavaScript|You need to enable/i.test(t) || t.length < 400) return null;
  // Keep the first line (company — title) for context, then jump to the substantive section.
  const head = t.slice(0, 160);
  const m = t.slice(160).match(RE_SECTION);
  if (m && m.index != null) t = `${head} … ${t.slice(160 + m.index)}`;
  return t;
}

  // --emit-screen N [--offset K]: the Stage-2 SCREEN — a wide, zero-fetch triage over companies
  // that have live postings but no rank yet.
  //
  // Deep research costs 2-4 web fetches and two dossiers per company; at ~4,000 companies that is
  // a day of wall clock. But 3,673 of them already have JD bodies on disk, which is enough to say
  // "worth a closer look?" without touching the network. This emits a compact brief per company so
  // one agent can screen 40 in a single pass.
  //
  // It sets llm_rank, NEVER llm_fit. llm_fit is what drains the research queue, so a screen that
  // wrote it would consume companies instead of prioritising them. RANK_BOOST in researchEligible()
  // already reads llm_rank, so a screened 5 rises immediately.
  if (args.includes('--emit-screen')) {
    const n = num('--emit-screen', 40);
    const offset = num('--offset', 0);
    const excerptChars = num('--excerpt', 1200);
    const research = loadJsonl(join(ROOT, 'data', 'posting-research.jsonl'));
    const personalPost = new Map(loadJsonl(join(ROOT, 'data', 'postings-personal.jsonl')).map(x => [x.key, x]));

    const byCo = new Map();
    for (const r of research) {
      if (!r?.company_key || r.live === false) continue;
      if (!byCo.has(r.company_key)) byCo.set(r.company_key, []);
      byCo.get(r.company_key).push(r);
    }

    // name → all keys sharing it, for the cross-ATS duplicate hint below
    const normName = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const dupeNames = new Map();
    for (const p of personal) {
      const nn = normName(p.name);
      if (!nn) continue;
      if (!dupeNames.has(nn)) dupeNames.set(nn, new Set());
      dupeNames.get(nn).add(p.key);
    }
    for (const [k, v] of dupeNames) if (v.size < 2) dupeNames.delete(k);

    const seenK = new Set();
    const pool = personal
      .filter(p => { if (seenK.has(p.key)) return false; seenK.add(p.key); return true; })
      .filter(p => !p.excluded_by_type && p.decision === 'undecided'
        && p.llm_fit == null && p.llm_rank == null && byCo.has(p.key))
      // Best first, so a run that stops early still covered the most valuable companies.
      .sort((a, b) => (postingQuality(agg(b.key)).value ?? 0) - (postingQuality(agg(a.key)).value ?? 0)
        || String(a.key).localeCompare(String(b.key)))
      .slice(offset, offset + n);

    const out = pool.map(p => {
      const posts = byCo.get(p.key) || [];
      const a = agg(p.key);
      // Lead with the highest-scoring posting: its body is the most representative sample of the
      // work actually on offer, and it is the one the user would look at first.
      const scored = [...posts].sort((x, y) => {
        const sx = personalPost.get(x.key) || {}, sy = personalPost.get(y.key) || {};
        return ((sy.manual_score ?? sy.computed_score ?? sy.llm_rank ?? 0) - (sx.manual_score ?? sx.computed_score ?? sx.llm_rank ?? 0));
      });
      let excerpt = '';
      for (const r of scored) {
        if (!r.has_body) continue;
        try {
          const body = readFileSync(join(ROOT, 'data', 'posting-research', sk(r.key) + '.md'), 'utf-8');
          const flat = cleanExcerpt(body);
          // A client-rendered shell captured instead of a JD. Presenting it as an excerpt is worse
          // than presenting nothing — it reads as evidence while containing none.
          if (!flat) continue;
          excerpt = flat.slice(0, excerptChars);
          break;
        } catch { /* unreadable → try the next posting */ }
      }
      return {
        key: p.key,
        name: p.name || (research.find(r => r.company_key === p.key) || {}).company || p.key,
        // The same employer often has boards on two ATSs (ashby:nubank AND greenhouse:nubank).
        // Naming the twin lets one screening pass cover both instead of burning two slots.
        also_listed_as: dupeNames.get(normName(p.name || '')) ?
          [...dupeNames.get(normName(p.name || ''))].filter(k => k !== p.key) : undefined,
        live_relevant: a.live_relevant,
        best_posting_score: a.best_posting_score ?? null,
        best_posting_rank: a.best_posting_rank ?? null,
        // One entry per role, each carrying its OWN location and pay. A deduped union of
        // locations across all postings cannot say WHICH role is the Canada-eligible one, and
        // geography is the second-heaviest factor in the screen.
        // Workday collapses locations to "3 Locations" and Ashby lists them alphabetically, both of
        // which hide the one fact that decides eligibility. Compute it once, over ALL postings.
        // Broadened after two screeners caught false negatives: Finning posts in Surrey BC and
        // Saputo in Saint-Laurent QC, neither of which the original city list matched. Province
        // codes and a wider city list close most of the gap.
        has_canada_posting: posts.some(r => /canada|canadian|ontario|quebec|qu\u00e9bec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|\b(on|qc|bc|ab|mb|sk|ns|nb|nl|pe)\b[,\s]|toronto|vancouver|montr|ottawa|calgary|edmonton|winnipeg|halifax|victoria|surrey|burnaby|richmond|mississauga|waterloo|kitchener|london on|hamilton|saint-laurent|st-laurent|laval|gatineau|regina|saskatoon|kelowna|kanata|markham|brampton|remote.*(americas|anywhere|worldwide|global|north america)/i
          .test(`${r.location || ''} ${(r.extracted?.location_hints || []).join(' ')} ${r.extracted?.geo_eligibility || ''}`)),
        roles: scored.slice(0, 8).map(r => {
          const c = normalizeComp(r.comp) || normalizeComp(r.extracted?.comp);
          return {
            title: r.title || null,
            location: r.location || null,
            comp: c ? `${c.min ?? '?'}-${c.max ?? '?'} ${c.currency || ''}`.trim() : null,
          };
        }),
        // The single strongest signal in the brief. Empty for the ~282 companies with no body at
        // all — those must be screened on titles alone, and the reason should say so.
        jd_excerpt: excerpt || null,
      };
    });
    console.log(JSON.stringify(out, null, 1));
    return;
  }

  // --record-fail <key> "<reason>": a company that CANNOT be researched (dead careers page, no
  // substantive content). Without this it never gets an llm_fit, so it never leaves the queue and
  // the next run re-fetches the same 404. Recording the failure backs it off instead.
  if (args.includes('--record-fail')) {
    const i = args.indexOf('--record-fail');
    const key = args[i + 1];
    const detail = args[i + 2] || '';
    if (!key) { console.error('usage: --record-fail <key> "<reason>"'); process.exit(1); }
    const status = args.includes('--no-evidence') ? 'no_evidence' : 'fetch_failed';
    appendResearchAttempts([{ key, status, detail, at: new Date().toISOString() }], LEDGER);
    const fails = (loadResearchLedger(LEDGER).get(key)?.fails) || 1;
    console.error(`✓ recorded ${status} for ${key} (consecutive failures: ${fails}; backing off ${backoffHours(fails)}h)`);
    return;
  }

  // --emit-comp: the COMP research work queue. Companies whose relevant open postings state no
  // pay and for which we have no band — ordered so effort lands where it buys the most.
  // Unlike --emit-research this does NOT require an llm_rank, but it DOES require at least one
  // scored posting: a company with 300 unscored listings is a staffing agency, not a target.
  if (args.includes('--emit-comp')) {
    const n = num('--emit-comp', 20);
    const titles = relevantTitlesByKey();
    const todo = personal
      .filter(p => !p.excluded_by_type && p.decision !== 'skip')
      .filter(p => { const a = agg(p.key); return a.live_relevant_no_comp > 0 && a.comp_band_rows === 0 && a.best_posting_score != null; })
      // Value = how good the best role is, then how many postings a band would cover.
      .sort((a, b) => ((agg(b.key).best_posting_score ?? 0) - (agg(a.key).best_posting_score ?? 0))
        || (agg(b.key).live_relevant_no_comp - agg(a.key).live_relevant_no_comp))
      .slice(0, n);
    console.log(JSON.stringify(todo.map(p => {
      const r = research.get(p.key) || {}, a = agg(p.key);
      return {
        key: p.key, name: p.name || r.name, careers_url: r.careers_url || p.careers_url || '',
        llm_rank: p.llm_rank ?? null, llm_fit: p.llm_fit ?? null,
        titles: titles.get(p.key) || (r.sample_titles || []),
        live_relevant: a.live_relevant, live_relevant_no_comp: a.live_relevant_no_comp,
        best_posting_score: a.best_posting_score,
      };
    }), null, 1));
    return;
  }

  // --apply-comp: merge researched pay bands into the OBJECTIVE registry. Every row is validated
  // against the same contract the server route and doctor.mjs use — a mislabeled derivation, an
  // uncited claim, or a forbidden source is rejected here rather than silently stored.
  if (args.includes('--apply-comp')) {
    const file = args[args.indexOf('--apply-comp') + 1];
    const incoming = JSON.parse(readFileSync(file, 'utf-8'));
    const today = new Date().toISOString().slice(0, 10);
    const rejected = [];
    const ok = [];
    for (const row of (Array.isArray(incoming) ? incoming : [incoming])) {
      const errs = validateBandRow(row, { families: TITLE_FAMILIES });
      if (errs.length) { rejected.push({ key: row?.key, title_family: row?.title_family, errs }); continue; }
      ok.push({ ...row, first_seen: row.first_seen || today, last_seen: today });
    }
    // ONE band per (company, role family, level). The slot key used to include the source, so
    // re-running research piled an llm_prior on top of an llm_research on top of a jd_posted for
    // the same slot and bandFor had to arbitrate between three rows that all claimed the same
    // thing. Collisions are now resolved here, keeping the strongest evidence:
    //   derivation (direct > inferred > estimated) → confidence → sample_size → as_of
    // This preserves the original intent — a researched band never clobbers the company's own
    // posted numbers — while stopping the accumulation.
    // CURRENCY is part of the slot: ingest/jd-comp.mjs deliberately emits separate rows for a
    // company that posts the same role in CAD and USD, and those are different facts about
    // different geos — not duplicates to be collapsed.
    const slot = (r) => `${r.key}|${r.title_family}|${r.ladder_level}|${r.band?.currency || ''}`;
    const better = (a, b) => {
      if (!b) return true;
      const d = (DERIVATION_RANK[a.derivation] || 0) - (DERIVATION_RANK[b.derivation] || 0);
      if (d) return d > 0;
      const c = (CONFIDENCE_RANK[a.provenance?.confidence] || 0) - (CONFIDENCE_RANK[b.provenance?.confidence] || 0);
      if (c) return c > 0;
      const n = (a.provenance?.sample_size || 0) - (b.provenance?.sample_size || 0);
      if (n) return n > 0;
      return String(a.provenance?.as_of || '') >= String(b.provenance?.as_of || '');
    };
    const bySlot = new Map();
    for (const r of [...loadJsonl(COMP), ...ok]) {         // incoming last: ties go to the new row
      const k = slot(r);
      if (better(r, bySlot.get(k))) bySlot.set(k, r);
    }
    const superseded = loadJsonl(COMP).length + ok.length - bySlot.size;
    saveJsonl(COMP, [...bySlot.values()]);
    console.error(`✓ applied ${ok.length} pay bands${rejected.length ? `, REJECTED ${rejected.length}` : ''}${superseded > 0 ? ` (${superseded} weaker row(s) superseded)` : ''}`);
    for (const r of rejected) console.error(`  ✗ ${r.key} [${r.title_family}]: ${r.errs.join('; ')}`);
    return;
  }

  // default: --emit (top heuristic-ranked, not yet preranked by the LLM)
  const n = num('--emit', 50), offset = num('--offset', 0);
  const titles = relevantTitlesByKey();
  const eligible = personal
    .filter(p => !p.excluded_by_type && p.decision === 'undecided' && p.llm_rank == null)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(offset, offset + n);
  const batch = eligible.map(p => {
    const r = research.get(p.key) || {};
    return { key: p.key, name: p.name || r.name, company_type: r.company_type, remote_openings: r.remote_relevant, titles: titles.get(p.key) || (r.sample_titles || []) };
  });
  console.log(JSON.stringify(batch, null, 1));
}
// Guard the entry point: this module now EXPORTS researchEligible(), and importing it to reuse
// that predicate must not run a triage command as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) main();
