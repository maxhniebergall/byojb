#!/usr/bin/env node
// dedupe-companies.mjs — find company keys that are the SAME EMPLOYER registered twice.
//
// One employer commonly appears under several keys: three Workday tenants (hpe/acjobsite,
// hpe/jobsathpe, hpe/wfmathpe), a second Greenhouse board (upbound + upboundext), a board on a
// different ATS entirely (ashby:openly + greenhouse:openly), or a stale test board
// (greenhouse:wekatest). Each duplicate costs a research slot, splits fit and comp data across
// keys, and inflates every company-level aggregate.
//
// Detection is by EVIDENCE, not by name. Names are unreliable in both directions here: the
// registry stores raw ATS slugs ("hpe", "upboundext"), scraper artifacts ("Company Background
// Planet"), and outright wrong names ("Real Artists" for Real Brokerage) — while genuinely
// different companies share names ("Stratus" the MEP-construction SaaS vs Stratus Technologies).
// So a pair is only reported when their POSTINGS coincide:
//
//   • requisition-id overlap — the strongest signal. HPE publishes the same req across three
//     tenants with only a -1/-2/-3 suffix, so the ids match once the suffix is stripped.
//   • title+location overlap — two boards listing the same roles in the same places.
//
// A name similarity alone is never sufficient, but it is used to RANK and to explain.
//
//   node dedupe-companies.mjs                  # report candidate groups
//   node dedupe-companies.mjs --json           # machine-readable
//   node dedupe-companies.mjs --apply          # record every detected LIVE duplicate as an alias
//   node dedupe-companies.mjs --apply pairs.json   # record human-supplied groups too
//
// Applying writes ALIASES, never a merge. data/company-aliases.jsonl maps a duplicate key to the
// canonical one; no company row is edited or deleted, so a wrong call is undone by deleting a line.
// Detection cannot see every case — a subsidiary on its own ATS (Counterpoint Health under Clover
// Health) shares neither slug nor requisition ids — so a human can supply groups directly:
//
//   [{ "canonical": "greenhouse:cloverhealth",
//      "aliases": ["bamboohr:counterpoint"],
//      "note": "Counterpoint Health is a Clover Health subsidiary; boards carry the same roles" }]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const C_PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');
export const ALIASES_PATH = join(ROOT, 'data', 'company-aliases.jsonl');

function loadJsonl(p) {
  const out = [];
  if (!existsSync(p)) return out;
  for (const l of readFileSync(p, 'utf-8').split('\n')) if (l) try { out.push(JSON.parse(l)); } catch {}
  return out;
}

// A requisition id as the employer means it, with ATS-added disambiguation removed. HPE's
// R-1201852-1 / -2 / -3 are one req syndicated to three tenants, so the trailing -N must go.
export function reqId(url) {
  const s = decodeURIComponent(String(url || ''));
  // ALPHA-PREFIXED ids only. A bare numeric id is not employer-specific: distinct Workday tenants
  // reuse the same numbers, which grouped Finning with DLA Piper, Rocket and QTS on nothing more
  // than a coincidental integer.
  const m = s.match(/(?:^|[_/-])((?:R|REQ|JR|JOB)[-_]?\d{4,})/i);      // R12345, REQ006824, JR011958
  if (!m) return null;
  return m[1].toUpperCase().replace(/[-_]/g, '').replace(/-\d$/, '');
}

// Strip the parts of a slug that identify a BOARD rather than a COMPANY.
export function slugCore(key) {
  // A malformed key (a scraped job title that landed in the company slot, e.g.
  // "workday:Senior-Manager--Workplace-Experience_R013703") must not collapse into a short core
  // that then matches unrelated companies.
  const slug = String(key).split(':').slice(1).join(':');
  return slug
    .split('/')[0]                                    // workday tenant, not the site
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^internaljobsat|^jobsat|^careersat|^workat/, '')
    .replace(/(ext|external|test|staging|inc|llc|corp|careers|jobs|hq|global)$/g, '');
}

