#!/usr/bin/env node
// comp-core.mjs — the company × title-family × level pay-band registry.
//
// Most postings never state a salary (13.5k of 16.5k live ones here), so the weight-10 comp
// dimension goes null and silently redistributes. This module lets a company's OWN published
// numbers stand in for the ones it didn't publish — while never letting an estimate pass as a
// stated fact.
//
// The central rule is `derivation`, carried on every row and never collapsed downstream:
//
//   direct    — stated for THIS company by an authoritative source (its own posted range,
//               pay-transparency page, a filing).
//   inferred  — DERIVED from company-specific evidence (rolled up across its other postings,
//               extrapolated a rung along its ladder, LLM-synthesized from cited sources).
//   estimated — from a model's own prior, with no citable source at all. Weakest tier, last
//               resort, and off by default for scoring.
//
// Precedence is strict: direct > inferred > estimated. A posting that LISTS its comp always
// wins over any band. Bands are never compared across title families — bandFor returns null
// instead, because a wrong-family number is worse than no number.
//
// PURE apart from loadCompBands' file read.

import { readFileSync, existsSync } from 'fs';
import { LEVEL_LADDER } from './title-family.mjs';

export const DERIVATIONS = ['direct', 'inferred', 'estimated'];
export const DERIVATION_RANK = { direct: 3, inferred: 2, estimated: 1 };
export const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };
export const COMPONENTS = ['base', 'total_cash', 'tc'];

// A source implies its derivation and whether a citation is mandatory. This table is the
// validator: it makes a mislabeled derivation and an uncited claim detectable in the data
// rather than only in the prompt that produced it.
//
// Note this list carries no opinion about WHICH sites may be read. The pipeline never goes
// looking for aggregator data (levels.fyi and friends) — it assumes it can't get it, and is
// built entirely on first-party evidence. But if a source does yield a number, the honest move
// is to record where it came from. Rejecting a citation would only push the number into
// `llm_prior`, misattributed and unauditable, which is the exact failure `derivation` exists
// to prevent. Label accurately; the tier system handles how much any given source is trusted.
export const SOURCES = {
  jd_posted:            { derivation: 'direct',    cite: 'url' },
  company_disclosure:   { derivation: 'direct',    cite: 'url' },
  jd_rollup:            { derivation: 'inferred',  cite: 'derived_from' },
  ladder_extrapolation: { derivation: 'inferred',  cite: 'derived_from' },
  lca:                  { derivation: 'inferred',  cite: 'url' },
  llm_research:         { derivation: 'inferred',  cite: 'url' },
  llm_prior:            { derivation: 'estimated', cite: null },
  manual:               { derivation: null,        cite: null },   // any derivation, human-entered
};

// ── currency / interval normalization ───────────────────────────────
const PERIODS = {
  'per-year-salary': 1, 'per-hour-wage': 2080, 'per-month-salary': 12,
  'per-week-salary': 52, 'semi-month-salary': 24,
};
const SYMBOLS = [
  [/^ca\$|^c\$/i, 'CAD'], [/^a\$/i, 'AUD'], [/^£/, 'GBP'], [/^€/, 'EUR'], [/^\$|^us\$/i, 'USD'],
];

// Providers hand us three different shapes for the same fact: a structured object, an EMPTY
// Ashby placeholder object, or a display string ("$180K – $220K • Offers Equity"). Reduce all
// three to {min,max,currency} in annual units, or null when there is genuinely no number.
export function normalizeComp(comp) {
  if (!comp) return null;

  if (typeof comp === 'object') {
    // Ashby nests the real numbers under summaryComponents/compensationTiers rather than exposing
    // min/max at the top level. Reading only the top level saw `{compensationTierSummary: null, …}`
    // and dismissed the whole shape as an empty placeholder — silently discarding 348 postings'
    // worth of authoritative, currency-tagged comp and falling back to the LLM's prose reading.
    const ashby = ashbySalary(comp);
    if (ashby) return ashby;

    const min = num(comp.min), max = num(comp.max);
    if (min == null && max == null) return null;          // genuinely empty
    const mult = PERIODS[comp.interval] ?? (comp.interval ? null : 1);
    if (mult == null) return null;                        // unrecognized interval — don't guess
    return clean({
      min: min == null ? null : min * mult,
      max: max == null ? null : max * mult,
      currency: (comp.currency || '').toUpperCase() || null,
    });
  }

  if (typeof comp === 'string') return parseCompString(comp);
  return null;
}

