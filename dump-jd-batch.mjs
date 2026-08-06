// Prints N cached JD bodies (with key + sk + company/title) for facet extraction.
// Usage: node dump-jd-batch.mjs <count> [offset]  — only rank>=3, has_body, not yet extracted.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sk } from './posting-core.mjs';

const ROOT = process.cwd();
const load = (f) => existsSync(f) ? readFileSync(f, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const research = load(join(ROOT, 'data', 'posting-research.jsonl'));
const personal = load(join(ROOT, 'data', 'postings-personal.jsonl'));
const rByKey = new Map(research.map(r => [r.key, r]));

const count = Number(process.argv[2] || 12);
const offset = Number(process.argv[3] || 0);

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

for (const p of todo) {
  const r = rByKey.get(p.key);
  const path = join(ROOT, 'data', 'posting-research', sk(p.key) + '.md');
  const body = existsSync(path) ? readFileSync(path, 'utf-8') : '(missing)';
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('KEY: ' + p.key);
  console.log('SK: ' + sk(p.key));
  console.log('COMPANY: ' + (r.company || '') + '  |  TITLE: ' + (r.title || ''));
  console.log('───────────────────────────────────────────────────────────────');
  console.log(body.split('\n').slice(2).join('\n').slice(0, 6000));
}
console.error(`dumped ${todo.length} (offset ${offset})`);
