#!/usr/bin/env node
// resolve-unresolved.mjs
//
// Crawls the homepages of unresolved companies to discover their careers pages,
// extracts embedded ATS links (Greenhouse, Lever, Ashby, etc.), resolves them,
// and updates the master registries and portals.yml.
//
// Usage:
//   node resolve-unresolved.mjs --limit 50

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveByUrl, appendToPortals } from './find-companies.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PERSONAL_PATH = join(ROOT, 'data', 'companies-personal.jsonl');
const RESEARCH_PATH = join(ROOT, 'data', 'company-research.jsonl');
const YC_HIRING_API = 'https://yc-oss.github.io/api/companies/hiring.json';
const CONCURRENCY_LIMIT = 5;
const FETCH_TIMEOUT_MS = 6000;

// Load website URLs from YC hiring list
async function loadYcWebsites() {
  const websites = new Map();
  try {
    const res = await fetch(YC_HIRING_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    for (const c of list) {
      if (c.name && c.website) {
        websites.set(c.name.toLowerCase().trim(), c.website);
      }
    }
  } catch (err) {
    console.error(`Warning: Failed to load YC websites: ${err.message}`);
  }
  return websites;
}

function loadRegistry(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf-8').split('\n').filter(Boolean).map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function saveRegistry(filePath, data) {
  const lines = data.map(obj => JSON.stringify(obj)).join('\n') + '\n';
  writeFileSync(filePath, lines, 'utf-8');
}

async function scanPageForAts(name, url) {
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) return null;
    const html = await res.text();
    
    const atsKeywords = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'smartrecruiters.com', 'recruitee.com', 'workdayjobs.com', 'workable.com', 'bamboohr.com', 'breezy.hr', 'rippling.com', 'jobs.gem.com'];
    
    const urls = new Set();
    const urlRegex = /https?:\/\/[^\s"'><]+/gi;
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
      const cleanUrl = match[0].split(/[#"']/)[0];
      const lower = cleanUrl.toLowerCase();
      if (atsKeywords.some(kw => lower.includes(kw))) {
        urls.add(cleanUrl);
      }
    }
    
    for (const rawUrl of urls) {
      const resolved = await resolveByUrl(name, rawUrl);
      if (resolved.resolved) {
        return resolved;
      }
    }
  } catch {}
  return null;
}

async function crawlAndResolve(name, website) {
  if (!website) return { name, resolved: false, reason: 'no website' };
  
  try {
    const res = await fetch(website, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) return { name, resolved: false, reason: `HTTP ${res.status}` };
    const html = await res.text();
    
    const hrefRegex = /href=["']([^"']+)["']/gi;
    const candidates = new Set();
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      candidates.add(match[1]);
    }
    
    const careerKeywords = ['career', 'job', 'work-with-us', 'join-us', 'hiring', 'opening', 'recruit'];
    const atsKeywords = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'smartrecruiters.com', 'recruitee.com', 'workdayjobs.com', 'workable.com', 'bamboohr.com', 'breezy.hr', 'rippling.com', 'jobs.gem.com'];
    
    const matches = [];
    for (const href of candidates) {
      const lower = href.toLowerCase();
      const isCareerLink = careerKeywords.some(kw => lower.includes(kw));
      const isAtsLink = atsKeywords.some(kw => lower.includes(kw));
      
      if (isCareerLink || isAtsLink) {
        try {
          const absoluteUrl = new URL(href, website).href;
          matches.push(absoluteUrl);
        } catch {}
      }
    }
    
    const uniqueMatches = [...new Set(matches)];
    
    // 1. Probe direct ATS links
    for (const url of uniqueMatches) {
      if (atsKeywords.some(kw => url.toLowerCase().includes(kw))) {
        const resolved = await resolveByUrl(name, url);
        if (resolved.resolved) return resolved;
      }
    }
    
    // 2. Scan internal careers pages
    for (const url of uniqueMatches) {
      if (url.startsWith(website) || url.includes(new URL(website).hostname)) {
        const resolved = await scanPageForAts(name, url);
        if (resolved) return resolved;
      }
    }
    
    return { name, resolved: false, reason: 'no matched ATS' };
  } catch (err) {
    return { name, resolved: false, reason: err.message };
  }
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
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 50;

  console.log(`Loading YC website URLs...`);
  const ycWebsites = await loadYcWebsites();
  
  console.log(`Loading master registries...`);
  const personal = loadRegistry(PERSONAL_PATH);
  const research = loadRegistry(RESEARCH_PATH);
  
  // Find undecided unresolved entries
  const unresolvedEntries = personal.filter(p => p.provider === 'unresolved' && p.decision === 'undecided');
  console.log(`Found ${unresolvedEntries.length} unresolved undecided companies in registry.`);
  
  // Match with websites we have
  const candidates = unresolvedEntries.map(p => {
    const website = ycWebsites.get(p.name.toLowerCase().trim());
    return { entry: p, website };
  }).filter(c => c.website);
  
  console.log(`Matched ${candidates.length} unresolved companies with website URLs.`);
  
  const slice = candidates.slice(0, limit);
  console.log(`Crawling first ${slice.length} companies...`);
  
  const tasks = slice.map(c => async () => {
    console.log(`Crawling: "${c.entry.name}" (${c.website})...`);
    const resolved = await crawlAndResolve(c.entry.name, c.website);
    if (resolved.resolved) {
      console.log(`  ✓ Resolved ${c.entry.name}: ${resolved.provider} (${resolved.careers_url})`);
    } else {
      console.log(`  · Unresolved ${c.entry.name} (${resolved.reason})`);
    }
    return { entry: c.entry, resolved };
  });
  
  const results = await limitConcurrency(tasks, CONCURRENCY_LIMIT);
  const hits = results.filter(r => r && r.resolved.resolved);
  
  console.log(`\nResolution Summary:`);
  console.log(`  Resolved: ${hits.length} / ${slice.length}`);
  
  if (hits.length > 0) {
    const resolvedHits = hits.map(h => h.resolved);
    appendToPortals(resolvedHits);
    
    // Update local registry objects by matching name (keys are not unique for unresolved entries)
    for (const h of hits) {
      const provider = h.resolved.provider;
      const slug = h.resolved.careers_url.split('/').filter(Boolean).pop() || 'site';
      const newKey = `${provider}:${slug}`;
      const nameLower = h.entry.name.toLowerCase().trim();
      
      const pObj = personal.find(p => p.name.toLowerCase().trim() === nameLower && p.provider === 'unresolved');
      if (pObj) {
        pObj.key = newKey;
        pObj.provider = provider;
        pObj.careers_url = h.resolved.careers_url;
      }
      
      const rObj = research.find(r => r.name.toLowerCase().trim() === nameLower && r.provider === 'unresolved');
      if (rObj) {
        rObj.key = newKey;
        rObj.provider = provider;
        rObj.careers_url = h.resolved.careers_url;
      }
    }
    
    // Save registries back
    saveRegistry(PERSONAL_PATH, personal);
    saveRegistry(RESEARCH_PATH, research);
    console.log(`Updated registries with ${hits.length} newly resolved companies.`);
  }
}

main().catch(err => {
  console.error("Critical error:", err);
  process.exit(1);
});
