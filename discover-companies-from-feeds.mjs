#!/usr/bin/env node
// discover-companies-from-feeds.mjs
//
// Automatically fetches new job listings from Remotive and Arbeitnow APIs,
// plus broad LinkedIn/Indeed scraper cache (JobSpy), filters for relevant backend/infrastructure
// roles, resolves their ATS systems (or extracts careers pages), matches against exclusions,
// and appends them to portals.yml and the master company registry.

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { resolveCompany, resolveByUrl, appendToPortals } from './find-companies.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORTALS_PATH = process.env.CAREER_OPS_PORTALS || join(ROOT, 'portals.yml');
const CRITERIA_PATH = join(ROOT, 'config', 'company_criteria.yml');
const EXCLUSIONS_LOG_PATH = join(ROOT, 'data', 'excluded-companies.jsonl');
const PERSONAL_PATH = join(ROOT, 'data', 'companies-personal.jsonl');
const RESEARCH_PATH = join(ROOT, 'data', 'company-research.jsonl');
const JOBSPY_CACHE_PATH = join(ROOT, 'data', 'jobspy-cache.json');
const CONCURRENCY_LIMIT = 5;
const FETCH_TIMEOUT_MS = 6000;

const AGGREGATOR_DOMAINS = new Set([
  'arbeitnow.com',
  'remotive.com',
  'remotive.io',
  'remotive.co',
  'www.arbeitnow.com',
  'www.remotive.com',
  'www.remotive.io',
  'localhost',
  '127.0.0.1'
]);

function isValidCareersUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (AGGREGATOR_DOMAINS.has(host) || host.endsWith('.remotive.com') || host.endsWith('.arbeitnow.com')) {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extractAtsUrlFromText(text) {
  if (!text) return null;
  const patterns = [
    /https?:\/\/[a-z0-9-]+\.greenhouse\.io\/[^\s"'>]+/i,
    /https?:\/\/job-boards(?:\.eu)?\.greenhouse\.io\/[^\s"'>]+/i,
    /https?:\/\/jobs\.ashbyhq\.com\/[^\s"'>]+/i,
    /https?:\/\/jobs\.lever\.co\/[^\s"'>]+/i,
    /https?:\/\/[a-z0-9-]+\.recruitee\.com[^\s"'>]*/i,
    /https?:\/\/jobs\.gem\.com\/[^\s"'>]+/i,
    /https?:\/\/apply\.workable\.com\/[^\s"'>]+/i,
    /https?:\/\/[a-z0-9-]+\.bamboohr\.com\/[^\s"'>]+/i,
    /https?:\/\/[a-z0-9-]+\.breezy\.hr\/[^\s"'>]+/i,
    /https?:\/\/ats\.rippling\.com\/[^\s"'>]+/i,
    /https?:\/\/[a-z0-9-]+\.myworkdayjobs\.com\/[^\s"'>]+/i,
    /https?:\/\/[^\s"'>\s]+\/(?:careers|jobs|join)(?:\/[^\s"'>]*)?/i
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const clean = m[0].replace(/[.,;)]+$/, ''); // clean trailing punctuation
      if (isValidCareersUrl(clean)) {
        return clean;
      }
    }
  }
  return null;
}

async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function existingPortalNames() {
  if (!existsSync(PORTALS_PATH)) return new Set();
  const text = readFileSync(PORTALS_PATH, 'utf-8');
  const names = new Set();
  for (const m of text.matchAll(/^\s*-\s*name:\s*(.+?)\s*$/gm)) {
    names.add(m[1].replace(/^["']|["']$/g, '').toLowerCase());
  }
  return names;
}

function checkExclusions(companyName, job, exclusions) {
  const lowerCompany = companyName.toLowerCase();
  const lowerTitle = (job.title || '').toLowerCase();
  const lowerDesc = (job.description || '').toLowerCase();
  const tags = Array.isArray(job.tags) ? job.tags.map(t => String(t).toLowerCase()) : [];

  for (const ex of exclusions) {
    const lowerEx = ex.toLowerCase().trim();
    if (!lowerEx) continue;

    if (lowerCompany.includes(lowerEx)) return ex;
    if (lowerTitle.includes(lowerEx)) return ex;
    if (tags.some(t => t.includes(lowerEx))) return ex;
    if (lowerDesc.includes(lowerEx)) return ex;
  }
  return null;
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

function buildLocationFilter(locationFilter) {
  if (!locationFilter) return () => true;
  const allow = (locationFilter.allow || []).map(k => k.toLowerCase());
  const block = (locationFilter.block || []).map(k => k.toLowerCase());
  const alwaysAllow = (locationFilter.always_allow || []).map(k => k.toLowerCase());

  return (location) => {
    if (!location) return true;
    const lower = location.toLowerCase();
    if (alwaysAllow.some(k => lower.includes(k))) return true;
    if (block.some(k => lower.includes(k))) return false;
    if (allow.length === 0) return true;
    return allow.some(k => lower.includes(k));
  };
}

function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());

  return (title) => {
    const lower = title.toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(k => lower.includes(k));
    const hasNegative = negative.some(k => lower.includes(k));
    return hasPositive && !hasNegative;
  };
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
  
  if (personalLines.length > 0) {
    appendFileSync(PERSONAL_PATH, personalLines.join('\n') + '\n', 'utf-8');
    appendFileSync(RESEARCH_PATH, researchLines.join('\n') + '\n', 'utf-8');
    console.log(`✓ added ${personalLines.length} new companies to master registry`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : null;

  console.log(`Starting company discovery from feeds...${dryRun ? ' [DRY RUN MODE]' : ''}`);

  // 1. Load config files
  if (!existsSync(PORTALS_PATH)) {
    console.error(`Error: portals.yml not found at ${PORTALS_PATH}`);
    process.exit(1);
  }
  const portalsConfig = yaml.load(readFileSync(PORTALS_PATH, 'utf-8'));
  const titleFilter = buildTitleFilter(portalsConfig.title_filter);
  const locationFilter = buildLocationFilter(portalsConfig.location_filter);

  let exclusions = [];
  if (existsSync(CRITERIA_PATH)) {
    try {
      const criteria = yaml.load(readFileSync(CRITERIA_PATH, 'utf-8'));
      exclusions = (criteria?.exclusions || [])
        .map(e => String(e).trim())
        .filter(e => e && !e.startsWith('[FILL IN]') && !e.includes('e.g.'));
      console.log(`Loaded ${exclusions.length} exclusions from company_criteria.yml:`, exclusions);
    } catch (err) {
      console.warn(`Warning: Could not parse criteria file: ${err.message}`);
    }
  }

  // Load already logged exclusions
  mkdirSync(dirname(EXCLUSIONS_LOG_PATH), { recursive: true });
  const loggedExclusions = new Set();
  if (existsSync(EXCLUSIONS_LOG_PATH)) {
    const lines = readFileSync(EXCLUSIONS_LOG_PATH, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.name) loggedExclusions.add(obj.name.toLowerCase());
      } catch {}
    }
  }

  // Load master registry to check skip-vetted decisions
  const personalMap = new Map();
  if (existsSync(PERSONAL_PATH)) {
    const lines = readFileSync(PERSONAL_PATH, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        personalMap.set(obj.name.toLowerCase(), obj);
      } catch {}
    }
    console.log(`Loaded ${personalMap.size} companies from master registry`);
  }

  // Helper to log exclusions
  const logExclusion = (name, reason) => {
    const lower = name.toLowerCase();
    if (loggedExclusions.has(lower)) return;
    loggedExclusions.add(lower);
    const dateStr = new Date().toISOString().split('T')[0];
    const record = JSON.stringify({ name, exclusion_matched: reason, date_added: dateStr }) + '\n';
    appendFileSync(EXCLUSIONS_LOG_PATH, record, 'utf-8');
    console.log(`❌ Skipped and logged excluded company: "${name}" (matched keyword: "${reason}")`);
  };

  const havePortals = existingPortalNames();
  console.log(`Loaded ${havePortals.size} existing companies from portals.yml`);

  // 2. Fetch feeds & JobSpy cache
  let allJobs = [];

  console.log("Reading JobSpy cache...");
  if (existsSync(JOBSPY_CACHE_PATH)) {
    try {
      const cache = JSON.parse(readFileSync(JOBSPY_CACHE_PATH, 'utf-8'));
      const jobspyJobs = (cache.jobs || []).map(j => ({
        company_name: j.company,
        title: j.title,
        description: "",
        location: j.location,
        url: j.url,
        tags: []
      }));
      console.log(`  Loaded ${jobspyJobs.length} jobs from JobSpy cache`);
      allJobs.push(...jobspyJobs);
    } catch (err) {
      console.error(`  Error parsing JobSpy cache: ${err.message}`);
    }
  } else {
    console.log("  No JobSpy cache found. Run npm run jobspy:refresh first.");
  }

  console.log("Fetching Remotive API...");
  try {
    const res = await fetchWithTimeout("https://remotive.com/api/remote-jobs");
    if (res.ok) {
      const json = await res.json();
      const remotiveJobs = (json.jobs || []).map(j => ({
        company_name: j.company_name,
        title: j.title,
        description: j.description,
        location: j.candidate_required_location,
        url: j.url,
        tags: j.tags || []
      }));
      console.log(`  Fetched ${remotiveJobs.length} jobs from Remotive`);
      allJobs.push(...remotiveJobs);
    } else {
      console.error(`  Failed to fetch Remotive: ${res.status}`);
    }
  } catch (err) {
    console.error(`  Error fetching Remotive: ${err.message}`);
  }

  console.log("Fetching Arbeitnow API...");
  try {
    const res = await fetchWithTimeout("https://arbeitnow.com/api/job-board-api");
    if (res.ok) {
      const json = await res.json();
      const arbeitnowJobs = (json.data || []).map(j => ({
        company_name: j.company_name,
        title: j.title,
        description: j.description,
        location: j.remote ? (j.location ? j.location + " Remote" : "Remote") : j.location,
        url: j.url,
        tags: j.tags || []
      }));
      console.log(`  Fetched ${arbeitnowJobs.length} jobs from Arbeitnow`);
      allJobs.push(...arbeitnowJobs);
    } else {
      console.error(`  Failed to fetch Arbeitnow: ${res.status}`);
    }
  } catch (err) {
    console.error(`  Error fetching Arbeitnow: ${err.message}`);
  }

  // 3. Filter and group by company
  const uniqueCompanies = new Map();

  for (const job of allJobs) {
    if (!job.company_name) continue;
    if (!titleFilter(job.title)) continue;
    if (!locationFilter(job.location)) continue;

    const lowerName = job.company_name.toLowerCase();
    
    // Skip if already in portals.yml
    if (havePortals.has(lowerName)) continue;

    // Check if previously marked as "skip" in the master registry
    const existingPersonal = personalMap.get(lowerName);
    if (existingPersonal && existingPersonal.decision === 'skip') {
      console.log(`Skipping "${job.company_name}" (previously skip-vetted)`);
      continue;
    }

    // Check hard exclusions
    const matchedEx = checkExclusions(job.company_name, job, exclusions);
    if (matchedEx) {
      if (!dryRun) {
        logExclusion(job.company_name, matchedEx);
      } else {
        console.log(`❌ [Dry Run] Excluded "${job.company_name}" (matched keyword: "${matchedEx}")`);
      }
      continue;
    }

    if (!uniqueCompanies.has(lowerName)) {
      uniqueCompanies.set(lowerName, {
        name: job.company_name,
        jobs: []
      });
    }
    uniqueCompanies.get(lowerName).jobs.push(job);
  }

  let companiesToResolve = Array.from(uniqueCompanies.values());
  console.log(`Found ${companiesToResolve.length} new candidate companies matching filters`);

  if (limit !== null && limit < companiesToResolve.length) {
    console.log(`Limiting processing to ${limit} companies as requested by --limit`);
    companiesToResolve = companiesToResolve.slice(0, limit);
  }

  // 4. Resolve companies concurrently
  const tasks = companiesToResolve.map(company => async () => {
    console.log(`Resolving: "${company.name}" (${company.jobs.length} relevant job(s))...`);
    
    // Step A: Name probers
    const resName = await resolveCompany(company.name);
    if (resName.resolved) {
      console.log(`  Resolved by Name: ${resName.provider} | Careers URL: ${resName.careers_url} | Count: ${resName.count}`);
      return resName;
    }

    // Step B: Scrape fallback (Description / Job Page details)
    const jobsToCheck = company.jobs.slice(0, 2);
    for (const job of jobsToCheck) {
      // 1. Try description text
      let candidateUrl = extractAtsUrlFromText(job.description);
      if (candidateUrl) {
        console.log(`  Found candidate URL in description: ${candidateUrl}`);
        const resUrl = await resolveByUrl(company.name, candidateUrl);
        if (resUrl.resolved) {
          console.log(`    Resolved by Description URL: ${resUrl.provider} | Careers URL: ${resUrl.careers_url} | Count: ${resUrl.count}`);
          return resUrl;
        }
        if (!company.careers_url) {
          company.careers_url = candidateUrl;
        }
      }

      // 2. Try page fetch
      console.log(`  Fetching job detail page: ${job.url}`);
      const pageHtml = await fetchText(job.url);
      if (pageHtml) {
        candidateUrl = extractAtsUrlFromText(pageHtml);
        if (candidateUrl) {
          console.log(`    Found candidate URL on job page: ${candidateUrl}`);
          const resUrl = await resolveByUrl(company.name, candidateUrl);
          if (resUrl.resolved) {
            console.log(`      Resolved by Page URL: ${resUrl.provider} | Careers URL: ${resUrl.careers_url} | Count: ${resUrl.count}`);
            return resUrl;
          }
          if (!company.careers_url) {
            company.careers_url = candidateUrl;
          }
        }
      }
    }

    if (company.careers_url) {
      console.log(`  Unresolved, but found careers page: ${company.careers_url}`);
      return { name: company.name, resolved: false, careers_url: company.careers_url };
    }

    console.log(`  Unresolved: No careers page or ATS found.`);
    return { name: company.name, resolved: false, careers_url: null };
  });

  const resolvedCompanies = await limitConcurrency(tasks, CONCURRENCY_LIMIT);
  const resolvedCount = resolvedCompanies.filter(r => r && r.resolved).length;
  const unresolvedCount = resolvedCompanies.filter(r => r && !r.resolved).length;

  console.log(`\nResolution Summary:`);
  console.log(`  Resolved (supported ATS): ${resolvedCount}`);
  console.log(`  Unresolved / Unsupported: ${unresolvedCount}`);

  if (dryRun) {
    console.log(`\n[Dry Run] Would append ${resolvedCompanies.length} companies to portals and registry:`);
    for (const r of resolvedCompanies) {
      if (!r) continue;
      const status = r.resolved ? `RESOLVED (${r.provider}, ${r.count} jobs)` : (r.careers_url ? 'UNSUPPORTED/OTHER' : 'UNRESOLVED');
      console.log(`  - ${r.name} | ${status} | URL: ${r.careers_url || 'None'}`);
    }
  } else {
    // 1. Append scannable/resolved ones to portals.yml
    const appended = appendToPortals(resolvedCompanies.filter(Boolean));
    // 2. Save new discoveries to master registry
    const newDiscoveries = resolvedCompanies.filter(r => r && !personalMap.has(r.name.toLowerCase()));
    saveToRegistry(newDiscoveries);
    console.log(`Successfully finished processing. Appended ${appended} companies to portals.yml`);
  }
}

main().catch(err => {
  console.error("Critical error in discover-companies-from-feeds:", err);
  process.exit(1);
});
