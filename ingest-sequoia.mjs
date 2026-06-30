#!/usr/bin/env node
// ingest-sequoia.mjs
//
// Fetches the active company list from Sequoia Capital's REST API,
// resolves their ATS endpoints, and registers them in portals.yml and the master registry.
//
// Usage:
//   node ingest-sequoia.mjs [--dry-run] [--limit 50]

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveCompany, appendToPortals } from './find-companies.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PERSONAL_PATH = join(ROOT, 'data', 'companies-personal.jsonl');
const RESEARCH_PATH = join(ROOT, 'data', 'company-research.jsonl');
const CONCURRENCY_LIMIT = 5;

function loadRegistryNames() {
  const names = new Set();
  if (!existsSync(PERSONAL_PATH)) return names;
  const lines = readFileSync(PERSONAL_PATH, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.name) names.add(obj.name.toLowerCase().trim());
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
  console.log(`✓ added ${personalLines.length} new Sequoia companies to master registry`);
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

// Fetch company website from its Sequoia detail page
async function fetchCompanyWebsite(companyUrl) {
  try {
    const res = await fetch(companyUrl, {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Look for link wrapping logo or the visit website button
    const match = html.match(/href="([^"]+)"[^>]*class="[^"]*button[^"]*outline[^"]*"/i) 
                  || html.match(/class="company__logo-link"[^>]*href="([^"]+)"/i)
                  || html.match(/class="company__logo"[^>]*href="([^"]+)"/i)
                  || html.match(/href="([^"]+)"[^>]*target="_blank"[^>]*>Visit Website/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 50;

  console.log(`Fetching companies from Sequoia REST API...`);
  const sequoiaCompanies = [];
  let page = 1;
  while (true) {
    try {
      const url = `https://sequoiacap.com/wp-json/wp/v2/company?per_page=100&page=${page}`;
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      for (const c of data) {
        if (c.title?.rendered) {
          sequoiaCompanies.push({
            name: c.title.rendered.replace(/&#038;/g, '&').replace(/&amp;/g, '&').trim(),
            sequoia_url: c.link
          });
        }
      }
      page++;
    } catch (err) {
      console.error(`Error fetching page ${page}: ${err.message}`);
      break;
    }
  }
  console.log(`Loaded ${sequoiaCompanies.length} companies from Sequoia portfolio`);

  const existingNames = loadRegistryNames();
  console.log(`Found ${existingNames.size} existing companies in master registry`);

  const candidates = sequoiaCompanies.filter(c => c.name && !existingNames.has(c.name.toLowerCase().trim()));
  console.log(`Found ${candidates.length} new Sequoia candidate companies (not in registry)`);

  const slice = candidates.slice(0, limit);
  console.log(`Resolving first ${slice.length} new Sequoia companies...`);

  const tasks = slice.map(c => async () => {
    console.log(`Probing Sequoia company: "${c.name}"...`);
    const resolved = await resolveCompany(c.name);
    if (resolved.resolved) {
      console.log(`  ✓ Resolved by name: ${resolved.provider} (${resolved.careers_url})`);
      return resolved;
    }
    
    // If name probing failed, try fetching the website from their Sequoia page
    console.log(`  · Name resolution failed for "${c.name}". Fetching detail page...`);
    const website = await fetchCompanyWebsite(c.sequoia_url);
    if (website) {
      console.log(`  · Found website: ${website}. Storing website for future crawls.`);
      return {
        name: c.name,
        resolved: false,
        careers_url: website,
        provider: 'unresolved'
      };
    }
    
    return {
      name: c.name,
      resolved: false,
      careers_url: c.sequoia_url,
      provider: 'unresolved'
    };
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
  console.error("Critical error in ingest-sequoia:", err);
  process.exit(1);
});
