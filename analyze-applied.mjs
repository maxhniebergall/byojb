#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    })
    .filter(Boolean);
}

const APPS_FILE = join(__dirname, 'data', 'applications.jsonl');
const PERSONAL_FILE = join(__dirname, 'data', 'postings-personal.jsonl');
const RESEARCH_FILE = join(__dirname, 'data', 'posting-research.jsonl');

function analyze() {
  const apps = loadJsonl(APPS_FILE);
  const personal = loadJsonl(PERSONAL_FILE);
  const research = loadJsonl(RESEARCH_FILE);

  const appliedKeys = new Set(
    apps.filter(a => a.status && a.status !== 'Discarded' && a.status !== 'Evaluated').map(a => a.key)
  );

  const researchByKey = new Map(research.map(r => [r.key, r]));

  // Valid scored postings
  const scored = personal.filter(p => p.computed_score != null);
  scored.sort((a, b) => b.computed_score - a.computed_score);

  const totalScored = scored.length;
  
  console.log(`# Applied Jobs Analysis\n`);
  console.log(`Total applied jobs found in tracker: ${appliedKeys.size}`);
  console.log(`Total jobs with computed scores in system: ${totalScored}\n`);

  const appliedStats = [];
  const appliedDims = {};
  let appliedCount = 0;
  
  const allDims = {};
  let allCount = 0;

  for (let i = 0; i < totalScored; i++) {
    const p = scored[i];
    const rank = i + 1;
    const percentile = ((totalScored - rank) / totalScored * 100).toFixed(1);
    
    // Accumulate all dims
    if (p.dim_scores) {
      allCount++;
      for (const [dim, val] of Object.entries(p.dim_scores)) {
        if (val != null) {
          if (!allDims[dim]) allDims[dim] = { sum: 0, count: 0 };
          allDims[dim].sum += val;
          allDims[dim].count += 1;
        }
      }
    }

    if (appliedKeys.has(p.key)) {
      appliedCount++;
      const r = researchByKey.get(p.key) || {};
      appliedStats.push({
        company: r.company || 'Unknown',
        title: r.title || 'Unknown',
        score: p.computed_score,
        rank,
        percentile,
        excluded: p.hard_excluded,
        reason: p.hard_reason
      });

      if (p.dim_scores) {
        for (const [dim, val] of Object.entries(p.dim_scores)) {
          if (val != null) {
            if (!appliedDims[dim]) appliedDims[dim] = { sum: 0, count: 0 };
            appliedDims[dim].sum += val;
            appliedDims[dim].count += 1;
          }
        }
      }
    }
  }

  // Also find applied jobs that were completely filtered out / unscored
  const unscoredApplied = [];
  for (const k of appliedKeys) {
    const p = personal.find(x => x.key === k);
    if (!p || p.computed_score == null) {
      const r = researchByKey.get(k) || {};
      unscoredApplied.push({
        company: r.company || 'Unknown',
        title: r.title || 'Unknown',
        excluded: p ? p.hard_excluded : 'not found',
        reason: p ? p.hard_reason : 'not processed'
      });
    }
  }

  console.log(`## Rankings of Applied Jobs\n`);
  for (const a of appliedStats) {
    let line = `- **${a.company}** - ${a.title}\n  - Score: ${a.score} (Rank: ${a.rank}/${totalScored}, Top ${100 - a.percentile}%)`;
    if (a.excluded) {
      line += `\n  - ⚠️ HARD EXCLUDED: ${a.reason}`;
    }
    console.log(line);
  }

  if (unscoredApplied.length > 0) {
    console.log(`\n## Unscored or Fully Excluded Applied Jobs\n`);
    for (const u of unscoredApplied) {
      console.log(`- **${u.company}** - ${u.title}`);
      console.log(`  - Excluded: ${u.excluded}, Reason: ${u.reason}`);
    }
  }

  console.log(`\n## Dimension Averages (Applied vs All)\n`);
  console.log(`| Dimension | Applied Avg | All Avg | Diff |`);
  console.log(`|-----------|-------------|---------|------|`);
  
  const dims = new Set([...Object.keys(appliedDims), ...Object.keys(allDims)]);
  for (const d of Array.from(dims).sort()) {
    const aAvg = appliedDims[d] ? (appliedDims[d].sum / appliedDims[d].count) : null;
    const allAvg = allDims[d] ? (allDims[d].sum / allDims[d].count) : null;
    
    if (aAvg !== null && allAvg !== null) {
      const diff = aAvg - allAvg;
      const diffStr = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      console.log(`| ${d} | ${aAvg.toFixed(2)} | ${allAvg.toFixed(2)} | ${diffStr} |`);
    } else {
      console.log(`| ${d} | ${aAvg ? aAvg.toFixed(2) : 'N/A'} | ${allAvg ? allAvg.toFixed(2) : 'N/A'} | N/A |`);
    }
  }
}

analyze();
