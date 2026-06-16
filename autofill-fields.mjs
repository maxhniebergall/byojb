// autofill-fields.mjs — deterministic ATS form-field classification. NO LLM, ever.
//
// Maps a form field's visible label to an application-profile key and classifies it:
//   standard    — fillable from the application profile (name/email/phone/links/…)
//   file        — a file upload (resume); the extension can't set it for security → user attaches
//   free_text   — essay / cover-letter / long-answer → NOT auto-filled (captured on submit so a
//                 future feature can learn to draft from the corpus)
//   salary      — comp expectation → flagged for review, never auto-filled (negotiation)
//   demographic — EEO (gender/race/veteran/disability) → always left blank
//   unmapped    — a normal field with no mapping yet → the user assigns one in the popup
//
// Matching is plain lowercase substring/exact matching (NOT regex) so the whole map is
// JSON-serializable: web/server.mjs ships it to the Chrome extension verbatim, and both
// classify identically. Order matters — the first matching FIELD_MAP entry wins, so put
// specific labels (first/last name) before generic ones.

export const PROFILE_KEYS = [
  'first_name', 'last_name', 'full_name', 'email', 'phone',
  'linkedin', 'github', 'portfolio', 'website', 'location', 'city',
  'work_authorization', 'requires_sponsorship', 'willing_to_relocate',
  'years_experience', 'current_company', 'current_title', 'how_did_you_hear',
];

// `exact` matches the whole normalized label; `keywords` match as substrings.
export const FIELD_MAP = [
  { profile: 'first_name', keywords: ['first name', 'given name', 'forename'] },
  { profile: 'last_name', keywords: ['last name', 'surname', 'family name'] },
  { profile: 'full_name', exact: ['name', 'your name'], keywords: ['full name', 'legal name', 'candidate name'] },
  { profile: 'email', keywords: ['email', 'e-mail'] },
  { profile: 'phone', keywords: ['phone', 'mobile', 'telephone', 'cell number', 'cell phone'] },
  { profile: 'linkedin', keywords: ['linkedin'] },
  { profile: 'github', keywords: ['github'] },
  { profile: 'portfolio', keywords: ['portfolio'] },
  { profile: 'website', keywords: ['website', 'personal site', 'personal website', 'blog'] },
  { profile: 'location', keywords: ['location', 'where are you based', 'current location', 'street address', 'mailing address', 'city'] },
  { profile: 'work_authorization', keywords: ['authorized to work', 'work authorization', 'legally authorized', 'right to work', 'eligible to work', 'authorization to work'] },
  { profile: 'requires_sponsorship', keywords: ['require sponsorship', 'visa sponsorship', 'need sponsorship', 'sponsorship'] },
  { profile: 'willing_to_relocate', keywords: ['relocate', 'relocation'] },
  { profile: 'years_experience', keywords: ['years of experience', 'years experience', 'total experience', 'how many years'] },
  { profile: 'current_company', keywords: ['current company', 'current employer', 'present employer', 'most recent employer'] },
  { profile: 'current_title', keywords: ['current title', 'current role', 'job title', 'present title', 'current position'] },
  { profile: 'how_did_you_hear', keywords: ['how did you hear', 'referral source', 'how were you referred', 'where did you hear'] },
];

export const SALARY_KEYWORDS = ['salary', 'compensation expectation', 'compensation requirement', 'desired pay', 'pay expectation', 'expected pay', 'expected compensation', 'desired compensation', 'rate expectation', 'desired salary', 'expected salary'];
export const DEMOGRAPHIC_KEYWORDS = ['gender', 'race', 'ethnic', 'hispanic', 'latino', 'veteran', 'disab', 'sexual orientation', 'pronoun', 'transgender', 'national origin'];
export const FREE_TEXT_KEYWORDS = ['cover letter', 'why do you', 'why are you', 'why us', 'why this', 'why would you', 'tell us', 'in your own words', 'what makes you', 'additional information', 'anything else', 'motivat', 'open-ended', 'short answer', 'essay', 'describe a', 'describe your', 'tell me about'];

const FILE_KEYWORDS = ['resume', 'cv', 'cover letter file'];

// Normalize a raw label: lowercase, collapse whitespace, drop trailing * / : markers.
export function normLabel(label) {
  return String(label || '').toLowerCase().replace(/\s+/g, ' ').replace(/[*:]+\s*$/, '').trim();
}

// Classify one field. `userMap` is the user's saved label→profileKey overrides (wins).
export function classifyField(label, type = '', attrs = {}, userMap = {}) {
  const norm = normLabel(label);
  const t = String(type || '').toLowerCase();
  const hit = (arr) => arr.some(k => norm.includes(k));

  if (t === 'file' || (norm && (FILE_KEYWORDS.some(k => norm.includes(k)) && /upload|attach|file/i.test(norm + ' ' + t)))) {
    return { kind: 'file', profileKey: 'resume' };
  }
  if (!norm) return { kind: 'unmapped', profileKey: null };

  if (userMap && Object.prototype.hasOwnProperty.call(userMap, norm)) {
    return { kind: 'standard', profileKey: userMap[norm] };
  }
  // salary & demographic override everything (a salary textarea is still "review", not free_text)
  if (hit(SALARY_KEYWORDS)) return { kind: 'salary', profileKey: null };
  if (hit(DEMOGRAPHIC_KEYWORDS)) return { kind: 'demographic', profileKey: null };

  for (const e of FIELD_MAP) {
    if ((e.exact && e.exact.includes(norm)) || (e.keywords && e.keywords.some(k => norm.includes(k)))) {
      return { kind: 'standard', profileKey: e.profile };
    }
  }

  const longText = attrs && attrs.maxlength && Number(attrs.maxlength) > 200;
  if (t === 'textarea' || hit(FREE_TEXT_KEYWORDS) || longText) return { kind: 'free_text', profileKey: null };
  return { kind: 'unmapped', profileKey: null };
}

// Classify a whole form. `fields` = [{ label, name, type, required, maxlength? }].
// Returns the classified fields plus a verdict the popup uses to group them.
export function classifyForm(fields = [], userMap = {}) {
  const classified = fields.map(f => ({ ...f, ...classifyField(f.label, f.type, f, userMap) }));
  const counts = {};
  for (const f of classified) counts[f.kind] = (counts[f.kind] || 0) + 1;
  const requiredUnresolved = classified.filter(f => f.required && f.kind !== 'standard');
  return {
    fields: classified,
    counts,
    allStandard: classified.length > 0 && classified.every(f => f.kind === 'standard'),
    requiredUnresolved,
  };
}
