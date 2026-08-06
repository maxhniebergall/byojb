// Dumps cached JD bodies for a list of keys (from a file, one key per line).
// Usage: node dump-jd-keys.mjs <keyfile> <count> <offset>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sk } from './posting-core.mjs';

const ROOT = process.cwd();
const load = (f) => existsSync(f) ? readFileSync(f, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const rByKey = new Map(load(join(ROOT, 'data', 'posting-research.jsonl')).map(r => [r.key, r]));

const keys = readFileSync(process.argv[2], 'utf-8').split('\n').filter(Boolean);
const count = Number(process.argv[3] || 12);
const offset = Number(process.argv[4] || 0);

for (const key of keys.slice(offset, offset + count)) {
  const r = rByKey.get(key) || {};
  const path = join(ROOT, 'data', 'posting-research', sk(key) + '.md');
  const body = existsSync(path) ? readFileSync(path, 'utf-8') : '(missing)';
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('KEY: ' + key);
  console.log('COMPANY: ' + (r.company || '') + '  |  TITLE: ' + (r.title || ''));
  console.log('───────────────────────────────────────────────────────────────');
  console.log(body.split('\n').slice(2).join('\n').slice(0, 5500));
}
console.error(`dumped ${Math.min(count, keys.length - offset)} of ${keys.length}`);
