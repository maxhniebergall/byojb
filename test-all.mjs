#!/usr/bin/env node

/**
 * test-all.mjs — Comprehensive test suite for BYOJB
 *
 * Run before merging any PR or pushing changes.
 * Tests: syntax, scripts, dashboard, data contract, personal data, paths.
 *
 * Usage:
 *   node test-all.mjs           # Run all tests
 *   node test-all.mjs --quick   # Skip dashboard build (faster)
 */

import { execSync, execFileSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const QUICK = process.argv.includes('--quick');
const NODE = process.execPath;

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings++; }

function run(cmd, args = [], opts = {}) {
  try {
    if (Array.isArray(args) && args.length > 0) {
      return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf-8', timeout: 30000, ...opts }).trim();
    }
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 30000, ...opts }).trim();
  } catch (e) {
    return null;
  }
}

function fileExists(path) { return existsSync(join(ROOT, path)); }
function readFile(path) { return readFileSync(join(ROOT, path), 'utf-8'); }

console.log('\n🧪 BYOJB test suite\n');

// ── 1. SYNTAX CHECKS ────────────────────────────────────────────

console.log('1. Syntax checks');

const mjsFiles = readdirSync(ROOT).filter(f => f.endsWith('.mjs'));
for (const f of mjsFiles) {
  const result = run(NODE, ['--check', f]);
  if (result !== null) {
    pass(`${f} syntax OK`);
  } else {
    fail(`${f} has syntax errors`);
  }
}

// ── 2. SCRIPT EXECUTION ─────────────────────────────────────────

console.log('\n2. Script execution (graceful on empty data)');

const scripts = [
  { name: 'doctor.mjs', expectExit: 0, allowFail: true },
];

for (const { name, allowFail } of scripts) {
  const result = run(NODE, name.split(' '), { stdio: ['pipe', 'pipe', 'pipe'] });
  if (result !== null) {
    pass(`${name} runs OK`);
  } else if (allowFail) {
    warn(`${name} exited with error (expected without user data)`);
  } else {
    fail(`${name} crashed`);
  }
}

// ── 3. LIVENESS CLASSIFICATION ──────────────────────────────────

console.log('\n3. Liveness classification');

try {
  const { classifyLiveness } = await import(pathToFileURL(join(ROOT, 'liveness-core.mjs')).href);

  const expiredChromeApply = classifyLiveness({
    finalUrl: 'https://example.com/jobs/closed-role',
    bodyText: 'Company Careers\nApply\nThe job you are looking for is no longer open.',
    applyControls: [],
  });
  if (expiredChromeApply.result === 'expired') {
    pass('Expired pages are not revived by nav/footer "Apply" text');
  } else {
    fail(`Expired page misclassified as ${expiredChromeApply.result}`);
  }

  const activeWorkdayPage = classifyLiveness({
    finalUrl: 'https://example.workday.com/job/123',
    bodyText: [
      '663 JOBS FOUND',
      'Senior AI Engineer',
      'Join our applied AI team to ship production systems, partner with customers, and own delivery across evaluation, deployment, and reliability.',
    ].join('\n'),
    applyControls: ['Apply for this Job'],
  });
  if (activeWorkdayPage.result === 'active') {
    pass('Visible apply controls still keep real job pages active');
  } else {
    fail(`Active job page misclassified as ${activeWorkdayPage.result}`);
  }

  const closedMycareersfuture = classifyLiveness({
    finalUrl: 'https://www.mycareersfuture.gov.sg/job/engineering/senior-staff-embedded-software-engineer',
    bodyText: [
      'Senior Staff Embedded Software Engineer',
      'MaxLinear Asia Singapore Private Limited',
      '9 applications    Posted 27 Oct 2025    Closed on 26 Nov 2025',
      'Applications have closed for this job',
      'Log in to Apply',
      "You'll need to log in with Singpass to verify your identity.",
      'Roles & Responsibilities: design, develop and maintain embedded firmware for broadband communications ICs.',
    ].join('\n'),
    applyControls: ['Log in to Apply'],
  });
  if (closedMycareersfuture.result === 'expired') {
    pass('Closed postings with "Applications have closed" banner are detected');
  } else {
    fail(`Closed mycareersfuture posting misclassified as ${closedMycareersfuture.result}`);
  }
} catch (e) {
  fail(`Liveness classification tests crashed: ${e.message}`);
}

// ── 5. DATA CONTRACT ────────────────────────────────────────────

console.log('\n5. Data contract validation');

// Check system files exist
const systemFiles = [
  'DATA_CONTRACT.md',
  'modes/_shared.md', 'modes/_profile.template.md',
  'modes/scan.md', 'modes/find-companies.md',
  'modes/triage-companies.md', 'modes/research-companies.md',
  'modes/triage-jobs.md', 'modes/research-jobs.md',
  'templates/states.yml',
  '.agents/skills/byojb/SKILL.md',
];

for (const f of systemFiles) {
  if (fileExists(f)) {
    pass(`System file exists: ${f}`);
  } else {
    fail(`Missing system file: ${f}`);
  }
}

// Check user files are NOT tracked (gitignored)
const userFiles = [
  'config/profile.yml', 'modes/_profile.md', 'portals.yml',
];
for (const f of userFiles) {
  const tracked = run('git', ['ls-files', f]);
  if (tracked === '') {
    pass(`User file gitignored: ${f}`);
  } else if (tracked === null) {
    pass(`User file gitignored: ${f}`);
  } else {
    fail(`User file IS tracked (should be gitignored): ${f}`);
  }
}

// ── 6. PERSONAL DATA LEAK CHECK ─────────────────────────────────

console.log('\n6. Personal data leak check');

const leakPatterns = [
  'Santiago', 'santifer.io', 'Santifer iRepair', 'Zinkee', 'ALMAS',
  'hi@santifer.io', '688921377', '/Users/santifer/',
];

const scanExtensions = ['md', 'yml', 'html', 'mjs', 'sh', 'go', 'json'];
const allowedFiles = [
  'README.md',
  'LICENSE',
  'package.json',
  '.github/FUNDING.yml',
  'test-all.mjs',
];

// Build pathspec for git grep — only scan tracked files matching these
// extensions. This is what `grep -rn` was trying to do, but git-aware:
// untracked files (debate artifacts, AI tool scratch, local plans/) and
// gitignored files can't trigger false positives because they were never
// going to reach a commit anyway.
const grepPathspec = scanExtensions.map(e => `'*.${e}'`).join(' ');

let leakFound = false;
for (const pattern of leakPatterns) {
  const result = run(
    `git grep -n "${pattern}" -- ${grepPathspec} 2>/dev/null`
  );
  if (result) {
    for (const line of result.split('\n')) {
      const file = line.split(':')[0];
      if (allowedFiles.some(a => file.includes(a))) continue;
      warn(`Possible personal data in ${file}: "${pattern}"`);
      leakFound = true;
    }
  }
}
if (!leakFound) {
  pass('No personal data leaks outside allowed files');
}

// ── 7. ABSOLUTE PATH CHECK ──────────────────────────────────────

console.log('\n7. Absolute path check');

// Same git grep approach: only scans tracked files. Untracked AI tool
// outputs, local debate artifacts, etc. can't false-positive here.
const absPathResult = run(
  `git grep -n "/Users/" -- '*.mjs' '*.sh' '*.md' '*.go' '*.yml' 2>/dev/null | grep -v README.md | grep -v LICENSE | grep -v CLAUDE.md | grep -v test-all.mjs`
);
if (!absPathResult) {
  pass('No absolute paths in code files');
} else {
  for (const line of absPathResult.split('\n').filter(Boolean)) {
    fail(`Absolute path: ${line.slice(0, 100)}`);
  }
}

// ── 8. MODE FILE INTEGRITY ──────────────────────────────────────

console.log('\n8. Mode file integrity');

const expectedModes = [
  '_shared.md', '_profile.template.md', 'scan.md',
  'find-companies.md', 'triage-companies.md', 'research-companies.md',
  'triage-jobs.md', 'research-jobs.md',
];

for (const mode of expectedModes) {
  if (fileExists(`modes/${mode}`)) {
    pass(`Mode exists: ${mode}`);
  } else {
    fail(`Missing mode: ${mode}`);
  }
}

// Check _shared.md references _profile.md
const shared = readFile('modes/_shared.md');
if (shared.includes('_profile.md')) {
  pass('_shared.md references _profile.md');
} else {
  fail('_shared.md does NOT reference _profile.md');
}

// ── 9. LOCAL PARSER CONTRACT ────────────────────────────────────

console.log('\n9. Local parser contract');