// Pull the Salary component out of Ashby's nested comp blob. Equity components live alongside it
// and must never be read as salary. Ashby states its own interval ("1 YEAR", "1 HOUR") and an
// explicit currencyCode — both more trustworthy than anything inferred from prose.
const ASHBY_INTERVAL = { '1 YEAR': 1, '1 MONTH': 12, '1 WEEK': 52, '1 HOUR': 2080, '1 DAY': 260 };
function ashbySalary(comp) {
  const pools = [
    Array.isArray(comp.summaryComponents) ? comp.summaryComponents : [],
    ...(Array.isArray(comp.compensationTiers) ? comp.compensationTiers.map(t => t?.components || []) : []),
  ];
  for (const pool of pools) {
    const sal = pool.find(c => c?.compensationType === 'Salary' && (c.minValue != null || c.maxValue != null));
    if (!sal) continue;
    const mult = ASHBY_INTERVAL[sal.interval] ?? (sal.interval && sal.interval !== 'NONE' ? null : 1);
    if (mult == null) continue;                            // unrecognized interval — don't guess
    const min = num(sal.minValue), max = num(sal.maxValue);
    return clean({
      min: min == null ? null : min * mult,
      max: max == null ? null : max * mult,
      currency: (sal.currencyCode || '').toUpperCase() || null,
    });
  }
  return null;
}

// "$180K – $220K • Offers Equity" → {min:180000,max:220000,currency:'USD'}
// Only the FIRST bullet segment is money; later ones are equity percentages and perks, and
// reading "0.1% – 0.75%" as a salary would be catastrophic.
export function parseCompString(s) {
  const head = String(s).split('•')[0].trim();
  if (!head || /%/.test(head)) return null;

  let currency = null;
  for (const [re, cur] of SYMBOLS) if (re.test(head)) { currency = cur; break; }

  // en-dash, em-dash, hyphen, or "to" all appear as the range separator
  const nums = [...head.matchAll(/([\d,]+(?:\.\d+)?)\s*([kKmM])?/g)].map(m => {
    let v = parseFloat(m[1].replace(/,/g, ''));
    const suf = (m[2] || '').toLowerCase();
    if (suf === 'k') v *= 1e3; else if (suf === 'm') v *= 1e6;
    return v;
  }).filter(v => v > 0);

  if (!nums.length) return null;
  // A bare number under 1000 in a comp string is an hourly rate or a typo, not a salary.
  const annual = nums.filter(v => v >= 1000);
  if (!annual.length) return null;
  return clean({ min: annual[0], max: annual.length > 1 ? annual[annual.length - 1] : null, currency });
}

