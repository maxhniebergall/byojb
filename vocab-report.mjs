#!/usr/bin/env node
// vocab-report.mjs — the vocabulary review queue (Stage 2 of docs/technology-vocabulary-plan.md).
//
// `preferences.languages` / `preferences.technologies` are hand-maintained lists matched by EXACT
// string equality. A term the corpus uses and the lists don't know is silent: it contributes
// nothing to the stack score, and nothing anywhere says so. That is how Stripe's "Software
// Engineer, Machine Learning Infrastructure" sat mis-scored — the JD said "MLOps", "AI agents",
// "model training"; the rubric said "ML", "agent", "model serving"; all three read as unknown.
// It was found by reading one row's facets by hand, which does not scale to a backlog.
//
// This ranks every unrecognised term by how much it is COSTING, so the backlog becomes finite and
// ordered. The corpus proposes; the human decides. Nothing here classifies anything, and nothing
// here writes to config/rubric.yml — `avoid` suppresses whole categories of job, so a preference
// is the user's to state (see "What NOT to do" in the plan).
//
//   node vocab-report.mjs              # human-readable, ranked by impact
//   node vocab-report.mjs --json       # machine-readable (same data as GET /api/vocab/terms)
//   node vocab-report.mjs --limit 50   # how many terms to show (default 30)

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';
import { loadJsonl } from './posting-core.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RUBRIC = join(ROOT, 'config', 'rubric.yml');
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const PERSONAL = join(ROOT, 'data', 'postings-personal.jsonl');

// A posting with facets but no computed score still costs something — it just can't say how much.
// Score it at the middle of the 1-5 ladder rather than dropping it, so an unscored posting neither
// inflates nor silently erases a term's impact.
const NEUTRAL_SCORE = 3;

// The set of terms the rubric already has an opinion about, in EXACTLY the rubric's own matching
// semantics: case-insensitive whole-string equality, mirroring itemMatchesList in score-postings.mjs.
// Deliberately NOT substring matching — "C" is on the avoid list and would match Cloud, CI/CD and
// ClickHouse, and a false positive on `avoid` is the most damaging kind (it caps a stack at 1.5).
// If matching is ever loosened it must be per-entry, never globally (plan, "What NOT to do").
export function knownTerms(prefs) {
  const known = new Set();
  for (const grp of ['languages', 'technologies']) {
    const g = prefs?.[grp] || {};
    for (const list of ['love', 'ok', 'avoid', 'neutral']) {
      for (const t of (g[list] || [])) known.add(String(t).toLowerCase());
    }
  }
  return known;
}

// Is this posting one whose vocabulary is worth spending a decision on?
//
// Three ways a posting can be real-but-irrelevant, and all three must be excluded or the ranking
// measures the corpus rather than the cost:
//   live === false      — the opening is gone; classifying its words buys nothing
//   hard_excluded       — a dealbreaker fired (wrong country, onsite, contract). No score the
//                         vocabulary produces could ever make this applicable.
//   dup_of != null      — one requisition republished per city. Counting all three of Tailscale's
//                         listings would treat one job as three pieces of evidence, which is
//                         precisely the "inferring preference from anecdote" failure inverted.
function reachable(r, p) {
  return r?.live !== false && !p?.hard_excluded && (p?.dup_of == null);
}