const scanScript = readFile('scan.mjs');
if (
  scanScript.includes('typeof company.name !== \'string\'') &&
  scanScript.includes('company.name.trim()') &&
  scanScript.includes('company.name.toLowerCase()')
) {
  pass('scan.mjs guards company names before filtering');
} else {
  fail('scan.mjs does not guard company names before filtering');
}

if (
  scanScript.includes("skipIds: ['local-parser']") &&
  scanScript.includes('local parser failed, used API fallback') &&
  scanScript.includes('resolveProvider(company, providers')
) {
  pass('scan.mjs falls back to ATS API when local parser fails');
} else {
  fail('scan.mjs does not fall back to ATS API when local parser fails');
}

if (fileExists('providers/local-parser.mjs')) {
  pass('local-parser provider module exists');
} else {
  fail('local-parser provider module is missing');
}

const scanMode = fileExists('modes/scan.md') ? readFile('modes/scan.md') : '';
if (
  scanMode.includes('local_parser_ok') &&
  scanMode.includes('no repetir scraping caro') &&
  scanMode.includes('nombre no listado en `local_parser_ok`')
) {
  pass('scan.md skips expensive levels after successful local parser');
} else {
  fail('scan.md missing local_parser_ok skip rules for agent scan');
}

if (!fileExists('scripts/parsers/cohere_jobs.py')) {
  pass('Cohere parser example is not bundled as a runtime script');
} else {
  fail('Cohere parser example is still bundled as a runtime script');
}

const portalExample = readFile('templates/portals.example.yml');
if (
  !portalExample.includes('cohere_jobs.py') &&
  portalExample.includes('scripts/parsers/example-js-company-jobs.js') &&
  portalExample.includes('scripts/parsers/example_python_company_jobs.py') &&
  portalExample.includes('already know their target careers URL')
) {
  pass('portals example documents a generic local parser contract');
} else {
  fail('portals example still points at a bundled Cohere parser');
}



// ── 11. LOCATION FILTER — always_allow tier ───────────────────────

console.log('\n11. Location filter — always_allow tier');

try {
  const { buildLocationFilter } = await import(pathToFileURL(join(ROOT, 'scan.mjs')).href);

  const filter = buildLocationFilter({
    always_allow: ['belgium', 'brussels'],
    allow: ['europe', 'emea', 'remote'],
    block: ['france', 'germany', 'united states'],
  });

  // Case 1: home-region passes regardless of other text
  if (filter('Brussels, Belgium') === true) pass('Brussels, Belgium passes (always_allow hit)');
  else fail('Brussels, Belgium should pass');

  // Case 2: always_allow wins over block (THE motivating case for this tier)
  if (filter('Remote, Belgium or France') === true) pass('Remote, Belgium or France passes (always_allow beats block)');
  else fail('Remote, Belgium or France should pass — always_allow must win over block');

  // Case 3: no always_allow hit, block still rejects
  if (filter('Paris, France') === false) pass('Paris, France is rejected (block still applies)');
  else fail('Paris, France should be rejected');

  // Case 4: empty location → pass (existing semantics, unchanged)
  if (filter('') === true) pass('empty location passes (unchanged semantics)');
  else fail('empty location should pass');

  // Case 5: case-insensitivity
  if (filter('BRUSSELS, BELGIUM') === true) pass('case-insensitive match works');
  else fail('case-insensitive match failed');

  // Case 6: backward compatibility — no always_allow key behaves like stock allow/block
  const stockFilter = buildLocationFilter({
    allow: ['europe', 'remote'],
    block: ['france'],
  });
  if (stockFilter('Remote, Belgium or France') === false) pass('without always_allow, block still wins (backward compatible)');
  else fail('without always_allow, behaviour must match stock allow/block (block wins)');

  // Case 7: null/missing locationFilter → pass-all filter (early-return path)
  const nullFilter = buildLocationFilter(null);
  if (nullFilter('Anywhere on Earth') === true && nullFilter('') === true) {
    pass('null locationFilter returns a pass-all filter (early-return path)');
  } else {
    fail('null locationFilter should return a pass-all filter');
  }

  // Case 8: string-instead-of-array → wrapped to a 1-item list
  const stringFilter = buildLocationFilter({ always_allow: 'belgium', block: ['france'] });
  if (stringFilter('Remote, Belgium or France') === true) {
    pass('always_allow as a bare string is wrapped to a single-item list');
  } else {
    fail('always_allow as a bare string should still work');
  }

  // Case 9: null/non-string items are filtered out (no crash, no false matches)
  const messyFilter = buildLocationFilter({
    always_allow: [null, 'belgium', 42, undefined],
    block: ['france', null, 7],
  });
  if (messyFilter('Brussels, Belgium') === true && messyFilter('Paris, France') === false) {
    pass('non-string entries (null, numbers, undefined) are filtered out without crashing');
  } else {
    fail('mixed-type keyword lists should not crash and should still match string entries');
  }

  // Case 10: all-null/non-string list → empty after normalization (no false rejects)
  const allBadFilter = buildLocationFilter({ block: [null, 42, undefined], allow: ['remote'] });
  if (allBadFilter('Remote') === true) {
    pass('a block list with only non-string entries normalizes to [] (no false rejects)');
  } else {
    fail('non-string-only block list should not cause rejection');
  }

  // Case 11: empty / whitespace-only entries are dropped (would otherwise pass-all via includes(''))
  const emptyKeywordFilter = buildLocationFilter({
    always_allow: ['', '  '],
    allow: ['remote'],
    block: ['france'],
  });
  if (emptyKeywordFilter('Paris, France') === false) {
    pass('empty/whitespace always_allow entries are dropped (no pass-all via includes(""))');
  } else {
    fail('empty always_allow entries should NOT bypass block — would have made the filter pass-all');
  }

  // Case 12: surrounding whitespace is trimmed so the keyword still matches
  const whitespaceFilter = buildLocationFilter({
    always_allow: ['  Belgium  ', '\tBrussels\n'],
    block: ['france'],
  });
  if (whitespaceFilter('Remote, Belgium or France') === true) {
    pass('whitespace-padded keywords still match after trim');
  } else {
    fail('"  Belgium  " should be trimmed and still match "Remote, Belgium or France"');
  }

  // Case 13: whitespace-only location is treated as missing (pass-all-tiers)
  if (filter('   \t  ') === true) pass('whitespace-only location passes (treated as missing)');
  else fail('whitespace-only location should pass');

  // Case 14: non-string location (number/object/null) → pass without throwing
  let crashed = false;
  try {
    const r1 = filter(42);
    const r2 = filter({ city: 'Brussels' });
    const r3 = filter(null);
    const r4 = filter(undefined);
    if (r1 === true && r2 === true && r3 === true && r4 === true) {
      pass('non-string location values (number, object, null, undefined) pass without throwing');
    } else {
      fail(`non-string location results: number=${r1}, object=${r2}, null=${r3}, undefined=${r4}`);
    }
  } catch (e) {
    crashed = true;
    fail(`non-string location crashed: ${e.message}`);
  }

  // Case 15: a malformed location (e.g. legacy object) does NOT bypass block when interpreted naively —
  // the guard returns true (pass) BEFORE block/allow even run, which is correct: scoring/eval happens
  // downstream from the scan filter, so malformed locations should fall through to the manual evaluation
  // step rather than being silently dropped here.
  if (filter(42) === true) pass('non-string locations are passed through to downstream evaluation, not silently dropped');
  else fail('non-string locations should pass through');

} catch (e) {
  fail(`always_allow tests crashed: ${e.message}`);
}

// ── 12. PROVIDERS — Workable ────────────────────────────────────────

console.log('\n12. Provider — workable');

