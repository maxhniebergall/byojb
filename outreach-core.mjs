// outreach-core.mjs — canonical contact + outreach-thread records.
//
// BYOJB tracks postings and submitted applications, but direct outreach needs two things
// neither of those model: a PERSON, and a MESSAGE THREAD with that person. Outreach usually
// precedes an application and often exists with no application at all, so these live in their
// own registries rather than as fields on applications.jsonl.
//
//   data/contacts.jsonl  — one row per person (SOURCE OF TRUTH)
//   data/outreach.jsonl  — one row per thread with one contact (SOURCE OF TRUTH)
//   data/outreach.md     — GENERATED from outreach.jsonl via syncOutreachMd(); never hand-edit
//
// Consumers: web/server.mjs (Outreach + Contacts tabs, Chrome-extension LinkedIn capture).
// Keep dependency-light (Node built-ins + the existing shared helpers) — never call an LLM here.

import { writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadJsonl, saveJsonl, canonicalUrl } from './posting-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
// BYOJB_OUTREACH_DIR redirects the registries at a scratch directory. Mirrors the BYOJB_TRACKER
// escape hatch in application-core.mjs; the test suite uses it so it never touches real data.
const DATA_DIR = process.env.BYOJB_OUTREACH_DIR || join(ROOT, 'data');
export const CONTACTS_JSONL = join(DATA_DIR, 'contacts.jsonl');
export const OUTREACH_JSONL = join(DATA_DIR, 'outreach.jsonl');
export const OUTREACH_MD = join(DATA_DIR, 'outreach.md');

export const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const norm = (s) => String(s ?? '').toLowerCase().trim();

// ── controlled vocabularies ─────────────────────────────────────────
// archetype + relationship are the two fields that actually predict conversion (a former
// colleague vouching is a "strong" referral; a cold DM to a stranger is a "weak" one that
// internal ATS tooling tags as unverified), so they're structured, not buried in notes.
export const ARCHETYPES = ['hiring_manager', 'recruiter', 'peer_engineer', 'exec', 'alumni', 'former_colleague', 'other'];
// connected_1 / connected_2 mirror LinkedIn's 1st/2nd-degree distance. Note these describe network
// DISTANCE, not how well someone knows your work — you can be 1st-degree with a stranger who
// accepted a connect request. They are therefore not strong ties; use former_colleague/warm_intro
// when the person can actually vouch for you.
export const RELATIONSHIPS = ['former_colleague', 'warm_intro', 'alumni', 'shared_employer', 'connected_1', 'connected_2', 'cold'];
export const CHANNELS = ['linkedin_dm', 'linkedin_connect', 'email', 'hn_thread', 'referral_ask', 'intro_request', 'other'];
export const INTENTS = ['direct_pitch', 'informational', 'referral_ask', 'reconnect', 'recruiter_profile'];
export const OUTCOMES = ['', 'no_response', 'declined', 'referred', 'intro_made', 'screen_scheduled', 'converted_to_application'];

// A "strong" referral comes from someone who can vouch from direct working history; everything
// else is a sourcing lead. Surfaced in the UI so the expected payoff is honest up front.
export const STRONG_RELATIONSHIPS = ['former_colleague', 'warm_intro'];
export const isStrongTie = (relationship) => STRONG_RELATIONSHIPS.includes(relationship);

// How visible this person is on LinkedIn at all. A dormant contact will simply never see the
// message, so it's worth knowing BEFORE spending the personalization effort a good pitch needs.
export const ACTIVITY_LEVELS = ['unknown', 'active', 'occasional', 'dormant'];

const oneOf = (list, value, fallback) => list.includes(String(value || '')) ? String(value) : fallback;
export const validateArchetype = (v) => oneOf(ARCHETYPES, v, 'other');
export const validateRelationship = (v) => oneOf(RELATIONSHIPS, v, 'cold');
export const validateActivity = (v) => oneOf(ACTIVITY_LEVELS, v, 'unknown');

// Relevance: 0–5 on the same scale as the posting rubric, so it reads the same everywhere.
// null means UNRATED, which is deliberately distinct from 0 ("rated, and not worth pursuing") —
// collapsing the two would make an untouched contact look actively rejected.
export function validateRelevance(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(0, Math.round(n * 10) / 10));
}
export const validateChannel = (v) => oneOf(CHANNELS, v, 'other');
export const validateIntent = (v) => oneOf(INTENTS, v, 'direct_pitch');
export const validateOutcome = (v) => oneOf(OUTCOMES, v, '');

// ── outreach lifecycle ──────────────────────────────────────────────
// Mirrors the CANONICAL_STATES pattern in application-core.mjs.
export const OUTREACH_STATES = ['Drafted', 'Sent', 'Followed Up', 'Responded', 'Referred', 'Converted', 'No Response', 'Closed'];

