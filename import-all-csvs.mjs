#!/usr/bin/env node
// import-all-csvs.mjs
//
// Reads all CSV files in data/ats-companies/*.csv and bulk-imports any
// missing companies into the master registries (companies-personal.jsonl
// and company-research.jsonl) as undecided.

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(ROOT, 'data', 'ats-companies');
const PERSONAL_PATH = join(ROOT, 'data', 'companies-personal.jsonl');
const RESEARCH_PATH = join(ROOT, 'data', 'company-research.jsonl');

function loadJsonlKeys(path) {
  const keys = new Set();
  if (!existsSync(path)) return keys;
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.key) keys.add(obj.key);
    } catch {}
  }
  return keys;
}

function main() {
  console.log("Loading existing company keys from registry...");
  const existingKeys = loadJsonlKeys(PERSONAL_PATH);
  console.log(`Found ${existingKeys.size} existing company keys in master registry`);

  if (!existsSync(CSV_DIR)) {
    console.error(`Error: CSV directory not found at ${CSV_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
  console.log(`Processing ${files.length} CSV files...`);

  let addedCount = 0;
  const personalLines = [];
  const researchLines = [];

  for (const file of files) {
    const provider = basename(file, '.csv');
    const filePath = join(CSV_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    
    // skip header line
    const dataLines = lines.slice(1);
    
    let fileAdded = 0;

    for (const line of dataLines) {
      const parts = line.split(',');
      if (parts.length < 3) continue;
      
      const url = parts.pop();
      const slug = parts.pop();
      const name = parts.join(',').replace(/^"|"$/g, '').trim();

      if (!name || !slug) continue;

      const key = `${provider}:${slug}`;
      if (existingKeys.has(key)) continue;

      existingKeys.add(key);

      const personalObj = {
        key,
        name,
        provider,
        careers_url: url,
        relevance_score: 50.0,
        excluded_by_type: false,
        decision: 'undecided',
        llm_fit: null,
        fit_brief: null,
        last_reviewed: null
      };

      const researchObj = {
        key,
        name,
        provider,
        careers_url: url,
        company_type: 'unknown',
        relevant: 0,
        remote_relevant: 0,
        sample_titles: []
      };

      personalLines.push(JSON.stringify(personalObj));
      researchLines.push(JSON.stringify(researchObj));
      fileAdded++;
      addedCount++;
    }
    
    console.log(`  ${provider}: processed ${dataLines.length} lines, added ${fileAdded} new companies`);
  }

  if (personalLines.length > 0) {
    console.log(`Writing ${personalLines.length} new companies to master registry files...`);
    appendFileSync(PERSONAL_PATH, personalLines.join('\n') + '\n', 'utf-8');
    appendFileSync(RESEARCH_PATH, researchLines.join('\n') + '\n', 'utf-8');
    console.log(`✓ successfully registered ${addedCount} new companies!`);
  } else {
    console.log("No new companies to import (all duplicates).");
  }
}

main();
