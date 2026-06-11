#!/usr/bin/env node
// rank-postings.mjs (NEW) — turn the raw scan capture into the persistent POSTINGS registry.
//
// Mirror of rank-companies.mjs, one grain finer. Two layers joined on `key` (= canonical URL):
//   data/posting-research.jsonl   — OBJECTIVE, shareable: identity + facts; `extracted` facets
//                                   (filled later by Stage-3 research) carried forward on re-run.
//                                   Full JD body → data/posting-research/<sk(key)>.md.
//   data/postings-personal.jsonl  — PRIVATE: relevance_score, llm_rank, scores, decision, override.
//
// Reads the raw cache scan.mjs writes (data/postings/raw-latest.jsonl) = the full set of
// title/location-passing postings this scan, WITH JD bodies. Re-running MERGES the personal
// layer so decisions/scores survive, and marks postings that dropped off a scanned board
// `live:false` (listings are ephemeral; a vetted decision is durable). Zero-token, no LLM.
//
//   node rank-postings.mjs            # rebuild/refresh from data/postings/raw-latest.jsonl
//   node rank-postings.mjs --queue 30 # also print the top-N by relevance

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';
import { loadJsonl, saveJsonl, sk, deriveCompanyKey } from './posting-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RAW = join(ROOT, 'data', 'postings', 'raw-latest.jsonl');
const COMPANY_RESEARCH = join(ROOT, 'data', 'company-research.jsonl');
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'postings-personal.jsonl');
const BODY_DIR = join(ROOT, 'data', 'posting-research');

// crude HTML→text for the stored JD body (Greenhouse returns escaped HTML).
function htmlToText(s) {
  if (!s) return '';
  return s
    .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function seniorityBonus(title) {
  return /\b(senior|staff|principal|lead|sr\.?)\b/i.test(title || '') ? 0.5 : 0;
}
function recencyBonus(date, today) {
  if (!date) return 0;
  const d = Date.parse(date);
  if (Number.isNaN(d)) return 0;
  const days = (Date.parse(today) - d) / 86_400_000;
  if (days <= 14) return 0.5;
  if (days <= 45) return 0.25;
  return 0;
}

function main() {
  if (!existsSync(RAW)) {
    console.error(`No raw scan cache at ${RAW}. Run \`node scan.mjs\` first.`);
    process.exit(1);
  }
  const rawAll = loadJsonl(RAW);
  const meta = (rawAll.find(r => r._meta) || {})._meta || {};
  const raw = rawAll.filter(r => !r._meta && r.url);
  const today = meta.scanned_at || new Date().toISOString().slice(0, 10);

  // careers_url → company_key (exact join to the company registry; fall back to URL parsing)
  const companyByUrl = new Map();
  for (const c of loadJsonl(COMPANY_RESEARCH)) if (c.careers_url) companyByUrl.set(c.careers_url, c.key);

  const priorResearch = new Map(loadJsonl(RESEARCH).map(r => [r.key, r]));
  const priorPersonal = new Map(loadJsonl(PERSONAL).map(r => [r.key, r]));

  mkdirSync(BODY_DIR, { recursive: true });

  const research = new Map();
  const personal = new Map();
  const scannedCompanyKeys = new Set();

  for (const m of raw) {
    const key = m.url;
    const company_key = companyByUrl.get(m.careers_url) || deriveCompanyKey(m.provider, m.careers_url);
    scannedCompanyKeys.add(company_key);
    const prevR = priorResearch.get(key) || {};
    const prevP = priorPersonal.get(key) || {};

    // JD body → per-key markdown (objective). Write/refresh when we have a body.
    let has_body = !!prevR.has_body;
    if (m.description && m.description.trim()) {
      const text = htmlToText(m.description);
      if (text) {
        writeFileSync(join(BODY_DIR, sk(key) + '.md'),
          `# ${m.company} — ${m.title}\n${m.url}\n\n${text}\n`, 'utf-8');
        has_body = true;
      }
    }

    research.set(key, {
      key, company_key, company: m.company, title: m.title, url: m.url,
      location: m.location || '', department: m.department || '', provider: m.provider,
      date_posted: m.date_posted || prevR.date_posted || '',
      comp: m.comp ?? prevR.comp ?? null,
      employment_type_raw: m.employment_type || prevR.employment_type_raw || '',
      first_seen: prevR.first_seen || today, last_seen: today, live: true, has_body,
      // facts extracted by Stage-3 research live here; preserve across re-scans
      extracted: prevR.extracted || null,
    });

    const relevance_score = Number((1 + seniorityBonus(m.title) + recencyBonus(m.date_posted, today)).toFixed(2));
    personal.set(key, {
      key,
      relevance_score,
      llm_rank: prevP.llm_rank ?? null,
      llm_reason: prevP.llm_reason ?? null,
      dim_scores: prevP.dim_scores ?? null,
      computed_score: prevP.computed_score ?? null,
      llm_holistic_fit: prevP.llm_holistic_fit ?? null,
      manual_score: prevP.manual_score ?? null,
      fit_brief: prevP.fit_brief ?? null,
      hard_excluded: prevP.hard_excluded ?? false,
      decision: prevP.decision || 'undecided',
      last_reviewed: prevP.last_reviewed || null,
    });
  }

  // Carry forward postings absent from this scan. If their board WAS scanned → live:false
  // (the listing is gone). If their board was NOT scanned this run (e.g. JobSpy didn't run,
  // or a --company partial scan) → keep their prior state untouched.
  let expired = 0, kept = 0;
  for (const [key, prevR] of priorResearch) {
    if (research.has(key)) continue;
    const scanned = scannedCompanyKeys.has(prevR.company_key);
    research.set(key, { ...prevR, live: scanned ? false : prevR.live, last_seen: prevR.last_seen });
    if (!personal.has(key)) personal.set(key, priorPersonal.get(key) || { key, decision: 'undecided' });
    if (scanned && prevR.live !== false) expired++; else kept++;
  }

  // sort: live first, then relevance desc — purely cosmetic for the file
  const personalRows = [...personal.values()].sort((a, b) =>
    ((research.get(b.key)?.live ? 1 : 0) - (research.get(a.key)?.live ? 1 : 0)) ||
    ((b.relevance_score ?? 0) - (a.relevance_score ?? 0)));
  const researchRows = [...research.values()];

  saveJsonl(RESEARCH, researchRows);
  saveJsonl(PERSONAL, personalRows);

  const live = researchRows.filter(r => r.live).length;
  const withBody = researchRows.filter(r => r.has_body).length;
  console.log(`✓ postings registry: ${researchRows.length} total (${live} live, ${researchRows.length - live} expired)`);
  console.log(`  objective → ${RESEARCH}  (${withBody} with JD body in ${BODY_DIR}/)`);
  console.log(`  personal  → ${PERSONAL}`);
  if (expired) console.log(`  marked ${expired} dropped postings live:false; carried ${kept} from un-scanned boards`);
  const undecided = personalRows.filter(p => p.decision === 'undecided' && research.get(p.key)?.live).length;
  console.log(`  live & undecided (the ranking queue): ${undecided}`);

  const n = Number((process.argv.includes('--queue') && process.argv[process.argv.indexOf('--queue') + 1]) || 0);
  if (n) {
    console.log(`\nTop ${n} live by relevance:`);
    for (const p of personalRows.filter(p => research.get(p.key)?.live).slice(0, n)) {
      const r = research.get(p.key);
      console.log(`  ${p.relevance_score}  ${r.company} — ${r.title} [${r.provider}]`);
    }
  }
}
main();