// Pull an explicit annual salary RANGE out of JD prose.
//
// This sits between the ATS field and the LLM extraction in the trust order, and it earns that
// spot: measured against 411 postings where both exist, the LLM's `extracted.comp` contradicts the
// body text 27% of the time (Warp's JD says "$165,000 to $260,000"; the extraction recorded
// 180000-240000). A further 1,884 postings state a range in the body that the extraction missed
// entirely. Verbatim text beats an interpretation of it.
//
// Deliberately conservative — it would rather return null than guess:
//   • requires a two-ended range; a lone figure is too easy to confuse with a bonus or 401k cap
//   • requires a salary-ish word within 200 chars, so revenue/funding/ARR figures don't qualify
//   • bounds each end to a plausible annual salary
//   • rejects the segment outright if equity/option language is closer than the salary cue
// "and" is a real separator in the wild — Helm.ai writes "base range of approximately $150,000
// and $250,000" — but it is also the most common word in English, so it only survives because
// every match still has to clear the pay-cue and disqualifier checks below.
const RE_RANGE = /\$\s?([\d,]{6,})(?:\.\d+)?\s*(?:to|through|and|-|–|—)\s*\$?\s?([\d,]{6,})(?:\.\d+)?/g;
// Bare "annual" is NOT a pay cue — "annual revenue grew from $200,000 to $900,000" would qualify.
// Every cue here has to be about paying a person.
const RE_PAY_CUE = /salary|compensation|base pay|base range|pay range|pay band|pay scale|per year|\/yr\b|\/year|OTE|total cash|earn/i;
const RE_DISQUALIFY = /equity|option|RSU|shares|401\(?k\)?|revenue|funding|valuation|raised|ARR|budget|contract value/i;
// A label that unambiguously introduces THIS number as pay for a person. Checked in the 60 chars
// immediately preceding the figure, so it can only apply to the range it actually precedes.
const RE_SALARY_LABEL = /(base\s+)?(salary|pay|compensation)\s*(range|band|scale)?\s*(for this (role|position))?\s*(is|:|of)?\s*$|base (salary|pay)\s*$|salary\s*$/i;
export function parseCompFromBody(text, { min = 40000, max = 900000 } = {}) {
  if (!text) return null;
  // Greenhouse renders a posted range as
  //   <div class="pay-range"><span>$150,000</span><span>&mdash;</span><span>$200,000 USD</span></div>
  // Leaving &mdash; undecoded meant the separator never matched, the range was missed, and
  // jd-comp.mjs fell through to the Stage-3 extractor's guess — manufacturing an `estimated`
  // band for a company that had published a real number in its own JD.
  const plain = String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[mn]dash;|&minus;|&#821[12];|&#x201[34];/gi, '-')
    .replace(/&amp;/g, '&');
  RE_RANGE.lastIndex = 0;
  const found = [];
  let m;
  while ((m = RE_RANGE.exec(plain)) !== null) {
    const lo = Number(m[1].replace(/,/g, '')), hiRaw = Number(m[2].replace(/,/g, ''));
    if (!(lo >= min && hiRaw <= max && hiRaw >= lo)) continue;
    const ctx = plain.slice(Math.max(0, m.index - 200), m.index + m[0].length + 200);
    if (!RE_PAY_CUE.test(ctx)) continue;
    // An EXPLICIT salary label immediately before the number settles it, and must win over the
    // proximity check below. Otherwise the near-universal JD sentence
    //   "…salary, equity, and a comprehensive benefits package. Base salary range: $160,700 - $231,000"
    // is rejected because "equity" happens to sit within the window — discarding a real, posted,
    // first-party range and letting the pipeline fall through to a model guess instead.
    // Some employers post a THREE-point band: "$88,200 - $110,200 - $132,200" (min / target /
    // max). Matching only the first pair recorded the MIDPOINT as the maximum, truncating the top
    // of the band by ~20% and understating every role at those companies.
    let hi = hiRaw;
    const tail3 = plain.slice(m.index + m[0].length, m.index + m[0].length + 24);
    const third = tail3.match(/^\s*[-–—]\s*\$?\s?([\d,]{6,})/);
    if (third) {
      const t = Number(third[1].replace(/,/g, ''));
      if (t >= hi && t <= max) hi = t;
    }

    const label = plain.slice(Math.max(0, m.index - 60), m.index);
    const labelled = RE_SALARY_LABEL.test(label);

    // Only when nothing labelled it: a figure sitting right next to equity, revenue or funding
    // language is not a salary, whichever word happens to come first.
    if (!labelled) {
      const near = plain.slice(Math.max(0, m.index - 90), m.index + m[0].length + 90);
      if (RE_DISQUALIFY.test(near)) continue;
    }

    // Currency must bind to THIS range, not to the paragraph. Plenty of JDs post both:
    //   "$180,000 to $240,000 USD ($175,000 to $245,000 CAD) per year"
    // A paragraph-wide search sees "CAD" and stamps it on the USD numbers — inflating a Canadian
    // band by ~35%. So look only in the ~28 chars trailing the digits, where the label actually sits.
    const tail = plain.slice(m.index + m[0].length, m.index + m[0].length + 28);
    const head = plain.slice(Math.max(0, m.index - 12), m.index);
    const local = `${head}${tail}`;
    const cur = /\bCAD\b|\bC\$/i.test(local) ? 'CAD' : /\bUSD\b|\bUS\$/i.test(local) ? 'USD' : null;
    found.push({ min: lo, max: hi, currency: cur });
  }
  if (!found.length) return null;
  // When a JD states the same pay in two currencies, take CAD — that's the currency this user is
  // actually paid in, so it needs no conversion and carries no FX assumption.
  return clean(found.find(f => f.currency === 'CAD') || found[0]);
}

