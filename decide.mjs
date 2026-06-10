#!/usr/bin/env node
// decide.mjs (NEW) — Stage 4: YOUR keep/skip decision over the LLM's research reports.
//
// This is the ONLY manual step. It does no research — it just records your call on companies
// the LLM has already web-researched (Stage 3). Decisions live in the personal layer and drive
// generate-watchlist.mjs.
//
//   node decide.mjs --list [N]          # companies researched (have llm_fit) but undecided, by score
//   node decide.mjs keep <key|name>...  # mark keep  (→ watchlist on next generate-watchlist)
//   node decide.mjs skip <key|name>...  # mark skip
//
// After deciding: node generate-watchlist.mjs && node scan.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');

function load() {
  const out = [];
  if (existsSync(PERSONAL)) for (const l of readFileSync(PERSONAL, 'utf-8').split('\n')) { if (l) try { out.push(JSON.parse(l)); } catch {} }
  return out;
}
const save = (rows) => writeFileSync(PERSONAL, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
const norm = (s) => String(s).toLowerCase().trim();

function main() {
  const args = process.argv.slice(2);
  const rows = load();

  if (args[0] === '--list') {
    const n = Number(args[1]) || 40;
    const pending = rows.filter(p => p.decision === 'undecided' && p.llm_fit != null && !p.excluded_by_type)
      .sort((a, b) => b.llm_fit - a.llm_fit);
    console.log(`${pending.length} companies researched & awaiting your decision (top ${Math.min(n, pending.length)}):`);
    for (const p of pending.slice(0, n)) {
      console.log(`  [${p.llm_fit}/5] ${p.name}  (${p.key})`);
      if (p.fit_brief) console.log(`        report: ${p.fit_brief}`);
    }
    console.log(`\nDecide:  node decide.mjs keep "<name>" ...   |   node decide.mjs skip "<name>" ...`);
    return;
  }

  const action = args[0];
  if (action !== 'keep' && action !== 'skip') {
    console.error('Usage: node decide.mjs --list [N] | keep <key|name>... | skip <key|name>...');
    process.exit(1);
  }
  const targets = args.slice(1).map(norm);
  let n = 0;
  for (const p of rows) {
    if (targets.includes(norm(p.key)) || targets.includes(norm(p.name))) {
      p.decision = action; p.last_reviewed = p.last_reviewed || 'set'; n++;
      console.error(`  ${action}: ${p.name}`);
    }
  }
  if (!n) { console.error('No matching companies (use the exact name or key from --list).'); process.exit(1); }
  save(rows);
  console.error(`✓ ${action} applied to ${n} company(ies). Run: node generate-watchlist.mjs`);
}
main();
