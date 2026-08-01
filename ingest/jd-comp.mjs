#!/usr/bin/env node
// ingest/jd-comp.mjs — build company pay bands from comp ALREADY in the postings registry.
//
// Pay-transparency laws (CO, NY, WA, CA, IL) mean thousands of postings already carry a real
// range. This sweeps them into per-(company, title_family, ladder_level, currency) bands so a
// company's published numbers can stand in for the postings where it published nothing.
//
// Zero new data sources, zero network access, no ToS question — the numbers are already local.
//
//   node ingest/jd-comp.mjs            # rebuild the jd_posted / jd_rollup rows
//   node ingest/jd-comp.mjs --stats    # coverage report, write nothing
//   node ingest/jd-comp.mjs --min-n 2  # require N postings per band (default 1)
//
// Derivation is set by sample size, not blanket-assigned:
//   1 posting  → derivation:"direct",   source:"jd_posted"   (it IS the company's stated range)
//   2+ postings→ derivation:"inferred", source:"jd_rollup"   (the percentile spread is synthesized)
// Either way a posting that lists its OWN comp always outranks these at scoring time.
//
// Rows THIS SCRIPT produced (provenance.collected_by) are fully regenerated each run; every other
// row — LLM research, manual entries — is preserved untouched, even if it shares a `source` label.

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { loadJsonl, saveJsonl, sk } from '../posting-core.mjs';
import { normalizeTitle } from '../title-family.mjs';
import { bandSlotKey } from '../comp-core.mjs';
import { normalizeComp, parseCompFromBody } from '../comp-core.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const RESEARCH = join(ROOT, 'data', 'posting-research.jsonl');
const COMP = join(ROOT, 'data', 'company-comp.jsonl');

const VERSION = 'ingest/jd-comp.mjs@v1';
// Ownership is by PRODUCER, not by evidence type. This script regenerates only the rows it wrote
// itself, identified by provenance.collected_by.
//
// Keying on the `source` label instead would silently destroy researched work: the research prompt
// legitimately emits source:"jd_posted" for a range an LLM reads off a live JD, and that row is
// indistinguishable from ours by label alone. It is entirely distinguishable by who produced it.
const OWNER_PREFIX = 'ingest/jd-comp.mjs';
const isOurs = (r) => String(r?.provenance?.collected_by || '').startsWith(OWNER_PREFIX);

// The SCANNER's structured field wins. It comes straight from the ATS API with an explicit
// currencyCode and numeric min/max — objective ground truth. The LLM's `extracted.comp` is an
// interpretation of JD prose, and measured against the 34 postings where both exist it disagrees
// on CURRENCY 38% of the time and on value 62% of the time (e.g. Ashby reports
// 196900-246100 USD where the extraction wrote 160000-210000 CAD).
//
// Currency errors are the expensive kind: a USD band mislabeled CAD skips the usd_to_cad
// conversion and understates the role by ~35%. Fall back to the extraction only when the scanner
// has nothing — which is the common case, since most boards publish no structured comp at all.
// Trust order: ATS structured field > verbatim JD text > LLM interpretation.
// `level` is the rung this posting's TITLE resolved to. It disambiguates a JD that advertises two
// levels and posts a range for each — see parseCompFromBody. Optional: without it the parser keeps
// its previous first-match behaviour.
function compOf(r, level = null) {
  const raw = normalizeComp(r?.comp);
  if (raw) return { c: raw, from: 'scanned' };
  // The body is verbatim text the company published; the extraction is a reading of it, and it
  // contradicts that text 27% of the time while missing it entirely on 1,884 postings.
  if (r?.has_body) {
    try {
      const body = readFileSync(join(ROOT, 'data', 'posting-research', sk(r.key) + '.md'), 'utf-8');
      const fromBody = parseCompFromBody(body, { level });
      if (fromBody) {
        // A bare "$" in the prose carries no currency. Leaving it null buckets the band under
        // "UNKNOWN", which the scorer then treats as CAD — understating a US role by ~35%. Infer
        // from the posting's own location, defaulting to USD (the structured fields in this corpus
        // are ~85% USD, and the boards are overwhelmingly US-headquartered).
        if (!fromBody.currency) fromBody.currency = inferCurrency(r);
        return { c: fromBody, from: 'body' };
      }
    } catch { /* unreadable body → fall through */ }
  }
  const ex = normalizeComp(r?.extracted?.comp);
  if (ex) return { c: ex, from: 'extracted' };
  return null;
}

// Infer the currency of a bare "$" range from the posting's geography.
//
// The subtlety that bit us: "United States or Canada" names BOTH, and a company posting ONE range
// for both countries posts it in USD. Matching "canada" anywhere stamped CAD on 35 postings'
// USD figures — a ~35% overstatement once usd_to_cad is skipped. Canada wins only when the US is
// not also named.
const RE_CA = /canada|ontario|quebec|british columbia|alberta|toronto|vancouver|montreal|ottawa|calgary/i;
const RE_US = /united states|\bu\.?s\.?a?\b|america(?!s)|remote us|new york|california|texas|seattle|boston|washington/i;
function inferCurrency(r) {
  const loc = `${r.location || ''} ${(r.extracted?.location_hints || []).join(' ')}`;
  if (RE_CA.test(loc) && !RE_US.test(loc)) return 'CAD';
  return 'USD';
}