// A comp bound of 0 means "not stated", never "this job pays nothing". Lever in particular emits
// 0 for an absent floor, which produced bands like `0-230000 CAD` and even `0-0 PHP` — the former
// distorts anything reading band.min, the latter is pure noise.
const num = (v) => (v == null || v === '' || Number(v) === 0 || Number.isNaN(Number(v))) ? null : Number(v);
function clean(c) {
  if (c.min != null && c.max != null && c.max < c.min) { const t = c.min; c.min = c.max; c.max = t; }
  return (c.min == null && c.max == null) ? null : c;
}

// ── loading & selection ─────────────────────────────────────────────
export function loadCompBands(path) {
  const byKey = new Map();
  if (!path || !existsSync(path)) return byKey;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    let row; try { row = JSON.parse(line); } catch { continue; }
    if (!row?.key || !row?.title_family) continue;        // no company-agnostic rows, ever
    if (!byKey.has(row.key)) byKey.set(row.key, []);
    byKey.get(row.key).push(row);
  }
  return byKey;
}

const daysBetween = (iso, nowMs) => {
  const t = Date.parse(iso || '');
  return Number.isNaN(t) ? null : (nowMs - t) / 86400000;
};

function demote(d) { return d === 'direct' ? 'inferred' : 'estimated'; }
function demoteConf(c) { return c === 'high' ? 'medium' : 'low'; }

// Pick the best band for a posting's (title_family, ladder_level).
//
// Order: best derivation tier available, then exact level → ±1 rung → any level in the family.
// ACROSS FAMILIES: null, always. Non-exact level matches are DEMOTED a derivation tier and a
// confidence step on the way out — a direct band for a neighbouring level is not a direct band
// for this level, and the extrapolation is itself an inference.
//
// `now` is injectable so callers stay deterministic in tests.
export function bandFor(rows, title_family, ladder_level, prefs = {}, now = Date.now()) {
  if (!rows?.length || !title_family) return null;
  const maxAge = prefs?.comp_band_max_age_days ?? 540;

  const inFamily = rows
    .filter(r => r.title_family === title_family && r.band)
    .map(r => {
      // Staleness is applied here (not in the pure scorer): an old band still counts, but it
      // can no longer claim high confidence.
      const age = daysBetween(r.provenance?.as_of, now);
      const stale = age != null && age > maxAge;
      return { ...r, _conf: stale ? 'low' : (r.provenance?.confidence || 'low'), _stale: stale };
    });
  if (!inFamily.length) return null;

  const di = LEVEL_LADDER.indexOf(String(ladder_level || '').toLowerCase());
  const rank = (r) => {
    const ri = LEVEL_LADDER.indexOf(String(r.ladder_level || '').toLowerCase());
    if (di < 0 || ri < 0) return r.ladder_level === ladder_level ? 0 : 9;
    return Math.abs(ri - di);
  };

  const best = inFamily
    .map(r => ({ r, dist: rank(r) }))
    // dist 0-2 = same/near rung; dist 9 = level unknown on one side, so the family band is the
    // only thing on offer. Both are usable, and everything non-exact gets demoted below.
    .filter(x => x.dist <= 2 || x.dist === 9)
    .sort((a, b) =>
      (DERIVATION_RANK[b.r.derivation] || 0) - (DERIVATION_RANK[a.r.derivation] || 0)
      || a.dist - b.dist
      || (CONFIDENCE_RANK[b.r._conf] || 0) - (CONFIDENCE_RANK[a.r._conf] || 0)
      || (b.r.provenance?.sample_size || 0) - (a.r.provenance?.sample_size || 0)
      || String(b.r.provenance?.as_of || '').localeCompare(String(a.r.provenance?.as_of || ''))
    )[0];
  if (!best) return null;

  const { r, dist } = best;
  const exact = dist === 0;
  return {
    ...r.band,
    derivation: exact ? r.derivation : demote(r.derivation),
    confidence: exact ? r._conf : demoteConf(r._conf),
    sample_size: r.provenance?.sample_size ?? 0,
    title_family: r.title_family,
    ladder_level: r.ladder_level,
    source: exact ? r.provenance?.source : 'ladder_extrapolation',
    as_of: r.provenance?.as_of || null,
    model: r.provenance?.model || null,
    stale: !!r._stale,
    method: exact
      ? (r.provenance?.method || null)
      : `${dist === 9 ? "posting's level unknown; using this company's" : `${dist} rung(s) from the`} ${r.ladder_level} band`
        + (r.provenance?.method ? ` (${r.provenance.method})` : ''),
  };
}