const STATUS_ALIASES = {
  draft: 'Drafted', drafted: 'Drafted', queued: 'Drafted',
  sent: 'Sent', messaged: 'Sent', contacted: 'Sent',
  'followed up': 'Followed Up', followup: 'Followed Up', 'follow up': 'Followed Up', 'follow-up': 'Followed Up', bumped: 'Followed Up',
  responded: 'Responded', replied: 'Responded', response: 'Responded',
  referred: 'Referred', referral: 'Referred', intro: 'Referred',
  converted: 'Converted', applied: 'Converted',
  'no response': 'No Response', ghosted: 'No Response', silent: 'No Response',
  closed: 'Closed', dead: 'Closed', declined: 'Closed',
};

// Normalize any status string to a canonical label (defaults to Drafted with a warning).
export function validateOutreachStatus(status) {
  const clean = String(status || '').replace(/\*\*/g, '').trim();
  const lower = clean.toLowerCase();
  for (const valid of OUTREACH_STATES) if (valid.toLowerCase() === lower) return valid;
  if (STATUS_ALIASES[lower]) return STATUS_ALIASES[lower];
  if (clean) console.warn(`⚠️  Non-canonical outreach status "${status}" → defaulting to "Drafted"`);
  return 'Drafted';
}

// A thread is "in play" while a reply is still plausible or an outcome is still pending.
export const OPEN_OUTREACH_STATUSES = ['Drafted', 'Sent', 'Followed Up', 'Responded', 'Referred'];
export const isOpenOutreach = (status) => OPEN_OUTREACH_STATUSES.includes(status);

// ── keys ────────────────────────────────────────────────────────────
const hash8 = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8);

// Deterministic contact key. Prefer the most identity-stable handle available: a LinkedIn
// profile slug survives job changes and name spellings; email is next; a company+name pair is
// the last resort (and is the one that can collide, hence the hash suffix).
export function contactKey({ linkedin_url = '', email = '', company_key = '', name = '' } = {}) {
  const li = linkedInSlug(linkedin_url);
  if (li) return `li:${li}`;
  if (email) return `em:${norm(email)}`;
  const n = norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!n) return '';
  const co = norm(company_key).replace(/[^a-z0-9:]+/g, '-');
  return `pn:${co ? co + ':' : ''}${n}-${hash8(`${co}|${n}`)}`;
}

// "https://www.linkedin.com/in/jane-doe-123/?foo=1" → "jane-doe-123"
export function linkedInSlug(url) {
  const m = String(url || '').match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).toLowerCase() : '';
}

// ── jsonl io ────────────────────────────────────────────────────────
export function loadContacts() { return loadJsonl(CONTACTS_JSONL); }
export function saveContacts(rows) { saveJsonl(CONTACTS_JSONL, rows); }
export function loadOutreach() { return loadJsonl(OUTREACH_JSONL); }
export function saveOutreach(rows) { saveJsonl(OUTREACH_JSONL, rows); }

// ── contacts ────────────────────────────────────────────────────────
// Merge-preserving upsert, same semantics as upsertApplication: a partial patch stays partial
// and never blanks a field you already filled in by hand.
export function upsertContact(key, patch = {}) {
  const rows = loadContacts();
  let row = rows.find(r => r.key === key);
  if (!row) {
    row = {
      key, name: '', company_key: '', company: '', title: '',
      archetype: 'other', relationship: 'cold',
      relevance: null, activity: 'unknown',
      linkedin_url: '', email: '', phone: '', source: 'manual', notes: '',
      first_seen: today(), last_updated: '',
    };
    rows.push(row);
  }
  const clean = { ...patch };
  for (const k of Object.keys(clean)) if (clean[k] === undefined) delete clean[k];
  if ('archetype' in clean) clean.archetype = validateArchetype(clean.archetype);
  if ('relationship' in clean) clean.relationship = validateRelationship(clean.relationship);
  if ('activity' in clean) clean.activity = validateActivity(clean.activity);
  if ('relevance' in clean) clean.relevance = validateRelevance(clean.relevance);
  delete clean.key; delete clean.first_seen;
  Object.assign(row, clean);
  row.last_updated = today();
  saveContacts(rows);
  return row;
}

// Find an existing person by any identity handle before minting a new one — the extension
// re-captures the same profile often, and duplicate people wreck the thread history.
export function resolveContact({ key = '', linkedin_url = '', email = '', company_key = '', name = '' } = {}) {
  const rows = loadContacts();
  if (key) { const hit = rows.find(r => r.key === key); if (hit) return hit; }
  const li = linkedInSlug(linkedin_url);
  if (li) { const hit = rows.find(r => linkedInSlug(r.linkedin_url) === li); if (hit) return hit; }
  if (email) { const hit = rows.find(r => norm(r.email) === norm(email)); if (hit) return hit; }
  if (name) {
    const hit = rows.find(r => norm(r.name) === norm(name) && (!company_key || norm(r.company_key) === norm(company_key)));
    if (hit) return hit;
  }
  return null;
}

