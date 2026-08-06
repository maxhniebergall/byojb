// Deterministic geo classifier for remaining rank>=3, has_body, not-extracted postings.
// Buckets each as 'canada', 'global', or 'blocked' based on location + body text signals.
// Usage: node triage-geo.mjs [emit]   (emit prints keys of canada+global, best first)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sk } from './posting-core.mjs';

const ROOT = process.cwd();
const load = (f) => existsSync(f) ? readFileSync(f, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const research = load(join(ROOT, 'data', 'posting-research.jsonl'));
const personal = load(join(ROOT, 'data', 'postings-personal.jsonl'));
const rByKey = new Map(research.map(r => [r.key, r]));

const CA_CITIES = /\b(canada|canadian|\bCAN\b|toronto|vancouver|montreal|montr[ée]al|ottawa|calgary|edmonton|waterloo|kitchener|mississauga|winnipeg|halifax|victoria|quebec|qu[ée]bec|ontario|british columbia|alberta|manitoba|saskatchewan|nova scotia|newfoundland)\b/i;
const CA_ABBR = /,\s*(ON|BC|QC|AB|MB|SK|NS|NB|NL|PE)\b/;
const GLOBAL = /\b(work from anywhere|anywhere in the world|worldwide|globally remote|fully remote|remote[- ]first|remote, global|any location|location[- ]?agnostic)\b/i;
const US_ONLY = /\b(must reside (in|within).{0,40}(united states|u\.?s\.?a?\b)|within \d+ miles of|us[- ]based only|must be (located|based) in the (us|united states)|authorized to work in the (us|united states)|no immigration[- ]related sponsorship|GM does not provide immigration)\b/i;
const NON_CA_COUNTRY = /\b(india|bangalore|bengaluru|hyderabad|pune|noida|ahmedabad|chennai|gurgaon|gurugram|mumbai|poland|krak[oó]w|warsaw|mazowieckie|romania|cluj|bucharest|serbia|belgrade|spain|madrid|barcelona|brazil|s[aã]o paulo|mexico|germany|netherlands|united kingdom|england|london|ireland|dublin|france|paris|singapore|japan|tokyo|australia|philippines|manila|costa rica|colombia|argentina|portugal|lisbon)\b/i;

function classify(r) {
  const path = join(ROOT, 'data', 'posting-research', sk(r.key) + '.md');
  const body = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  const head = body.split('\n').slice(0, 6).join(' ');       // title + url + location line
  const text = body.slice(0, 4000);
  const hay = head + ' ' + text;
  // location line is line 3 (index 2) as "Location: ..."
  const locLine = (body.split('\n')[2] || '');
  const inCA = CA_CITIES.test(locLine) || CA_ABBR.test(locLine);
  const nonCA = NON_CA_COUNTRY.test(locLine);
  const usOnly = US_ONLY.test(hay);
  const global = GLOBAL.test(hay);
  if (inCA && !nonCA) return { b: 'canada', score: 3 };
  if (global && !usOnly && !nonCA) return { b: 'global', score: 2 };
  if (nonCA || usOnly) return { b: 'blocked', score: 0 };
  // remote with no explicit country restriction, and no non-CA city → possible
  if (/remote/i.test(locLine) || /remote/i.test(head)) return { b: 'global', score: 1 };
  return { b: 'unknown', score: 1 };
}

const todo = personal
  .filter(p => rByKey.get(p.key)?.live !== false && p.decision === 'undecided' && (p.llm_rank ?? 0) >= 3)
  .filter(p => { const r = rByKey.get(p.key); return r?.has_body && !r?.extracted; });

const buckets = { canada: [], global: [], blocked: [], unknown: [] };
for (const p of todo) {
  const r = rByKey.get(p.key);
  const c = classify(r);
  buckets[c.b].push({ key: p.key, score: c.score, company: r.company, title: r.title });
}

if (process.argv[2] === 'emit') {
  const out = [...buckets.canada, ...buckets.global].sort((a, b) => b.score - a.score);
  console.log(out.map(x => x.key).join('\n'));
} else {
  for (const k of ['canada', 'global', 'unknown', 'blocked']) {
    console.error(`\n=== ${k.toUpperCase()} (${buckets[k].length}) ===`);
    for (const x of buckets[k].slice(0, k === 'blocked' ? 0 : 60)) console.error(`  ${x.company} — ${x.title}`);
  }
  console.error(`\ntotals: canada=${buckets.canada.length} global=${buckets.global.length} unknown=${buckets.unknown.length} blocked=${buckets.blocked.length}`);
}