// Coarse pay-geography bucket. A band must not average a US range with an offshore one: Flex
// posts USD 150-220k for the USA and USD 55-100k for Brazil under the same title and currency,
// and blending them describes neither. Also fills provenance.geo, which was null on every row.
const RE_OFFSHORE = /brazil|argentina|colombia|mexico|chile|peru|india|philippines|pakistan|vietnam|indonesia|poland|romania|ukraine|serbia|bulgaria|latam|emea|apac|africa|egypt|nigeria|kenya/i;
const RE_EU = /united kingdom|\buk\b|ireland|germany|france|spain|portugal|netherlands|sweden|norway|denmark|finland|switzerland|austria|belgium|italy|london|berlin|paris|amsterdam/i;
function geoBucket(r) {
  const loc = `${r.location || ''} ${(r.extracted?.location_hints || []).join(' ')}`;
  if (RE_OFFSHORE.test(loc)) return 'offshore';
  if (RE_EU.test(loc)) return 'eu';
  // Canada and the US were both bucketed as 'na', which is why nearly every row reported an
  // uninformative geo. They are different pay markets AND different eligibility: a Toronto band
  // and an Ohio band are not interchangeable facts, and collapsing them made the field useless
  // for the currency/cost-of-living comparisons it exists to support. Canada is checked FIRST so
  // "Toronto, Canada (Remote), United States" resolves to the home market rather than the US.
  if (RE_CA.test(loc)) return 'ca';
  if (RE_US.test(loc)) return 'us';
  return 'unknown';
}

const pct = (sorted, p) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
};

