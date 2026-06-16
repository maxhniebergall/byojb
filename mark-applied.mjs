#!/usr/bin/env node
// mark-applied.mjs — record/update an application from the terminal (manual fallback to
// the Chrome extension's automatic submit-capture). Writes data/applications.jsonl (the
// source of truth) and regenerates data/applications.md.
//
//   node mark-applied.mjs <key|url|"company"> [--cv output/x.pdf] [--apply-url URL] \
//        [--status Applied] [--recruiter "Name <email>"] [--confirmation "..."] [--note "..."]
//   node mark-applied.mjs status <key|url|"company"> <Status>   # change status (appends timeline)
//   node mark-applied.mjs --list [N]                            # recent applications
//   node mark-applied.mjs --migrate                             # import applications.md rows → jsonl
//   node mark-applied.mjs --sync                                # regenerate applications.md from jsonl

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  loadApplications, upsertApplication, resolveKey, syncTrackerMd, migrateFromMd,
  validateStatus, CANONICAL_STATES,
} from './application-core.mjs';
import { loadJsonl, deriveCompanyKey } from './posting-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const POST_RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');

// "Name <email@x.com>" | "Name, +1-555" | "email@x.com" → {name,email,phone}
function parseRecruiter(s) {
  const out = { name: '', email: '', phone: '' };
  if (!s) return out;
  const em = s.match(/[\w.+-]+@[\w.-]+\.\w+/);
  if (em) out.email = em[0];
  const ph = s.match(/\+?[\d][\d\s().-]{6,}/);
  if (ph) out.phone = ph[0].trim();
  out.name = s.replace(/<[^>]*>/g, '').replace(out.email, '').replace(out.phone, '').replace(/[,;]/g, ' ').trim();
  return out;
}

// Pull --flag value pairs and positional args out of argv.
function parseArgs(argv) {
  const flags = {}; const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { flags[a.slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
    else pos.push(a);
  }
  return { flags, pos };
}

function printList(n) {
  const rows = loadApplications().sort((a, b) =>
    String(b.date_applied || '').localeCompare(String(a.date_applied || '')) || (b.tracker_num - a.tracker_num));
  console.log(`${rows.length} applications (showing ${Math.min(n, rows.length)}):`);
  for (const r of rows.slice(0, n)) {
    const rec = r.recruiter?.name || r.recruiter?.email || '';
    console.log(`  #${r.tracker_num} [${r.status}] ${r.company} — ${r.title}  (${r.date_applied || '?'})${rec ? '  ↳ ' + rec : ''}`);
    if (r.apply_url) console.log(`        ${r.apply_url}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const { flags, pos } = parseArgs(argv);

  if (flags.migrate) { const n = migrateFromMd(); syncTrackerMd(); console.log(`✓ migrated ${n} row(s) from applications.md → applications.jsonl`); return; }
  if (flags.sync) { const n = syncTrackerMd(); console.log(`✓ regenerated applications.md (${n} rows)`); return; }
  if (flags.list || pos[0] === '--list') { printList(Number(flags.list) || Number(pos[1]) || 30); return; }

  // status <target> <Status>
  if (pos[0] === 'status') {
    const key = resolveKey(pos[1]);
    if (!key) { console.error(`No match for "${pos[1]}". Use the exact key/url or a company name.`); process.exit(1); }
    const status = validateStatus(pos[2] || '');
    const row = upsertApplication(key, { status });
    syncTrackerMd();
    console.error(`✓ #${row.tracker_num} ${row.company || key} → ${row.status}`);
    return;
  }

  const target = pos[0];
  if (!target) {
    console.error('Usage: node mark-applied.mjs <key|url|"company"> [--cv path] [--apply-url URL] [--status S] [--recruiter "Name <email>"] [--confirmation X] [--note X]');
    console.error(`       node mark-applied.mjs status <target> <${CANONICAL_STATES.join('|')}>`);
    console.error('       node mark-applied.mjs --list [N] | --migrate | --sync');
    process.exit(1);
  }

  const key = resolveKey(target);
  if (!key) { console.error(`No match for "${target}". Pass the posting URL, the canonical key, or a company name from the registry.`); process.exit(1); }

  // Backfill company/title/apply_url from the postings registry when available.
  const r = loadJsonl(POST_RESEARCH).find(x => x.key === key) || {};
  const apply_url = flags['apply-url'] || r.apply_url || r.url || key;
  const patch = {
    status: flags.status || 'Applied',
    company: r.company || undefined,
    title: r.title || undefined,
    apply_url,
    company_key: r.company_key || deriveCompanyKey('', apply_url) || undefined,
  };
  if (flags.cv) patch.cv_pdf = flags.cv;
  if (flags.confirmation) patch.confirmation = flags.confirmation;
  if (flags.note) patch.notes = flags.note;
  if (flags.recruiter) patch.recruiter = parseRecruiter(flags.recruiter);
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];

  const row = upsertApplication(key, patch);
  syncTrackerMd();
  console.error(`✓ #${row.tracker_num} ${row.company || key} — ${row.title || ''} [${row.status}]`);
}

main();