try {
  const workable = (await import(pathToFileURL(join(ROOT, 'providers/workable.mjs')).href)).default;
  const { parseWorkableMarkdown } = await import(pathToFileURL(join(ROOT, 'providers/workable.mjs')).href);

  // detect() — auto-detection from careers_url
  if (workable.id === 'workable') pass('workable.id is "workable"');
  else fail(`workable.id is ${JSON.stringify(workable.id)}`);

  const hit = workable.detect({ name: 'TestCo', careers_url: 'https://apply.workable.com/optimile' });
  if (hit && hit.url === 'https://apply.workable.com/optimile/jobs.md') {
    pass('workable.detect() resolves apply.workable.com/<slug> → /jobs.md feed');
  } else {
    fail(`workable.detect() returned ${JSON.stringify(hit)}`);
  }

  const miss = workable.detect({ name: 'TestCo', careers_url: 'https://example.com/careers' });
  if (miss === null) pass('workable.detect() returns null for non-workable URLs');
  else fail(`workable.detect() should return null, got ${JSON.stringify(miss)}`);

  // parse() — markdown table
  const sampleMd = [
    '# Optimile — All Open Positions',
    '',
    '| Title | Department | Location | Type | Salary | Posted | Details |',
    '|---|---|---|---|---|---|---|',
    '| Senior AI PM | Product | Ghent, Belgium | Full-time | — | 2026-04-01 | [View](https://apply.workable.com/optimile/jobs/view/ABC123.md) |',
    '| Tech Lead | Engineering | Remote | Full-time | — | 2026-03-25 | [View](https://apply.workable.com/optimile/jobs/view/DEF456.md) |',
  ].join('\n');

  const jobs = parseWorkableMarkdown(sampleMd, 'Optimile');
  if (jobs.length === 2) pass('parseWorkableMarkdown extracts 2 jobs from 2-row table');
  else fail(`parseWorkableMarkdown returned ${jobs.length} jobs, expected 2`);

  if (jobs[0]?.title === 'Senior AI PM' && jobs[0]?.location === 'Ghent, Belgium' && jobs[0]?.company === 'Optimile') {
    pass('parseWorkableMarkdown extracts title, location, company correctly');
  } else {
    fail(`parseWorkableMarkdown row 0 = ${JSON.stringify(jobs[0])}`);
  }

  if (jobs[0]?.url === 'https://apply.workable.com/optimile/jobs/view/ABC123') {
    pass('parseWorkableMarkdown strips .md suffix from job URL');
  } else {
    fail(`parseWorkableMarkdown should strip .md; got url=${JSON.stringify(jobs[0]?.url)}`);
  }

  // Robustness
  if (parseWorkableMarkdown('', 'X').length === 0) pass('empty input → empty result');
  else fail('empty input should yield empty result');

  if (parseWorkableMarkdown(null, 'X').length === 0) pass('null input → empty result (no crash)');
  else fail('null input should yield empty result without crashing');

  // fetch() reaches the http context on the happy path (allowed hostname).
  await workable.fetch(
    { name: 'Smoke', careers_url: 'https://apply.workable.com/optimile' },
    {
      transport: 'http',
      fetchText: async (url) => {
        if (!url.startsWith('https://apply.workable.com/')) {
          throw new Error('fetchText called with unexpected URL');
        }
        return '| Title | Department | Location | Type | Salary | Posted | Details |\n|---|---|---|---|---|---|---|\n';
      },
      fetchJson: async () => { throw new Error('fetchJson should not be called'); },
    },
  );
  pass('workable.fetch() reaches fetchText on the happy path (allowed hostname)');

  // fetch() rejects an unresolvable careers_url (no apply.workable.com match in URL).
  let rejected = false;
  try {
    await workable.fetch(
      { name: 'BadUrl', careers_url: 'https://evil.com/totally-not-workable' },
      {
        transport: 'http',
        fetchText: async () => { throw new Error('SSRF! should not reach here'); },
        fetchJson: async () => { throw new Error('SSRF! should not reach here'); },
      },
    );
  } catch (e) {
    if (e.message.includes('cannot derive feed URL')) {
      rejected = true;
    } else {
      fail(`workable.fetch() rejected with wrong error: ${e.message}`);
    }
  }
  if (rejected) pass('workable.fetch() rejects unresolvable careers_url before fetch');
  else fail('workable.fetch() should throw cannot-derive-feed-URL for non-Workable URLs');

  // SSRF: malicious URL with apply.workable.com in the PATH (not hostname) must not be detected as Workable.
  // With strict URL parsing, the hostname `evil.example` fails the check and detect() returns null.
  if (workable.detect({ name: 'Spoof', careers_url: 'https://evil.example/apply.workable.com/slug' }) === null) {
    pass('workable.detect() rejects path-spoofed URLs (apply.workable.com in path, not hostname)');
  } else {
    fail('workable.detect() must NOT misdetect URLs that contain apply.workable.com in the path');
  }

  // careers_url with non-string value (e.g. YAML mistake passing a number) → detect() returns null without crashing
  if (workable.detect({ name: 'X', careers_url: 42 }) === null) {
    pass('workable.detect() returns null for non-string careers_url (42)');
  } else {
    fail('workable.detect() should treat non-string careers_url as missing');
  }

  // Workable parser tolerates a title with a stray pipe — URL is extracted from the line, not cols[7]
  const strayPipeMd = [
    '| Title | Department | Location | Type | Salary | Posted | Details |',
    '|---|---|---|---|---|---|---|',
    '| Senior PM (full | part-time) | Product | Remote | Full-time | — | 2026-04-01 | [View](https://apply.workable.com/x/jobs/view/PIPE.md) |',
  ].join('\n');
  const strayJobs = parseWorkableMarkdown(strayPipeMd, 'X');
  if (strayJobs.length === 1 && strayJobs[0].url === 'https://apply.workable.com/x/jobs/view/PIPE') {
    pass('parseWorkableMarkdown extracts URL from line-level regex (survives stray pipes in title)');
  } else {
    fail(`stray-pipe row not handled correctly: ${JSON.stringify(strayJobs)}`);
  }

  // Off-domain [View] link is dropped (URL validation)
  const offDomainMd = [
    '| Title | Department | Location | Type | Salary | Posted | Details |',
    '|---|---|---|---|---|---|---|',
    '| Good Role | Product | Remote | Full-time | — | 2026-04-01 | [View](https://apply.workable.com/x/jobs/view/ABC.md) |',
    '| Evil Role | Product | Remote | Full-time | — | 2026-04-01 | [View](https://evil.example/jobs/view/X) |',
    '| Insecure Role | Product | Remote | Full-time | — | 2026-04-01 | [View](http://apply.workable.com/x/jobs/view/Y.md) |',
  ].join('\n');
  const filteredJobs = parseWorkableMarkdown(offDomainMd, 'X');
  if (filteredJobs.length === 1 && filteredJobs[0].title === 'Good Role') {
    pass('parseWorkableMarkdown drops off-domain and non-https [View] links');
  } else {
    fail(`expected only "Good Role" through, got ${JSON.stringify(filteredJobs.map(j => j.title))}`);
  }

} catch (e) {
  fail(`workable provider tests crashed: ${e.message}`);
}

// ── 13. PROVIDERS — SmartRecruiters ─────────────────────────────────

console.log('\n13. Provider — smartrecruiters');