// IMPACT — what a term is actually costing, not how often it occurs.
//
//   impact = Σ over reachable postings using the term of (computed_score / 5)
//
// i.e. a frequency count where each posting is weighted by how good it is, normalized so one
// perfect posting contributes 1.0. The properties that matter:
//   · a term on 40 strong reachable postings outranks one on a single excluded role (that is the
//     entire point — the plan asks the vocabulary to grow from patterns, not anecdotes);
//   · it stays LINEAR in count, so it reads as "worth about N good postings" and can be sanity-
//     checked by eye against the count column. A superlinear weighting would rank better but stop
//     being explainable, and an unexplainable number is exactly what this project avoids elsewhere
//     (see the recomputable-scoring principle in score-postings.mjs);
//   · a 1.2-scoring posting still contributes ~0.24 rather than 0 — a low score may itself be the
//     symptom of the missing term, so zeroing it would hide the gaps it exists to find.
//
// It is NOT weighted by which list the term might belong to: that would require guessing the
// classification, which is the human's call.
export function computeVocab({ research = [], personal = [], rubric = {}, limit = null } = {}) {
  const known = knownTerms(rubric?.preferences);
  const byKey = new Map(personal.map(p => [p.key, p]));
  const terms = new Map();   // lowercase term → { term, count, impact, examples[] }

  let considered = 0;
  for (const r of research) {
    const ex = r?.extracted;
    if (!ex) continue;
    const p = byKey.get(r.key);
    if (!reachable(r, p)) continue;
    considered++;
    const score = p?.computed_score != null ? Number(p.computed_score) : NEUTRAL_SCORE;
    const weight = Math.max(0, score) / 5;
    // Dedupe WITHIN a posting: a JD naming "Kubernetes" twice across languages and technologies is
    // one piece of evidence, not two.
    const seen = new Set();
    // Track WHICH extracted field each term came from. The extractor already made this call —
    // "Python" lands in languages, "Kubernetes" in technologies — so the queue can file a term into
    // the matching preference list instead of asking the user to remember a global mode. A global
    // selector silently sent 20+ technologies (SDKs, Protobuf, AWS Lambda, service mesh) into
    // preferences.languages, because it is set once and then applies to every later click.
    for (const [item, srcGroup] of [
      ...(ex.languages || []).map(x => [x, 'languages']),
      ...(ex.technologies || []).map(x => [x, 'technologies']),
    ]) {
      const raw = String(item || '').trim();
      const k = raw.toLowerCase();
      if (!raw || known.has(k) || seen.has(k)) continue;
      seen.add(k);
      let t = terms.get(k);
      // Keep the FIRST spelling seen as the display form: it is a real posting's own casing, which
      // is what should be pasted into the rubric if the user classifies it.
      if (!t) { t = { term: raw, count: 0, impact: 0, examples: [], group_votes: { languages: 0, technologies: 0 } }; terms.set(k, t); }
      t.group_votes[srcGroup]++;
      t.count++;
      t.impact += weight;
      if (t.examples.length < 3) t.examples.push({ company: r.company || '', title: r.title || '', key: r.key, score: p?.computed_score ?? null });
    }
  }

  // Majority vote across postings: a term the extractor mostly listed as a language is a language.
  for (const t of terms.values()) {
    t.group = (t.group_votes.languages > t.group_votes.technologies) ? 'languages' : 'technologies';
  }
  const rows = [...terms.values()]
    .map(t => ({ ...t, impact: Number(t.impact.toFixed(2)) }))
    // Deterministic: impact desc, then count desc, then term — so two runs on unchanged data
    // produce byte-identical output and a diff means the corpus moved.
    .sort((a, b) => (b.impact - a.impact) || (b.count - a.count) || a.term.localeCompare(b.term));

  return {
    total_terms: rows.length,
    postings_considered: considered,
    known_terms: known.size,
    rows: limit ? rows.slice(0, limit) : rows,
  };
}

export function loadVocabInputs() {
  const rubric = yaml.load(readFileSync(RUBRIC, 'utf-8')) || {};
  const research = existsSync(RESEARCH) ? loadJsonl(RESEARCH) : [];
  const personal = existsSync(PERSONAL) ? loadJsonl(PERSONAL) : [];
  return { rubric, research, personal };
}

// The one call the dashboard makes. Kept here rather than in web/server.mjs so the CLI and the
// panel can never disagree about what "unrecognised" or "impact" means.
export function vocabQueue(limit = null) {
  return computeVocab({ ...loadVocabInputs(), limit });
}

function main() {
  const argv = process.argv.slice(2);
  const li = argv.indexOf('--limit');
  const limit = li >= 0 ? Number(argv[li + 1]) : 30;
  const out = vocabQueue(Number.isFinite(limit) && limit > 0 ? limit : null);

  if (argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); return; }

  console.log(`\nVocabulary review queue — terms real postings use that your rubric has no opinion on.`);
  console.log(`${out.total_terms} unrecognised terms across ${out.postings_considered} live, reachable, non-duplicate postings`);
  console.log(`(rubric currently knows ${out.known_terms} terms)\n`);
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log(`${pad('impact', 8)}${pad('n', 5)}term`);
  console.log('─'.repeat(78));
  for (const t of out.rows) {
    console.log(`${pad(t.impact.toFixed(2), 8)}${pad(t.count, 5)}${t.term}`);
    for (const e of t.examples) console.log(`${' '.repeat(13)}· ${e.company} — ${e.title}${e.score != null ? ` (${e.score})` : ''}`);
  }
  console.log(`\nClassify them in the dashboard's Vocabulary panel (/postings), then re-run`);
  console.log(`  node score-postings.mjs`);
  console.log(`Nothing here writes to config/rubric.yml — love/ok/avoid/neutral is your call.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
