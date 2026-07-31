#!/usr/bin/env node
// title-family.mjs — normalize a raw job title into (title_family, ladder_level).
//
// Pay bands are only comparable WITHIN a role family: a senior backend band says nothing about
// a senior data-scientist band at the same company. So every band in data/company-comp.jsonl is
// keyed by (company, title_family, ladder_level), and this module is the single place that
// derives that pair from the messy title strings the ATSs actually publish.
//
// PURE — Node builtins only, no I/O, no deps. Safe to import from the browser bundle, the
// scorer, and the ingest scripts alike (same contract as posting-core.mjs).

// Ordered IC ladder (people-management is off-ladder). Defined HERE rather than in
// score-postings.mjs because that module imports this one — the ladder is the lower-level
// concept. score-postings re-exports it, so its existing importers are unaffected.
export const LEVEL_LADDER = ['junior', 'mid', 'mid-senior', 'senior', 'staff', 'principal'];

// Coarse enough that most companies have several postings per family (thin samples make
// useless bands), fine enough that the bands within one are actually comparable.
export const TITLE_FAMILIES = [
  'backend', 'frontend', 'fullstack', 'platform_infra', 'data_eng', 'ml_eng',
  'data_science', 'security', 'sre_devops', 'mobile', 'qa', 'eng_manager',
  'software_general', 'other',
];

