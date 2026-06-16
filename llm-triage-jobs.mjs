#!/usr/bin/env node
// llm-triage-jobs.mjs (NEW) — deterministic driver for the postings ranking pipeline.
//
// Mirror of llm-triage.mjs, one grain finer (postings, not companies). The LLM (this session,
// or the Gemini CLI via modes/triage-jobs.md / research-jobs.md) does the judgement; this script
// only emits work-lists and merges results. It NEVER calls an LLM (subscription-only rule).
//
//   node llm-triage-jobs.mjs --emit 50 [--offset 0]  # next N undecided, live, un-preranked (JSON)
//   node llm-triage-jobs.mjs --apply scores.json      # merge prerank OR research results
//   node llm-triage-jobs.mjs --emit-research 20 [--all]# preranked postings → full-JD facet extraction
//                                                       (--all re-emits extracted ones to backfill new facets)
//   node llm-triage-jobs.mjs --queue 30               # top by score, for manual review
//   node llm-triage-jobs.mjs --vet-queue              # undecided companies w/ a shortlisted posting (Lever C)
//   node llm-triage-jobs.mjs --stats                  # pipeline progress
//
// --apply payload (array). Prerank items: {key, llm_rank (1-5), llm_reason}.
//   Research items: {key, extracted:{...facets...}, fit_brief, llm_reason?}. FACTS ONLY — the LLM
//   never sends a score; every dimension is computed from facets × rubric by score-postings.
//   (Legacy llm_dim_scores / llm_holistic_fit are still accepted for back-compat but no longer emitted.)
//   extracted → OBJECTIVE layer (posting-research.jsonl); recomputed deterministically into PERSONAL.

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadJsonl, saveJsonl, sk } from './posting-core.mjs';
import { computeScores, loadRubric } from './score-postings.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'postings-personal.jsonl');
const C_PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');
const BODY_DIR = join(ROOT, 'data', 'posting-research');

const bodyFileRel = (key) => `data/posting-research/${sk(key)}.md`;
function jdExcerpt(key, max = 1500) {
  const p = join(BODY_DIR, sk(key) + '.md');
  if (!existsSync(p)) return '';
  const body = readFileSync(p, 'utf-8').split('\n').slice(2).join('\n').trim();  // drop title + url lines
  return body.length > max ? body.slice(0, max) + '…' : body;
}