// ── outreach threads ────────────────────────────────────────────────
// A person can be approached more than once over a search (different role, months later), so
// thread keys are `${contact_key}#${seq}` rather than one row per person.
export function nextThreadKey(contact_key, rows = loadOutreach()) {
  const prefix = `${contact_key}#`;
  const max = rows.reduce((m, r) => {
    if (!String(r.key || '').startsWith(prefix)) return m;
    return Math.max(m, Number(String(r.key).slice(prefix.length)) || 0);
  }, 0);
  return `${prefix}${max + 1}`;
}

// Merge-preserving upsert. `patch.message` APPENDS to messages[] rather than replacing it —
// the follow-up history is the whole point of the record, so it is never clobbered wholesale.
export function upsertOutreach(key, patch = {}) {
  const rows = loadOutreach();
  let row = rows.find(r => r.key === key);
  if (!row) {
    row = {
      key, contact_key: String(key).split('#')[0] || '', company_key: '', posting_key: '', application_key: '',
      channel: 'other', intent: 'direct_pitch', status: 'Drafted', messages: [],
      // A PREPARED message that has not been sent. Deliberately separate from messages[]:
      // that log is a record of what actually happened, and a draft hasn't happened yet.
      // markSent() is the only thing that moves text from one to the other.
      draft: '', scheduled_for: '',
      outcome: '', next_action: '', next_action_date: '', notes: '',
      created_at: nowIso(), last_updated: '',
    };
    rows.push(row);
  }
  const { message, status, ...rest } = patch;
  for (const k of Object.keys(rest)) if (rest[k] === undefined) delete rest[k];
  if ('channel' in rest) rest.channel = validateChannel(rest.channel);
  if ('intent' in rest) rest.intent = validateIntent(rest.intent);
  if ('outcome' in rest) rest.outcome = validateOutcome(rest.outcome);
  if ('posting_key' in rest && rest.posting_key) rest.posting_key = canonicalUrl(rest.posting_key);
  if ('messages' in rest) delete rest.messages; // only `message` may touch the log
  delete rest.key; delete rest.created_at;
  Object.assign(row, rest);

  if (message) {
    row.messages = row.messages || [];
    row.messages.push({
      direction: message.direction === 'in' ? 'in' : 'out',
      sent_at: message.sent_at || nowIso(),
      body: String(message.body || ''),
      note: String(message.note || ''),
    });
  }
  if (status) row.status = validateOutreachStatus(status);
  row.last_updated = nowIso();
  saveOutreach(rows);
  return row;
}

// ── send-day scheduling ─────────────────────────────────────────────
// Cold outreach lands best on Tue/Wed/Thu mornings, so drafts are written whenever you have the
// context and queued for the next good slot. This is a DEFAULT, not a restriction — any date is
// accepted, and nothing here sends anything.
export const DEFAULT_SEND_DAYS = ['tue', 'wed', 'thu'];
const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
export const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseSendDays(list) {
  const out = (Array.isArray(list) ? list : [])
    .map(d => DAY_INDEX[String(d).slice(0, 3).toLowerCase()])
    .filter(n => Number.isInteger(n));
  return out.length ? [...new Set(out)].sort((a, b) => a - b) : parseSendDays(DEFAULT_SEND_DAYS);
}

// Local-time date parts, never toISOString() — that shifts to UTC and can hand back "yesterday"
// for anyone west of Greenwich, which would quietly file a draft under the wrong day.
export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
// Noon anchor keeps DST transitions from rolling the date over.
export const parseDate = (s) => new Date(`${s}T12:00:00`);
export const weekdayOf = (s) => isValidDate(s) ? parseDate(s).getDay() : null;

// The next allowed send day on or after `from` (so drafting on a Tuesday can go out that morning).
export function nextSendDay(from = isoDate(), days = DEFAULT_SEND_DAYS) {
  const allowed = parseSendDays(days);
  const start = isValidDate(from) ? parseDate(from) : new Date();
  for (let i = 0; i < 14; i++) {
    const c = new Date(start);
    c.setDate(start.getDate() + i);
    if (allowed.includes(c.getDay())) return isoDate(c);
  }
  return isoDate(start);
}

export function isSendDay(dateStr, days = DEFAULT_SEND_DAYS) {
  const w = weekdayOf(dateStr);
  return w != null && parseSendDays(days).includes(w);
}

