#!/usr/bin/env node
// score-postings.mjs (NEW) — recomputable, facet-weighted scoring of the postings registry.
//
// The score is DERIVED, never authored: computeScores(extracted, rubric, holistic) maps each
// rubric dimension to a 1-5 score — deterministically from the Stage-3 extracted facets where
// the dimension has a `compute:` binding, else from the LLM's holistic read — then a weighted
// average. Re-run after editing config/rubric.yml (weights / preferences / hard_filters) and the
// queue re-ranks WITHOUT re-running the LLM. The dashboard ships dim_scores to the browser and
// recomputes the weighted average live from the sliders, so the two never drift.
//
//   node score-postings.mjs            # (re)score every posting that has extracted facets
//   node score-postings.mjs --stats    # show how many are scored / hard-excluded
//
// computeScores / evalHardFilters are PURE (no Node deps) — exported for reuse.

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';
import { loadJsonl, saveJsonl } from './posting-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RUBRIC = join(ROOT, 'config', 'rubric.yml');
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'postings-personal.jsonl');

const clamp = (n, lo = 1, hi = 5) => Math.max(lo, Math.min(hi, n));
const lc = (a) => (a || []).map(s => String(s).toLowerCase());
const hasAny = (hay, needles) => { const set = new Set(lc(hay)); return lc(needles).some(n => set.has(n) || [...set].some(h => h.includes(n))); };

// ── per-dimension facet computers (PURE) ────────────────────────────
// Each returns 1-5, or null when the facet is unknown (dimension is then skipped and its
// weight redistributed, so a partially-extracted posting still scores honestly).
export const COMPUTERS = {
  comp(ex, prefs) {
    const c = ex.comp;
    let val = c && (c.max ?? c.min);
    if (!val) return null;
    if (c.currency && /usd|us\$|\$us/i.test(c.currency)) val *= (prefs?.usd_to_cad || 1.35);
    const tiers = [...(prefs?.comp_tiers || [])].sort((a, b) => b.min - a.min);
    for (const t of tiers) if (val >= t.min) return clamp(t.score);
    return 1;
  },
  tech_stack(ex, prefs) {
    const stack = [...(ex.languages || []), ...(ex.technologies || [])];
    if (!stack.length) return null;
    const L = prefs?.languages || {}, T = prefs?.technologies || {};
    const love = [...(L.love || []), ...(T.love || [])];
    const ok = [...(L.ok || []), ...(T.ok || [])];
    const avoid = [...(L.avoid || []), ...(T.avoid || [])];
    if (avoid.length && hasAny(stack, avoid)) return 1.5;
    let s = 3;
    if (love.length && hasAny(stack, love)) s += 1.5;
    else if (ok.length && hasAny(stack, ok)) s += 0.5;
    return clamp(s);
  },
  level(ex, prefs) {
    const map = { principal: 5, staff: 5, senior: 4, 'mid-senior': 3.5, mid: 3, junior: 2, manager: 1 };
    let base = ex.seniority && map[String(ex.seniority).toLowerCase()] != null ? map[String(ex.seniority).toLowerCase()] : null;
    if (base == null && ex.yoe_min != null) base = ex.yoe_min >= 8 ? 4.5 : ex.yoe_min >= 5 ? 4 : ex.yoe_min >= 3 ? 3 : 2;
    if (base == null) return null;
    const ceil = prefs?.yoe_ceiling;
    if (ceil != null && ex.yoe_min != null && ex.yoe_min > ceil) base = clamp(base - 1);  // demands more than he wants
    return clamp(base);
  },
  remote_tz(ex, prefs) {
    const geo = String(ex.geo_eligibility || '').toLowerCase();
    const rp = String(ex.remote_policy || '').toLowerCase();
    if (geo === 'us_only' || geo === 'eu_only') return 1;
    if (rp === 'onsite') return 1;
    if (rp === 'hybrid') return 3;
    const tzOk = (prefs?.timezone_ok || []).some(k =>
      hasAny([...(ex.location_hints || []), ex.timezone || ''], [k]));
    if (rp === 'remote') return (geo === 'canada' || geo === 'global' || tzOk) ? 5 : 4;
    return null;
  },
};

// ── hard filters (PURE) ─────────────────────────────────────────────
export function evalHardFilters(ex, filters) {
  for (const f of (filters || [])) {
    const v = ex?.[f.facet];
    if (v == null) continue;
    const val = Array.isArray(v) ? v.map(x => String(x).toLowerCase()) : String(v).toLowerCase();
    if (f.in && (Array.isArray(val) ? val.some(x => f.in.map(String).map(s => s.toLowerCase()).includes(x))
      : f.in.map(String).map(s => s.toLowerCase()).includes(val))) return { excluded: true, reason: `${f.facet} ∈ ${f.in}` };
    if (f.gt != null && Number(v) > f.gt) return { excluded: true, reason: `${f.facet} > ${f.gt}` };
    if (f.lt != null && Number(v) < f.lt) return { excluded: true, reason: `${f.facet} < ${f.lt}` };
  }
  return { excluded: false, reason: '' };
}

// ── the recomputable score (PURE) ───────────────────────────────────
export function computeScores(extracted, rubric, holistic = null) {
  const ex = extracted || {};
  const dims = rubric?.dimensions || [];
  const dim_scores = {};
  let wsum = 0, acc = 0;
  for (const d of dims) {
    const id = d.id || d.name;
    let s = null;
    if (d.compute && COMPUTERS[d.compute]) s = COMPUTERS[d.compute](ex, rubric.preferences);
    else s = (holistic != null ? Number(holistic) : null);   // soft / qualitative dimension
    dim_scores[id] = s == null ? null : Number(Number(s).toFixed(2));
    if (s != null) { wsum += (Number(d.weight) || 0); acc += (Number(d.weight) || 0) * s; }
  }
  const computed_score = wsum ? Number((acc / wsum).toFixed(2)) : null;
  const { excluded, reason } = evalHardFilters(ex, rubric?.hard_filters);
  return { dim_scores, computed_score, hard_excluded: excluded, hard_reason: reason };
}

export function loadRubric() {
  return yaml.load(readFileSync(RUBRIC, 'utf-8')) || { dimensions: [] };
}

function main() {
  if (!existsSync(RESEARCH)) { console.error(`No ${RESEARCH}. Run rank-postings.mjs first.`); process.exit(1); }
  const rubric = loadRubric();
  const research = new Map(loadJsonl(RESEARCH).map(r => [r.key, r]));
  const personal = loadJsonl(PERSONAL);

  let scored = 0, excluded = 0;
  for (const p of personal) {
    const r = research.get(p.key);
    if (!r || !r.extracted) continue;   // only postings the LLM has extracted facets for
    const { dim_scores, computed_score, hard_excluded } = computeScores(r.extracted, rubric, p.llm_holistic_fit);
    p.dim_scores = dim_scores;
    p.computed_score = computed_score;
    p.hard_excluded = hard_excluded;
    scored++;
    if (hard_excluded) excluded++;
  }
  saveJsonl(PERSONAL, personal);

  if (process.argv.includes('--stats')) {
    console.log(`postings with extracted facets: ${scored}`);
    console.log(`hard-excluded (dealbreaker facet): ${excluded}`);
  }
  console.log(`✓ scored ${scored} postings (${excluded} hard-excluded) → ${PERSONAL}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
