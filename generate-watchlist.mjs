#!/usr/bin/env node
// generate-watchlist.mjs (NEW) — build portals.yml `tracked_companies` from the registry.
//
// The watchlist is a GENERATED artifact: companies where the PERSONAL layer says
// decision=keep. Joins data/companies-personal.jsonl (decisions) with
// data/company-research.jsonl (name/provider/careers_url). Preserves the portals.yml header
// (title_filter / location_filter / search_queries) and the JobSpy Boards entry.
//
//   node generate-watchlist.mjs            # regenerate portals.yml tracked_companies
//   node generate-watchlist.mjs --dry-run  # print what would change, write nothing

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORTALS = join(ROOT, 'portals.yml');
const RESEARCH = join(ROOT, 'data', 'company-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');
const RUBRIC = join(ROOT, 'config', 'rubric.yml');

// Lever A breadth controls (config/rubric.yml workflow.scan). Absent block → keep-only fallback
// (the original gated behavior), so nothing changes until the block is present.
function scanCfg() {
  try {
    const s = ((yaml.load(readFileSync(RUBRIC, 'utf-8')) || {}).workflow || {}).scan || {};
    return {
      include_undecided: s.include_undecided === true,
      min_relevant_openings: Number(s.min_relevant_openings) || 0,
      max_undecided_companies: Number(s.max_undecided_companies) || 0,
    };
  } catch { return { include_undecided: false, min_relevant_openings: 0, max_undecided_companies: 0 }; }
}

// ATSs the scanner (scan.mjs + providers/) can actually re-check.
const SCANNABLE = new Set(['greenhouse', 'ashby', 'lever', 'smartrecruiters', 'recruitee', 'workday', 'workable', 'bamboohr', 'breezy', 'rippling', 'gem']);
const WORKDAY_SEARCH = ['backend engineer', 'platform engineer', 'infrastructure engineer', 'mlops', 'data engineer', 'cloud engineer', 'devops engineer'];

function loadJsonl(path) {
  const out = [];
  if (!existsSync(path)) return out;
  for (const l of readFileSync(path, 'utf-8').split('\n')) { if (l) try { out.push(JSON.parse(l)); } catch {} }
  return out;
}

const JOBSPY_ENTRY = `  - name: JobSpy Boards
    careers_url: https://www.linkedin.com/jobs
    provider: local-parser
    enabled: true
    parser:
      command: .venv/bin/python
      script: ingest/jobspy_pull.py
      args: ["--emit"]
      timeout_ms: 30000
`;

// Build one tracked_companies YAML block. Returns { block } | { unscannable } | null.
function entryBlock(p, r, note) {
  const name = p.name || r.name;
  const provider = p.provider || r.provider;
  const careers_url = p.careers_url || r.careers_url;
  if (!name || !careers_url) return null;
  if (!SCANNABLE.has(provider)) return { unscannable: name + ` (${provider})` };
  let block = `  - name: ${JSON.stringify(name)}\n    careers_url: ${careers_url}\n`;
  if (provider === 'workday') block += `    provider: workday\n    workday_search: ${JSON.stringify(WORKDAY_SEARCH)}\n`;
  block += `    enabled: true\n    notes: "${note}"\n`;
  return { block };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const cfg = scanCfg();
  const research = new Map(loadJsonl(RESEARCH).map(r => [r.key, r]));
  const personal = loadJsonl(PERSONAL);
  // remote-eligible relevant openings (the count Max actually cares about), from the survey-derived
  // research layer; used both for the undecided threshold and the candidate note.
  const openingsOf = (p) => { const r = research.get(p.key) || {}; return Number(r.remote_relevant ?? r.relevant ?? 0); };

  const entries = [], skippedUnscannable = [];
  let keptCount = 0, undecidedCount = 0;

  // 1. All decision=keep companies — always scanned (the durable watchlist; original behavior).
  for (const p of personal.filter(p => p.decision === 'keep')) {
    const r = research.get(p.key) || {};
    const provider = p.provider || r.provider;
    const staleNote = p.stale ? ', no current openings — re-checked over time' : '';
    const res = entryBlock(p, r, `watchlist — fit ${p.llm_fit ?? '?'}/5 (${provider}${staleNote})`);
    if (!res) continue;
    if (res.unscannable) { skippedUnscannable.push(res.unscannable); continue; }
    entries.push(res.block); keptCount++;
  }

  // 2. Lever A — top undecided companies that have live openings, capped. decision=skip is never
  //    included (a dealbreaker). Postings from these surface and rank on role merit (boost-not-gate).
  if (cfg.include_undecided) {
    const keepKeys = new Set(personal.filter(p => p.decision === 'keep').map(p => p.key));
    const candidates = personal
      .filter(p => p.decision === 'undecided' && !p.excluded_by_type && !keepKeys.has(p.key))
      .filter(p => SCANNABLE.has(p.provider || (research.get(p.key) || {}).provider))
      .filter(p => openingsOf(p) >= cfg.min_relevant_openings)
      .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    const capped = cfg.max_undecided_companies >= 0 ? candidates.slice(0, cfg.max_undecided_companies) : candidates;
    for (const p of capped) {
      const r = research.get(p.key) || {};
      const provider = p.provider || r.provider;
      const res = entryBlock(p, r, `candidate — ${openingsOf(p)} relevant, unvetted (${provider})`);
      if (!res || res.unscannable) continue;
      entries.push(res.block); undecidedCount++;
    }
  }

  const text = readFileSync(PORTALS, 'utf-8');
  const idx = text.indexOf('\ntracked_companies:');
  if (idx === -1) throw new Error('portals.yml: tracked_companies not found');
  const header = text.slice(0, idx).trimEnd();
  const breadthNote = cfg.include_undecided
    ? `# Watchlist = decision=keep PLUS up to ${cfg.max_undecided_companies} undecided companies with >=${cfg.min_relevant_openings} relevant openings (Lever A).\n# decision=skip is excluded; postings from undecided companies still surface and rank on role merit.`
    : `# Watchlist = personal decision=keep. Broad boards via the JobSpy entry.`;
  const tracked = `\n\n# -- Tracked companies (GENERATED by generate-watchlist.mjs from the registry; do not hand-edit) --\n${breadthNote}\ntracked_companies:\n\n${JOBSPY_ENTRY}\n${entries.join('\n')}`;

  const summary = cfg.include_undecided
    ? `watchlist: ${entries.length} companies (${keptCount} keep + ${undecidedCount} undecided-with-openings, scannable) + JobSpy`
    : `watchlist: ${entries.length} companies (decision=keep, scannable) + JobSpy`;
  console.log(summary);
  if (skippedUnscannable.length) console.log(`  skipped (no scanner provider): ${skippedUnscannable.join(', ')}`);
  if (dryRun) { console.log('(--dry-run: portals.yml not written)'); return; }
  writeFileSync(PORTALS, header + tracked, 'utf-8');
  console.log(`✓ wrote ${PORTALS}`);
}
main();