// Prepare (or re-edit) a message without sending it. Keeps the thread in Drafted.
export function saveDraft(key, { draft, scheduled_for } = {}) {
  const patch = {};
  if (draft !== undefined) patch.draft = String(draft);
  if (scheduled_for !== undefined) patch.scheduled_for = isValidDate(scheduled_for) ? scheduled_for : '';
  return upsertOutreach(key, patch);
}

// You sent it yourself; record that. The draft becomes an outbound message in the log, the draft
// slot empties, and the status advances. Nothing here contacts anyone — BYOJB never sends.
export function markSent(key, { body, sent_at } = {}) {
  const row = loadOutreach().find(r => r.key === key);
  if (!row) return null;
  const text = String(body ?? row.draft ?? '').trim();
  if (!text) return null;
  // A second outbound message on an already-Sent thread is a follow-up, not a first contact.
  const status = row.status === 'Drafted' ? 'Sent' : row.status === 'Sent' ? 'Followed Up' : row.status;
  return upsertOutreach(key, {
    message: { direction: 'out', body: text, sent_at: sent_at || nowIso() },
    status, draft: '', scheduled_for: '',
  });
}

// Link a thread to the application it produced. Called after POST /api/application/create.
export function linkApplication(outreach_key, application_key) {
  return upsertOutreach(outreach_key, {
    application_key,
    status: 'Converted',
    outcome: 'converted_to_application',
  });
}

// Last outbound / last inbound message timestamps — the raw material the UI uses to show
// "N days since you last wrote". Purely informational; nothing here nags or schedules.
export function threadTiming(row) {
  const msgs = row.messages || [];
  const last = (dir) => {
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].direction === dir) return msgs[i].sent_at || '';
    return '';
  };
  const lastOut = last('out');
  const days = lastOut ? Math.floor((Date.now() - Date.parse(lastOut)) / 86400000) : null;
  return { last_out: lastOut, last_in: last('in'), days_since_out: Number.isFinite(days) ? days : null, message_count: msgs.length };
}

// ── outreach.md generation ──────────────────────────────────────────
const HEADER = [
  '# Outreach',
  '',
  '<!-- GENERATED from data/outreach.jsonl by outreach-core.mjs — do not edit by hand. -->',
  '',
  '| Contact | Company | Role / Posting | Archetype | Tie | Channel | Intent | Status | Msgs | Last sent | Next action |',
  '|---------|---------|----------------|-----------|-----|---------|--------|--------|------|-----------|-------------|',
];

// Render pipes as " / " so naive markdown-table parsers never mis-split a cell (same rule
// application-core.mjs uses for titles like "OpenTelemetry | Canada | Remote").
const cell = (s) => String(s ?? '').replace(/\s*\|\s*/g, ' / ').replace(/\n/g, ' ').trim() || '—';

export function renderOutreachRow(r, contact = {}, postingTitle = '') {
  const t = threadTiming(r);
  const name = contact.linkedin_url ? `[${cell(contact.name || r.contact_key)}](${contact.linkedin_url})` : cell(contact.name || r.contact_key);
  return `| ${name} | ${cell(contact.company || r.company_key)} | ${cell(postingTitle)} | ${cell(contact.archetype)} | ${isStrongTie(contact.relationship) ? 'strong' : 'weak'} | ${cell(r.channel)} | ${cell(r.intent)} | ${cell(r.status)} | ${t.message_count} | ${cell((t.last_out || '').slice(0, 10))} | ${cell(r.next_action)} |`;
}

// Regenerate outreach.md from the jsonl rows (most recently touched first).
export function syncOutreachMd(rows = loadOutreach(), contacts = loadContacts(), postingTitles = new Map()) {
  const byContact = new Map(contacts.map(c => [c.key, c]));
  const sorted = [...rows].sort((a, b) => String(b.last_updated || '').localeCompare(String(a.last_updated || '')));
  const out = [...HEADER, ...sorted.map(r => renderOutreachRow(r, byContact.get(r.contact_key) || {}, postingTitles.get(r.posting_key) || '')), ''].join('\n');
  writeFileSync(OUTREACH_MD, out);
  return sorted.length;
}

// Convenience for callers that want the md to reflect real posting titles without wiring up
// the postings registry themselves.
export function syncOutreachMdWithPostings() {
  const POST_RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
  const titles = new Map();
  if (existsSync(POST_RESEARCH)) {
    const wanted = new Set(loadOutreach().map(r => r.posting_key).filter(Boolean));
    if (wanted.size) for (const p of loadJsonl(POST_RESEARCH)) if (wanted.has(p.key)) titles.set(p.key, p.title || '');
  }
  return syncOutreachMd(loadOutreach(), loadContacts(), titles);
}