try {
  const sr = (await import(pathToFileURL(join(ROOT, 'providers/smartrecruiters.mjs')).href)).default;
  const { parseSmartRecruitersResponse } = await import(pathToFileURL(join(ROOT, 'providers/smartrecruiters.mjs')).href);

  if (sr.id === 'smartrecruiters') pass('smartrecruiters.id is "smartrecruiters"');
  else fail(`smartrecruiters.id is ${JSON.stringify(sr.id)}`);

  const hitCareers = sr.detect({ name: 'Adyen', careers_url: 'https://careers.smartrecruiters.com/adyen' });
  if (hitCareers && hitCareers.url.startsWith('https://api.smartrecruiters.com/v1/companies/adyen/postings')) {
    pass('smartrecruiters.detect() resolves careers.smartrecruiters.com/<slug> → api URL');
  } else {
    fail(`smartrecruiters.detect(careers) returned ${JSON.stringify(hitCareers)}`);
  }

  const hitJobs = sr.detect({ name: 'X', careers_url: 'https://jobs.smartrecruiters.com/x' });
  if (hitJobs && hitJobs.url.startsWith('https://api.smartrecruiters.com/v1/companies/x/postings')) {
    pass('smartrecruiters.detect() also handles jobs.smartrecruiters.com');
  } else {
    fail(`smartrecruiters.detect(jobs) returned ${JSON.stringify(hitJobs)}`);
  }

  if (sr.detect({ name: 'X', careers_url: 'https://example.com/careers' }) === null) {
    pass('smartrecruiters.detect() returns null for non-SR URLs');
  } else {
    fail('smartrecruiters.detect() should return null for non-SR URLs');
  }

  // parseSmartRecruitersResponse
  const sample = {
    content: [
      {
        id: 'abc-123',
        name: 'Senior PM',
        ref: 'https://api.smartrecruiters.com/v1/companies/sgs/postings/abc-123',
        location: { fullLocation: 'Geneva, Switzerland', remote: false },
      },
      {
        id: 'def-456',
        name: 'Remote AI Engineer',
        ref: 'https://api.smartrecruiters.com/v1/companies/sgs/postings/def-456',
        location: { city: 'Paris', country: 'France', remote: true },
      },
      {
        id: 'ghi-789',
        name: 'No-ref Role',
        location: { fullLocation: 'Berlin, Germany' },
      },
    ],
  };
  const jobs = parseSmartRecruitersResponse(sample, 'SGS');
  if (jobs.length === 3) pass('parseSmartRecruitersResponse extracts 3 jobs');
  else fail(`parseSmartRecruitersResponse returned ${jobs.length} jobs`);

  if (jobs[0]?.location === 'Geneva, Switzerland' && jobs[0]?.title === 'Senior PM') {
    pass('parseSmartRecruitersResponse uses fullLocation when present');
  } else {
    fail(`row 0 = ${JSON.stringify(jobs[0])}`);
  }

  if (jobs[1]?.location === 'Paris, France, Remote') {
    pass('parseSmartRecruitersResponse builds location from city/country/remote when no fullLocation');
  } else {
    fail(`row 1 location = ${JSON.stringify(jobs[1]?.location)}, expected "Paris, France, Remote"`);
  }

  if (jobs[0]?.url === 'https://jobs.smartrecruiters.com/sgs/postings/abc-123') {
    pass('parseSmartRecruitersResponse rewrites api.smartrecruiters.com → jobs.smartrecruiters.com');
  } else {
    fail(`row 0 url = ${JSON.stringify(jobs[0]?.url)}`);
  }

  if (jobs[2]?.url && jobs[2].url.startsWith('https://jobs.smartrecruiters.com/sgs/ghi-789')) {
    pass('parseSmartRecruitersResponse falls back to synthetic URL when ref is missing');
  } else {
    fail(`row 2 url = ${JSON.stringify(jobs[2]?.url)}`);
  }

  // Empty input safety
  if (parseSmartRecruitersResponse({}, 'X').length === 0) pass('empty {} input → empty result');
  else fail('empty {} input should yield empty result');

  if (parseSmartRecruitersResponse({ content: 'not an array' }, 'X').length === 0) {
    pass('non-array content → empty result (no crash)');
  } else {
    fail('non-array content should yield empty result');
  }

  // careers_url with non-string value → detect() returns null without crashing
  if (sr.detect({ name: 'X', careers_url: { foo: 'bar' } }) === null) {
    pass('smartrecruiters.detect() returns null for non-string careers_url (object)');
  } else {
    fail('smartrecruiters.detect() should treat non-string careers_url as missing');
  }

  // Fallback URL when both ref AND id are missing → empty string (not "undefined" in URL)
  const noRefNoId = parseSmartRecruitersResponse(
    { content: [{ name: 'Stranded Role' }] },
    'X',
  );
  if (noRefNoId.length === 1 && noRefNoId[0].url === '') {
    pass('parseSmartRecruitersResponse returns url="" when both ref and id are missing');
  } else {
    fail(`expected url='' when ref+id both missing, got ${JSON.stringify(noRefNoId[0])}`);
  }

  // SSRF: malicious URL with smartrecruiters hostname in the PATH (not host) must not be detected.
  if (sr.detect({ name: 'Spoof', careers_url: 'https://evil.example/careers.smartrecruiters.com/slug' }) === null) {
    pass('smartrecruiters.detect() rejects path-spoofed URLs');
  } else {
    fail('smartrecruiters.detect() must NOT misdetect path-spoofed URLs');
  }

  // SmartRecruiters: untrusted j.ref host falls through to fallback rather than rewriting
  const bogusRef = parseSmartRecruitersResponse(
    { content: [{ id: 'X1', name: 'Strange Role', ref: 'https://evil.example/v1/companies/x/postings/X1' }] },
    'TestCo',
  );
  if (bogusRef[0]?.url && !bogusRef[0].url.includes('evil.example')) {
    pass('parseSmartRecruitersResponse rejects untrusted j.ref host (falls through to fallback)');
  } else {
    fail(`untrusted j.ref leaked into url: ${JSON.stringify(bogusRef[0]?.url)}`);
  }

  // SmartRecruiters: companyName with spaces/symbols is slugified for the fallback URL
  const slugifiedCompany = parseSmartRecruitersResponse(
    { content: [{ id: 'X2', name: 'Strange Role' }] },
    'My Acme & Co.',
  );
  if (slugifiedCompany[0]?.url === 'https://jobs.smartrecruiters.com/my-acme-co/X2-strange-role') {
    pass('parseSmartRecruitersResponse slugifies the companyName for the fallback URL');
  } else {
    fail(`fallback URL not properly slugified: ${JSON.stringify(slugifiedCompany[0]?.url)}`);
  }

  // Pagination: fetch() loops until an empty page (or short page) is returned
  let pageRequests = 0;
  const pagedJobs = await sr.fetch(
    { name: 'PagedCo', careers_url: 'https://careers.smartrecruiters.com/paged' },
    {
      transport: 'http',
      fetchText: async () => { throw new Error('fetchText should not be called'); },
      fetchJson: async (url) => {
        pageRequests++;
        const offset = parseInt(new URL(url).searchParams.get('offset') || '0', 10);
        if (offset === 0) {
          // Page 1: full page (100 items)
          return { content: Array.from({ length: 100 }, (_, i) => ({ id: `P1-${i}`, name: `Role 1-${i}` })) };
        }
        if (offset === 100) {
          // Page 2: short page (50 items) → loop stops after this
          return { content: Array.from({ length: 50 }, (_, i) => ({ id: `P2-${i}`, name: `Role 2-${i}` })) };
        }
        // Should not be reached because page 2 was short
        return { content: [] };
      },
    },
  );
  if (pageRequests === 2 && pagedJobs.length === 150) {
    pass('smartrecruiters.fetch() paginates and aggregates results (2 pages → 150 total)');
  } else {
    fail(`pagination: pageRequests=${pageRequests}, total=${pagedJobs.length} (expected 2 requests / 150 results)`);
  }

  // Pagination stop condition: empty content terminates the loop
  let emptyPageRequests = 0;
  const emptyJobs = await sr.fetch(
    { name: 'EmptyCo', careers_url: 'https://careers.smartrecruiters.com/empty' },
    {
      transport: 'http',
      fetchText: async () => { throw new Error('fetchText should not be called'); },
      fetchJson: async () => {
        emptyPageRequests++;
        return { content: [] };
      },
    },
  );
  if (emptyPageRequests === 1 && emptyJobs.length === 0) {
    pass('smartrecruiters.fetch() stops on the first empty page');
  } else {
    fail(`empty pagination: requests=${emptyPageRequests}, total=${emptyJobs.length}`);
  }

} catch (e) {
  fail(`smartrecruiters provider tests crashed: ${e.message}`);
}

// ── 14. PROVIDERS — Recruitee ───────────────────────────────────────

console.log('\n14. Provider — recruitee');