// Names are corroboration, never proof. Used only to separate two hiring entities that SHARE an
// ATS tenant: workday:salesforce/slack, workday:relx/risksolutions (LexisNexis) and
// workday:bullish/coindesk are real, distinct employers renting the same Workday instance, and
// merging them would erase a genuine difference in who employs you and on what terms.
function nameKey(n) {
  return String(n || '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|group|holdings|company|co|plc|sa|gmbh|the)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function namesAgree(a, b) {
  const x = nameKey(a), y = nameKey(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const ax = new Set(x.split(' ').filter(Boolean)), by = new Set(y.split(' ').filter(Boolean));
  let inter = 0; for (const t of ax) if (by.has(t)) inter++;
  return inter / Math.min(ax.size, by.size) >= 0.5;
}

// alias key → canonical key. Consumers use this to treat several registrations as one employer.
export function loadAliases(path = ALIASES_PATH) {
  const by = new Map();
  if (!existsSync(path)) return by;
  for (const l of readFileSync(path, 'utf-8').split('\n')) {
    if (!l) continue;
    try { const r = JSON.parse(l); if (r?.alias && r?.canonical) by.set(r.alias, r.canonical); } catch {}
  }
  // Collapse chains (a→b, b→c ⇒ a→c) so a consumer never has to walk them, and a cycle cannot hang.
  for (const [alias] of by) {
    const seen = new Set([alias]);
    let cur = by.get(alias);
    while (by.has(cur) && !seen.has(cur)) { seen.add(cur); cur = by.get(cur); }
    by.set(alias, cur);
  }
  return by;
}

// Resolve a company key to the employer it belongs to.
export function canonicalKey(key, aliases) {
  return aliases.get(key) || key;
}

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  return inter / (a.size + b.size - inter);
};

function main() {
  const asJson = process.argv.includes('--json');
  // Two different problems wear the same shape, and blending them makes both unreadable:
  //   LIVE duplicates  — two boards BOTH carrying postings for one employer (HPE's three Workday
  //                      tenants, ashby:openly + greenhouse:openly). These split research, fit and
  //                      comp data, and are the ones worth merging.
  //   DEAD twins       — a live board beside empty registrations of the same slug, usually the
  //                      discovery pass probing one name across every ATS (`affinity` exists on six
  //                      providers, five with zero postings), or a board the company abandoned
  //                      (bamboohr:tailscale returns totalCount 0; Tailscale moved to Greenhouse).
  //                      These cost nothing at scoring time but clutter the registry.
  const includeDead = process.argv.includes('--include-dead');
  const research = loadJsonl(RESEARCH).filter(r => r?.company_key && r.live !== false);
  const personal = new Map();
  for (const c of loadJsonl(C_PERSONAL)) if (!personal.has(c.key)) personal.set(c.key, c);

  const byCompany = new Map();
  // Seed from the COMPANY registry, not only from postings. A duplicate whose board is empty --
  // bamboohr:tailscale returns totalCount 0 because Tailscale moved to Greenhouse -- has no
  // postings to coincide with, so a postings-only scan can never see it. Those are precisely the
  // stale registrations worth retiring, and they still occupy a key and a relevance_score.
  for (const c of personal.values()) {
    if (!byCompany.has(c.key)) {
      byCompany.set(c.key, { key: c.key, name: c.name || '', reqs: new Set(), roles: new Set(), n: 0 });
    }
  }
  for (const r of research) {
    if (!byCompany.has(r.company_key)) {
      byCompany.set(r.company_key, { key: r.company_key, name: r.company || '', reqs: new Set(), roles: new Set(), n: 0 });
    }
    const c = byCompany.get(r.company_key);
    c.n++;
    const id = reqId(r.url);
    if (id) c.reqs.add(id);
    const t = String(r.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (t) c.roles.add(`${t}|${String(r.location || '').toLowerCase().slice(0, 24)}`);
  }

  // Only compare companies that share a slug core or a requisition id — comparing all pairs is
  // O(n^2) over 4k companies and would surface coincidences rather than duplicates.
  const buckets = new Map();
  const add = (k, c) => { if (!buckets.has(k)) buckets.set(k, new Set()); buckets.get(k).add(c); };
  // Bucket by shared ROLE as well, or two companies that share only their postings are never even
  // compared — which is exactly the subsidiary case (Clover Health and Counterpart Health share no
  // slug and no requisition ids, only 5 identical openings).
  //
  // Skip roles that many companies post: "software engineer|remote" would bucket hundreds of
  // unrelated companies together and make this O(n^2) for no signal.
  const roleCompanies = new Map();
  for (const c of byCompany.values()) {
    for (const v of c.roles) {
      if (!roleCompanies.has(v)) roleCompanies.set(v, []);
      roleCompanies.get(v).push(c);
    }
  }
  const GENERIC_ROLE_COMPANIES = 8;
  for (const c of byCompany.values()) {
    add(`slug:${slugCore(c.key)}`, c);
    for (const id of c.reqs) add(`req:${id}`, c);
    for (const v of c.roles) {
      if ((roleCompanies.get(v) || []).length <= GENERIC_ROLE_COMPANIES) add(`role:${v}`, c);
    }
  }

  const pairs = new Map();
  for (const set of buckets.values()) {
    if (set.size < 2) continue;
    const list = [...set];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]].sort((x, y) => x.key.localeCompare(y.key));
        const pk = `${a.key} ${b.key}`;
        if (pairs.has(pk)) continue;
        const reqJ = jaccard(a.reqs, b.reqs);
        const roleJ = jaccard(a.roles, b.roles);
        const sameSlug = slugCore(a.key) === slugCore(b.key) && slugCore(a.key).length >= 3;
        // Evidence thresholds: a shared requisition is near-conclusive; shared roles need to be
        // substantial; a shared slug alone is only enough when it is also a real word-length slug.
        // A shared slug core is the reliable signal — it is the employer's own handle on the ATS,
        // and it survives across providers (ashby:openly / greenhouse:openly) and across board
        // variants (upbound / upboundext). Requisition or role overlap ALONE is not enough:
        // corporate families syndicate reqs between distinct hiring entities (RELX and LexisNexis,
        // Salesforce and Slack), and merging those would erase real differences in who employs you
        // and where. So overlap must be corroborated, and only near-total overlap stands by itself.
        // Sharing a tenant is not sharing an employer. Require the names to agree, or the actual
        // ROLES to coincide — a subsidiary on the parent's tenant posts its own distinct jobs,
        // while a duplicate board posts the same ones.
        // Requisition overlap is NOT corroboration here: a corporate family numbers reqs centrally,
        // so RELX and LexisNexis, Maersk and APM Terminals, Bullish and CoinDesk all share ids
        // while being separate employers. Only agreeing names, or a role list that is essentially
        // the same list, distinguish a duplicated board from a sibling business unit.
        const shared = [...a.roles].filter(v => b.roles.has(v)).length;
        const corroborated = namesAgree(a.name, b.name) || roleJ >= 0.7;
        // An EMPTY board can't overlap with anything, so it needs its own rule: same slug core and
        // agreeing names, with one side holding no live postings at all. That is a dead
        // registration, not a sibling business unit.
        // Exactly one side empty. Two empty registrations are not evidence of anything -- 28k of
        // the registry has no live postings, and pairing them by slug alone produced 2,575 bogus
        // groups. The informative case is a LIVE board beside a dead twin.
        const deadBoard = sameSlug && namesAgree(a.name, b.name) && ((a.n === 0) !== (b.n === 0));
        // Three or more IDENTICAL postings, at high overlap, is the same employer on two boards --
        // and it is the only thing that catches a differently-named subsidiary. Counterpart Health
        // carries 5 of Clover Health's 7 live roles, title and location identical, but shares no
        // slug with its parent and no requisition ids (Greenhouse ids are numeric, so reqJ is 0).
        //
        // The count matters more than the ratio. Two companies with two generic openings each --
        // heycar and Happl both list "Backend Engineer" and "Senior Backend Engineer" -- score a
        // perfect 1.00 by coincidence. Requiring THREE shared postings rejects every such pair
        // here while keeping Clover/Counterpart, HPE, Abbott, Williams, Aveva and Wynd Labs.
        const sharedPostings = shared >= 3 && roleJ >= 0.7;
        if ((sameSlug && (reqJ > 0 || roleJ > 0) && corroborated) || (reqJ >= 0.5 && roleJ >= 0.5) || sharedPostings || deadBoard) {
          pairs.set(pk, { a, b, reqJ, roleJ, sameSlug, deadBoard });
        }
      }
    }
  }

  // Merge pairs into connected groups so HPE's three tenants report as one group, not three pairs.
  const parent = new Map();
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  for (const { a, b } of pairs.values()) {
    for (const k of [a.key, b.key]) if (!parent.has(k)) parent.set(k, k);
    const [ra, rb] = [find(a.key), find(b.key)];
    if (ra !== rb) parent.set(ra, rb);
  }
  const groups = new Map();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(k);
  }

  const out = [...groups.values()]
    .filter(g => g.length > 1)
    .filter(g => includeDead || g.every(k => (byCompany.get(k)?.n || 0) > 0))
    .map(keys => {
      const members = keys.map(k => {
        const c = byCompany.get(k), p = personal.get(k) || {};
        return { key: k, name: c.name, live: c.n, llm_rank: p.llm_rank ?? null, llm_fit: p.llm_fit ?? null, decision: p.decision || 'undecided' };
      }).sort((x, y) => y.live - x.live);
      // Keep the key with the most live postings, then the one already researched — it holds the
      // dossier and the human decision.
      const canonical = members.slice().sort((x, y) =>
        (y.llm_fit != null) - (x.llm_fit != null) || y.live - x.live)[0];
      return { canonical: canonical.key, members };
    })
    .sort((a, b) => b.members.length - a.members.length);

  if (asJson) { console.log(JSON.stringify(out, null, 2)); return; }

  const applyIdx = process.argv.indexOf('--apply');
  if (applyIdx !== -1) {
    // Detected groups, plus any the human supplied. Detection cannot see a subsidiary on its own
    // ATS — Counterpoint Health under Clover Health shares no slug, no requisition ids and no
    // titles — so the file is how a person contributes knowledge the data does not contain.
    const groups = out.map(g => ({ canonical: g.canonical, aliases: g.members.map(m => m.key).filter(k => k !== g.canonical), note: 'detected: shared slug + coinciding postings' }));
    const file = process.argv[applyIdx + 1];
    if (file && !file.startsWith('--')) {
      for (const g of JSON.parse(readFileSync(file, 'utf-8'))) {
        if (!g?.canonical || !Array.isArray(g.aliases)) continue;
        groups.push({ canonical: g.canonical, aliases: g.aliases, note: g.note || 'manual' });
      }
    }
    const existing = loadAliases();
    const rows = [];
    const at = new Date().toISOString();
    let added = 0;
    for (const g of groups) {
      for (const alias of g.aliases) {
        if (alias === g.canonical) continue;
        if (existing.get(alias) === g.canonical) continue;      // already recorded
        rows.push(JSON.stringify({ alias, canonical: g.canonical, note: g.note, at }));
        added++;
      }
    }
    // Append-only: an alias file that is rewritten loses the human-supplied entries that detection
    // cannot reproduce. Latest line wins on re-read.
    const prior = existsSync(ALIASES_PATH) ? readFileSync(ALIASES_PATH, 'utf-8') : '';
    writeFileSync(ALIASES_PATH, prior + (rows.length ? rows.join('\n') + '\n' : ''), 'utf-8');
    console.log(`✓ ${added} alias(es) recorded → ${ALIASES_PATH}`);
    console.log('  re-run `node score-postings.mjs && node company-aggregates.mjs` to fold them in');
    return;
  }
  const label = includeDead ? 'duplicate/stale group(s)' : 'live duplicate group(s)';
  console.log(`${out.length} ${label} across ${out.reduce((n, g) => n + g.members.length, 0)} keys`);
  if (!includeDead) console.log('(pass --include-dead to also list empty boards sharing a live board\'s slug)');
  console.log('');
  for (const g of out) {
    console.log(`▸ keep ${g.canonical}`);
    for (const m of g.members) {
      const mark = m.key === g.canonical ? ' *' : '  ';
      console.log(`   ${mark} ${m.key.padEnd(46)} ${String(m.live).padStart(4)} live  rank ${String(m.llm_rank ?? '-').padStart(2)}  fit ${String(m.llm_fit ?? '-').padStart(2)}  ${m.name}`);
    }
    console.log('');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
