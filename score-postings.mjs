#!/usr/bin/env node
// score-postings.mjs (NEW) — recomputable, facet-weighted scoring of the postings registry.
//
// The score is DERIVED, never authored: computeScores(extracted, rubric, llm) maps each
// rubric dimension to a 1-5 score — deterministically from the Stage-3 extracted facets where
// the dimension has a `compute:` binding, else from the LLM's per-dimension read — then a weighted
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
const C_PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');

const clamp = (n, lo = 1, hi = 5) => Math.max(lo, Math.min(hi, n));
const lc = (a) => (a || []).map(s => String(s).toLowerCase());
const hasAny = (hay, needles) => { const set = new Set(lc(hay)); return lc(needles).some(n => set.has(n) || [...set].some(h => h.includes(n))); };

// Ordered IC ladder for the categorical Level dimension (people-management is off-ladder).
export const LEVEL_LADDER = ['junior', 'mid', 'mid-senior', 'senior', 'staff', 'principal'];
// Score a posting's level by PROXIMITY to the desired one (not "higher = better").
// exact match = 5, each rung away = −1; people-management is off the IC ladder. null = unknown → skip.
export function levelMatch(ex, desiredLevel = 'senior') {
  const di = LEVEL_LADDER.indexOf(String(desiredLevel).toLowerCase());
  if (di < 0) return null;                          // desired level not on the ladder
  const sen = String(ex?.seniority || '').toLowerCase();
  let li = LEVEL_LADDER.indexOf(sen);
  if (li < 0 && sen === 'manager') return 1;        // wants an IC; this is people-management
  if (li < 0 && ex?.yoe_min != null) {              // infer a rung from years of experience
    li = ex.yoe_min >= 8 ? LEVEL_LADDER.indexOf('staff')
       : ex.yoe_min >= 5 ? LEVEL_LADDER.indexOf('senior')
       : ex.yoe_min >= 3 ? LEVEL_LADDER.indexOf('mid-senior')
       : LEVEL_LADDER.indexOf('mid');
  }
  if (li < 0) return null;                           // unknown level → skip the dimension
  return clamp(5 - Math.abs(li - di));
}

// Check if an item matches any entry in the needles list (exact case-insensitive match)
function itemMatchesList(item, needles) {
  if (!needles || !needles.length) return false;
  const itemLc = String(item).toLowerCase();
  return needles.some(n => String(n).toLowerCase() === itemLc);
}