try {
  const recruitee = (await import(pathToFileURL(join(ROOT, 'providers/recruitee.mjs')).href)).default;
  const { parseRecruiteeResponse } = await import(pathToFileURL(join(ROOT, 'providers/recruitee.mjs')).href);

  if (recruitee.id === 'recruitee') pass('recruitee.id is "recruitee"');
  else fail(`recruitee.id is ${JSON.stringify(recruitee.id)}`);

  const hit = recruitee.detect({ name: 'Channable', careers_url: 'https://channable.recruitee.com' });
  if (hit && hit.url === 'https://channable.recruitee.com/api/offers/') {
    pass('recruitee.detect() resolves <slug>.recruitee.com → api offers');
  } else {
    fail(`recruitee.detect() returned ${JSON.stringify(hit)}`);
  }

  if (recruitee.detect({ name: 'X', careers_url: 'https://example.com/careers' }) === null) {
    pass('recruitee.detect() returns null for non-recruitee URLs');
  } else {
    fail('recruitee.detect() should return null for non-recruitee URLs');
  }

  // parseRecruiteeResponse
  const sample = {
    offers: [
      { title: 'Senior PM', careers_url: 'https://channable.recruitee.com/o/senior-pm', city: 'Utrecht', country: 'Netherlands', remote: false },
      { title: 'Backend Eng', url: 'https://channable.recruitee.com/o/backend', city: 'Amsterdam', country: 'Netherlands', remote: true },
      { title: 'AI Lead', location: 'Remote, EMEA' },
    ],
  };
  const jobs = parseRecruiteeResponse(sample, 'Channable');
  if (jobs.length === 3) pass('parseRecruiteeResponse extracts 3 offers');
  else fail(`parseRecruiteeResponse returned ${jobs.length} offers`);

  if (jobs[0]?.title === 'Senior PM' && jobs[0]?.company === 'Channable' && jobs[0]?.url === 'https://channable.recruitee.com/o/senior-pm') {
    pass('parseRecruiteeResponse prefers careers_url field over url');
  } else {
    fail(`row 0 = ${JSON.stringify(jobs[0])}`);
  }

  if (jobs[1]?.location === 'Amsterdam, Netherlands, Remote') {
    pass('parseRecruiteeResponse assembles city/country/remote when no location field');
  } else {
    fail(`row 1 location = ${JSON.stringify(jobs[1]?.location)}, expected "Amsterdam, Netherlands, Remote"`);
  }

  if (jobs[2]?.location === 'Remote, EMEA') {
    pass('parseRecruiteeResponse uses explicit location field when present');
  } else {
    fail(`row 2 location = ${JSON.stringify(jobs[2]?.location)}`);
  }

  if (parseRecruiteeResponse({}, 'X').length === 0) pass('empty {} → empty result');
  else fail('empty {} should yield empty result');

  if (parseRecruiteeResponse({ offers: null }, 'X').length === 0) {
    pass('null offers → empty result (no crash)');
  } else {
    fail('null offers should yield empty result');
  }

  // careers_url with non-string value → detect() returns null without crashing
  if (recruitee.detect({ name: 'X', careers_url: null }) === null && recruitee.detect({ name: 'X', careers_url: 7 }) === null) {
    pass('recruitee.detect() returns null for non-string careers_url (null and 7)');
  } else {
    fail('recruitee.detect() should treat non-string careers_url as missing');
  }

  // SSRF: malicious URL with recruitee.com in the PATH (not host) must not be detected.
  if (recruitee.detect({ name: 'Spoof', careers_url: 'https://evil.example/channable.recruitee.com/foo' }) === null) {
    pass('recruitee.detect() rejects path-spoofed URLs');
  } else {
    fail('recruitee.detect() must NOT misdetect path-spoofed URLs');
  }

  // Off-domain offer URL is dropped (URL validation)
  const offDomainOffers = parseRecruiteeResponse(
    {
      offers: [
        { title: 'Good', careers_url: 'https://channable.recruitee.com/o/good' },
        { title: 'Evil', careers_url: 'https://evil.example/o/evil' },
        { title: 'Insecure', careers_url: 'http://channable.recruitee.com/o/insecure' },
        { title: 'No URL field' },
      ],
    },
    'Channable',
  );
  if (offDomainOffers[0]?.url === 'https://channable.recruitee.com/o/good' && offDomainOffers[1]?.url === '' && offDomainOffers[2]?.url === '' && offDomainOffers[3]?.url === '') {
    pass('parseRecruiteeResponse drops off-domain, non-https, and missing offer URLs');
  } else {
    fail(`URL validation: row0=${JSON.stringify(offDomainOffers[0]?.url)}, row1=${JSON.stringify(offDomainOffers[1]?.url)}, row2=${JSON.stringify(offDomainOffers[2]?.url)}, row3=${JSON.stringify(offDomainOffers[3]?.url)}`);
  }

} catch (e) {
  fail(`recruitee provider tests crashed: ${e.message}`);
}

// ── 12. TRACKER REPORT LINK NORMALIZATION (#760) ────────────────

console.log('\n12. Tracker report-link normalization');

try {
  const { normalizeReportLink } = await import(pathToFileURL(join(ROOT, 'tracker-links.mjs')).href);
  const repo = '/repo';
  const dataDir = join(repo, 'data');

  // data/ layout: root-relative TSV link → ../reports/...
  const fromTsv = normalizeReportLink('[12](reports/012-acme-2026-01-04.md)', dataDir, repo);
  if (fromTsv === '[12](../reports/012-acme-2026-01-04.md)') {
    pass('data/ layout: root-relative link rewritten to ../reports/...');
  } else {
    fail(`data/ layout normalization wrong: ${fromTsv}`);
  }

  // Idempotent: re-running on an already-normalized link must not double-prefix
  const twice = normalizeReportLink(fromTsv, dataDir, repo);
  if (twice === fromTsv) {
    pass('normalization is idempotent (no double-prefix on re-run)');
  } else {
    fail(`normalization not idempotent: ${twice}`);
  }

  // Root layout: tracker at repo root → link stays reports/...
  const atRoot = normalizeReportLink('[12](reports/012-acme-2026-01-04.md)', repo, repo);
  if (atRoot === '[12](reports/012-acme-2026-01-04.md)') {
    pass('root layout: link stays root-relative reports/...');
  } else {
    fail(`root layout normalization wrong: ${atRoot}`);
  }

  // Non-report links are left untouched — including external URLs that happen
  // to contain an embedded "/reports/" segment (must not be rewritten).
  const other = normalizeReportLink('[site](https://example.com/reports/foo.md)', dataDir, repo);
  if (other === '[site](https://example.com/reports/foo.md)') {
    pass('non-report links (incl. URLs with embedded /reports/) are left untouched');
  } else {
    fail(`non-report link altered: ${other}`);
  }


} catch (e) {
  fail(`tracker-link normalization tests crashed: ${e.message}`);
}

// ── 15. AUTOFILL FIELD CLASSIFICATION ───────────────────────────

console.log('\n15. Autofill field classification (deterministic, no LLM)');

try {
  const { classifyField, classifyForm } = await import(pathToFileURL(join(ROOT, 'autofill-fields.mjs')).href);

  const ck = (label, type, exp) => {
    const got = classifyField(label, type).kind;
    if (got === exp) pass(`"${label}" → ${exp}`);
    else fail(`"${label}" → ${got} (expected ${exp})`);
  };
  ck('First Name', 'text', 'standard');
  ck('Email', 'email', 'standard');
  ck('Are you legally authorized to work?', 'select', 'standard');
  ck('Desired salary', 'text', 'salary');               // never auto-filled
  ck('Gender', 'select', 'demographic');                // always left blank
  ck('Why do you want to work here?', 'textarea', 'free_text');
  ck('Resume/CV', 'file', 'file');
  ck('Favourite programming language?', 'text', 'unmapped');

  // user mapping override wins
  const mapped = classifyField('How did you find this role', 'text', {}, { 'how did you find this role': 'how_did_you_hear' });
  if (mapped.kind === 'standard' && mapped.profileKey === 'how_did_you_hear') pass('user mapping override resolves to standard');
  else fail('user mapping override did not resolve');

  const form = classifyForm([
    { label: 'First Name', type: 'text', required: true },
    { label: 'Why us?', type: 'textarea', required: true },
  ]);
  if (!form.allStandard && form.requiredUnresolved.length === 1) pass('classifyForm flags a required free-text field as unresolved');
  else fail('classifyForm verdict wrong');
} catch (e) {
  fail(`autofill classification tests crashed: ${e.message}`);
}

// ── 16. APPLICATION CORE (pure helpers) ─────────────────────────

console.log('\n16. Application core (status + tracker rendering)');

try {
  const ac = await import(pathToFileURL(join(ROOT, 'application-core.mjs')).href);

  if (ac.validateStatus('applied') === 'Applied' && ac.validateStatus('aplicado') === 'Applied') pass('validateStatus normalizes aliases to canonical');
  else fail('validateStatus alias normalization failed');
  if (ac.validateStatus('garbage') === 'Evaluated') pass('validateStatus defaults unknown → Evaluated');
  else fail('validateStatus default failed');

  if (ac.nextTrackerNum([{ tracker_num: 3 }, { tracker_num: 7 }]) === 8) pass('nextTrackerNum = max + 1');
  else fail('nextTrackerNum wrong');

  const row = ac.renderRow({ tracker_num: 9, date_applied: '2026-06-15', company: 'Acme', title: 'SWE', score: '4.2/5', status: 'Applied', cv_pdf: 'cv.pdf', report: '[9](reports/009-acme-2026-06-15.md)', notes: 'ok' });
  if (row.startsWith('| 9 | 2026-06-15 | Acme | SWE | 4.2/5 | Applied | ✅ |') && /reports\/009-acme/.test(row)) pass('renderRow emits the canonical 9-column tracker row');
  else fail(`renderRow output wrong: ${row}`);
} catch (e) {
  fail(`application-core tests crashed: ${e.message}`);
}

// ── 17. OPEN-APPLICATION CAP (per-company hide) ─────────────────

console.log('\n17. Open-application cap (per-company)');

try {
  const { OPEN_STATUSES, isOpen } = await import(pathToFileURL(join(ROOT, 'application-core.mjs')).href);

  if (isOpen('Applied') && isOpen('Interview') && isOpen('Offer')) pass('Applied/Interview/Offer count as open');
  else fail('open-status set wrong');
  if (!isOpen('Rejected') && !isOpen('Discarded') && !isOpen('SKIP')) pass('Rejected/Discarded/SKIP are closed (free the slot)');
  else fail('closed statuses leaked into open set');

  // capped predicate over a synthetic application set (mirrors server openCountByCompany)
  const apps = [
    { company_key: 'greenhouse:acme', status: 'Applied' },
    { company_key: 'greenhouse:acme', status: 'Interview' },
    { company_key: 'greenhouse:acme', status: 'Applied' },
    { company_key: 'greenhouse:acme', status: 'Rejected' },   // closed → does NOT count
    { company_key: 'lever:initech', status: 'Applied' },
  ];
  const MAX = 3;
  const counts = {};
  for (const a of apps) if (isOpen(a.status)) counts[a.company_key] = (counts[a.company_key] || 0) + 1;
  if (counts['greenhouse:acme'] === 3 && counts['lever:initech'] === 1) pass('open count excludes closed applications');
  else fail(`open count wrong: ${JSON.stringify(counts)}`);
  const capped = Object.entries(counts).filter(([, n]) => n >= MAX).map(([k]) => k);
  if (capped.length === 1 && capped[0] === 'greenhouse:acme') pass('company with 3 open is capped; company with 1 is not');
  else fail(`capped set wrong: ${JSON.stringify(capped)}`);
} catch (e) {
  fail(`open-application cap tests crashed: ${e.message}`);
}

