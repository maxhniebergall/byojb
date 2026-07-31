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
import { loadJsonl, saveJsonl, sk } from './posting-core.mjs';
import { LEVEL_LADDER, levelFromYoe, normalizeTitle } from './title-family.mjs';
import { loadCompBands, bandFor } from './comp-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RUBRIC = join(ROOT, 'config', 'rubric.yml');
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'postings-personal.jsonl');
const C_PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');
const COMP = join(ROOT, 'data', 'company-comp.jsonl');
const BODY_DIR = join(ROOT, 'data', 'posting-research');

const clamp = (n, lo = 1, hi = 5) => Math.max(lo, Math.min(hi, n));
const lc = (a) => (a || []).map(s => String(s).toLowerCase());
const hasAny = (hay, needles) => { const set = new Set(lc(hay)); return lc(needles).some(n => set.has(n) || [...set].some(h => h.includes(n))); };

// The ordered IC ladder now lives in title-family.mjs (the lower-level module, which also owns
// the yoe→rung thresholds). Re-exported here so existing importers of LEVEL_LADDER keep working.
export { LEVEL_LADDER };
// Score a posting's level by PROXIMITY to the desired one (not "higher = better").
// exact match = 5, each rung away = −1; people-management is off the IC ladder. null = unknown → skip.
export function levelMatch(ex, desiredLevel = 'senior') {
  const di = LEVEL_LADDER.indexOf(String(desiredLevel).toLowerCase());
  if (di < 0) return null;                          // desired level not on the ladder
  const sen = String(ex?.seniority || '').toLowerCase();
  let li = LEVEL_LADDER.indexOf(sen);
  if (li < 0 && sen === 'manager') return 1;        // wants an IC; this is people-management
  if (li < 0 && ex?.yoe_min != null) {              // infer a rung from years of experience
    li = LEVEL_LADDER.indexOf(levelFromYoe(ex.yoe_min));   // single definition, see title-family.mjs
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

// ── remote policy derivation (PURE) ─────────────────────────────────
// remote_tz is a weight-10 dimension and geography is the decisive facet in this corpus, so
// the policy is derived from every available signal rather than the JD prose alone. Ordered by
// how much the signal can be trusted — the first rule that fires wins:
//   1. #LI-REMOTE / #LI-HYBRID / #LI-ONSITE — LinkedIn tags the publisher set deliberately.
//      (Other #LI-XX tags are recruiter initials / #LI-DNI and carry no location meaning.)
//   2. An explicit negation ("NO REMOTE", "no possibility of remote work") — must beat rule 5,
//      or postings that say remote only to rule it out get tagged remote.
//   3. The Stage-3 extracted policy, when the LLM actually determined one.
//   4. A keyword in the scanner's own location string.
//   5. The word "remote" anywhere in the body.
//   6. DEFAULT: a location naming a specific city, with no remote signal anywhere, is ONSITE.
//      Absence of evidence is treated as evidence of onsite — the safe assumption for a
//      candidate who cannot relocate.
const RE_NEG_REMOTE = /\b(no|not|non)\b[^.]{0,30}\bremote\b|\bremote\b[^.]{0,20}\b(not (available|an option)|is not)\b/i;
const RE_CITYISH = /[A-Za-z]{3,}/;   // a location string with words in it (a city/region name)
export function deriveRemotePolicy({ location = '', body = '', extracted = null } = {}) {
  const loc = String(location || '').toLowerCase();
  const txt = String(body || '');
  const known = (v) => { const s = String(v ?? '').toLowerCase(); return (s && s !== 'unclear' && s !== 'unknown') ? s : ''; };

  if (/#LI-REMOTE\b/i.test(txt)) return { policy: 'remote', source: 'li-tag' };
  if (/#LI-HYBRID\b/i.test(txt)) return { policy: 'hybrid', source: 'li-tag' };
  if (/#LI-ONSITE\b/i.test(txt)) return { policy: 'onsite', source: 'li-tag' };

  if (RE_NEG_REMOTE.test(txt) || RE_NEG_REMOTE.test(loc)) return { policy: 'onsite', source: 'negation' };

  const ex = known(extracted?.remote_policy);
  if (ex === 'remote' || ex === 'hybrid' || ex === 'onsite') return { policy: ex, source: 'extracted' };

  if (/\bhybrid\b/.test(loc)) return { policy: 'hybrid', source: 'location' };
  // Onsite phrasings actually seen in this corpus' location strings — "office based" and
  // "in person" are NOT covered by an /in-?office/ pattern and previously fell through to the
  // body's stray "remote" mention (Canonical MAAS: "Office Based - Toronto" scored as remote).
  if (/\bon-?site\b|\bin-?office\b|\boffice[- ]based\b|\bin[- ]person\b|\bheadquarters\b/.test(loc)) return { policy: 'onsite', source: 'location' };
  if (/\bremote\b|\banywhere\b|\bdistributed\b|\bworldwide\b|\bwork from home\b|\bhome[- ]based\b|\bvirtual\b|\btelecommute\b/.test(loc)) return { policy: 'remote', source: 'location' };

  if (/\bremote\b|\bwork from home\b/i.test(txt)) return { policy: 'remote', source: 'body' };

  if (RE_CITYISH.test(loc)) return { policy: 'onsite', source: 'city-default' };
  return { policy: '', source: 'none' };
}

// Walk the rubric's comp_tiers (highest first) for an annual CAD figure. Shared by the listed
// and the band-derived paths so both read the same table.
function tierScore(val, prefs) {
  const tiers = [...(prefs?.comp_tiers || [])].sort((a, b) => b.min - a.min);
  for (const t of tiers) if (val >= t.min) return clamp(t.score);
  return 1;
}

// ── per-dimension facet computers (PURE) ────────────────────────────
// Each returns 1-5, or null when the facet is unknown (dimension is then skipped and its
// weight redistributed, so a partially-extracted posting still scores honestly).
export const COMPUTERS = {
  comp(ex, prefs) {
    // Two comp sources exist and must be reconciled: the LLM's `extracted.comp` (Stage 3,
    // read from the JD prose) and the scanner's `comp` (objective, from the ATS's own
    // structured field). The scanned one is present on postings whose body never captured —
    // without this fallback those score with the comp dimension SKIPPED, which silently
    // inflates them (a known-low band vanishing is worse than no band at all).
    // The SCANNER's field takes precedence over the LLM's read: it comes from the ATS API with an
    // explicit currency and numbers, whereas `extracted.comp` is an interpretation of JD prose.
    // Where both exist they disagree on currency 38% of the time, and a USD range mislabeled CAD
    // skips the usd_to_cad conversion and understates the role by ~35%.
    const scanned = ex._scanned_comp;
    const c = (scanned && (scanned.max ?? scanned.min)) ? scanned : ex.comp;
    let val = c && (c.max ?? c.min);
    if (val) {
      if (c.currency && /usd|us\$|\$us/i.test(c.currency)) val *= (prefs?.usd_to_cad || 1.35);
      return tierScore(val, prefs);
    }

    // ── nothing was LISTED: fall back to the company's own band ──────────────
    // `_comp_band` is this company's researched band for THIS posting's (title_family,
    // ladder_level), injected via ctx at scoring time — the objective layer is never rewritten
    // with it. The result is SHRUNK TOWARD THE NEUTRAL 3 by evidence tier, so a derived band can
    // never masquerade as a stated one. Shrink rather than a flat penalty: a weak band must be
    // unable to push a posting to EITHER extreme, and a flat subtraction would still let a bad
    // band tank a good posting.
    const b = ex._comp_band;
    if (!b || prefs?.comp_impute === false) return null;
    if ((b.sample_size ?? 0) < (prefs?.comp_imputed_min_sample ?? 1)) return null;
    let bval = b.mid ?? b.max ?? b.min;
    if (!bval) return null;
    if (b.currency && /usd|us\$|\$us/i.test(b.currency)) bval *= (prefs?.usd_to_cad || 1.35);
    // A base-only band compared against TC-denominated comp_tiers under-scores systematically.
    // The default 1.0 deliberately invents no equity/bonus uplift; set it explicitly if measured.
    if (b.component === 'base') bval *= (prefs?.base_to_tc ?? 1.0);

    let k;
    if (b.derivation === 'direct') k = prefs?.comp_direct_shrink ?? 1.0;
    else if (b.derivation === 'estimated') {
      // Parametric model priors: collected and displayed from day one, but they do not move a
      // score until explicitly enabled and reviewed.
      if (prefs?.comp_use_estimated !== true) return null;
      k = prefs?.comp_estimated_shrink ?? 0.15;
    } else {
      k = (prefs?.comp_imputed_shrink || { high: 0.8, medium: 0.55, low: 0.3 })[b.confidence] ?? 0.3;
    }
    return clamp(3 + (tierScore(bval, prefs) - 3) * k);
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
    // Same dual-source reconciliation as comp: when Stage 3 could not read a remote policy
    // or geo out of the JD prose, the scanner's own `location` string often states it
    // outright ("Remote Canada", "Remote US", "Toronto, ON, remote", "Hybrid - Toronto").
    // Without this the dimension goes null and its weight is redistributed, so a posting we
    // KNOW is US-only scores identically to one whose geography is genuinely unknown.
    // NOTE: the extractor writes the literal string "unclear" (not null) for facets it could
    // not determine — a truthy value — so every fallback here must normalize it away first.
    const known = (v) => { const s = String(v ?? '').toLowerCase(); return (s && s !== 'unclear' && s !== 'unknown') ? s : ''; };
    const loc = String(ex._scanned_location || '').toLowerCase();
    const locSays = (re) => re.test(loc);
    const geo = known(ex.geo_eligibility)
      || (locSays(/\bremote[ ,-]*(us|usa|united states)\b|\bus[ -]only\b/) ? 'us_only'
        : locSays(/\bcanada\b|\bcanadian\b/) ? 'canada'
        : locSays(/\banywhere\b|\bworldwide\b|\bglobal\b/) ? 'global' : '');
    // Derived by deriveRemotePolicy() from LI tags → negations → extracted → location → body
    // → city-default; injected as _remote_policy so this stays a pure function.
    const rp = known(ex._remote_policy) || known(ex.remote_policy);
    if (geo === 'us_only' || geo === 'eu_only') return 1;
    if (rp === 'onsite') return 1;
    if (rp === 'hybrid') return 3;
    const tzOk = (prefs?.timezone_ok || []).some(k =>
      hasAny([...(ex.location_hints || []), ex.timezone || '', ex._scanned_location || ''], [k]));
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
  const ex = {
    ...(extracted || {}),
    ...(ctx?.company_fit != null ? { _company_fit: ctx.company_fit } : {}),
    ...(ctx?.scanned_comp != null ? { _scanned_comp: ctx.scanned_comp } : {}),
    ...(ctx?.scanned_location ? { _scanned_location: ctx.scanned_location } : {}),
    ...(ctx?.remote_policy ? { _remote_policy: ctx.remote_policy } : {}),
    // The company's band for this posting's (title_family, ladder_level). `_`-prefixed so
    // evalHardFilters cannot see it: a dealbreaker must never fire on a derived number.
    ...(ctx?.comp_band ? { _comp_band: ctx.comp_band } : {}),
  };
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
  return { dim_scores, computed_score, hard_excluded: excluded, hard_reason: reason, meta: compMeta(ex, dim_scores, dims) };
}

// Which evidence actually produced the comp score. FIVE distinct values, not a boolean —
// "this posting listed it", "the scanner saw it", "the company states this band", "we derived
// this band", and "a model guessed it" are five different epistemic claims, and collapsing them
// is exactly how a derived number ends up read as a stated one.
function compMeta(ex, dim_scores, dims) {
  const listed = (ex.comp && (ex.comp.max ?? ex.comp.min)) ? 'listed'
    : (ex._scanned_comp && (ex._scanned_comp.max ?? ex._scanned_comp.min)) ? 'scanned' : null;
  if (listed) return { comp_source: listed, comp_band: null };
  const b = ex._comp_band;
  // Locate the comp dimension by its `compute:` binding rather than assuming the id is "comp",
  // so renaming the dimension in rubric.yml can't silently break the provenance reporting.
  const compDim = (dims || []).find(d => d.compute === 'comp');
  const compId = compDim && (compDim.id || compDim.name);
  // The band existed but the computer declined it (below the sample floor, estimated-and-
  // disabled, no usable number) — report no source, matching the null dimension.
  if (!b || !compId || dim_scores[compId] == null) return { comp_source: null, comp_band: null };
  return {
    comp_source: b.derivation === 'direct' ? 'company_direct'
      : b.derivation === 'estimated' ? 'company_estimated' : 'company_inferred',
    comp_band: b,
  };
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

  const bandsByCompany = loadCompBands(COMP);

  let scored = 0, excluded = 0, imputed = 0;
  for (const p of personal) {
    const r = research.get(p.key);
    if (!r || !r.extracted) {
      // No facets → clear any score derived from a PREVIOUS extraction. Without this the
      // derived fields outlive their source: a posting whose stub extraction was cleared
      // (so it could be re-fetched and re-read) kept its old score and stayed at the top
      // of the board on data that no longer exists.
      if (p.computed_score != null || p.dim_scores != null) {
        p.computed_score = null; p.dim_scores = null; p.hard_excluded = false;
        p.comp_source = null; p.comp_band_ref = null;
      }
      continue;
    }
    const company_fit = companyFitByKey.get(r.company_key) ?? null;
    // The company's own band for this posting's role family and level. bandFor returns null
    // across title families and applies the staleness rule, so the pure scorer never has to.
    const { title_family, ladder_level } = normalizeTitle(r.title, r.extracted);
    const comp_band = bandFor(bandsByCompany.get(r.company_key), title_family, ladder_level, rubric.preferences);
    // The body carries the #LI- tags and negations deriveRemotePolicy() needs; read it here
    // so computeScores stays pure and browser-reusable.
    let body = '';
    if (r.has_body) { try { body = readFileSync(join(BODY_DIR, sk(r.key) + '.md'), 'utf-8'); } catch { /* unreadable → derive from location alone */ } }
    const { policy: remote_policy } = deriveRemotePolicy({ location: r.location, body, extracted: r.extracted });
    const { dim_scores, computed_score, hard_excluded, meta } = computeScores(r.extracted, rubric, p.llm_dim_scores ?? p.llm_holistic_fit, { company_fit, scanned_comp: r.comp ?? null, scanned_location: r.location ?? null, remote_policy, comp_band });
    p.dim_scores = dim_scores;
    p.computed_score = computed_score;
    p.hard_excluded = hard_excluded;
    // Provenance of the comp score. The band's DOLLARS stay out of the personal layer — only
    // the tuple describing where the number came from, so the UI can label it and doctor.mjs
    // can audit it. Both fields are fully recomputable: re-running this script rewrites them.
    p.comp_source = meta.comp_source;
    p.comp_band_ref = meta.comp_band ? {
      title_family: meta.comp_band.title_family, ladder_level: meta.comp_band.ladder_level,
      source: meta.comp_band.source, derivation: meta.comp_band.derivation,
      confidence: meta.comp_band.confidence, sample_size: meta.comp_band.sample_size,
      as_of: meta.comp_band.as_of, method: meta.comp_band.method,
      model: meta.comp_band.model ?? null, currency: meta.comp_band.currency ?? null,
      min: meta.comp_band.min ?? null, mid: meta.comp_band.mid ?? null, max: meta.comp_band.max ?? null,
    } : null;
    if (meta.comp_source && meta.comp_source.startsWith('company_')) imputed++;
    scored++;
    if (hard_excluded) excluded++;
  }
  saveJsonl(PERSONAL, personal);

  if (process.argv.includes('--stats')) {
    console.log(`postings with extracted facets: ${scored}`);
    console.log(`hard-excluded (dealbreaker facet): ${excluded}`);
    const by = {};
    for (const p of personal) if (p.comp_source) by[p.comp_source] = (by[p.comp_source] || 0) + 1;
    console.log(`comp evidence: ${Object.entries(by).map(([k, v]) => `${k}=${v}`).join(' ') || '(none)'}`);
  }
  console.log(`✓ scored ${scored} postings (${excluded} hard-excluded, ${imputed} comp from company bands) → ${PERSONAL}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