// Score one stack subset (e.g. ex.languages) against a preference group {love, ok, avoid, neutral}.
function stackScore(items, group, prefs) {
  if (!items || !items.length) return null;
  const love = group?.love || [], ok = group?.ok || [], avoid = group?.avoid || [];
  const neutral = group?.neutral || [];
  
  if (avoid.length && items.some(item => itemMatchesList(item, avoid))) {
    return 1.5;
  }
  
  let s = 3;
  const hasLove = love.length && items.some(item => itemMatchesList(item, love));
  const hasOk = ok.length && items.some(item => itemMatchesList(item, ok));
  
  if (hasLove) s += 1.5;
  else if (hasOk) s += 0.5;

  // Calculate mismatch penalty for unlisted items (neither loved, ok, avoided, nor neutral)
  const unlistedItems = items.filter(item => {
    return !itemMatchesList(item, love) &&
           !itemMatchesList(item, ok) &&
           !itemMatchesList(item, avoid) &&
           !itemMatchesList(item, neutral);
  });

  if (unlistedItems.length > 0) {
    const penaltyPerItem = prefs?.mismatch_penalty ?? 0.3;
    const maxPenalty = prefs?.max_mismatch_penalty ?? 1.5;
    const totalPenalty = Math.min(unlistedItems.length * penaltyPerItem, maxPenalty);
    s -= totalPenalty;
  }
  
  return clamp(s);
}

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
  // Per-facet stack scoring — `compute: languages` and `compute: technologies` each score their own
  // facet against their own preference group, so the rubric can weight them independently.
  languages(ex, prefs) { return stackScore(ex.languages, prefs?.languages, prefs); },
  technologies(ex, prefs) { return stackScore(ex.technologies, prefs?.technologies, prefs); },
  // Formerly "qualitative" dims, now FACET-DRIVEN: the LLM extracts a normalized enum (not a score),
  // and these map it to 1-5 via a preference table (tunable, recomputable, re-weightable live).
  scope(ex, prefs) {                       // from ex.autonomy: high|medium|low
    const s = (prefs?.autonomy_scores || { high: 5, medium: 3, low: 1 })[String(ex.autonomy || '').toLowerCase()];
    return s == null ? null : clamp(s);
  },
  wlb(ex, prefs) {                         // from ex.culture: sustainable|balanced|hustle (+ on_call)
    let s = (prefs?.culture_scores || { sustainable: 5, balanced: 3, hustle: 1 })[String(ex.culture || '').toLowerCase()];
    if (s == null) return null;
    if (ex.on_call === true) s -= 1;       // a hard on-call rotation cuts into work-life balance
    return clamp(s);
  },
  stability(ex, prefs) {                   // from ex.company_stage: seed|startup|growth|late_stage|public|profitable
    const s = (prefs?.company_stage_scores || { public: 5, profitable: 5, late_stage: 4, growth: 4, startup: 2.5, seed: 1.5, early: 1.5 })[String(ex.company_stage || '').toLowerCase()];
    return s == null ? null : clamp(s);
  },
  // Legacy unified stack score (languages + technologies merged) — kept for back-compat; prefer the
  // two facet dimensions above. Remove the `tech_stack` rubric dimension once you've split it.
  tech_stack(ex, prefs) {
    const stack = [...(ex.languages || []), ...(ex.technologies || [])];
    const L = prefs?.languages || {}, T = prefs?.technologies || {};
    return stackScore(stack, {
      love: [...(L.love || []), ...(T.love || [])],
      ok: [...(L.ok || []), ...(T.ok || [])],
      avoid: [...(L.avoid || []), ...(T.avoid || [])],
      neutral: [...(L.neutral || []), ...(T.neutral || [])]
    }, prefs);
  },
  // Level is CATEGORICAL, not "more = better": score by how close the posting's level is to the
  // desired one (prefs.desired_level), so a too-senior role is penalized like a too-junior one.
  // exact match = 5, one rung away = 4, … ; people-management is off the IC ladder.
  level(ex, prefs) {
    return levelMatch(ex, prefs?.desired_level || 'senior');
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
  // Company fit (Lever B) is NOT a JD facet — it's the vetted company's llm_fit, injected at scoring
  // time as `_company_fit` (see computeScores' ctx merge). null when the company is undecided/skip →
  // the dimension is skipped and its weight redistributed, so the posting ranks on role merit alone.
  company_fit(ex) {
    const v = ex?._company_fit;
    return v == null ? null : clamp(Number(v));
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
// `llm` carries the LLM's read of the QUALITATIVE dimensions (those without a `compute:` binding).
// New form: a per-dimension object {<dim id>: 1-5} so the LLM scores each qualitative dimension
// independently. Legacy form: a single number (the old `llm_holistic_fit`) — applied to every
// qualitative dim as a fallback for rows not yet re-scored. Compute dims ignore `llm` entirely.
// `ctx` carries non-facet, posting-external signals injected at scoring time (currently the vetted
// company's fit). It's merged into a LOCAL copy of `extracted` as `_company_fit` so the persisted
// OBJECTIVE layer (posting-research.jsonl) is never polluted with a personal value. Callers that
// pass nothing get exactly the prior behavior.
export function computeScores(extracted, rubric, llm = null, ctx = {}) {
  const ex = { ...(extracted || {}), ...(ctx?.company_fit != null ? { _company_fit: ctx.company_fit } : {}) };
  const dims = rubric?.dimensions || [];
  const perDim = (llm && typeof llm === 'object') ? llm : null;
  const legacy = (typeof llm === 'number') ? llm : null;
  const dim_scores = {};
  let wsum = 0, acc = 0;
  for (const d of dims) {
    const id = d.id || d.name;
    let s = null;
    if (d.compute && COMPUTERS[d.compute]) {
      s = COMPUTERS[d.compute](ex, rubric.preferences);     // deterministic from facets
    } else {                                                // qualitative — the LLM scores each one
      const v = perDim ? perDim[id] : legacy;
      s = (v == null || v === '') ? null : Number(v);
    }
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
  // Lever B: company_fit dimension. Map company_key → vetted llm_fit, but ONLY for decision=keep
  // companies (boost-only) — undecided/skip stay null so the dimension is skipped for them.
  const companyFitByKey = new Map();
  for (const c of loadJsonl(C_PERSONAL)) {
    if (c.decision === 'keep' && c.llm_fit != null) companyFitByKey.set(c.key, c.llm_fit);
  }

  let scored = 0, excluded = 0;
  for (const p of personal) {
    const r = research.get(p.key);
    if (!r || !r.extracted) continue;   // only postings the LLM has extracted facets for
    const company_fit = companyFitByKey.get(r.company_key) ?? null;
    const { dim_scores, computed_score, hard_excluded } = computeScores(r.extracted, rubric, p.llm_dim_scores ?? p.llm_holistic_fit, { company_fit });
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