// ── validation ──────────────────────────────────────────────────────
// Used by the server route, --apply-comp, and doctor.mjs so every write path enforces the same
// contract. Returns an array of human-readable problems; empty means valid.
export function validateBandRow(row, { families = [] } = {}) {
  const errs = [];
  const p = row?.provenance || {};
  if (!row?.key) errs.push('missing key (no company-agnostic rows)');
  if (!row?.title_family) errs.push('missing title_family (no role-agnostic rows)');
  else if (families.length && !families.includes(row.title_family)) errs.push(`unknown title_family "${row.title_family}"`);
  if (row?.ladder_level && !LEVEL_LADDER.includes(row.ladder_level)) errs.push(`unknown ladder_level "${row.ladder_level}"`);
  if (!DERIVATIONS.includes(row?.derivation)) errs.push(`derivation must be one of ${DERIVATIONS.join('|')}`);

  const spec = SOURCES[p.source];
  if (!spec) errs.push(`unknown source "${p.source}"`);
  else if (spec.derivation && spec.derivation !== row?.derivation) {
    errs.push(`source "${p.source}" implies derivation "${spec.derivation}", got "${row?.derivation}"`);
  }

  const cited = (p.source_urls || []).length > 0;
  const derived = (p.derived_from || []).length > 0;
  if (spec?.cite === 'url' && !cited) errs.push(`source "${p.source}" requires provenance.source_urls`);
  if (spec?.cite === 'derived_from' && !derived) errs.push(`source "${p.source}" requires provenance.derived_from`);
  if (p.source === 'llm_prior' && !p.model) errs.push('llm_prior requires provenance.model (a prior is a claim about a specific model)');
  if (row?.derivation === 'estimated' && p.confidence !== 'low') errs.push('estimated bands must be confidence: low');

  const b = row?.band || {};
  if (b.min == null && b.max == null && b.mid == null) errs.push('band has no numbers');
  if (b.component && !COMPONENTS.includes(b.component)) errs.push(`component must be one of ${COMPONENTS.join('|')}`);
  if (p.confidence && !CONFIDENCE_RANK[p.confidence]) errs.push(`confidence must be high|medium|low`);
  // The prompt states this rule; without enforcement a single data point could claim `high`.
  if (p.confidence === 'high' && (p.sample_size ?? 0) < 3) errs.push('confidence: high requires provenance.sample_size >= 3');
  if (!p.as_of) errs.push('missing provenance.as_of');
  // Format matters more than it looks: daysBetween() returns null for an unparseable date, so
  // as_of: "today" would silently disable staleness and let the band keep high confidence forever.
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.as_of))) errs.push(`provenance.as_of must be YYYY-MM-DD, got "${p.as_of}"`);
  return errs;
}
