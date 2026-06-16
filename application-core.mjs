// application-core.mjs — canonical application records + applications.md sync.
//
// `data/applications.jsonl` is the SOURCE OF TRUTH for submitted/tracked applications
// (one record per application, keyed by canonicalUrl — the same join key the postings
// pipeline uses). `data/applications.md` is GENERATED from it via syncTrackerMd() so the
// committed human-readable tracker and the structured machine surface never drift.
//
// Consumers: mark-applied.mjs (CLI), web/server.mjs (Applications tab + extension submit),
// merge-tracker.mjs (batch eval additions). Keep dependency-light (Node built-ins + the
// existing shared helpers) — never call an LLM here.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { loadJsonl, saveJsonl, canonicalUrl } from './posting-core.mjs';
import { normalizeReportLink as normalizeLink } from './tracker-links.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const APPLICATIONS_JSONL = join(ROOT, 'data', 'applications.jsonl');
// Match merge-tracker.mjs: prefer data/applications.md, fall back to root layout.
export const APPLICATIONS_MD = process.env.CAREER_OPS_TRACKER
  ? process.env.CAREER_OPS_TRACKER
  : existsSync(join(ROOT, 'data/applications.md'))
    ? join(ROOT, 'data/applications.md')
    : join(ROOT, 'applications.md');
const POST_RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');

const TRACKER_DIR = dirname(APPLICATIONS_MD);
// reports/ lives at the repo root, which is the tracker's parent in the data/ layout.
const REPORTS_ROOT = basename(TRACKER_DIR) === 'data' ? dirname(TRACKER_DIR) : TRACKER_DIR;

// ── canonical states (single source of truth, mirrors templates/states.yml) ──
export const CANONICAL_STATES = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'];

const STATUS_ALIASES = {
  'evaluada': 'Evaluated', 'condicional': 'Evaluated', 'hold': 'Evaluated', 'evaluar': 'Evaluated', 'verificar': 'Evaluated',
  'aplicado': 'Applied', 'enviada': 'Applied', 'aplicada': 'Applied', 'applied': 'Applied', 'sent': 'Applied', 'submitted': 'Applied',
  'respondido': 'Responded',
  'entrevista': 'Interview',
  'oferta': 'Offer',
  'rechazado': 'Rejected', 'rechazada': 'Rejected',
  'descartado': 'Discarded', 'descartada': 'Discarded', 'cerrada': 'Discarded', 'cancelada': 'Discarded',
  'no aplicar': 'SKIP', 'no_aplicar': 'SKIP', 'skip': 'SKIP', 'monitor': 'SKIP', 'geo blocker': 'SKIP',
};

// An application "occupies a slot" at its company while it's still in play. Closing it
// (Rejected/Discarded/SKIP) frees the slot — this drives the per-company open-application cap.
export const OPEN_STATUSES = ['Applied', 'Responded', 'Interview', 'Offer'];
export const isOpen = (status) => OPEN_STATUSES.includes(status);

// Normalize any status string to a canonical label (defaults to Evaluated with a warning).
export function validateStatus(status) {
  const clean = String(status || '').replace(/\*\*/g, '').replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '').trim();
  const lower = clean.toLowerCase();
  for (const valid of CANONICAL_STATES) if (valid.toLowerCase() === lower) return valid;
  if (STATUS_ALIASES[lower]) return STATUS_ALIASES[lower];
  if (/^(duplicado|dup|repost)/i.test(lower)) return 'Discarded';
  if (clean) console.warn(`⚠️  Non-canonical status "${status}" → defaulting to "Evaluated"`);
  return 'Evaluated';
}

export const today = () => new Date().toISOString().slice(0, 10);
const norm = (s) => String(s ?? '').toLowerCase().trim();

// ── jsonl io ────────────────────────────────────────────────────────
export function loadApplications() { return loadJsonl(APPLICATIONS_JSONL); }
export function saveApplications(rows) { saveJsonl(APPLICATIONS_JSONL, rows); }

export function nextTrackerNum(rows) {
  return rows.reduce((m, r) => Math.max(m, Number(r.tracker_num) || 0), 0) + 1;
}

