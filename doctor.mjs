#!/usr/bin/env node

/**
 * doctor.mjs — Setup validation for BYOJB
 * Checks all prerequisites and prints a pass/fail checklist.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

// ANSI colors (only on TTY)
const isTTY = process.stdout.isTTY;
const green = (s) => isTTY ? `\x1b[32m${s}\x1b[0m` : s;
const red = (s) => isTTY ? `\x1b[31m${s}\x1b[0m` : s;
const dim = (s) => isTTY ? `\x1b[2m${s}\x1b[0m` : s;

function checkNodeVersion() {
  const major = parseInt(process.versions.node.split('.')[0]);
  if (major >= 18) {
    return { pass: true, label: `Node.js >= 18 (v${process.versions.node})` };
  }
  return {
    pass: false,
    label: `Node.js >= 18 (found v${process.versions.node})`,
    fix: 'Install Node.js 18 or later from https://nodejs.org',
  };
}

function checkDependencies() {
  if (existsSync(join(projectRoot, 'node_modules'))) {
    return { pass: true, label: 'Dependencies installed' };
  }
  return {
    pass: false,
    label: 'Dependencies not installed',
    fix: 'Run: npm install',
  };
}

async function checkPlaywright() {
  try {
    const { chromium } = await import('playwright');
    const execPath = chromium.executablePath();
    if (existsSync(execPath)) {
      return { pass: true, label: 'Playwright chromium installed' };
    }
    return {
      pass: false,
      label: 'Playwright chromium not installed',
      fix: 'Run: npx playwright install chromium',
    };
  } catch {
    return {
      pass: false,
      label: 'Playwright chromium not installed',
      fix: 'Run: npx playwright install chromium',
    };
  }
}

function checkProfile() {
  if (existsSync(join(projectRoot, 'config', 'profile.yml'))) {
    return { pass: true, label: 'config/profile.yml found' };
  }
  return {
    pass: false,
    label: 'config/profile.yml not found',
    fix: [
      'Run: cp config/profile.example.yml config/profile.yml',
      'Then edit it with your details',
    ],
  };
}

function checkPortals() {
  if (existsSync(join(projectRoot, 'portals.yml'))) {
    return { pass: true, label: 'portals.yml found' };
  }
  return {
    pass: false,
    label: 'portals.yml not found',
    fix: [
      'Run: cp templates/portals.example.yml portals.yml',
      'Then customize with your target companies',
    ],
  };
}

function checkAutoDir(name) {
  const dirPath = join(projectRoot, name);
  if (existsSync(dirPath)) {
    return { pass: true, label: `${name}/ directory ready` };
  }
  try {
    mkdirSync(dirPath, { recursive: true });
    return { pass: true, label: `${name}/ directory ready (auto-created)` };
  } catch {
    return {
      pass: false,
      label: `${name}/ directory could not be created`,
      fix: `Run: mkdir ${name}`,
    };
  }
}

// Audit the pay-band registry. The whole feature rests on never confusing a number the company
// STATED with one we derived or a model guessed, so every integrity rule is checked here — not
// only in the prompt that produced the row.
async function checkCompBands() {
  const path = join(projectRoot, 'data', 'company-comp.jsonl');
  if (!existsSync(path)) return { pass: true, label: 'company pay bands: none yet (optional)' };

  let C, T;
  try {
    C = await import('./comp-core.mjs');
    T = await import('./title-family.mjs');
  } catch (e) {
    return { pass: false, label: 'company pay bands: comp-core.mjs failed to load', fix: e.message };
  }

  const problems = [];
  const seen = new Map();   // slot → best derivation rank seen
  let n = 0, stale = 0;
  const maxAge = 540, now = Date.now();

  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    let row; try { row = JSON.parse(line); } catch { problems.push('unparseable JSONL line'); continue; }
    n++;
    for (const e of C.validateBandRow(row, { families: T.TITLE_FAMILIES })) {
      problems.push(`${row.key} [${row.title_family}/${row.ladder_level}]: ${e}`);
    }
    const age = (now - Date.parse(row.provenance?.as_of || '')) / 86400000;
    if (Number.isFinite(age) && age > maxAge) stale++;
    const slot = `${row.key}|${row.title_family}|${row.ladder_level}`;
    const rank = C.DERIVATION_RANK[row.derivation] || 0;
    seen.set(slot, Math.max(seen.get(slot) || 0, rank));
    if ((seen.get(slot) || 0) > rank && rank === 1) {
      problems.push(`${slot}: an "estimated" row sits alongside better evidence — it should have been superseded`);
    }
  }

  if (problems.length) {
    return {
      pass: false,
      label: `company pay bands: ${problems.length} integrity problem(s) across ${n} rows`,
      fix: [...problems.slice(0, 8), problems.length > 8 ? `…and ${problems.length - 8} more` : '',
        'Re-run `node ingest/jd-comp.mjs`, or fix/remove the offending rows in data/company-comp.jsonl'].filter(Boolean),
    };
  }
  return { pass: true, label: `company pay bands: ${n} rows valid${stale ? ` (${stale} stale → forced to low confidence)` : ''}` };
}

async function main() {
  console.log('\nBYOJB doctor');
  console.log('============\n');

  const checks = [
    checkNodeVersion(),
    checkDependencies(),
    await checkPlaywright(),
    checkProfile(),
    checkPortals(),
    checkAutoDir('data'),
    checkAutoDir('reports'),
    await checkCompBands(),
  ];

  let failures = 0;

  for (const result of checks) {
    if (result.pass) {
      console.log(`${green('✓')} ${result.label}`);
    } else {
      failures++;
      console.log(`${red('✗')} ${result.label}`);
      const fixes = Array.isArray(result.fix) ? result.fix : [result.fix];
      for (const hint of fixes) {
        console.log(`  ${dim('→ ' + hint)}`);
      }
    }
  }

  console.log('');
  if (failures > 0) {
    console.log(`Result: ${failures} issue${failures === 1 ? '' : 's'} found. Fix them and run \`npm run doctor\` again.`);
    process.exit(1);
  } else {
    console.log('Result: All checks passed. You\'re ready to go! Start the dashboard with `npm run dashboard`.');
    console.log('');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('doctor.mjs failed:', err.message);
  process.exit(1);
});
