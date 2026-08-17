// Prints N cached JD bodies (with key + sk + company/title) for facet extraction.
// Usage: node dump-jd-batch.mjs <count> [offset]  — only rank>=3, has_body, not yet extracted.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sk } from './posting-core.mjs';

// The banner a truncated body MUST carry. Exported and asserted in test-all.mjs so the loud
// failure can never be quietly softened back into a silent `.slice()`.
export const TRUNCATION_BANNER = '!! BODY TRUNCATED — FACETS FROM THIS POSTING ARE INCOMPLETE !!';
export const truncationBanner = (key, len, cap) => [
  '',
  '█'.repeat(72),
  TRUNCATION_BANNER,
  `   posting: ${key}`,
  `   ${len - cap} of ${len} chars withheld (cap ${cap}).`,
  '   Benefits, PTO and salary bands sit at the END of a JD — they are what a cap eats first.',
  `   Re-dump with:  --max-body ${len + 1000}`,
  '█'.repeat(72),
].join('\n');

// BODIES ARE NEVER TRUNCATED IN NORMAL OPERATION. 100k is a catastrophic-bug guard (a corrupted
// or runaway body file), not a budget — the longest real JD seen is ~20k chars, so nothing
// legitimate comes close. Do not lower this to "save tokens": a 6000-char cap once silently
// removed the benefits block from 41 of 168 postings, and every one of them recorded
// `pto_policy: "unclear"` for a policy that was sitting in the file. See TRUNCATION_BANNER.
export const MAX_BODY_DEFAULT = 100000;

// Everything below is the CLI. Guarded so test-all.mjs can import the constants above
// without reading data files or printing a dump.
const IS_CLI = process.argv[1] && process.argv[1].endsWith('dump-jd-batch.mjs');
if (!IS_CLI) { /* imported for constants only */ } else {

const ROOT = process.cwd();
const load = (f) => existsSync(f) ? readFileSync(f, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const research = load(join(ROOT, 'data', 'posting-research.jsonl'));
const personal = load(join(ROOT, 'data', 'postings-personal.jsonl'));
const rByKey = new Map(research.map(r => [r.key, r]));

const count = Number(process.argv[2] || 12);
const offset = Number(process.argv[3] || 0);

// --max-body overrides the cap; --tail <n> prints only the LAST n chars, to re-read the end of a
// body whose head has already been extracted without paying for the whole thing again.
const mi = process.argv.indexOf('--max-body');
const MAX_BODY = mi >= 0 ? Number(process.argv[mi + 1]) : MAX_BODY_DEFAULT;
const ti = process.argv.indexOf('--tail');
const TAIL = ti >= 0 ? Number(process.argv[ti + 1]) : 0;

// --stale re-extracts postings that ALREADY have facets, but whose body has been replaced since
// those facets were read. The score is computed from the facts, not the text, so such a posting
// carries a confident number derived from a JD that is no longer on disk — exactly the Stripe
// failure (facts read off a truncated body) with no symptom to notice.
//
// `body_fetched_at > extracted_at` is the durable test. The `body_src && !extracted_at` clause
// catches the 368 rows refreshed by the corpus pass that ran BEFORE those timestamps existed;
// it can be dropped once those are drained.
const stale = process.argv.includes('--stale');
const isStale = (r) => r?.extracted && (
  (r.body_fetched_at && r.extracted_at && r.body_fetched_at > r.extracted_at) ||
  (r.body_src && !r.extracted_at)
);

// --keys <file> dumps an EXPLICIT list of keys (one per line) instead of an offset window.
//
// Offsets are unsafe for parallel agents: the queue is defined by a predicate, so applying one
// agent's batch shrinks the set and slides every other agent's window. In wave 1 that gave two
// agents overlapping slices — 80 extractions produced only 60 distinct postings, and the offsets
// nobody landed on were skipped entirely. An explicit key list is stable no matter what else is
// being applied concurrently.
const ki = process.argv.indexOf('--keys');
const keyFile = ki >= 0 ? process.argv[ki + 1] : null;
const wanted = keyFile ? new Set(readFileSync(keyFile, 'utf-8').split('\n').map(s => s.trim()).filter(Boolean)) : null;

const todo = wanted
  ? personal.filter(p => wanted.has(p.key))
  : personal
      .filter(p => rByKey.get(p.key)?.live !== false && p.decision === 'undecided' && (p.llm_rank ?? 0) >= 3)
      .filter(p => { const r = rByKey.get(p.key); return r?.has_body && (stale ? isStale(r) : !r?.extracted); })
      .sort((a, b) => (b.llm_rank - a.llm_rank))
      .slice(offset, offset + count);

const truncated = [];
for (const p of todo) {
  const r = rByKey.get(p.key);
  const path = join(ROOT, 'data', 'posting-research', sk(p.key) + '.md');
  const body = existsSync(path) ? readFileSync(path, 'utf-8') : '(missing)';
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('KEY: ' + p.key);
  console.log('SK: ' + sk(p.key));
  console.log('COMPANY: ' + (r.company || '') + '  |  TITLE: ' + (r.title || ''));
  // The LOCATION field outranks the body when reading geo_eligibility (see modes/research-jobs.md),
  // so it has to travel with the text, not be looked up separately.
  console.log('LOCATION: ' + (r.location || '(none)') + '  |  COMP: ' + (r.comp ? JSON.stringify(r.comp) : '(none)'));
  console.log('───────────────────────────────────────────────────────────────');
  // Print the WHOLE body. A silent `.slice(0, 6000)` used to live here, and it recreated the
  // Stripe failure described above one layer up: benefits blocks sit at the END of a JD, so the
  // cap quietly removed exactly the text that carries pto_policy, benefits and often the salary
  // band. 41 of 168 postings in one pass recorded `pto_policy: "unclear"` for facts that were
  // present in the file and never reached the reader. If a cap is ever reintroduced it must
  // announce itself — extraction cannot flag an omission it has no way to see.
  const text = body.split('\n').slice(2).join('\n');
  if (TAIL) {
    console.log(text.length > TAIL ? `[… head omitted …]\n${text.slice(-TAIL)}` : text);
    continue;
  }
  if (text.length > MAX_BODY) {
    console.log(text.slice(0, MAX_BODY));
    console.log(truncationBanner(p.key, text.length, MAX_BODY));
    truncated.push(p.key);
  } else {
    console.log(text);
  }
}
console.error(`dumped ${todo.length} (offset ${offset})`);
// Repeat the alarm on stderr so it survives being piped/tailed away, and fail the process:
// a truncated dump must never be mistaken for a complete one by whatever consumes it.
if (truncated.length) {
  console.error(`\n!! ${truncated.length} BODY/BODIES TRUNCATED — DO NOT EXTRACT FACETS FROM THIS DUMP !!`);
  for (const k of truncated) console.error(`   ${k}`);
  process.exit(3);
}

}  // end IS_CLI