// ── 18. Title-family / level normalization ──────────────────────
console.log('\n18. Title normalization (title-family.mjs)');
try {
  const { normalizeTitle, levelFromYoe, titleFamily, TITLE_FAMILIES } = await import(pathToFileURL(join(ROOT, 'title-family.mjs')).href);
  const cases = [
    ['Senior Backend Engineer', 'backend', 'senior'],
    ['Staff Machine Learning Engineer', 'ml_eng', 'staff'],
    ['L5 Software Engineer', 'software_general', 'senior'],
    ['IC4 Infrastructure Engineer', 'platform_infra', 'senior'],
    ['Senior Member of Technical Staff', 'other', 'senior'],
    ['SDE II', 'software_general', 'mid'],
    ['Software Engineer III', 'software_general', 'mid-senior'],
    ['Distinguished Engineer', 'other', 'principal'],
    ['Site Reliability Engineer', 'sre_devops', null],
    ['Data Scientist', 'data_science', null],
    ['Engineering Manager, Platform', 'eng_manager', null],
  ];
  let ok = 0;
  for (const [title, fam, lvl] of cases) {
    const r = normalizeTitle(title, {});
    if (r.title_family === fam && r.ladder_level === lvl) ok++;
    else fail(`normalizeTitle("${title}") → ${r.title_family}/${r.ladder_level}, expected ${fam}/${lvl}`);
  }
  if (ok === cases.length) pass(`normalizeTitle: ${ok}/${cases.length} title+level cases`);

  if (levelFromYoe(9) === 'staff' && levelFromYoe(6) === 'senior' && levelFromYoe(4) === 'mid-senior'
      && levelFromYoe(1) === 'mid' && levelFromYoe(null) === null) pass('levelFromYoe thresholds (8/5/3)');
  else fail('levelFromYoe thresholds wrong');

  // Every family the normalizer can emit must be declared, or the server validator rejects it.
  const emitted = new Set(cases.map(c => c[1]));
  if ([...emitted].every(f => TITLE_FAMILIES.includes(f))) pass('emitted families are all declared in TITLE_FAMILIES');
  else fail('normalizeTitle emitted a family missing from TITLE_FAMILIES');

  // A generic SWE title must NOT be guessed into a specialty.
  if (titleFamily('Software Engineer', {}) === 'software_general') pass('generic SWE is not guessed into a specialty');
  else fail('generic SWE mapped to a specialty family');
} catch (e) { fail(`title-family tests crashed: ${e.message}`); }

// ── 19. Comp bands: parsing, selection, validation ──────────────
console.log('\n19. Comp bands (comp-core.mjs)');
try {
  const C = await import(pathToFileURL(join(ROOT, 'comp-core.mjs')).href);
  const { TITLE_FAMILIES } = await import(pathToFileURL(join(ROOT, 'title-family.mjs')).href);

  // parsing: equity percentages must never be read as salary; hourly must annualize
  const p1 = C.parseCompString('$180K – $220K • Offers Equity');
  const p2 = C.parseCompString('$100K – $200K • 0.1% – 0.75%');
  const p3 = C.normalizeComp({ min: 50, max: 70, currency: 'USD', interval: 'per-hour-wage' });
  const p4 = C.normalizeComp({ compensationTierSummary: null, compensationTiers: [] });
  if (p1?.min === 180000 && p1?.max === 220000 && p1?.currency === 'USD') pass('parseCompString reads a $K range');
  else fail(`parseCompString range wrong: ${JSON.stringify(p1)}`);
  if (p2?.min === 100000 && p2?.max === 200000) pass('parseCompString ignores the equity-% segment');
  else fail(`parseCompString leaked equity %: ${JSON.stringify(p2)}`);
  if (p3?.min === 104000) pass('normalizeComp annualizes an hourly wage');
  else fail(`hourly annualization wrong: ${JSON.stringify(p3)}`);
  if (p4 === null) pass("normalizeComp rejects Ashby's empty placeholder");
  else fail(`empty Ashby object not rejected: ${JSON.stringify(p4)}`);

  // Ashby nests the real numbers; reading only the top level discarded 348 postings of
  // authoritative, currency-tagged comp and silently fell back to the LLM's prose reading.
  const ash = C.normalizeComp({ summaryComponents: [
    { compensationType: 'EquityPercentage', interval: 'NONE', minValue: null, maxValue: null },
    { compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 196900, maxValue: 246100 }] });
  if (ash?.min === 196900 && ash?.currency === 'USD') pass('normalizeComp reads Ashby nested salary');
  else fail(`Ashby nested salary not parsed: ${JSON.stringify(ash)}`);
  // Dual-currency JDs: "$180,000 to $240,000 USD ($175,000 to $245,000 CAD)". A paragraph-wide
  // currency search stamped CAD onto the USD numbers, inflating a Canadian band by ~35%.
  const dual = C.parseCompFromBody('The salary range for this position is $180,000 to $240,000 USD ($175,000 to $245,000 CAD) per year');
  if (dual?.min === 175000 && dual?.max === 245000 && dual?.currency === 'CAD')
    pass('a dual-currency JD binds each range to its own currency (and prefers CAD)');
  else fail(`dual-currency wrong: ${JSON.stringify(dual)}`);
  // Greenhouse splits a posted range across spans joined by &mdash;. Leaving the entity undecoded
  // meant the range was missed and jd-comp fell through to the extractor's guess — manufacturing
  // an `estimated` band for a company that had published a real number.
  const gh = C.parseCompFromBody('<div>The base salary range for this role is:</div><div class="pay-range"><span>$150,000</span><span class="divider">&mdash;</span><span>$200,000 USD</span></div>');
  if (gh?.min === 150000 && gh?.max === 200000 && gh?.currency === 'USD')
    pass('parseCompFromBody decodes &mdash; in Greenhouse pay-range markup');
  else fail(`greenhouse pay-range not parsed: ${JSON.stringify(gh)}`);
  if (C.parseCompFromBody('salary range $120,000 &ndash; $160,000 CAD')?.currency === 'CAD')
    pass('parseCompFromBody decodes &ndash; too');
  else fail('ndash not decoded');

  const bodyOnly = C.parseCompFromBody('salary range for this role is $165,000 to $260,000.');
  if (bodyOnly?.min === 165000 && bodyOnly?.max === 260000) pass('parseCompFromBody reads a plain JD range');
  else fail(`body range wrong: ${JSON.stringify(bodyOnly)}`);
  for (const [txt, why] of [
    ['annual revenue grew from $200,000 to $900,000', 'revenue'],
    ['we raised $10,000,000 to $50,000,000 in funding', 'funding'],
    ['equity grant of $100,000 to $400,000 in RSUs', 'equity'],
  ]) if (C.parseCompFromBody(txt) !== null) fail(`parseCompFromBody accepted ${why} figures`);
  pass('parseCompFromBody rejects revenue/funding/equity figures');
  // Lever emits 0 for an absent bound; a salary of 0 is never a real datum.
  if (C.normalizeComp({ min: 0, max: 230000, currency: 'CAD' })?.min == null) pass('a zero bound is treated as missing, not as $0');
  else fail('zero bound survived as a real number');
  if (C.normalizeComp({ min: 0, max: 0, currency: 'PHP' }) === null) pass('a 0-0 band is rejected outright');
  else fail('0-0 band survived');

  const ashHour = C.normalizeComp({ summaryComponents: [{ compensationType: 'Salary', interval: '1 HOUR', currencyCode: 'USD', minValue: 60, maxValue: 80 }] });
  if (ashHour?.min === 124800) pass('Ashby hourly interval is annualized');
  else fail(`Ashby hourly wrong: ${JSON.stringify(ashHour)}`);
  // Equity percentages sit in the same array as salary — reading one as pay would be catastrophic.
  if (C.normalizeComp({ summaryComponents: [{ compensationType: 'EquityPercentage', interval: 'NONE', minValue: 0.1, maxValue: 0.7 }] }) === null)
    pass('an equity-only Ashby blob is not read as salary');
  else fail('equity component was read as salary');

  // selection
  const mk = (fam, lvl, deriv, conf, n) => ({
    key: 'x:y', title_family: fam, ladder_level: lvl, derivation: deriv,
    band: { min: 100000, mid: 150000, max: 200000, currency: 'CAD', component: 'base' },
    provenance: { source: deriv === 'direct' ? 'jd_posted' : 'jd_rollup', confidence: conf, sample_size: n, as_of: '2026-07-01' },
  });
  const rows = [mk('backend', 'senior', 'direct', 'high', 5), mk('ml_eng', 'staff', 'direct', 'high', 5)];
  const prefs = { comp_band_max_age_days: 540 };
  const NOW = Date.parse('2026-07-31');

  const exact = C.bandFor(rows, 'backend', 'senior', prefs, NOW);
  if (exact?.derivation === 'direct') pass('bandFor: exact match keeps derivation "direct"');
  else fail(`exact match derivation wrong: ${exact?.derivation}`);

  const adj = C.bandFor(rows, 'backend', 'staff', prefs, NOW);
  if (adj?.derivation === 'inferred' && adj?.source === 'ladder_extrapolation')
    pass('bandFor: adjacent level is DEMOTED to inferred');
  else fail(`adjacent not demoted: ${JSON.stringify({ d: adj?.derivation, s: adj?.source })}`);

  if (C.bandFor(rows, 'security', 'senior', prefs, NOW) === null)
    pass('bandFor: returns null ACROSS title families (never a wrong-family number)');
  else fail('bandFor leaked a band across title families');

  const stale = C.bandFor([{ ...mk('backend', 'senior', 'direct', 'high', 5), provenance: { source: 'jd_posted', confidence: 'high', sample_size: 5, as_of: '2020-01-01' } }], 'backend', 'senior', prefs, NOW);
  if (stale?.confidence === 'low' && stale?.stale === true) pass('bandFor: a stale band is forced to low confidence');
  else fail(`staleness not applied: ${JSON.stringify({ c: stale?.confidence, s: stale?.stale })}`);

  // an estimated row must never beat a direct one for the same slot
  const mixed = [mk('backend', 'senior', 'estimated', 'low', 0), mk('backend', 'senior', 'direct', 'high', 5)];
  if (C.bandFor(mixed, 'backend', 'senior', prefs, NOW)?.derivation === 'direct')
    pass('bandFor: direct outranks estimated for the same slot');
  else fail('estimated band outranked a direct one');

  // validation
  const base = {
    key: 'x:y', title_family: 'backend', ladder_level: 'senior', derivation: 'estimated',
    band: { min: 1, max: 2 },
    provenance: { source: 'llm_prior', model: 'm', confidence: 'low', sample_size: 0, as_of: '2026-07-31' },
  };
  if (C.validateBandRow(base, { families: TITLE_FAMILIES }).length === 0) pass('validateBandRow accepts a well-formed llm_prior row');
  else fail(`valid row rejected: ${C.validateBandRow(base, { families: TITLE_FAMILIES }).join('; ')}`);

  const checks = [
    ['a company-agnostic row', { ...base, key: null }],
    ['a mislabeled derivation', { ...base, derivation: 'direct' }],
    ['an llm_prior row with no model', { ...base, provenance: { ...base.provenance, model: undefined } }],
    ['an uncited llm_research row', { ...base, derivation: 'inferred', provenance: { source: 'llm_research', confidence: 'low', sample_size: 1, as_of: '2026-07-31' } }],
    ['an estimated row claiming high confidence', { ...base, provenance: { ...base.provenance, confidence: 'high' } }],
  ];
  let rej = 0;
  for (const [label, row] of checks) {
    if (C.validateBandRow(row, { families: TITLE_FAMILIES }).length > 0) rej++;
    else fail(`validateBandRow ACCEPTED ${label}`);
  }
  if (rej === checks.length) pass(`validateBandRow rejects all ${rej} malformed shapes`);
} catch (e) { fail(`comp-core tests crashed: ${e.message}`); }

