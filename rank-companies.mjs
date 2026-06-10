#!/usr/bin/env node
// rank-companies.mjs (NEW) — turn the raw survey into the persistent company registry.
//
// Splits into two layers joined on `key` (= "<provider>:<slug>"):
//   data/company-research.jsonl  — OBJECTIVE, shareable: counts + company_type + careers_url.
//                                  (self_description/stability/remote_policy added later by vetting.)
//   data/companies-personal.jsonl — PRIVATE: relevance_score, decision, llm_fit, fit_brief.
//
// company_type is an objective classification (product/consulting/outsourcing/staffing/unknown).
// The personal layer applies the user's rule "exclude consulting/outsourcing/staffing" → those
// stay in the landscape but never enter the vetting queue or watchlist. Re-running MERGES the
// personal layer so decisions/fit briefs survive a fresh survey. Zero-token, no LLM.
//
//   node rank-companies.mjs            # rebuild registry from data/survey/results.jsonl
//   node rank-companies.mjs --queue 40 # also print the top-N vetting queue

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(ROOT, 'data', 'survey', 'results.jsonl');
const CSV_DIR = join(ROOT, 'data', 'ats-companies');
const RESEARCH = join(ROOT, 'data', 'company-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');

const EXCLUDED_TYPES = new Set(['consulting', 'outsourcing', 'staffing']);

// Objective company_type heuristic — known services/consulting/outsourcing/staffing brands.
const TYPE_NAMES = [
  [/\b(accenture|deloitte|capgemini|pwc|kpmg|\bey\b|ernst\s*&\s*young|booz\s*allen|mckinsey|bain|bcg|slalom|thoughtworks|publicis\s*sapient)\b/i, 'consulting'],
  [/\b(cognizant|infosys|wipro|tata\s*consultancy|\btcs\b|hcl|tech\s*mahindra|mindtree|mphasis|ltimindtree|persistent\s*systems|virtusa|luxoft|epam|globant|endava|nagarro|dxc|atos|ntt\s*data|unisys|genpact|miratech|sigma\s*software|software\s*mind|gdit|leidos|saic|caci|ibm\s*consulting)\b/i, 'outsourcing'],
  [/\b(randstad|adecco|robert\s*half|insight\s*global|kforce|teksystems|aerotek|hays|manpower|kelly\s*services|blend360|collabera|apex\s*systems)\b/i, 'staffing'],
];
function detectType(name, samples) {
  for (const [re, type] of TYPE_NAMES) if (re.test(name)) return type;
  // generic services signals in the company NAME
  if (/\b(consult(ing|ancy)?|advisory)\b/i.test(name)) return 'consulting';
  if (/\b(outsourc\w*|it\s*services|managed\s*services|software\s*house|nearshore|offshore)\b/i.test(name)) return 'outsourcing';
  if (/\b(staffing|recruit(ing|ment)|talent\s*solutions|staffing\s*agency)\b/i.test(name)) return 'staffing';
  // services signal in the job titles
  const titles = (samples || []).join(' ').toLowerCase();
  if (/\bconsultant\b|\bclient\b|staff\s*aug/.test(titles)) return 'consulting';
  return 'unknown';
}

// careers_url comes from the ATS CSVs (slug→url); reconstruct a map per provider.
function loadCsvUrls() {
  const map = {};
  if (!existsSync(CSV_DIR)) return map;
  for (const f of readdirSync(CSV_DIR)) {
    if (!f.endsWith('.csv')) continue;
    const provider = f.replace(/\.csv$/, '');
    map[provider] = {};
    for (const line of readFileSync(join(CSV_DIR, f), 'utf-8').split('\n').slice(1)) {
      const p = line.split(',');
      const slug = (p[1] || '').trim();
      if (slug) map[provider][slug] = (p[2] || '').trim();
    }
  }
  return map;
}

function loadPersonal() {
  const prior = new Map();
  if (!existsSync(PERSONAL)) return prior;
  for (const line of readFileSync(PERSONAL, 'utf-8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(line); prior.set(r.key, r); } catch {}
  }
  return prior;
}

function seniorityBonus(samples) {
  return (samples || []).some(t => /senior|staff|principal|lead/i.test(t)) ? 1 : 0;
}

function main() {
  const urls = loadCsvUrls();
  const prior = loadPersonal();
  const rows = [];
  for (const l of readFileSync(RESULTS, 'utf-8').split('\n')) {
    if (!l) continue;
    try { rows.push(JSON.parse(l)); } catch {}  // tolerate a partial final line during a live survey
  }

  const research = [], personal = [];
  for (const r of rows) {
    if (r.error || !(r.relevant > 0)) continue;      // registry = companies with ≥1 relevant opening
    const key = `${r.provider}:${r.slug}`;
    const company_type = detectType(r.name, r.samples);
    research.push({
      key, provider: r.provider, slug: r.slug, name: r.name,
      careers_url: urls[r.provider]?.[r.slug] || '',
      total: r.total, relevant: r.relevant, remote_relevant: r.remote_ca,
      sample_titles: r.samples || [], company_type,
    });
    const prev = prior.get(key) || {};
    // remote-eligible relevant openings DOMINATE (his must-have). Non-remote `relevant`
    // is only a tiny tiebreaker, so a company with 0 remote openings can't rank high.
    const relevance_score = Number(((r.remote_ca || 0) + 0.5 * seniorityBonus(r.samples) + 0.01 * r.relevant).toFixed(2));
    personal.push({
      key,
      relevance_score,
      excluded_by_type: EXCLUDED_TYPES.has(company_type),
      decision: prev.decision || 'undecided',
      llm_fit: prev.llm_fit ?? null,
      fit_brief: prev.fit_brief || null,
      last_reviewed: prev.last_reviewed || null,
    });
  }

  research.sort((a, b) => b.remote_relevant - a.remote_relevant);
  // personal sorted by relevance, excluded types sink to the bottom
  personal.sort((a, b) => (a.excluded_by_type - b.excluded_by_type) || (b.relevance_score - a.relevance_score));

  writeFileSync(RESEARCH, research.map(r => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(PERSONAL, personal.map(r => JSON.stringify(r)).join('\n') + '\n');

  const excluded = personal.filter(p => p.excluded_by_type).length;
  const queue = personal.filter(p => !p.excluded_by_type && p.decision === 'undecided');
  console.log(`✓ registry: ${research.length} companies with relevant openings`);
  console.log(`  objective → ${RESEARCH}`);
  console.log(`  personal  → ${PERSONAL}`);
  const types = {};
  for (const r of research) types[r.company_type] = (types[r.company_type] || 0) + 1;
  console.log(`  company_type:`, Object.entries(types).map(([k, v]) => `${k}=${v}`).join(' '));
  console.log(`  excluded (consulting/outsourcing/staffing → landscape-only): ${excluded}`);
  console.log(`  vetting queue (undecided, eligible): ${queue.length}`);

  const n = Number((process.argv.includes('--queue') && process.argv[process.argv.indexOf('--queue') + 1]) || 0);
  if (n) {
    const byKey = new Map(research.map(r => [r.key, r]));
    console.log(`\nTop ${n} vetting queue:`);
    for (const p of queue.slice(0, n)) {
      const r = byKey.get(p.key);
      console.log(`  ${p.relevance_score}  ${r.name} [${r.provider}] remote_relevant=${r.remote_relevant} type=${r.company_type}`);
    }
  }
}
main();