function main() {
  const args = process.argv.slice(2);
  const num = (flag, d) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : d; };
  const research = new Map(loadJsonl(RESEARCH).map(r => [r.key, r]));
  const personal = loadJsonl(PERSONAL);
  const pByKey = new Map(personal.map(p => [p.key, p]));
  const live = (key) => research.get(key)?.live !== false;

  // ── apply ──
  if (args.includes('--apply')) {
    const file = args[args.indexOf('--apply') + 1];
    const items = JSON.parse(readFileSync(file, 'utf-8'));
    const rubric = loadRubric();
    let prerank = 0, extracted = 0, rescored = 0;
    for (const s of items) {
      const p = pByKey.get(s.key); const r = research.get(s.key);
      if (!p) continue;
      if (s.llm_rank != null) { p.llm_rank = s.llm_rank; prerank++; }
      if (s.llm_reason != null) p.llm_reason = s.llm_reason;
      if (s.fit_brief) p.fit_brief = s.fit_brief;
      if (s.llm_holistic_fit != null) p.llm_holistic_fit = Number(s.llm_holistic_fit);
      // per-dimension LLM scores for the qualitative dims {<dim id>: 1-5}; preferred over the
      // single holistic number so each qualitative dimension scores (and re-weights) independently.
      if (s.llm_dim_scores && typeof s.llm_dim_scores === 'object') {
        p.llm_dim_scores = {};
        for (const [k, v] of Object.entries(s.llm_dim_scores)) if (v != null && v !== '') p.llm_dim_scores[k] = Number(v);
        rescored++;
      }
      // MERGE facets (not overwrite) so a partial re-extraction can backfill new facet keys
      // without re-sending the whole schema. Fresh extraction: r.extracted is null → becomes s.extracted.
      if (s.extracted && r) { r.extracted = { ...(r.extracted || {}), ...s.extracted }; extracted++; }
      // recompute the deterministic score from facets × rubric (never trust an LLM-authored score)
      if (r?.extracted) {
        const sc = computeScores(r.extracted, rubric, p.llm_dim_scores ?? p.llm_holistic_fit);
        p.dim_scores = sc.dim_scores; p.computed_score = sc.computed_score; p.hard_excluded = sc.hard_excluded;
      }
      p.last_reviewed = p.last_reviewed || 'llm';
    }
    saveJsonl(PERSONAL, personal);
    if (extracted) saveJsonl(RESEARCH, [...research.values()]);
    console.error(`✓ applied ${items.length} items (${prerank} preranked, ${extracted} facet-extracted, ${rescored} per-dim rescored)`);
    return;
  }

  // ── stats ──
  if (args.includes('--stats')) {
    const liveUndecided = personal.filter(p => live(p.key) && p.decision === 'undecided');
    const preranked = liveUndecided.filter(p => p.llm_rank != null);
    const researched = liveUndecided.filter(p => research.get(p.key)?.extracted);
    const decided = personal.filter(p => p.decision !== 'undecided');
    console.log(`live & undecided postings: ${liveUndecided.length}`);
    console.log(`  preranked (Stage 2): ${preranked.length} | remaining: ${liveUndecided.length - preranked.length}`);
    console.log(`  facet-extracted (Stage 3): ${researched.length}`);
    console.log(`decisions made: ${decided.length} (shortlist=${personal.filter(p => p.decision === 'shortlist').length}, skip=${personal.filter(p => p.decision === 'skip').length})`);
    return;
  }

  // ── queue ──
  if (args.includes('--queue')) {
    const n = num('--queue', 30);
    const ranked = personal.filter(p => live(p.key) && p.decision === 'undecided')
      .sort((a, b) => (score(b) - score(a)));
    console.log(`Top ${n} live & undecided by score:`);
    for (const p of ranked.slice(0, n)) {
      const r = research.get(p.key) || {};
      console.log(`  ${(score(p) ?? 0).toFixed(1)}  ${r.company} — ${r.title}  ${p.hard_excluded ? '⛔' : ''}${p.llm_reason ? '— ' + p.llm_reason : ''}`);
    }
    return;
  }

  // ── vet-queue: Lever C — just-in-time company vetting ──
  // Undecided companies that earned a vetting decision by having a SHORTLISTED live posting.
  // Vet each (set llm_fit + decision=keep/skip), then `node score-postings.mjs` folds the fit in.
  if (args.includes('--vet-queue')) {
    const companies = new Map(loadJsonl(C_PERSONAL).map(c => [c.key, c]));
    const byCompany = new Map();
    for (const p of personal) {
      if (p.decision !== 'shortlist' || !live(p.key)) continue;
      const r = research.get(p.key) || {};
      const ck = r.company_key; if (!ck) continue;
      const co = companies.get(ck);
      if (!co || co.decision !== 'undecided') continue;   // only un-vetted companies need a decision
      if (!byCompany.has(ck)) byCompany.set(ck, { key: ck, name: co.name || r.company, provider: co.provider || r.provider, titles: [] });
      byCompany.get(ck).titles.push(r.title);
    }
    const out = [...byCompany.values()].sort((a, b) => b.titles.length - a.titles.length);
    console.log(`${out.length} undecided ${out.length === 1 ? 'company has' : 'companies have'} a shortlisted posting — vet (set fit + keep/skip), then \`node score-postings.mjs\`:`);
    for (const c of out) {
      console.log(`  ${c.key}  ${c.name} [${c.provider || '?'}] — ${c.titles.length} shortlisted`);
      for (const t of c.titles) console.log(`      • ${t}`);
    }
    return;
  }

  // ── emit-research: top preranked, for full-JD facet extraction (the LLM's ONLY job) ──
  // --all also re-emits already-extracted postings, so a schema change (new facets) can be
  // backfilled from the cached JD bodies — no re-fetch. Ships current facets as a reference.
  if (args.includes('--emit-research')) {
    const n = num('--emit-research', 20);
    const all = args.includes('--all');
    const todo = personal
      .filter(p => live(p.key) && p.decision === 'undecided' && p.llm_rank != null && (all || !research.get(p.key)?.extracted))
      .sort((a, b) => (b.llm_rank - a.llm_rank) || ((b.relevance_score ?? 0) - (a.relevance_score ?? 0)))
      .slice(0, n);
    console.log(JSON.stringify(todo.map(p => {
      const r = research.get(p.key) || {};
      return { key: p.key, company: r.company, title: r.title, url: r.url, llm_rank: p.llm_rank,
        has_body: !!r.has_body, body_file: r.has_body ? bodyFileRel(p.key) : null,
        ...(all ? { current_facets: r.extracted || null } : {}) };
    }), null, 1));
    return;
  }

  // ── default: emit (next undecided, live, not yet preranked) ──
  const n = num('--emit', 50), offset = num('--offset', 0);
  const batch = personal
    .filter(p => live(p.key) && p.decision === 'undecided' && p.llm_rank == null)
    .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
    .slice(offset, offset + n)
    .map(p => {
      const r = research.get(p.key) || {};
      return { key: p.key, company: r.company, title: r.title, department: r.department || '',
        location: r.location || '', jd_excerpt: jdExcerpt(p.key, 600) };
    });
  console.log(JSON.stringify(batch, null, 1));
}

// display score for ranking: manual override → computed (facets) → llm prerank
function score(p) { return p.manual_score ?? p.computed_score ?? (p.llm_rank != null ? p.llm_rank : null); }

main();
