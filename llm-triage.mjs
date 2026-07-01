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

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(ROOT, 'data', 'survey', 'results.jsonl');
const RESEARCH = join(ROOT, 'data', 'company-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');

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

function main() {
  const args = process.argv.slice(2);
  const num = (flag, d) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : d; };
  const research = new Map(loadJsonl(RESEARCH).map(r => [r.key, r]));
  let personal = loadJsonl(PERSONAL);

  if (args.includes('--apply')) {
    const file = args[args.indexOf('--apply') + 1];
    const scores = new Map(JSON.parse(readFileSync(file, 'utf-8')).map(s => [s.key, s]));
    let n = 0, typeChanged = false, reclassified = 0;
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
      n++;
    }
    writeFileSync(PERSONAL, personal.map(p => JSON.stringify(p)).join('\n') + '\n');
    if (typeChanged) writeFileSync(RESEARCH, [...research.values()].map(r => JSON.stringify(r)).join('\n') + '\n');
    console.error(`✓ applied ${n} scores${reclassified ? ` (${reclassified} reclassified as consulting/outsourcing/staffing → landscape-only)` : ''}`);
    return;
  }

  if (args.includes('--stats')) {
    const eligible = personal.filter(p => !p.excluded_by_type && p.decision === 'undecided');
    const triaged = eligible.filter(p => p.llm_rank != null);
    console.log(`eligible (undecided, not redlisted): ${eligible.length}`);
    console.log(`  triaged by LLM: ${triaged.length} | remaining: ${eligible.length - triaged.length}`);
    const decided = personal.filter(p => p.decision !== 'undecided').length;
    console.log(`manual decisions made: ${decided}  (LLM:manual ratio ≈ ${decided ? Math.round(triaged.length / decided) : '∞'}:1)`);
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

  // --emit-research: top preranked-but-unresearched (llm_rank set, llm_fit null), by llm_rank desc.
  // This is the Stage-3 work queue (web-research these next).
  if (args.includes('--emit-research')) {
    const n = num('--emit-research', 20);
    const titles = relevantTitlesByKey();
    // Corroborate the (sometimes inflated) llm_rank with real opening-volume: a rank-5 with 1
    // opening (likely a keyword-fallback false positive) sinks below a rank-5 with many openings.
    const remoteOf = (p) => (research.get(p.key) || {}).remote_relevant || 0;
    const todo = personal
      .filter(p => !p.excluded_by_type && p.decision === 'undecided' && p.llm_rank != null && p.llm_fit == null)
      .sort((a, b) => (b.llm_rank - a.llm_rank) || (remoteOf(b) - remoteOf(a)))
      .slice(0, n);
    console.log(JSON.stringify(todo.map(p => {
      const r = research.get(p.key) || {};
      return { key: p.key, name: p.name || r.name, careers_url: r.careers_url || p.careers_url || '', llm_rank: p.llm_rank, titles: titles.get(p.key) || (r.sample_titles || []) };
    }), null, 1));
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
main();