// ── 20. Comp scoring: listed wins, derived shrinks ──────────────
console.log('\n20. Comp imputation (score-postings.mjs)');
try {
  const S = await import(pathToFileURL(join(ROOT, 'score-postings.mjs')).href);
  const prefs = {
    usd_to_cad: 1.35, base_to_tc: 1.0, comp_impute: true, comp_imputed_min_sample: 1,
    comp_direct_shrink: 1.0, comp_imputed_shrink: { high: 0.8, medium: 0.55, low: 0.3 },
    comp_use_estimated: false, comp_estimated_shrink: 0.15,
    comp_tiers: [{ min: 200000, score: 5 }, { min: 180000, score: 4 }, { min: 160000, score: 3 }, { min: 150000, score: 2 }, { min: 0, score: 1 }],
  };
  const band = (d, conf) => ({ mid: 250000, currency: 'CAD', component: 'base', derivation: d, confidence: conf, sample_size: 5 });

  // a LISTED figure must be used verbatim and never replaced by a band
  const listed = S.COMPUTERS.comp({ comp: { min: 250000, currency: 'CAD' }, _comp_band: band('estimated', 'low') }, prefs);
  if (listed === 5) pass('listed comp wins over any band');
  else fail(`listed comp not honored: ${listed}`);

  // The ATS's structured field beats the LLM's prose reading. They disagree on CURRENCY 38% of
  // the time, and a USD range mislabeled CAD skips usd_to_cad and understates the role by ~35%.
  const conflict = S.COMPUTERS.comp({
    comp: { min: 160000, max: 210000, currency: 'CAD' },        // LLM's reading
    _scanned_comp: { min: 196900, max: 246100, currency: 'USD' }, // ATS ground truth
  }, prefs);
  const atsOnly = S.COMPUTERS.comp({ _scanned_comp: { min: 196900, max: 246100, currency: 'USD' } }, prefs);
  if (conflict === atsOnly) pass('the ATS structured field outranks the LLM comp extraction');
  else fail(`scanner precedence wrong: conflict=${conflict} atsOnly=${atsOnly}`);

  if (S.COMPUTERS.comp({ _comp_band: band('direct', 'high') }, prefs) === 5) pass('direct band scores at full strength');
  else fail('direct band was shrunk');

  const inf = S.COMPUTERS.comp({ _comp_band: band('inferred', 'medium') }, prefs);
  if (inf > 3 && inf < 5) pass(`inferred band shrinks toward neutral (${inf})`);
  else fail(`inferred shrink wrong: ${inf}`);

  if (S.COMPUTERS.comp({ _comp_band: band('estimated', 'low') }, prefs) === null)
    pass('estimated band does NOT score while comp_use_estimated is false');
  else fail('estimated band scored despite being disabled');

  const est = S.COMPUTERS.comp({ _comp_band: band('estimated', 'low') }, { ...prefs, comp_use_estimated: true });
  if (est > 3 && est < 3.5) pass(`estimated band is a nudge only when enabled (${est})`);
  else fail(`estimated shrink wrong: ${est}`);

  if (S.COMPUTERS.comp({ _comp_band: band('direct', 'high') }, { ...prefs, comp_impute: false }) === null)
    pass('comp_impute:false disables band fallback entirely');
  else fail('comp_impute:false did not disable imputation');

  if (S.COMPUTERS.comp({ _comp_band: { ...band('inferred', 'low'), sample_size: 0 } }, { ...prefs, comp_imputed_min_sample: 3 }) === null)
    pass('a band under the sample floor stays null');
  else fail('sample floor not enforced');

  // an imputed band must never be able to hard-exclude a posting
  const hf = S.evalHardFilters({ _comp_band: band('direct', 'high') }, [{ facet: '_comp_band', in: ['x'] }]);
  if (!hf.excluded) pass('an imputed band cannot trigger a hard filter');
  else fail('imputed band triggered a hard filter');
} catch (e) { fail(`comp scoring tests crashed: ${e.message}`); }

