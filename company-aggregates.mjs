#!/usr/bin/env node
// company-aggregates.mjs — roll the postings registry up to per-company queue signals.
//
// The company research queue used to have exactly two ordering signals (llm_rank, then
// remote_relevant), neither of which knows anything about the postings actually on offer. This
// derives the signals that do: how many relevant live postings a company has, how many of those
// state NO comp and have no band to fall back on (the "go research pay here" queue), and how
// good its best posting is.
//
// DERIVED ONLY — never hand-maintained, fully regenerable. Run right after score-postings.mjs.
//
//   node company-aggregates.mjs           # write data/company-aggregates.jsonl
//   node company-aggregates.mjs --stats   # summary, write nothing

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import { loadJsonl, saveJsonl } from './posting-core.mjs';
import { normalizeTitle } from './title-family.mjs';
import { loadCompBands, bandFor, normalizeComp, CONFIDENCE_RANK } from './comp-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'postings-personal.jsonl');
const COMP = join(ROOT, 'data', 'company-comp.jsonl');
const RUBRIC = join(ROOT, 'config', 'rubric.yml');
const OUT = join(ROOT, 'data', 'company-aggregates.jsonl');

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return Number((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2).toFixed(2));
};

export function computeAggregates({ research, personal, bands, prefs, today }) {
  const pByKey = new Map(personal.map(p => [p.key, p]));
  const byCompany = new Map();

  for (const r of research) {
    if (!r?.company_key) continue;
    const p = pByKey.get(r.key) || {};
    // "Relevant" mirrors what the dashboard would actually show: live, not a dealbreaker, and
    // carrying some score. Pinned here so the two consumers (CLI + web) can't drift apart.
    const live = r.live !== false;
    const scored = (p.computed_score ?? p.llm_rank) != null;
    if (!live || p.hard_excluded || !scored) continue;

    if (!byCompany.has(r.company_key)) byCompany.set(r.company_key, { scores: [], ranks: [], n: 0, noComp: 0 });
    const agg = byCompany.get(r.company_key);
    agg.n++;
    const s = p.manual_score ?? p.computed_score;
    if (s != null) agg.scores.push(Number(s));
    // Stage-2 triage rank, kept SEPARATE from the rubric score. Only ~2.4k of 16.5k live postings
    // have been through Stage-3 JD research, so without this the vast majority of companies have
    // no quality signal at all and company research would be gated on job research finishing first.
    else if (p.llm_rank != null) agg.ranks.push(Number(p.llm_rank));

    const listed = normalizeComp(r.extracted?.comp) || normalizeComp(r.comp);
    if (!listed) {
      const { title_family, ladder_level } = normalizeTitle(r.title, r.extracted || {});
      if (!bandFor(bands.get(r.company_key), title_family, ladder_level, prefs)) agg.noComp++;
    }
  }

  // Fold in band metadata for every company that has bands, including ones with no live
  // postings — the dashboard filters on comp_band_rows and must see zero vs. absent alike.
  const keys = new Set([...byCompany.keys(), ...bands.keys()]);
  const out = [];
  for (const key of keys) {
    const a = byCompany.get(key) || { scores: [], ranks: [], n: 0, noComp: 0 };
    const rows = bands.get(key) || [];
    const bestConf = rows.reduce((best, r) => {
      const c = r.provenance?.confidence;
      return (CONFIDENCE_RANK[c] || 0) > (CONFIDENCE_RANK[best] || 0) ? c : best;
    }, null);
    out.push({
      key,
      live_relevant: a.n,
      live_relevant_no_comp: a.noComp,
      // Rubric score of the best RESEARCHED live posting (needs Stage-3 facets).
      best_posting_score: a.scores.length ? Math.max(...a.scores) : null,
      median_posting_score: median(a.scores),
      // Best Stage-2 TRIAGE rank among live postings that haven't been researched. A coarser,
      // cheaper signal — a world-knowledge read of the title + a JD excerpt, not a rubric
      // evaluation of extracted facets. Consumers must treat it as weaker evidence, never merge
      // the two into one number.
      best_posting_rank: a.ranks.length ? Math.max(...a.ranks) : null,
      researched_postings: a.scores.length,
      comp_band_rows: rows.length,
      comp_band_best_confidence: bestConf,
      comp_band_best_derivation: rows.reduce((b, r) =>
        b === 'direct' || r.derivation === 'direct' ? 'direct' : (b || r.derivation), null),
      comp_band_as_of: rows.map(r => r.provenance?.as_of).filter(Boolean).sort().pop() || null,
      computed_at: today,
    });
  }
  return out.sort((x, y) => (y.live_relevant - x.live_relevant) || String(x.key).localeCompare(String(y.key)));
}

function main() {
  if (!existsSync(RESEARCH)) { console.error(`No ${RESEARCH}. Run rank-postings.mjs first.`); process.exit(1); }
  const prefs = (yaml.load(readFileSync(RUBRIC, 'utf-8')) || {}).preferences || {};
  const rows = computeAggregates({
    research: loadJsonl(RESEARCH),
    personal: loadJsonl(PERSONAL),
    bands: loadCompBands(COMP),
    prefs,
    today: new Date().toISOString().slice(0, 10),
  });

  if (process.argv.includes('--stats')) {
    const withPostings = rows.filter(r => r.live_relevant > 0);
    const needComp = rows.filter(r => r.live_relevant_no_comp > 0 && r.comp_band_rows === 0);
    console.log(`companies with live relevant postings: ${withPostings.length}`);
    console.log(`companies with pay bands:              ${rows.filter(r => r.comp_band_rows > 0).length}`);
    console.log(`companies NEEDING comp research:       ${needComp.length}`);
    console.log(`  (postings they'd cover: ${needComp.reduce((s, r) => s + r.live_relevant_no_comp, 0)})`);
    console.log('\ntop 10 comp-research targets (by postings lacking comp):');
    for (const r of [...needComp].sort((a, b) => b.live_relevant_no_comp - a.live_relevant_no_comp).slice(0, 10)) {
      console.log(`  ${String(r.live_relevant_no_comp).padStart(4)} no-comp / ${String(r.live_relevant).padStart(4)} live · best ${r.best_posting_score ?? '-'}  ${r.key}`);
    }
    return;
  }

  saveJsonl(OUT, rows);
  console.log(`✓ ${rows.length} company aggregates → ${OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
