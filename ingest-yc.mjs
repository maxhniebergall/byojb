#!/usr/bin/env node
// ingest-yc.mjs
//
// Fetches the active hiring company list from Y Combinator,
// resolves their ATS endpoints, and registers them in portals.yml and the master registry.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveCompany, appendToPortals } from './find-companies.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PERSONAL_PATH = join(ROOT, 'data', 'companies-personal.jsonl');
const RESEARCH_PATH = join(ROOT, 'data', 'company-research.jsonl');
const YC_HIRING_API = 'https://yc-oss.github.io/api/companies/hiring.json';
const YC_ALL_API = 'https://yc-oss.github.io/api/companies/all.json';
const CONCURRENCY_LIMIT = 5;

function loadRegistryNames() {
  const names = new Set();
  if (!existsSync(PERSONAL_PATH)) return names;
  const lines = readFileSync(PERSONAL_PATH, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.name) names.add(obj.name.toLowerCase());
    } catch {}
  }
  return names;
}

function saveToRegistry(toAdd) {
  if (toAdd.length === 0) return;
  const personalLines = [];
  const researchLines = [];
  
  for (const r of toAdd) {
    const provider = r.provider || 'unresolved';
    const slug = r.careers_url ? (r.careers_url.split('/').filter(Boolean).pop() || 'site') : 'site';
    const key = `${provider}:${slug}`;
    
    const personalObj = {
      key,
      name: r.name,
      provider,
      careers_url: r.careers_url || '',
      relevance_score: 50.0,
      excluded_by_type: false,
      decision: 'undecided',
      llm_fit: null,
      fit_brief: null,
      last_reviewed: null
    };
    
    const researchObj = {
      key,
      name: r.name,
      provider,
      careers_url: r.careers_url || '',
      company_type: 'unknown',
      relevant: 0,
      remote_relevant: 0,
      sample_titles: []
    };
    
    personalLines.push(JSON.stringify(personalObj));
    researchLines.push(JSON.stringify(researchObj));
  }
  
  appendFileSync(PERSONAL_PATH, personalLines.join('\n') + '\n', 'utf-8');
  appendFileSync(RESEARCH_PATH, researchLines.join('\n') + '\n', 'utf-8');
  console.log(`✓ added ${personalLines.length} new YC companies to master registry`);
}

async function limitConcurrency(tasks, limit) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const taskIndex = index++;
      try {
        results[taskIndex] = await tasks[taskIndex]();
      } catch (err) {
        results[taskIndex] = null;
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const allCompanies = args.includes('--all');
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 30; // default to 30 to avoid rate limits

  const targetApi = allCompanies ? YC_ALL_API : YC_HIRING_API;
  console.log(`Fetching ${allCompanies ? 'all' : 'hiring'} YC companies list...`);
  let ycCompanies = [];
  try {
    const res = await fetch(targetApi);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ycCompanies = await res.json();
    console.log(`Loaded ${ycCompanies.length} YC companies from directory`);
  } catch (err) {
    console.error(`Failed to load YC directory: ${err.message}`);
    process.exit(1);
  }

  const existingNames = loadRegistryNames();
  console.log(`Found ${existingNames.size} existing companies in master registry`);

  const candidates = ycCompanies.filter(c => c.name && !existingNames.has(c.name.toLowerCase()));
  console.log(`Found ${candidates.length} new YC candidate companies (not in registry)`);

  const slice = candidates.slice(0, limit);
  console.log(`Resolving first ${slice.length} new YC companies...`);

  const tasks = slice.map(c => async () => {
    console.log(`Probing YC company: "${c.name}"...`);
    const resolved = await resolveCompany(c.name);
    if (resolved.resolved) {
      console.log(`  ✓ Resolved: ${resolved.provider} (${resolved.careers_url})`);
    } else {
      console.log(`  · Unresolved`);
    }
    return resolved;
  });

  const resolved = await limitConcurrency(tasks, CONCURRENCY_LIMIT);
  const resolvedHits = resolved.filter(r => r && r.resolved);
  console.log(`\nResolution Summary:`);
  console.log(`  Resolved: ${resolvedHits.length} / ${resolved.length}`);

  if (dryRun) {
    console.log(`\n[Dry Run] Would register and append:`);
    for (const r of resolvedHits) {
      console.log(`  - ${r.name} -> ${r.provider} (${r.careers_url})`);
    }
  } else {
    // Append resolved ones to portals.yml
    const appended = appendToPortals(resolvedHits);
    // Add all attempted ones (whether resolved or not) to registry
    saveToRegistry(resolved.filter(Boolean));
    console.log(`Successfully finished processing. Appended ${appended} companies to portals.yml`);
  }
}

main().catch(err => {
  console.error("Critical error in ingest-yc:", err);
  process.exit(1);
});