// ── 21. Research ledger (resumability + backoff) ─────────────────
console.log('\n21. Research ledger (research-ledger.mjs)');
try {
  const L = await import(pathToFileURL(join(ROOT, 'research-ledger.mjs')).href);
  const tmp = join(mkdtempSync(join(tmpdir(), 'ledger-')), 'l.tsv');
  const T = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  L.appendResearchAttempts([
    { key: 'a:ok', at: T(1), status: 'ok' },
    { key: 'a:f1', at: T(1), status: 'fetch_failed', detail: '404' },
    { key: 'a:f2', at: T(400), status: 'fetch_failed' },
    { key: 'a:f2', at: T(1), status: 'fetch_failed' },
    { key: 'a:rec', at: T(300), status: 'fetch_failed' },
    { key: 'a:rec', at: T(1), status: 'ok' },
  ], tmp);
  const led = L.loadResearchLedger(tmp);

  if (led.get('a:f2').fails === 2) pass('consecutive failures counted');
  else fail(`consecutive failures wrong: ${led.get('a:f2').fails}`);
  // A company that recovered must NOT stay exiled — this is why only CONSECUTIVE failures count.
  if (led.get('a:rec').fails === 0) pass('a later success resets the failure counter');
  else fail('recovered company still carries failures');
  if (L.backoffHours(2, 168) > L.backoffHours(1, 168)) pass('backoff grows with repeated failure');
  else fail('backoff does not grow');
  if (L.backoffHours(99, 168) === 168 * 16) pass('backoff is capped (a dead site is retried, not exiled)');
  else fail('backoff not capped');
  if (L.inBackoff(led.get('a:f1'), 0) === false) pass('SKIP_HOURS=0 disables the window');
  else fail('SKIP_HOURS=0 did not disable backoff');
  // A tab in a detail string would corrupt the TSV and silently shift every column.
  L.appendResearchAttempts([{ key: 'a:tabby', status: 'ok', detail: 'a\tb\nc' }], tmp);
  if (L.loadResearchLedger(tmp).get('a:tabby')?.status === 'ok') pass('tabs/newlines in detail are sanitized');
  else fail('a tab in detail corrupted the ledger row');
} catch (e) { fail(`research-ledger tests crashed: ${e.message}`); }

// ── 22. Research queue ordering (the Stage-3 work-list) ──────────
console.log('\n22. Research queue ordering (llm-triage.mjs)');
try {
  const { researchEligible } = await import(pathToFileURL(join(ROOT, 'llm-triage.mjs')).href);
  const A = {
    'c:great':  { live_relevant: 3, live_relevant_no_comp: 1, best_posting_score: 4.9, best_posting_rank: null, comp_band_rows: 0 },
    'c:ok':     { live_relevant: 9, live_relevant_no_comp: 0, best_posting_score: 3.1, best_posting_rank: null, comp_band_rows: 2 },
    'c:nopost': { live_relevant: 0, live_relevant_no_comp: 0, best_posting_score: null, best_posting_rank: null, comp_band_rows: 0 },
    'c:ranked': { live_relevant: 2, live_relevant_no_comp: 0, best_posting_score: 3.0, best_posting_rank: null, comp_band_rows: 0 },
    'c:dupe':   { live_relevant: 1, live_relevant_no_comp: 0, best_posting_score: 2.0, best_posting_rank: null, comp_band_rows: 0 },
    // triaged-only: no JD research yet, so only a Stage-2 rank exists
    'c:triaged':{ live_relevant: 4, live_relevant_no_comp: 2, best_posting_score: null, best_posting_rank: 5, comp_band_rows: 0 },
  };
  const agg = (k) => A[k] || { live_relevant: 0, live_relevant_no_comp: 0, best_posting_score: null, best_posting_rank: null, comp_band_rows: 0 };
  const P = (key, extra = {}) => ({ key, name: key, decision: 'undecided', llm_fit: null, llm_rank: null, excluded_by_type: false, ...extra });
  const rows = [
    P('c:great'), P('c:ok'), P('c:nopost'), P('c:ranked', { llm_rank: 5 }), P('c:triaged'),
    P('c:dupe'), P('c:dupe'),                                   // duplicate key
    P('c:done', { llm_fit: 4 }), P('c:skipped', { decision: 'skip' }), P('c:excl', { excluded_by_type: true }),
  ];
  const keys = (o) => researchEligible(rows, agg, new Map(), o).map(p => p.key);

  const q = keys({});
  // The whole point of the rewrite: order by the quality of a company's real postings.
  if (q[0] === 'c:great') pass('orders by best_posting_score (the best live posting wins)');
  else fail(`wrong head: ${q[0]}`);
  // A company with no scored live postings is exactly what the old queue emitted alphabetically.
  if (!q.includes('c:nopost')) pass('excludes companies with no scored live postings');
  else fail('a zero-posting company entered the queue');
  if (!q.includes('c:done')) pass('excludes already-researched companies (the queue drains)');
  else fail('a researched company stayed in the queue');
  if (!q.includes('c:skipped') && !q.includes('c:excl')) pass('excludes skipped and redlisted companies');
  else fail('a skipped/redlisted company entered the queue');
  if (q.filter(k => k === 'c:dupe').length === 1) pass('deduplicates repeated keys (no double fetches)');
  else fail('a duplicated key was emitted twice');

  // llm_rank must be a BOOST: it reorders within reach, but can't beat a much better posting,
  // and an UNRANKED company must not be buried (that was the old bug).
  if (q.indexOf('c:ranked') > q.indexOf('c:great')) pass('a rank-5 does not outrank a much better posting');
  else fail('llm_rank overpowered posting quality');
  if (keys({ rankWeight: 0 }).indexOf('c:ranked') > keys({}).indexOf('c:ranked'))
    pass('--rank-weight 0 removes the llm_rank boost');
  else fail('rank-weight had no effect');

  if (!keys({ minLive: 5 }).includes('c:great') && keys({ minLive: 5 }).includes('c:ok'))
    pass('--min-live filters on posting volume');
  else fail('min-live filter wrong');
  // needs-comp keeps only companies with unpriced roles AND no band on record.
  const nc = keys({ needsComp: true });
  if (nc.includes('c:great') && nc.includes('c:triaged') && !nc.includes('c:ok') && !nc.includes('c:dupe'))
    pass('--needs-comp keeps only companies with unpriced roles and no band');
  else fail(`needs-comp wrong: ${nc.join()}`);

  // The fallback: company research must NOT be gated on job research. Only ~15% of live postings
  // have Stage-3 facets, so without this the queue would hold 590 of 4,096 companies.
  if (q.includes('c:triaged')) pass('a company with only a triage rank still enters the queue');
  else fail('triaged-only company was excluded — company research is gated on job research');
  // …but researched evidence must still outrank an equally-numbered triage guess.
  const { postingQuality } = await import(pathToFileURL(join(ROOT, 'llm-triage.mjs')).href);
  if (postingQuality(A['c:triaged']).value < 5 && postingQuality(A['c:triaged']).basis === 'triaged')
    pass('a triage rank is discounted vs a researched rubric score');
  else fail('triage rank was not discounted');
  if (postingQuality(A['c:great']).basis === 'researched') pass('a researched score reports basis "researched"');
  else fail('basis mislabeled');

  // backoff integration
  const led = new Map([['c:great', { last: Date.now(), fails: 1 }]]);
  if (!researchEligible(rows, agg, led, {}).map(p => p.key).includes('c:great'))
    pass('a recently-failed company is held back by the ledger');
  else fail('backoff not applied in the queue');
  if (researchEligible(rows, agg, led, { rescan: true }).map(p => p.key).includes('c:great'))
    pass('--rescan overrides the backoff window');
  else fail('rescan did not override backoff');
} catch (e) { fail(`research queue tests crashed: ${e.message}`); }

// ── 23. Atomic saveJsonl ─────────────────────────────────────────
console.log('\n23. Atomic registry writes (posting-core.mjs)');
try {
  const { saveJsonl, loadJsonl } = await import(pathToFileURL(join(ROOT, 'posting-core.mjs')).href);
  const dir = mkdtempSync(join(tmpdir(), 'atomic-'));
  const f = join(dir, 'reg.jsonl');
  saveJsonl(f, [{ a: 1 }, { a: 2 }]);
  saveJsonl(f, [{ a: 3 }]);
  const got = loadJsonl(f);
  if (got.length === 1 && got[0].a === 3) pass('saveJsonl round-trips and replaces');
  else fail(`round-trip wrong: ${JSON.stringify(got)}`);
  // A leftover temp would mean the rename never happened — the file would be stale, not corrupt,
  // but the leak is the signal that something went wrong.
  if (!readdirSync(dir).some(n => n.includes('.tmp'))) pass('no temp file left behind');
  else fail(`temp leaked: ${readdirSync(dir).join()}`);
  if (readdirSync(dir).length === 1) pass('writes land on the target path, not a sibling');
  else fail(`unexpected files: ${readdirSync(dir).join()}`);
} catch (e) { fail(`atomic write tests crashed: ${e.message}`); }

// ── SUMMARY ─────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed, ${warnings} warnings`);

if (failed > 0) {
  console.log('🔴 TESTS FAILED — do NOT push/merge until fixed\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('🟡 Tests passed with warnings — review before pushing\n');
  process.exit(0);
} else {
  console.log('🟢 All tests passed — safe to push/merge\n');
  process.exit(0);
}