function main() {
  const args = process.argv.slice(2);
  const statsOnly = args.includes('--stats');
  const minN = Number(args[args.indexOf('--min-n') + 1]) || 1;
  const today = new Date().toISOString().slice(0, 10);

  const research = loadJsonl(RESEARCH);
  // Group key includes CURRENCY: rolling a USD range together with a CAD one would invent a
  // number that no posting ever stated. Separate rows keep each honest.
  const groups = new Map();
  let withComp = 0, noLevel = 0;

  for (const r of research) {
    if (!r?.company_key) continue;
    // Resolve the level BEFORE reading comp: a JD advertising two rungs posts a range for each,
    // and the parser needs to know which one this posting is in order to pick the right range.
    const { title_family, ladder_level } = normalizeTitle(r.title, r.extracted || {});
    // normalizeTitle now returns LEVEL_UNSPECIFIED rather than null for an unlevelled title, so
    // this no longer fires. Kept as a guard: a genuinely absent level would still be unusable.
    if (!ladder_level) { noLevel++; continue; }
    const hit = compOf(r, ladder_level);
    if (!hit) continue;
    withComp++;
    const cur = hit.c.currency || 'UNKNOWN';
    const gk = `${r.company_key}|${title_family}|${ladder_level}|${cur}|${geoBucket(r)}`;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push({ r, ...hit });
  }

  const rows = [];
  for (const [gk, items] of groups) {
    const [key, title_family, ladder_level, currency, geo] = gk.split('|');
    if (items.length < minN) continue;

    // Use each posting's midpoint so a wide range and a point estimate weigh the same, then take
    // percentiles ACROSS postings. p25/p75 (not min/max) so one outlier posting can't define the band.
    const mids = items.map(x => {
      const { min, max } = x.c;
      return (min != null && max != null) ? (min + max) / 2 : (max ?? min);
    }).filter(v => v != null).sort((a, b) => a - b);
    if (!mids.length) continue;

    const single = items.length === 1;
    const only = items[0];
    // A band is only `direct` when the number is VERIFIABLE — the ATS's structured field or the
    // JD's own text. When it came from the LLM extraction (neither of the other two had anything),
    // nobody can check it: HappyRobot had a 220-250K CAD band labelled "range posted on this
    // company's own JD" while the JD body states no numbers at all. That is an inference, and
    // mislabelling it `direct` lets it score at full strength and outrank real evidence.
    const verifiable = items.every(x => x.from === 'scanned' || x.from === 'body');
    // Take the range's real edges, not percentiles of its midpoints. Midpoint percentiles collapse
    // to min == mid == max whenever the source JDs share a range — Thumbtack's verbatim
    // CAD 180,200-233,200 became a flat 206,700, discarding the width the company actually posted.
    // p25/p75 across the EDGES keeps the real band while still resisting a single outlier.
    const lows = items.map(x => x.c.min ?? x.c.max).filter(v => v != null).sort((a, b) => a - b);
    const highs = items.map(x => x.c.max ?? x.c.min).filter(v => v != null).sort((a, b) => a - b);
    const band = single
      ? { min: only.c.min ?? only.c.max, mid: mids[0], max: only.c.max ?? only.c.min, currency, component: 'base' }
      : { min: pct(lows, 0.25), mid: pct(mids, 0.5), max: pct(highs, 0.75), currency, component: 'base' };

    // Confidence tracks the STRENGTH of the evidence, which is quality first and quantity second.
    //
    // Scaling on sample size alone put every `direct`/`jd_posted` row at `low`, because a single
    // posting fell in the `< 2` bucket — so the strongest evidence in the system (a range the
    // employer published on its own JD for this exact slot, checkable at source_urls) was rated
    // the same as a model's guess. Two separate research passes flagged it independently.
    //
    // A directly posted range is not a small sample of some hidden truth; for that slot it IS the
    // fact. Sample size still matters for a ROLLUP, where more postings genuinely means more
    // evidence about a band the company never stated outright.
    const confidence = !verifiable ? 'low'
      : single ? 'high'
        : items.length >= 5 ? 'high' : items.length >= 2 ? 'medium' : 'low';

    rows.push({
      key,
      title_family,
      ladder_level,
      derivation: (single && verifiable) ? 'direct' : verifiable ? 'inferred' : 'estimated',
      level_raw: [...new Set(items.map(x => x.r.title))].slice(0, 5),
      band,
      provenance: {
        source: (single && verifiable) ? 'jd_posted' : verifiable ? 'jd_rollup' : 'llm_prior',
        method: !verifiable
          ? `Stage-3 extractor only; no figure in the ATS field or the JD text (${items.length} posting(s))`
          : single
            ? `range posted on this company's own JD "${only.r.title}"`
            : `p25/p50/p75 across the posted range edges of ${items.length} of this company's own JDs`,
        derived_from: items.map(x => x.r.key).slice(0, 50),
        source_urls: [...new Set(items.map(x => x.r.url).filter(Boolean))].slice(0, 5),
        as_of: today,
        sample_size: items.length,
        confidence,
        geo,
        // llm_prior requires a model id: the claim is "a model asserted this", and which model
        // matters. The Stage-3 extractor is the author here.
        ...(!verifiable ? { model: 'stage3-extractor' } : {}),
        collected_by: VERSION,
      },
      first_seen: today,
      last_seen: today,
    });
  }

  if (statsOnly) {
    const cos = new Set(rows.map(r => r.key));
    console.log(`postings carrying a usable comp range: ${withComp}`);
    console.log(`  …of those, skipped for having no inferable level: ${noLevel}`);
    console.log(`bands: ${rows.length} across ${cos.size} companies`);
    console.log(`  direct (single posting):  ${rows.filter(r => r.derivation === 'direct').length}`);
    console.log(`  inferred (2+ rollup):     ${rows.filter(r => r.derivation === 'inferred').length}`);
    const byFam = {};
    for (const r of rows) byFam[r.title_family] = (byFam[r.title_family] || 0) + 1;
    console.log('  by family:', Object.entries(byFam).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
    return;
  }

  // Preserve everything we didn't produce (LLM research, manual entries); regenerate only ours.
  const kept = loadJsonl(COMP).filter(r => !isOurs(r));
  // Carry first_seen forward so a band's age reflects when we first saw it, not the last rebuild.
  const prevFirst = new Map(
    loadJsonl(COMP).filter(isOurs)
      .map(r => [`${r.key}|${r.title_family}|${r.ladder_level}|${r.band?.currency}|${r.provenance?.geo}`, r.first_seen])
  );
  for (const r of rows) {
    const prev = prevFirst.get(`${r.key}|${r.title_family}|${r.ladder_level}|${r.band?.currency}|${r.provenance?.geo}`);
    if (prev) r.first_seen = prev;
  }

  // Don't re-add our own row for a slot a PRESERVED row already covers with better evidence.
  // Research agents write `direct`/`jd_posted` bands read straight off a JD; regenerating an
  // `estimated` row for that same slot afterwards leaves both in place, and doctor rightly flags
  // the weaker one as un-superseded. Ownership means we may rewrite our rows — not that ours win.
  const RANK = { direct: 3, inferred: 2, estimated: 1 };
  const bestKept = new Map();
  for (const r of kept) {
    const k = bandSlotKey(r);
    bestKept.set(k, Math.max(bestKept.get(k) || 0, RANK[r.derivation] || 0));
  }
  // Strictly-better, not better-or-equal. On a TIE the preserved research row wins: both occupy
  // the same slot, so only one may survive, and the researched row carries the more specific
  // provenance (a named source URL and method line rather than a rollup). Keeping ours on ties
  // left 54 duplicate slots that the next --apply-comp then removed, so the file's row count
  // depended on which command ran last.
  const surviving = rows.filter(r => (RANK[r.derivation] || 0) > (bestKept.get(bandSlotKey(r)) || 0));
  const yielded = rows.length - surviving.length;

  saveJsonl(COMP, [...kept, ...surviving]);
  console.log(`✓ ${surviving.length} JD-derived bands across ${new Set(surviving.map(r => r.key)).size} companies → ${COMP}`);
  if (yielded) console.log(`  (${yielded} of ours yielded to better researched evidence)`);
  console.log(`  (preserved ${kept.length} rows from other sources)`);
}

main();