// Ordered — FIRST HIT WINS, so the more specific patterns must come first. "Senior ML
// Infrastructure Engineer" is ml_eng, not platform_infra; "Data Platform Engineer" is data_eng,
// not platform_infra. Ordering is the whole design here; resist the urge to sort these.
const FAMILY_PATTERNS = [
  ['eng_manager', /\b(engineering manager|eng manager|manager,? (software|engineering|data|platform)|director of engineering|vp of engineering|head of engineering|team lead manager)\b/],
  // Explicit "data scientist" wins over the ml_eng rule below, whose \bai\b is broad enough to
  // swallow most of them ("Senior Data Scientist, AI Platform"). Analysis and model-shipping are
  // different jobs on different bands, so the more specific title must be checked first.
  ['data_science', /\b(data scientist|data science|decision scientist|quantitative (researcher|analyst)|statistician|econometric)\b/],
  ['ml_eng', /\b(machine learning|ml|mlops|deep learning|applied (ai|scientist|ml)|ai|llm|genai|generative ai|agentic|nlp|computer vision|research (engineer|scientist))\b/],
  ['data_eng', /\b(data engineer|data engineering|analytics engineer|etl|data platform|data infrastructure|data warehouse|bi engineer|database engineer)\b/],
  ['security', /\b(security|appsec|infosec|cryptograph|penetration test|red team|trust (and|&) safety engineer|iam engineer)\b/],
  ['sre_devops', /\b(sre|site reliability|devops|dev ops|production engineer|observability|platform reliability)\b/],
  ['mobile', /\b(ios|android|mobile|react native|flutter|swift|kotlin) (engineer|developer)\b|\b(ios|android|mobile) (engineer|developer)\b/],
  ['qa', /\b(qa|quality assurance|test engineer|sdet|automation engineer|test automation)\b/],
  ['platform_infra', /\b(platform|infrastructure|infra|cloud|systems|distributed systems|kernel|compiler|networking|storage|database internals|core engineer)\b/],
  ['frontend', /\b(frontend|front[- ]end|ui engineer|web developer|javascript developer|react developer)\b/],
  ['fullstack', /\b(full[- ]?stack|fullstack)\b/],
  ['backend', /\b(backend|back[- ]end|server[- ]side|api engineer|java developer|python developer|golang|go developer|rust developer|\.net developer|c# developer|ruby developer|php developer)\b/],
];

// A generic "Software Engineer" with nothing else to go on. Deliberately NOT mapped to backend:
// guessing a specialty we don't know would put a band in a bucket it doesn't belong to, and a
// wrong-family band is worse than none (bandFor returns null across families on purpose).
// It gets its OWN family rather than falling into `other`, because most companies run a single
// generic SWE band and those postings are genuinely comparable — whereas `other` is a junk
// drawer (recruiters, enrollment specialists, sales engineers) whose members share nothing.
const RE_GENERIC_SWE = /\b(software|application|applications) (engineer|developer|development engineer)\b|\bprogrammer\b|\bsde\b|\bswe\b/;

export function titleFamily(rawTitle, ex = {}) {
  const t = String(rawTitle || '').toLowerCase();
  const hay = [t, ...(ex?.technologies || []), ...(ex?.languages || []), ex?.domain || '']
    .join(' ').toLowerCase();
  for (const [family, re] of FAMILY_PATTERNS) {
    if (re.test(t)) return family;
  }
  // Only if the title itself was uninformative do we let the extracted facets break the tie —
  // the title is the stronger signal and must never be overridden by a stray tech keyword.
  if (RE_GENERIC_SWE.test(t)) {
    for (const [family, re] of FAMILY_PATTERNS) {
      if (family !== 'eng_manager' && re.test(hay)) return family;
    }
    return 'software_general';
  }
  return 'other';
}

// ── level aliases ───────────────────────────────────────────────────
// Companies encode level in the title with their own ladder tokens. These map the COMMON
// conventions; a company whose ladder disagrees (an L5 that means staff, not senior) records
// its own `ladder_map` on the band row rather than getting special-cased here.
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
const NUMERIC_RUNGS = {           // the near-universal L/IC/E/P/T-number convention
  1: 'junior', 2: 'mid', 3: 'mid-senior', 4: 'senior', 5: 'senior', 6: 'staff', 7: 'principal', 8: 'principal',
};
const ALIAS_PATTERNS = [
  // Sun/Oracle-lineage "Member of Technical Staff" ladder, still used across infra companies.
  [/\b(distinguished|fellow)\b/, () => 'principal'],
  [/\b(pmts|principal member of (the )?technical staff)\b/, () => 'principal'],
  [/\b(smts|senior member of (the )?technical staff)\b/, () => 'senior'],
  [/\b(mts|member of (the )?technical staff)\b/, () => 'mid-senior'],
  // L5 / IC4 / E5 / P4 / T4 / G6 — a letter prefix plus a rung number.
  [/\b(?:l|ic|e|p|t|g)[- ]?([1-8])\b/, (m) => NUMERIC_RUNGS[Number(m[1])] || null],
  // SDE II / Engineer III / Software Engineer 2 — a trailing rung, roman or arabic.
  [/\b(?:engineer|developer|sde|swe|scientist)\s+(i{1,3}|iv|v)\b/, (m) => NUMERIC_RUNGS[ROMAN[m[1]]] || null],
  [/\b(?:engineer|developer|sde|swe|scientist)\s+([1-6])\b/, (m) => NUMERIC_RUNGS[Number(m[1])] || null],
];

export function levelAlias(rawTitle) {
  const t = String(rawTitle || '').toLowerCase();
  for (const [re, fn] of ALIAS_PATTERNS) {
    const m = t.match(re);
    if (m) { const lvl = fn(m); if (lvl) return lvl; }
  }
  return null;
}

// ── level from years of experience ──────────────────────────────────
// EXTRACTED from levelMatch() in score-postings.mjs so there is exactly one definition of the
// yoe→rung thresholds. levelMatch imports this; do not re-inline the numbers there.
export function levelFromYoe(yoe) {
  if (yoe == null || Number.isNaN(Number(yoe))) return null;
  const y = Number(yoe);
  return y >= 8 ? 'staff' : y >= 5 ? 'senior' : y >= 3 ? 'mid-senior' : 'mid';
}

// Plain-English level words in the title. Checked AFTER levelAlias (an explicit ladder token
// beats an adjective) but BEFORE yoe (a stated level beats an inference from a requirements line).
const WORD_PATTERNS = [
  [/\b(principal|distinguished|fellow)\b/, 'principal'],
  [/\bstaff\b/, 'staff'],
  [/\b(senior|sr\.?|lead|tech lead)\b/, 'senior'],
  [/\b(mid[- ]senior|intermediate)\b/, 'mid-senior'],
  [/\b(junior|jr\.?|entry[- ]level|associate|new grad|graduate|intern)\b/, 'junior'],
];

// The single entry point. Returns the pair every comp band is keyed by, plus WHICH signal
// decided the level — callers record it as provenance, since a level read off an explicit
// "L5" is a far stronger claim than one guessed from a yoe floor.
export function normalizeTitle(rawTitle, ex = {}) {
  const title = String(rawTitle || '');
  const t = title.toLowerCase();
  const title_family = titleFamily(title, ex);

  let ladder_level = null, source = null;

  const alias = levelAlias(title);
  if (alias) { ladder_level = alias; source = 'alias'; }

  if (!ladder_level) {
    const sen = String(ex?.seniority || '').toLowerCase();
    if (LEVEL_LADDER.includes(sen)) { ladder_level = sen; source = 'seniority'; }
  }

  if (!ladder_level) {
    for (const [re, lvl] of WORD_PATTERNS) {
      if (re.test(t)) { ladder_level = lvl; source = 'title_words'; break; }
    }
  }

  if (!ladder_level) {
    const fromYoe = levelFromYoe(ex?.yoe_min);
    if (fromYoe) { ladder_level = fromYoe; source = 'yoe'; }
  }

  return { title_family, ladder_level, level_raw: title, source };
}