// Resolve a CLI/UI argument to a canonical application key.
// Accepts: a canonical key, a raw URL (→ canonicalUrl), or a company/title substring
// matched against the postings registry (then existing applications) — best-effort.
export function resolveKey(arg) {
  if (!arg) return '';
  const a = String(arg).trim();
  if (/^https?:\/\//i.test(a)) return canonicalUrl(a);
  const apps = loadApplications();
  const direct = apps.find(r => r.key === a);
  if (direct) return direct.key;
  const needle = norm(a);
  const research = loadJsonl(POST_RESEARCH);
  const hit = research.find(r => norm(r.company).includes(needle) || norm(r.title).includes(needle)
    || `${norm(r.company)} ${norm(r.title)}`.includes(needle));
  if (hit) return hit.key;
  const appHit = apps.find(r => norm(r.company).includes(needle) || norm(r.title).includes(needle));
  return appHit ? appHit.key : '';
}

// Merge-preserving upsert. Durable human fields (recruiter, confirmation, notes, report,
// score) survive; a status change appends to status_timeline. Returns the stored row.
export function upsertApplication(key, patch = {}) {
  const rows = loadApplications();
  let row = rows.find(r => r.key === key);
  const isNew = !row;
  if (isNew) {
    row = {
      key, tracker_num: nextTrackerNum(rows), company: '', company_key: '', title: '', apply_url: '',
      date_applied: '', cv_pdf: '', pdf: '', status: 'Applied', status_timeline: [],
      recruiter: { name: '', email: '', phone: '', notes: '' }, confirmation: '',
      submitted_fields: [], submitted_snapshot: '', report: '', score: null, notes: '', last_updated: '',
    };
    rows.push(row);
  }

  const nextStatus = patch.status ? validateStatus(patch.status) : row.status;
  if (nextStatus !== row.status || isNew) {
    row.status_timeline = row.status_timeline || [];
    row.status_timeline.push({ status: nextStatus, date: patch.date_applied || patch.date || today(), note: patch.status_note || '' });
  }

  // Shallow-merge recruiter so a partial recruiter patch keeps the other fields.
  const recruiter = patch.recruiter ? { ...row.recruiter, ...patch.recruiter } : row.recruiter;
  const { status, recruiter: _r, status_note, date, ...rest } = patch;
  // Never overwrite an existing field with undefined (partial patches stay partial).
  for (const k of Object.keys(rest)) if (rest[k] === undefined) delete rest[k];
  Object.assign(row, rest);
  row.recruiter = recruiter;
  row.status = nextStatus;
  if (!row.date_applied) row.date_applied = patch.date_applied || patch.date || today();
  row.last_updated = today();

  saveApplications(rows);
  return row;
}

// ── applications.md generation ──────────────────────────────────────
const HEADER = [
  '# Applications',
  '',
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
];

const scoreCell = (s) => (s == null || s === '') ? '—' : (/\/5$/.test(String(s)) ? String(s) : `${s}/5`);
// Prefer an explicit pdf cell (carried from batch-eval TSVs); else derive from cv_pdf.
const pdfCell = (r) => r.pdf || (r.cv_pdf ? '✅' : '❌');
// Render pipes as " / " (not escaped "\|") so naive markdown-table parsers — verify-pipeline,
// the lifecycle join in web/server.mjs — never mis-split a title like "OpenTelemetry | Canada | Remote".
const cell = (s) => String(s ?? '').replace(/\s*\|\s*/g, ' / ').replace(/\n/g, ' ').trim();

// Render a single application row in the canonical 9-column format, with the
// report link normalized relative to the tracker file's directory (#760).
export function renderRow(r) {
  const report = r.report ? normalizeLink(r.report, TRACKER_DIR, REPORTS_ROOT) : '';
  return `| ${r.tracker_num} | ${cell(r.date_applied)} | ${cell(r.company)} | ${cell(r.title)} | ${cell(scoreCell(r.score))} | ${cell(r.status)} | ${pdfCell(r)} | ${report} | ${cell(r.notes)} |`;
}

// Regenerate applications.md from the jsonl rows (sorted by tracker_num).
export function syncTrackerMd(rows = loadApplications()) {
  const sorted = [...rows].sort((a, b) => (Number(a.tracker_num) || 0) - (Number(b.tracker_num) || 0));
  const out = [...HEADER, ...sorted.map(renderRow), ''].join('\n');
  writeFileSync(APPLICATIONS_MD, out);
  return sorted.length;
}

// ── one-time migration: existing applications.md rows → applications.jsonl ──
// Idempotent: rows already present (by tracker_num) are skipped. Returns count imported.
export function migrateFromMd() {
  if (!existsSync(APPLICATIONS_MD)) return 0;
  const rows = loadApplications();
  const seen = new Set(rows.map(r => Number(r.tracker_num)));
  let imported = 0;
  for (const line of readFileSync(APPLICATIONS_MD, 'utf8').split('\n')) {
    if (!line.startsWith('|') || line.includes('---') || /\b#\b.*Date.*Company/.test(line)) continue;
    const c = line.split('|').map(s => s.trim());
    if (c.length < 10) continue;
    const num = parseInt(c[1], 10);
    if (!num || seen.has(num)) continue;
    const reportField = c[8] || '';
    rows.push({
      key: '', tracker_num: num, company: c[3] || '', title: c[4] || '',
      apply_url: '', date_applied: c[2] || '', cv_pdf: '', pdf: c[7] || '',
      status: validateStatus(c[6] || 'Evaluated'), status_timeline: [],
      recruiter: { name: '', email: '', phone: '', notes: '' }, confirmation: '',
      submitted_fields: [], submitted_snapshot: '', report: reportField,
      score: (c[5] && c[5] !== '—') ? c[5] : null, notes: c[9] || '', last_updated: today(),
    });
    seen.add(num);
    imported++;
  }
  if (imported) saveApplications(rows);
  return imported;
}
