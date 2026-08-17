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
    // A title that states no level resolves to 'unspecified', not null: bandFor() already matched
    // these within the family, but every WRITE path used to drop them, discarding 418 postings
    // that carried a posted salary. 'unspecified' is not a ladder rung and never sorts as one.
    ['Site Reliability Engineer', 'sre_devops', 'unspecified'],
    ['Data Scientist', 'data_science', 'unspecified'],
    ['Engineering Manager, Platform', 'eng_manager', 'unspecified'],
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

// ── 18b. Work eligibility: the composed remote-AND-hireable-here facet ──────────
// No single extracted facet answers "could I hold this job?": geo_eligibility names the country
// the EMPLOYER hires in (true of remote AND of five-days-in-office roles), remote_policy names no
// country. These guard the composition and, more importantly, the region-allowlist detector, whose
// early versions wrongly excluded 168 genuinely-remote Canadian postings.
try {
  const { workEligible, detectRegionBlock } = await import(pathToFileURL(join(ROOT, 'score-postings.mjs')).href);
  const prefs = { work_location: {
    country: 'canada', region: 'british columbia',
    region_aliases: ['british columbia', 'b.c.', 'bc'],
    allow_policies: ['remote'], eligible_geo: ['canada', 'global'],
  } };
  const elig = [
    [{ remote_policy: 'remote', geo_eligibility: 'canada' }, 'yes'],
    [{ remote_policy: 'hybrid', geo_eligibility: 'canada' }, 'no'],   // hires here, but office-bound
    [{ remote_policy: 'onsite', geo_eligibility: 'canada' }, 'no'],
    [{ remote_policy: 'remote', geo_eligibility: 'us_only' }, 'no'],
    [{ remote_policy: 'remote', geo_eligibility: 'unclear' }, 'unclear'], // bare "Remote" is not a country
    [{}, 'unclear'],                                                     // no facets → never excluded
    [{ remote_policy: 'remote', geo_eligibility: 'canada', _region_blocked: true }, 'no'],
  ];
  let ok = 0;
  for (const [ex, want] of elig) {
    const got = workEligible(ex, prefs);
    if (got === want) ok++; else fail(`workEligible(${JSON.stringify(ex)}) → ${got}, expected ${want}`);
  }
  if (ok === elig.length) pass(`workEligible: ${ok}/${elig.length} cases`);
  if (workEligible({ remote_policy: 'hybrid', geo_eligibility: 'canada' }, {}) === 'unclear') pass('workEligible is inert when work_location is unconfigured');
  else fail('workEligible must not exclude anything when unconfigured');

  // The detector must fire on real restrictions and stay silent on boilerplate that merely NAMES
  // jurisdictions. Each false-positive case below was found excluding real postings.
  const blocks = [
    ['We are open to applicants based in Canada in the Ontario province.', true],
    ['We hire in the following: US states: Arizona, California, Colorado.', true],
    ['Candidates must be located in Canadian time zones (EST + CST only).', true],
    ['Successful candidates will undergo a background check in compliance to applicable federal, provincial, state and local laws.', null],
    ['We are an equal opportunity employer and hire based on merit in all states.', null],
    ['The base salary range for this position, reflected in CAD, is: 92,900 - 116,100', null],
    ['We hire in the United States and Canada.', null],
    ['Offers are based on level, experience, and skillset as assessed in the interview process', null],
  ];
  let bok = 0;
  for (const [body, want] of blocks) {
    const got = detectRegionBlock(body, prefs);
    if (got === want) bok++; else fail(`detectRegionBlock("${body.slice(0, 40)}…") → ${got}, expected ${want}`);
  }
  if (bok === blocks.length) pass(`detectRegionBlock: ${bok}/${blocks.length} cases (incl. 5 boilerplate false-positive guards)`);
} catch (e) { fail(`work-eligibility tests crashed: ${e.message}`); }

// ── 18c. effectiveGeo: the ATS location field outranks a hallucinated facet ─────
// Reddit's "Senior Software Engineer, Storage" is stored location "Remote - United States" with
// extracted geo_eligibility "canada". Because work_eligible composes remote_policy + geo, that
// bogus `canada` computed to yes and passed the hard filter -- the exact job the filter exists to
// remove. 51.3% of extracted rows were labelled canada; 109 named a US location and no Canadian one.
try {
  const { effectiveGeo } = await import(pathToFileURL(join(ROOT, 'score-postings.mjs')).href);
  const prefs = { work_location: { eligible_geo: ['canada', 'global'] } };
  const cases = [
    // location names a country, never names home → authoritative, overrides the extractor
    [{ _scanned_location: 'Remote - United States', geo_eligibility: 'canada' }, 'us_only'],
    [{ _scanned_location: 'United States (Remote)', geo_eligibility: 'canada' }, 'us_only'],
    [{ _scanned_location: 'London, United Kingdom', geo_eligibility: 'canada' }, 'eu_only'],
    // location DOES name home → the extractor's canada stands
    [{ _scanned_location: 'United States Remote; Canada Remote', geo_eligibility: 'canada' }, 'canada'],
    [{ _scanned_location: 'Toronto, ON', geo_eligibility: 'canada' }, 'canada'],
    // no decisive location → defer to the extractor, and silence stays silence
    [{ _scanned_location: '', geo_eligibility: 'canada' }, 'canada'],
    [{ _scanned_location: 'Remote', geo_eligibility: 'unclear' }, ''],
  ];
  let ok = 0;
  for (const [ex, want] of cases) {
    const got = effectiveGeo(ex, prefs);
    if (got === want) ok++;
    else fail(`effectiveGeo(${JSON.stringify(ex._scanned_location)}, ${ex.geo_eligibility}) → "${got}", expected "${want}"`);
  }
  if (ok === cases.length) pass(`effectiveGeo: ${ok}/${cases.length} location-vs-facet precedence cases`);
} catch (e) { fail(`effectiveGeo tests crashed: ${e.message}`); }

// ── 18d. Dual-level requisitions: pick the range for THIS posting's rung ─────────
// Roche advertises "Machine Learning Engineer/Senior Machine Learning Engineer" and states four
// ranges in one sentence. Taking the first match filed the NON-senior range under the senior slot,
// understating it by $20-37k. The level hint disambiguates; without it, behaviour is unchanged.
try {
  const { parseCompFromBody } = await import(pathToFileURL(join(ROOT, 'comp-core.mjs')).href);
  const roche = 'The expected salary range for this position based on the primary location of '
    + 'California for the Machine Learning Engineer is $147,600, - $274,000 and New York is '
    + '$141,100 - $262,100, and the Senior Machine Learning Engineer for California is '
    + '$167,400 - $310,800 and New York is $160,100 - $297,300.';
  const noHint = parseCompFromBody(roche);
  const senior = parseCompFromBody(roche, { level: 'senior' });
  if (noHint?.min === 147600) pass('dual-level: without a hint, first match is unchanged');
  else fail(`dual-level: no-hint min ${noHint?.min}, expected 147600`);
  if (senior?.min === 167400 && senior?.max === 310800) pass('dual-level: level hint selects the senior range');
  else fail(`dual-level: senior hint → ${JSON.stringify(senior)}, expected 167400-310800`);
  // The hint must not fire when it cannot discriminate — every candidate matching tells us nothing.
  const single = parseCompFromBody('Base salary range for this senior role: $150,000 - $200,000', { level: 'senior' });
  if (single?.min === 150000 && single?.max === 200000) pass('dual-level: a single range is unaffected by the hint');
  else fail(`dual-level: single range → ${JSON.stringify(single)}`);
  // Internal match offset must never leak onto a persisted band.
  if (!('at' in (senior || {}))) pass('dual-level: internal match offset is stripped from the result');
  else fail('dual-level: `at` leaked into the parsed comp');
} catch (e) { fail(`dual-level comp tests crashed: ${e.message}`); }

// ── 18d-2. Trailing currency code with NO leading marker ────────────────────────
// Clover Health (greenhouse:cloverhealth/8099637) posts
//   "A reasonable estimate of the base salary range for this role is 115,000 CAD to 145,000 CAD"
// — no "$" and no leading currency code, so the range matched nothing and a first-party posted
// band fell through to a model guess. 157 stored JD bodies used this shape. The guard is that the
// code must FOLLOW the first figure: unmarked number pairs must still be refused.
try {
  const { parseCompFromBody } = await import(pathToFileURL(join(ROOT, 'comp-core.mjs')).href);
  const clover = parseCompFromBody('A reasonable estimate of the base salary range for this '
    + 'role is 115,000 CAD to 145,000 CAD. Final pay is based on several factors.');
  if (clover?.min === 115000 && clover?.max === 145000 && clover.currency === 'CAD')
    pass('trailing-code: "115,000 CAD to 145,000 CAD" parses with currency');
  else fail(`trailing-code: clover → ${JSON.stringify(clover)}, expected 115000-145000 CAD`);
  const usd = parseCompFromBody('The base salary range for this role is 150,000 USD - 200,000 USD per year.');
  if (usd?.min === 150000 && usd?.max === 200000 && usd.currency === 'USD')
    pass('trailing-code: USD suffix form parses');
  else fail(`trailing-code: usd → ${JSON.stringify(usd)}`);
  // No currency marker anywhere → still refused, whatever pay words sit nearby.
  const bare = parseCompFromBody('Our salary survey covers companies processing 100,000 to 500,000 claims per year.');
  if (bare === null) pass('trailing-code: unmarked number pair is still refused');
  else fail(`trailing-code: bare pair parsed as ${JSON.stringify(bare)}`);
  // The dual-currency case must not regress: scanning the match text must not let CAD bleed onto USD.
  const dual = parseCompFromBody('base salary of $180,000 to $240,000 USD ($175,000 to $245,000 CAD) per year');
  if (dual?.min === 175000 && dual?.max === 245000 && dual.currency === 'CAD')
    pass('trailing-code: dual-currency posting still binds CAD to the CAD figures');
  else fail(`trailing-code: dual → ${JSON.stringify(dual)}`);
} catch (e) { fail(`trailing-code comp tests crashed: ${e.message}`); }

// ── 18e. Duplicate listings: one opening published per-city ─────────────────────
// Tailscale's single Infrastructure Engineer opening appears three times (CA/US/UK), each with its
// own Greenhouse job id; agency boards list one role 229 times. 2,540 rows, 15.5% of everything
// live. The canonical row must be the REACHABLE one -- keeping "first seen" would have retained an
// excluded US listing and hidden the Canada one that actually qualifies.
try {
  const { assignDupGroups } = await import(pathToFileURL(join(ROOT, 'score-postings.mjs')).href);
  if (typeof assignDupGroups !== 'function') { warn('assignDupGroups not exported — skipping dup tests'); }
  else {
    const research = new Map([
      ['us', { key: 'us', company_key: 'gh:tailscale', title: 'Infrastructure Engineer', live: true }],
      ['uk', { key: 'uk', company_key: 'gh:tailscale', title: 'Infrastructure Engineer', live: true }],
      ['ca', { key: 'ca', company_key: 'gh:tailscale', title: 'Infrastructure Engineer', live: true }],
      ['other', { key: 'other', company_key: 'gh:tailscale', title: 'Security Engineer', live: true }],
    ]);
    const personal = [
      { key: 'us', hard_excluded: true, computed_score: 3.48 },
      { key: 'uk', hard_excluded: true, computed_score: 3.35 },
      { key: 'ca', hard_excluded: false, computed_score: 4.78 },
      { key: 'other', hard_excluded: false, computed_score: 4.0 },
    ];
    const collapsed = assignDupGroups(personal, research);
    const byKey = Object.fromEntries(personal.map(p => [p.key, p]));
    if (collapsed === 2) pass('dup: collapses the two redundant listings');
    else fail(`dup: collapsed ${collapsed}, expected 2`);
    if (!byKey.ca.dup_of && byKey.us.dup_of === 'ca' && byKey.uk.dup_of === 'ca') pass('dup: the reachable (non-excluded) listing is canonical');
    else fail(`dup: wrong canonical — ca.dup_of=${byKey.ca.dup_of} us.dup_of=${byKey.us.dup_of}`);
    if (byKey.ca.dup_count === 3) pass('dup: canonical records how many listings it stands for');
    else fail(`dup: dup_count ${byKey.ca.dup_count}, expected 3`);
    if (!byKey.other.dup_of) pass('dup: a distinct title is left alone');
    else fail('dup: collapsed an unrelated title');
  }
} catch (e) { fail(`duplicate-listing tests crashed: ${e.message}`); }

// ── 18f. Company aliases: several registrations, one employer ───────────────────
// HPE holds three Workday tenants publishing identical requisitions, and a subsidiary can list a
// parent's roles on its own ATS. Aliases fold those into one employer for counting, for posting
// dedup, and for the research queue — which must not spend a slot researching the same company
// twice on evidence already folded into the canonical key.
try {
  const { canonicalKey } = await import(pathToFileURL(join(ROOT, 'dedupe-companies.mjs')).href);
  const { assignDupGroups } = await import(pathToFileURL(join(ROOT, 'score-postings.mjs')).href);
  const aliases = new Map([['workday:hpe/acjobsite', 'workday:hpe/jobsathpe'],
                           ['bamboohr:counterpoint', 'greenhouse:cloverhealth']]);
  if (canonicalKey('workday:hpe/acjobsite', aliases) === 'workday:hpe/jobsathpe'
      && canonicalKey('greenhouse:unrelated', aliases) === 'greenhouse:unrelated') pass('alias: resolves to the canonical employer, leaves others alone');
  else fail('alias: canonicalKey wrong');

  // The subsidiary case: same role, two company keys. Without aliases these never group.
  const research = new Map([
    ['a', { key: 'a', company_key: 'greenhouse:cloverhealth', title: 'Senior Software Engineer', live: true }],
    ['b', { key: 'b', company_key: 'bamboohr:counterpoint', title: 'Senior Software Engineer', live: true }],
  ]);
  const personal = [{ key: 'a', hard_excluded: false, computed_score: 4.2 }, { key: 'b', hard_excluded: false, computed_score: 4.0 }];
  const withAlias = assignDupGroups(personal.map(p => ({ ...p })), research, aliases);
  const without = assignDupGroups(personal.map(p => ({ ...p })), research, new Map());
  if (withAlias === 1) pass('alias: a subsidiary listing the parent\'s role collapses');
  else fail(`alias: collapsed ${withAlias} across companies, expected 1`);
  if (without === 0) pass('alias: without an alias the two keys stay separate (no false merging)');
  else fail(`alias: collapsed ${without} without an alias — must not merge unrelated companies`);
} catch (e) { fail(`company-alias tests crashed: ${e.message}`); }

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

  // Some employers post min / target / max. Matching only the first pair recorded the MIDPOINT as
  // the maximum, truncating the top of the band by ~20%.
  const three = C.parseCompFromBody('The salary range for this role is $88,200 - $110,200 - $132,200 CAD');
  if (three?.min === 88200 && three?.max === 132200) pass('a three-point band keeps its real maximum');
  else fail(`three-point band wrong: ${JSON.stringify(three)}`);

  // "and" as a separator, and "base range" as a cue. Helm.ai writes "base range of approximately
  // $150,000 and $250,000"; missing it let the extractor invent CAD 80-140k for that slot — off
  // by roughly 2x against a figure printed in the JD.
  const andSep = C.parseCompFromBody('this position is estimated to fall in the base range of approximately $150,000 and $250,000');
  if (andSep?.min === 150000 && andSep?.max === 250000) pass('"and" separator with a "base range" cue parses');
  else fail(`and-separator wrong: ${JSON.stringify(andSep)}`);
  // "and" is the commonest word in English, so it must still clear the disqualifier.
  for (const [txt, why] of [
    ['we raised between $10,000,000 and $50,000,000 in funding', 'funding'],
    ['annual revenue grew from $200,000 and $900,000', 'revenue'],
    ['equity grant of $100,000 and $400,000 in RSUs', 'equity'],
  ]) if (C.parseCompFromBody(txt) !== null) fail(`"and" separator accepted ${why} figures`);
  pass('"and" separator still rejects funding/revenue/equity');

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

  // ── timezone dimension ────────────────────────────────────────────────────
  {
    const tzPrefs = { home_timezone: 'America/Edmonton' };
    const tz = (z) => S.COMPUTERS.timezone({ timezone: z }, tzPrefs);

    // Max's scale, verbatim: 0h=5, 1h=4, 2h=3, 3h=1, 4h+=0.
    const scale = [[0, 5], [1, 4], [2, 3], [3, 1], [4, 0], [9, 0], [-2, 3]];
    if (scale.every(([d, want]) => S.tzScore(d) === want)) pass('tz: offset→score scale matches spec (0/1/2/3/4h → 5/4/3/1/0)');
    else fail(`tz: scale wrong — ${scale.map(([d]) => `${d}h=${S.tzScore(d)}`).join(' ')}`);

    // Sign must not matter: two hours east and two hours west are equally far.
    if (S.tzScore(-3) === S.tzScore(3)) pass('tz: distance is absolute, direction-independent');
    else fail('tz: sign of the offset changed the score');

    const cases = [['America/Denver', 5], ['America/Vancouver', 4], ['America/Chicago', 4],
                   ['America/Toronto', 3], ['America/New_York', 3], ['Europe/London', 0], ['Asia/Kolkata', 0]];
    const bad = cases.filter(([z, want]) => tz(z) !== want);
    if (!bad.length) pass('tz: real IANA zones score by true offset from Mountain');
    else fail(`tz: wrong for ${bad.map(([z, w]) => `${z} want ${w} got ${tz(z)}`).join('; ')}`);

    // Kimberley BC is MOUNTAIN despite being in British Columbia. Using America/Vancouver as home
    // would put every Mountain role 1h away and every Pacific role at 0 — inverted, by a full hour.
    if (tz('America/Denver') === 5 && tz('America/Vancouver') === 4) pass('tz: home zone is Mountain, not Pacific');
    else fail('tz: home zone appears to be Pacific');

    // Silence is not evidence of a hostile timezone — 1,618 of 2,526 postings say `unclear`, and
    // scoring those as bad would penalise every JD that simply never mentioned hours.
    const nulls = ['unclear', '', null, undefined, 'Unknown', 'Mars/Olympus'];
    if (nulls.every(z => tz(z) === null)) pass('tz: unstated or unrecognised zone → null, not a penalty');
    else fail(`tz: an unstated zone produced a score — ${nulls.map(z => `${z}=${tz(z)}`).join(' ')}`);

    // Fixed reference instant: re-running must not move scores across a DST boundary.
    if (S.tzOffsetHours('America/Toronto') === -5 && S.tzOffsetHours('Europe/London') === 0) pass('tz: offsets computed against a fixed reference instant');
    else fail('tz: reference instant is not stable');

    // Half-hour zones must not produce a fractional score.
    if (Number.isInteger(tz('Asia/Kolkata'))) pass('tz: half-hour zones round to an integer score');
    else fail('tz: half-hour zone produced a fractional score');
  }

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

// ── 24. Outreach core (contacts + threads) ───────────────────────
console.log('\n24. Outreach core (contacts, threads, message log)');
try {
  // Redirect the registries at a scratch dir BEFORE importing — the module reads the env var
  // at load time, and we must never write to the user's real contacts/outreach files.
  const odir = mkdtempSync(join(tmpdir(), 'outreach-'));
  process.env.BYOJB_OUTREACH_DIR = odir;
  const oc = await import(pathToFileURL(join(ROOT, 'outreach-core.mjs')).href);

  // — keys: identity-stable, and immune to tracking params / casing —
  const k1 = oc.contactKey({ linkedin_url: 'https://www.linkedin.com/in/Jane-Doe/?trk=x' });
  const k2 = oc.contactKey({ linkedin_url: 'https://linkedin.com/in/jane-doe' });
  if (k1 === k2 && k1 === 'li:jane-doe') pass('contactKey is stable across tracking params and casing');
  else fail(`contactKey unstable: ${k1} vs ${k2}`);
  if (oc.contactKey({ email: 'A@B.com' }) === 'em:a@b.com') pass('contactKey falls back to email');
  else fail('contactKey email fallback wrong');
  if (oc.contactKey({ name: 'Jane Doe', company_key: 'greenhouse:acme' }).startsWith('pn:greenhouse:acme:jane-doe-')) pass('contactKey falls back to company+name');
  else fail('contactKey name fallback wrong');
  if (oc.contactKey({}) === '') pass('contactKey refuses an empty identity');
  else fail('contactKey should return "" with no handles');

  // — status vocabulary —
  if (oc.validateOutreachStatus('follow up') === 'Followed Up' && oc.validateOutreachStatus('ghosted') === 'No Response') pass('validateOutreachStatus normalizes aliases');
  else fail('outreach status alias normalization failed');
  if (oc.validateOutreachStatus('garbage') === 'Drafted') pass('validateOutreachStatus defaults unknown → Drafted');
  else fail('outreach status default failed');
  if (oc.isOpenOutreach('Sent') && !oc.isOpenOutreach('Closed')) pass('isOpenOutreach splits in-play from closed');
  else fail('isOpenOutreach wrong');
  // A strong tie (someone who can vouch from direct working history) is what actually skips
  // recruiter screens; a cold contact's submission is tagged unverified. Keep them distinct.
  if (oc.isStrongTie('former_colleague') && !oc.isStrongTie('cold')) pass('isStrongTie separates vouchable ties from cold ones');
  else fail('isStrongTie wrong');

  // — thread key sequencing —
  const seqRows = [{ key: 'li:a#1' }, { key: 'li:a#2' }, { key: 'li:b#1' }];
  if (oc.nextThreadKey('li:a', seqRows) === 'li:a#3' && oc.nextThreadKey('li:c', seqRows) === 'li:c#1') pass('nextThreadKey sequences per contact');
  else fail('nextThreadKey wrong');

  // — upserts against the scratch registries —
  const c = oc.upsertContact('li:test', { name: 'Test Person', archetype: 'hiring_manager', notes: 'met at conf' });
  const c2 = oc.upsertContact('li:test', { title: 'EM' });
  if (c2.name === 'Test Person' && c2.notes === 'met at conf' && c2.title === 'EM') pass('upsertContact merges without blanking existing fields');
  else fail(`upsertContact clobbered fields: ${JSON.stringify(c2)}`);
  if (oc.upsertContact('li:test', { archetype: 'nonsense' }).archetype === 'other') pass('upsertContact validates archetype');
  else fail('upsertContact archetype validation failed');
  if (oc.resolveContact({ linkedin_url: 'https://www.linkedin.com/in/test/?x=1' }) === null) pass('resolveContact does not match on an unrelated slug');
  else fail('resolveContact matched the wrong person');

  // The message log is the whole record — a later patch must never replace it wholesale.
  const tk = oc.nextThreadKey('li:test');
  oc.upsertOutreach(tk, { channel: 'linkedin_dm', message: { direction: 'out', body: 'first', sent_at: '2026-07-01T00:00:00Z' } });
  oc.upsertOutreach(tk, { next_action: 'bump', message: { direction: 'in', body: 'reply', sent_at: '2026-07-03T00:00:00Z' } });
  const t = oc.upsertOutreach(tk, { messages: [], notes: 'x' });
  if (t.messages.length === 2 && t.messages[0].body === 'first' && t.messages[1].direction === 'in') pass('upsertOutreach appends to messages[] and ignores a direct messages overwrite');
  else fail(`message log damaged: ${JSON.stringify(t.messages)}`);
  if (t.next_action === 'bump' && t.notes === 'x') pass('upsertOutreach merges scalar fields across patches');
  else fail('upsertOutreach scalar merge failed');

  const timing = oc.threadTiming(t);
  if (timing.message_count === 2 && timing.last_out === '2026-07-01T00:00:00Z' && timing.last_in === '2026-07-03T00:00:00Z') pass('threadTiming reports last inbound/outbound separately');
  else fail(`threadTiming wrong: ${JSON.stringify(timing)}`);

  // Converting must mark the thread, not silently leave it looking un-actioned.
  const linked = oc.linkApplication(tk, 'https://example.com/job/1');
  if (linked.status === 'Converted' && linked.application_key === 'https://example.com/job/1' && linked.outcome === 'converted_to_application') pass('linkApplication marks the thread converted and back-links the application');
  else fail(`linkApplication wrong: ${JSON.stringify(linked)}`);

  // — relevance / activity / LinkedIn-degree relationships —
  if (oc.validateRelevance('4.5') === 4.5 && oc.validateRelevance(9) === 5 && oc.validateRelevance(-2) === 0) pass('validateRelevance clamps to the 0–5 rubric scale');
  else fail('validateRelevance clamping wrong');
  // null (unrated) must stay distinct from 0 (rated, not worth pursuing) — collapsing them would
  // make every untouched contact look actively rejected.
  if (oc.validateRelevance('') === null && oc.validateRelevance(null) === null && oc.validateRelevance('abc') === null && oc.validateRelevance(0) === 0) pass('validateRelevance keeps unrated (null) distinct from 0');
  else fail('validateRelevance null/0 handling wrong');
  if (oc.validateActivity('dormant') === 'dormant' && oc.validateActivity('bogus') === 'unknown') pass('validateActivity falls back to unknown');
  else fail('validateActivity wrong');
  if (oc.RELATIONSHIPS.includes('connected_1') && oc.RELATIONSHIPS.includes('connected_2')) pass('LinkedIn 1st/2nd-degree relationships available');
  else fail('connected_1/connected_2 missing from RELATIONSHIPS');
  // Degree is network DISTANCE, not a vouch: you can be 1st-degree with a total stranger.
  if (!oc.isStrongTie('connected_1') && !oc.isStrongTie('connected_2') && oc.isStrongTie('former_colleague')) pass('LinkedIn degree is not treated as a strong tie');
  else fail('connected_* must not count as a strong tie');

  const c3 = oc.upsertContact('li:rated', { name: 'Rated', relevance: '4.5', activity: 'active' });
  if (c3.relevance === 4.5 && c3.activity === 'active') pass('upsertContact stores relevance + activity');
  else fail(`upsertContact new fields wrong: ${JSON.stringify(c3)}`);
  const c4 = oc.upsertContact('li:rated', { title: 'EM' });
  if (c4.relevance === 4.5 && c4.activity === 'active') pass('an unrelated patch preserves relevance + activity');
  else fail('relevance/activity lost on partial patch');
  if (oc.upsertContact('li:rated', { relevance: '' }).relevance === null) pass('clearing relevance un-rates rather than zeroing');
  else fail('clearing relevance should yield null');

  // — send-day scheduling + the draft→sent transition —
  // Weekday maths must use LOCAL date parts; toISOString() would shift west-of-UTC users a day.
  if (oc.nextSendDay('2026-08-03') === '2026-08-04' && oc.nextSendDay('2026-08-07') === '2026-08-11') pass('nextSendDay finds the next Tue/Wed/Thu');
  else fail(`nextSendDay wrong: ${oc.nextSendDay('2026-08-03')}, ${oc.nextSendDay('2026-08-07')}`);
  // Drafting ON a send day can go out that same morning rather than waiting a week.
  if (oc.nextSendDay('2026-08-04') === '2026-08-04') pass('a send day returns itself');
  else fail('nextSendDay should include the given day');
  if (oc.nextSendDay('2026-08-03', ['mon', 'fri']) === '2026-08-03') pass('nextSendDay honours configured days');
  else fail('nextSendDay ignored the custom day list');
  if (JSON.stringify(oc.parseSendDays(['garbage'])) === JSON.stringify([2, 3, 4])) pass('parseSendDays falls back to Tue/Wed/Thu');
  else fail('parseSendDays fallback wrong');
  if (oc.isSendDay('2026-08-04') && !oc.isSendDay('2026-08-07')) pass('isSendDay distinguishes Tue from Fri');
  else fail('isSendDay wrong');

  const dk = oc.nextThreadKey('li:test');
  oc.upsertOutreach(dk, { channel: 'linkedin_dm' });
  oc.saveDraft(dk, { draft: 'Hi Dana — saw the platform work.', scheduled_for: '2026-08-04' });
  const drafted = oc.loadOutreach().find(r => r.key === dk);
  // A draft is NOT a message: nothing has been sent, so the log must still be empty.
  if (drafted.draft && drafted.status === 'Drafted' && (drafted.messages || []).length === 0) pass('saveDraft prepares without logging a message');
  else fail(`saveDraft leaked into the message log: ${JSON.stringify(drafted)}`);
  if (oc.saveDraft(dk, { scheduled_for: 'not-a-date' }).scheduled_for === '') pass('saveDraft rejects a malformed date');
  else fail('saveDraft should blank an invalid scheduled_for');

  oc.saveDraft(dk, { scheduled_for: '2026-08-04' });
  const sent1 = oc.markSent(dk);
  if (sent1.status === 'Sent' && sent1.messages.length === 1 && sent1.messages[0].direction === 'out'
      && sent1.messages[0].body === 'Hi Dana — saw the platform work.' && !sent1.draft && !sent1.scheduled_for) {
    pass('markSent moves the draft into the log as outbound and clears the slot');
  } else fail(`markSent wrong: ${JSON.stringify(sent1)}`);
  // A second outbound message is a follow-up, not a fresh first contact.
  oc.saveDraft(dk, { draft: 'Bump with a new detail.' });
  if (oc.markSent(dk).status === 'Followed Up') pass('a second send advances Sent → Followed Up');
  else fail('markSent should advance to Followed Up');
  if (oc.markSent(dk) === null) pass('markSent refuses when there is nothing prepared');
  else fail('markSent should return null on an empty draft');

  // A pipe in a name/next-action must not split the generated markdown table.
  oc.upsertOutreach(tk, { next_action: 'ping re: infra | scale work' });
  oc.syncOutreachMd();
  const md = readFileSync(oc.OUTREACH_MD, 'utf-8');
  const bodyLines = md.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Archetype'));
  // Every thread gets exactly one 11-column row, and a pipe inside a cell must not split it.
  if (bodyLines.length === oc.loadOutreach().length && bodyLines.every(l => l.split('|').length === 13)
      && bodyLines.some(l => l.includes('ping re: infra / scale work'))) {
    pass('syncOutreachMd emits one 11-column row per thread with pipes escaped');
  } else fail(`outreach.md rows malformed: ${JSON.stringify(bodyLines)}`);

  rmSync(odir, { recursive: true, force: true });
  delete process.env.BYOJB_OUTREACH_DIR;
} catch (e) {
  fail(`outreach-core tests crashed: ${e.message}`);
}

// ── 25. Vocabulary review queue (Stage 2) ────────────────────────
// The queue exists to make the vocabulary backlog FINITE and ORDERED, so the two things that can
// silently break it are (a) matching semantics drifting away from the rubric's exact, case-
// insensitive equality — the drift that mis-scored Stripe's ML Infrastructure posting — and (b)
// the impact weighting counting postings you could never take.
try {
  const { computeVocab, knownTerms } = await import(pathToFileURL(join(ROOT, 'vocab-report.mjs')).href);
  const rubric = { preferences: { languages: { love: ['Python'] }, technologies: { love: ['ML'], avoid: ['C'] } } };

  const research = [
    // "Kafka" on two strong, reachable postings; "Airflow" on one.
    { key: 'a', company: 'Alpha', title: 'Senior Platform Eng', live: true, extracted: { languages: ['python'], technologies: ['Kafka', 'Airflow'] } },
    { key: 'b', company: 'Beta', title: 'Staff Infra Eng', live: true, extracted: { technologies: ['Kafka'] } },
    // "Struts" only on postings that cost nothing: hard-excluded, a duplicate, and a dead listing.
    { key: 'c', company: 'Gamma', title: 'US-only Eng', live: true, extracted: { technologies: ['Struts'] } },
    { key: 'd', company: 'Delta', title: 'Dup of something', live: true, extracted: { technologies: ['Struts'] } },
    { key: 'e', company: 'Eps', title: 'Expired', live: false, extracted: { technologies: ['Struts'] } },
    // Cloud/CI-CD must NOT be swallowed by the avoid-list entry "C" — substring matching here
    // would file real terms as recognised and, worse, imply an avoid where none was stated.
    { key: 'f', company: 'Zeta', title: 'Cloud Eng', live: true, extracted: { technologies: ['Cloud', 'CI/CD', 'ML'] } },
  ];
  const personal = [
    { key: 'a', computed_score: 5, hard_excluded: false, dup_of: null },
    { key: 'b', computed_score: 5, hard_excluded: false, dup_of: null },
    { key: 'c', computed_score: 4.8, hard_excluded: true, dup_of: null },
    { key: 'd', computed_score: 4.8, hard_excluded: false, dup_of: 'c' },
    { key: 'e', computed_score: 4.8, hard_excluded: false, dup_of: null },
    { key: 'f', computed_score: 2.5, hard_excluded: false, dup_of: null },
  ];
  const out = computeVocab({ research, personal, rubric });
  const by = Object.fromEntries(out.rows.map(r => [r.term, r]));

  if (out.postings_considered === 3) pass('vocab: excluded / duplicate / dead postings are not considered');
  else fail(`vocab: considered ${out.postings_considered} postings, expected 3`);

  if (!by.Struts) pass('vocab: a term seen only on unreachable postings is not in the queue');
  else fail(`vocab: Struts ranked at impact ${by.Struts.impact} despite no reachable posting`);

  // Two 5.0 postings → 5/5 + 5/5 = 2.0; one 5.0 posting → 1.0.
  if (by.Kafka?.impact === 2 && by.Kafka?.count === 2) pass('vocab: impact sums score-weighted reachable postings');
  else fail(`vocab: Kafka → ${JSON.stringify(by.Kafka)}, expected impact 2 / count 2`);
  if (out.rows[0]?.term === 'Kafka' && by.Airflow?.impact === 1) pass('vocab: the higher-impact term ranks first');
  else fail(`vocab: ranking is ${out.rows.map(r => r.term).join(',')}`);

  // "python" (lowercased in the JD) is on the love list; "ML" is on it exactly. Neither is a gap.
  if (!by.python && !by.ML) pass('vocab: known terms match case-insensitively and are excluded');
  else fail('vocab: a term already in the rubric leaked into the queue');
  // The substring trap, stated concretely: "C" is on avoid, "Cloud" and "CI/CD" are not.
  if (by.Cloud && by['CI/CD']) pass('vocab: no substring matching — "C" on avoid does not swallow Cloud / CI/CD');
  else fail('vocab: substring matching hid a genuinely unrecognised term');

  if (knownTerms(rubric.preferences).size === 3) pass('vocab: knownTerms unions every list of both preference groups');
  else fail(`vocab: knownTerms → ${knownTerms(rubric.preferences).size}, expected 3`);

  if ((by.Kafka.examples || []).length === 2 && by.Kafka.examples[0].company === 'Alpha') pass('vocab: examples carry company + title, capped at 3');
  else fail(`vocab: Kafka examples → ${JSON.stringify(by.Kafka.examples)}`);
} catch (e) {
  fail(`vocab-report tests crashed: ${e.message}`);
}

// ── JD FETCHER — closed-posting detection & longer-wins guard ────────

console.log('\n🧲 JD fetcher (tiered) tests...');
try {
  const {
    commitDecision, greenhouseTarget, leverTarget, isThin, sharedBodyKeys,
  } = await import(pathToFileURL(join(ROOT, 'jd-fetch-lib.mjs')).href);
  const JD = await import(pathToFileURL(join(ROOT, 'jd-fetch-lib.mjs')).href);

  // Closed-posting detection: 30 bodies in the corpus say the req is dead in words while the page
  // still answers 200. Those must retire the posting, never be stored as a JD.
  const closedPhrases = [
    'Position Closed — thanks for your interest',
    'We are no longer accepting applications for this role',
    'This job is closed',
    'This role has been filled',
    'Sorry, this posting is closed',
  ];
  if (closedPhrases.every(b => commitDecision({ body: b, current: null }).action === 'closed')) {
    pass('jd-fetch: every closed-posting phrasing retires instead of storing');
  } else {
    fail('jd-fetch: a closed-posting phrasing was stored as a body');
  }
  if (commitDecision({ body: 'We are hiring — applications close in 2026', current: null }).action === 'store') {
    pass('jd-fetch: a live JD mentioning "close" is not mistaken for a closed posting');
  } else {
    fail('jd-fetch: false positive on closed-posting detection');
  }
  // Closed text wins even over the longer-wins guard: a dead req must never keep a stored body alive.
  if (commitDecision({ body: 'Position closed', current: 'x'.repeat(5000) }).action === 'closed') {
    pass('jd-fetch: closed detection runs before the length comparison');
  } else {
    fail('jd-fetch: closed posting survived because the new body was shorter');
  }

  // ── tombstone pages ───────────────────────────────────────────────────────
  // A 200-OK page that renders fine but holds no job. Browser-rendering the 800 bodyless postings
  // was the plan until a probe showed Workday answers "The page you are looking for doesn't exist."
  // and BambooHR silently redirects to its careers index — neither blocked nor slow, just empty.
  {
    const workdayTomb = 'Skip to main content\nSign In\nSearch for Jobs\nThe page you are looking for doesn\'t exist.\nFollow Us\n© 2026 Workday, Inc.';
    const bambooIndex = 'Current Openings\n\nThanks for checking out our job openings. See something that interests you? Apply here.\n\nChief of Staff to the CEO\n\nCorporate';
    if (JD.isGonePage(workdayTomb)) pass('jd-fetch: Workday not-found page is recognised as a tombstone');
    else fail('jd-fetch: Workday tombstone read as a job description');
    if (JD.isGonePage(bambooIndex)) pass('jd-fetch: BambooHR careers-index redirect is recognised as a tombstone');
    else fail('jd-fetch: careers index read as a job description');

    // The false positive that would matter: a real JD whose prose happens to mention pages/not found.
    const realJd = 'Our observability stack alerts when a page is not found in cache; you will own the CDN. '.repeat(30);
    if (!JD.isGonePage(realJd)) pass('jd-fetch: a JD mentioning "not found" is not a tombstone');
    else fail('jd-fetch: false positive — a real JD was classified as a tombstone');

    // Must retire, not store — and must beat the length guard, since a careers index is LONGER than
    // the absent body it would replace, so store-if-longer would happily write the tombstone in.
    if (JD.commitDecision({ body: workdayTomb, current: null }).action === 'closed') pass('jd-fetch: a tombstone retires the posting instead of being stored');
    else fail('jd-fetch: tombstone was stored as a body');
    if (JD.commitDecision({ body: bambooIndex, current: 'short' }).action === 'closed') pass('jd-fetch: tombstone detection runs before the length comparison');
    else fail('jd-fetch: a longer tombstone overwrote a shorter stored body');

    // A long careers index is a different problem (sharedBodyKeys) — INDEX_PAGE only fires on short
    // ones, so a genuine 4k+ JD that opens with a listing header is not swallowed.
    if (!JD.isGonePage('Current Openings\n' + 'x'.repeat(5000))) pass('jd-fetch: index heuristic is bounded by length');
    else fail('jd-fetch: index heuristic swallowed a long body');
  }

  // Longer-wins guard: 345 first-party pages render as JS shells shorter than the ATS content
  // already on disk. Overwriting them would destroy real JDs.
  const shell = 'You need to enable JavaScript to run this app.';
  if (commitDecision({ body: shell, current: 'x'.repeat(4000) }).action === 'kept-shorter') {
    pass('jd-fetch: a short JS shell never overwrites a longer stored body');
  } else {
    fail('jd-fetch: longer-wins guard did not protect the stored body');
  }
  if (commitDecision({ body: 'y'.repeat(4000), current: 'x'.repeat(900) }).action === 'store') {
    pass('jd-fetch: a longer fresh body does replace a shorter stored one');
  } else {
    fail('jd-fetch: longer body was not stored');
  }
  if (commitDecision({ body: 'x'.repeat(900), current: 'x'.repeat(900) }).action === 'kept-shorter') {
    pass('jd-fetch: equal-length body is a no-op (no pointless rewrite)');
  } else {
    fail('jd-fetch: equal-length body rewrote the file');
  }
  // The single exemption: a tier-1 ATS API body replacing an identified careers-index page, where
  // the junk is LONGER than the real JD (8 Nebius postings shared one 28k listing page).
  if (commitDecision({ body: 'real JD', current: 'x'.repeat(28000), authoritative: true }).action === 'store') {
    pass('jd-fetch: tier-1 API body overrides length when the stored body is a careers index');
  } else {
    fail('jd-fetch: authoritative tier-1 body was blocked by the length guard');
  }

  // Index-page detection — siblings of the same company sharing one body are all listing pages.
  const shared = sharedBodyKeys([
    { key: 'a', company: 'Nebius', body: 'Open positions at Nebius' + 'z'.repeat(3000) },
    { key: 'b', company: 'Nebius', body: 'Open positions at Nebius' + 'z'.repeat(3000) },
    { key: 'c', company: 'Nebius', body: 'A real and quite specific JD' },
    { key: 'd', company: 'Other', body: 'Open positions at Nebius' + 'z'.repeat(3000) },
  ]);
  if (shared.has('a') && shared.has('b') && !shared.has('c') && !shared.has('d')) {
    pass('jd-fetch: shared-body detection flags siblings only, scoped per company');
  } else {
    fail(`jd-fetch: shared-body detection flagged ${[...shared].join(',')}`);
  }

  // Tier-1 URL derivation.
  if (greenhouseTarget('https://careers.nebius.com/?gh_jid=4765610101', 'greenhouse:nebius')
      === 'https://boards-api.greenhouse.io/v1/boards/nebius/jobs/4765610101') {
    pass('jd-fetch: gh_jid on a first-party host resolves via company_key');
  } else {
    fail('jd-fetch: gh_jid board resolution failed');
  }
  if (greenhouseTarget('https://job-boards.greenhouse.io/speechify/jobs/4001', null)
      === 'https://boards-api.greenhouse.io/v1/boards/speechify/jobs/4001') {
    pass('jd-fetch: greenhouse board slug read straight from the URL');
  } else {
    fail('jd-fetch: greenhouse URL-form board resolution failed');
  }
  if (greenhouseTarget('https://example.com/careers/some-job', null) === null
      && greenhouseTarget('not a url', 'greenhouse:x') === null) {
    pass('jd-fetch: non-greenhouse and malformed URLs yield no tier-1 target');
  } else {
    fail('jd-fetch: greenhouseTarget matched something it should not');
  }
  if (leverTarget('https://jobs.lever.co/provectus/0bf1decc-002c')
      === 'https://api.lever.co/v0/postings/provectus/0bf1decc-002c'
      && leverTarget('https://jobs.lever.co/provectus') === null) {
    pass('jd-fetch: lever per-posting API derived from the posting URL only');
  } else {
    fail('jd-fetch: leverTarget derivation failed');
  }

  if (isThin('x'.repeat(899)) && !isThin('x'.repeat(901)) && isThin('You need to enable JavaScript'.padEnd(2000, '.'))) {
    pass('jd-fetch: thin = under 900 chars OR a JS shell of any length');
  } else {
    fail('jd-fetch: isThin threshold/shell detection wrong');
  }
} catch (e) {
  fail(`jd-fetch tests crashed: ${e.message}`);
}

// ── 26. JD dump must never silently truncate a body ──────────────
//
// REGRESSION GUARD. dump-jd-batch.mjs once carried a bare `.slice(0, 6000)` on the body. Benefits,
// PTO and salary bands live at the END of a job description, so the cap removed precisely the text
// that carries them — and left no trace that anything was missing. 41 of 168 postings in a single
// extraction pass recorded `pto_policy: "unclear"` for policies sitting in the file, and several
// recorded `comp: null` for published salary bands (Tailscale's $218,420–$302,840 CAD among them).
//
// The scores are computed from the facets, so a truncated read produces a confident number derived
// from a JD nobody fully saw. These tests assert the three properties that make that impossible:
//   (a) the default cap is far above any real JD, so normal operation never truncates;
//   (b) if a cap ever does bite, the output SHOUTS and the process exits non-zero;
//   (c) no bare slice/substr on the body sneaks back in.
console.log('\n26. JD dump: bodies are never silently truncated');
try {
  const dumpPath = join(ROOT, 'dump-jd-batch.mjs');
  const src = readFileSync(dumpPath, 'utf-8');
  const { MAX_BODY_DEFAULT, TRUNCATION_BANNER, truncationBanner } =
    await import(pathToFileURL(dumpPath).href);

  // (a) The cap is a catastrophic-bug guard, not a token budget. Longest real JD seen is ~20k.
  if (MAX_BODY_DEFAULT >= 100000) {
    pass(`default body cap is ${MAX_BODY_DEFAULT} chars — far above any real JD (~20k)`);
  } else {
    fail(`default body cap dropped to ${MAX_BODY_DEFAULT} — real JDs will be silently cut`);
  }

  // (b) A truncated body must announce itself, name the posting, and say how to recover.
  const banner = truncationBanner('https://example.com/job/1', 30000, 10000);
  const shouts = banner.includes(TRUNCATION_BANNER)
    && banner.includes('https://example.com/job/1')
    && banner.includes('20000')            // chars withheld
    && banner.includes('--max-body 31000') // the recovery command
    && /INCOMPLETE/.test(banner);
  if (shouts) {
    pass('truncation banner names the posting, the chars withheld, and the re-dump command');
  } else {
    fail('truncation banner is not loud/actionable enough');
  }

  // ...and the run must FAIL, so a truncated dump can't be mistaken for a complete one.
  if (/process\.exit\(3\)/.test(src) && /truncated\.length/.test(src)) {
    pass('a truncated dump exits non-zero instead of returning a partial dump as success');
  } else {
    fail('truncation no longer fails the process — a partial dump can pass for a complete one');
  }

  // (c) The original bug, textually. It was `…join('\n').slice(0, 6000)` — chained onto the
  // body-building expression, so a check anchored to a variable name misses it. The general rule
  // that does catch it: truncation must always go through the named cap, never a magic number.
  // Any `.slice(0, <numeric literal>)` / `.substring|substr(0, <literal>)` is the bug's shape.
  // (`.slice(2)` on the line array is a header skip, not a truncation, so require a 0 start.)
  // Strip comments first — the file documents the old bug in prose, and the guard must read code.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const magicCuts = [...code.matchAll(/\.\s*(?:slice|substring|substr)\s*\(\s*0\s*,\s*(\d+)\s*\)/g)]
    .map(m => m[0].trim());
  if (magicCuts.length === 0) {
    pass('no magic-number truncation anywhere — every cut goes through the named cap');
  } else {
    fail(`magic-number truncation found (the 6000-char bug's shape): ${magicCuts.join(' | ')}`);
  }

  // Behavioural end-to-end: a body longer than the cap must produce the banner AND exit 3.
  const tmp = mkdtempSync(join(tmpdir(), 'byojb-trunc-'));
  try {
    const key = 'https://example.com/jobs/huge';
    const skKey = (await import(pathToFileURL(join(ROOT, 'posting-core.mjs')).href)).sk(key);
    mkdirSync(join(tmp, 'data', 'posting-research'), { recursive: true });
    // Line 3 onward is the body (the dump skips the 2-line title/url header).
    const body = 'HEAD-MARKER\n' + 'x'.repeat(9000) + '\nTAIL-MARKER-PTO-20-DAYS';
    writeFileSync(join(tmp, 'data', 'posting-research', skKey + '.md'), `# T\n${key}\n\n${body}`);
    writeFileSync(join(tmp, 'data', 'posting-research.jsonl'),
      JSON.stringify({ key, company: 'C', title: 'T', location: 'Remote', has_body: true, live: true }) + '\n');
    writeFileSync(join(tmp, 'data', 'postings-personal.jsonl'),
      JSON.stringify({ key, decision: 'undecided', llm_rank: 5 }) + '\n');
    writeFileSync(join(tmp, 'keys.txt'), key + '\n');

    // Default cap: the whole body comes through, tail included, and the run succeeds.
    const okOut = run(NODE, [dumpPath, '--keys', join(tmp, 'keys.txt')], { cwd: tmp });
    if (okOut && okOut.includes('TAIL-MARKER-PTO-20-DAYS') && !okOut.includes(TRUNCATION_BANNER)) {
      pass('a 9k-char body is dumped in full under the default cap');
    } else {
      fail('default cap truncated a 9k body, or swallowed its tail');
    }

    // Forced tiny cap: banner present, tail gone, exit code 3.
    let cutOut = '', cutCode = 0;
    try {
      cutOut = execFileSync(NODE, [dumpPath, '--keys', join(tmp, 'keys.txt'), '--max-body', '500'],
        { cwd: tmp, encoding: 'utf-8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      cutOut = (e.stdout || '') + (e.stderr || '');
      cutCode = e.status;
    }
    if (cutOut.includes(TRUNCATION_BANNER) && !cutOut.includes('TAIL-MARKER') && cutCode === 3) {
      pass('a forced cap shouts, drops the tail, and exits 3 (never a silent partial)');
    } else {
      fail(`forced truncation was not loud enough (exit ${cutCode}, banner ${cutOut.includes(TRUNCATION_BANNER)})`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
} catch (e) {
  fail(`JD dump truncation tests crashed: ${e.message}`);
}

// ── 27. Per-host scheduler ───────────────────────────────────────
//
// The property that matters is ISOLATION: a saturated host must delay only its own queue.
// The design this replaced put every company in one FIFO drained by a fixed worker pool, so a
// worker blocked on a rate-limited host was a dead slot and the item behind it — for an idle
// host — waited too. Throughput decayed 374 -> 77 companies/min within a single run as the
// parallelisable hosts drained and only shared-host work was left.
//
// Ordering the FIFO cannot fix that (the sustainable rate per host is learned at runtime), so
// these assert the replacement: independent per-host queues, AIMD windows, and a global ceiling
// that guards resources without re-coupling hosts.
console.log('\n27. Per-host scheduler: isolation, AIMD, and the global ceiling');
try {
  const sched = await import('./providers/_host-scheduler.mjs');
  const { schedule, penalizeHost, rewardHost, hostState, resetScheduler,
          schedulerSnapshot, schedulerTunables: T } = sched;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // (a) The core fix. A host held busy must not delay a different host.
  resetScheduler();
  const order = [];
  const slow = schedule('slow.example', async () => { await sleep(300); order.push('slow'); });
  await sleep(10);
  const fast = schedule('fast.example', async () => { order.push('fast'); });
  await Promise.all([slow, fast]);
  if (order[0] === 'fast' && order[1] === 'slow') {
    pass('a busy host does not delay a different host');
  } else {
    fail(`host isolation broken — completion order was ${JSON.stringify(order)}`);
  }

  // (b) cwnd opens additively: it takes cwnd successes to gain one slot, so growth slows as
  //     the window widens. A multiplicative increase here is what makes a host oscillate.
  resetScheduler();
  await schedule('grow.example', async () => {});
  const startCwnd = hostState('grow.example').cwnd;
  rewardHost('grow.example');
  const afterOne = hostState('grow.example').cwnd;
  const delta = afterOne - startCwnd;
  if (Math.abs(delta - 1 / startCwnd) < 1e-9) {
    pass(`one success widens cwnd by 1/cwnd (${startCwnd} -> ${afterOne.toFixed(3)})`);
  } else {
    fail(`cwnd increase should be additive 1/cwnd, got +${delta}`);
  }

  // (c) A 429 halves the window and widens the gap — multiplicative decrease.
  resetScheduler();
  await schedule('pen.example', async () => {});
  for (let i = 0; i < 40; i++) rewardHost('pen.example');
  const before = hostState('pen.example');
  penalizeHost('pen.example', 0);
  const after = hostState('pen.example');
  if (Math.abs(after.cwnd - before.cwnd / 2) < 1e-9 && after.gap > before.gap) {
    pass(`a 429 halves cwnd (${before.cwnd.toFixed(2)} -> ${after.cwnd.toFixed(2)}) and widens the gap`);
  } else {
    fail(`429 must halve cwnd and widen gap — cwnd ${before.cwnd}->${after.cwnd}, gap ${before.gap}->${after.gap}`);
  }

  // (d) Bounds hold under sustained pressure in both directions.
  resetScheduler();
  await schedule('bound.example', async () => {});
  for (let i = 0; i < 50; i++) penalizeHost('bound.example', 0);
  const floored = hostState('bound.example');
  if (floored.cwnd >= T.CWND_MIN && floored.concurrency >= 1 && floored.gap <= T.MAX_HOST_GAP_MS) {
    pass('sustained 429s floor cwnd at 1 and cap the gap rather than stalling the host');
  } else {
    fail(`bounds violated under pressure: ${JSON.stringify(floored)}`);
  }
  resetScheduler();
  await schedule('ceil.example', async () => {});
  for (let i = 0; i < 500; i++) rewardHost('ceil.example');
  const opened = hostState('ceil.example');
  if (opened.cwnd <= T.CWND_MAX && opened.gap >= T.MIN_HOST_GAP_MS) {
    pass(`cwnd stops at CWND_MAX (${opened.cwnd}) and the gap at its floor (${opened.gap}ms)`);
  } else {
    fail(`unbounded growth: cwnd ${opened.cwnd} (max ${T.CWND_MAX}), gap ${opened.gap}`);
  }

  // (e) The gap spaces successive requests to one host. Without this a host with a wide
  //     window gets its whole window fired as a burst.
  resetScheduler();
  const stamps = [];
  await Promise.all([0, 1, 2].map(() =>
    schedule('gap.example', async () => { stamps.push(Date.now()); })));
  stamps.sort((a, b) => a - b);
  const spacings = [stamps[1] - stamps[0], stamps[2] - stamps[1]];
  // Allow slop for timer coarseness; the point is that they are not simultaneous.
  if (spacings.every(s => s >= T.MIN_HOST_GAP_MS * 0.7)) {
    pass(`successive same-host requests are spaced (${spacings.join('ms, ')}ms)`);
  } else {
    fail(`same-host requests fired as a burst: spacings ${spacings.join(', ')}ms`);
  }

  // (f) The global ceiling is never exceeded. This is the guardrail's whole job, and the
  //     slot must transfer directly to a waiter — decrementing and then waking one lets a
  //     synchronous fast-path caller slip in and over-subscribe.
  resetScheduler();
  let live = 0;
  let peak = 0;
  await Promise.all(Array.from({ length: 60 }, (_, i) =>
    schedule(`h${i}.example`, async () => {
      live++;
      if (live > peak) peak = live;
      await sleep(5);
      live--;
    })));
  const snap = schedulerSnapshot();
  if (peak <= T.GLOBAL_MAX && snap.inFlight === 0) {
    pass(`global in-flight never exceeded the ceiling (peak ${peak}/${T.GLOBAL_MAX}) and drained to 0`);
  } else {
    fail(`ceiling breached or leaked: peak ${peak}/${T.GLOBAL_MAX}, left in-flight ${snap.inFlight}`);
  }

  // (g) Under contention, admission favours the larger backlog. Otherwise a host with
  //     thousands of companies queues behind thousands of one-company hosts, which is the
  //     original head-of-line blocking rebuilt on the semaphore.
  const savedMax = process.env.BYOJB_HTTP_GLOBAL_MAX;
  process.env.BYOJB_HTTP_GLOBAL_MAX = '1';
  const fresh = await import(`./providers/_host-scheduler.mjs?contended=${Date.now()}`);
  const admitted = [];
  // Occupy the single slot, then queue three waiters with ascending backlog behind it.
  const blocker = fresh.schedule('block.example', async () => { await sleep(120); }, 0);
  await sleep(20);
  const waiters = [
    fresh.schedule('low.example', async () => { admitted.push('low'); }, 1),
    fresh.schedule('mid.example', async () => { admitted.push('mid'); }, 50),
    fresh.schedule('high.example', async () => { admitted.push('high'); }, 5000),
  ];
  await Promise.all([blocker, ...waiters]);
  if (savedMax === undefined) delete process.env.BYOJB_HTTP_GLOBAL_MAX;
  else process.env.BYOJB_HTTP_GLOBAL_MAX = savedMax;
  if (admitted[0] === 'high') {
    pass(`a contended ceiling admits the largest backlog first (${admitted.join(' < ')})`);
  } else {
    fail(`backlog priority ignored — admission order was ${JSON.stringify(admitted)}`);
  }

  // (h) The counter that turns "the ceiling never binds" into a measurement. Without it a
  //     throttling ceiling is indistinguishable from a healthy run.
  if (fresh.schedulerSnapshot().globalWaits >= 3) {
    pass('globalWaits counts acquisitions that actually waited, so a binding ceiling is visible');
  } else {
    fail(`globalWaits did not record the contention: ${fresh.schedulerSnapshot().globalWaits}`);
  }

  // (i) STALL REGRESSION. nextStart advances by `gap` on every scheduled attempt, and the retry
  //     loop re-enters schedule() up to MAX_RETRIES + 1 times per request while penalizeHost
  //     widens the gap it advances BY. Unclamped, a handful of retrying companies scheduled one
  //     host nine minutes out and it compounded: a real scan stalled dead with zero sockets open,
  //     zero in flight and the process asleep on a timer hours away. The clamp is what makes
  //     forward progress structural rather than lucky.
  // Scaled down via env so the assertion runs in about a second: a 2000ms gap ceiling against a
  // 300ms schedule-ahead bound. Each request is awaited in turn, so this measures the SCHEDULE
  // bound and not queue depth — queueing work ahead of the probe would only time the backlog.
  const savedAhead = process.env.BYOJB_HTTP_MAX_SCHEDULE_AHEAD_MS;
  const savedGapMax = process.env.BYOJB_HTTP_HOST_GAP_MAX_MS;
  process.env.BYOJB_HTTP_MAX_SCHEDULE_AHEAD_MS = '300';
  process.env.BYOJB_HTTP_HOST_GAP_MAX_MS = '2000';
  const bounded = await import(`./providers/_host-scheduler.mjs?storm=${Date.now()}`);
  for (let i = 0; i < 20; i++) bounded.penalizeHost('storm.example', 0);   // drive gap to its ceiling
  let worst = 0;
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    await bounded.schedule('storm.example', async () => {});
    worst = Math.max(worst, Date.now() - t0);
  }
  if (savedAhead === undefined) delete process.env.BYOJB_HTTP_MAX_SCHEDULE_AHEAD_MS;
  else process.env.BYOJB_HTTP_MAX_SCHEDULE_AHEAD_MS = savedAhead;
  if (savedGapMax === undefined) delete process.env.BYOJB_HTTP_HOST_GAP_MAX_MS;
  else process.env.BYOJB_HTTP_HOST_GAP_MAX_MS = savedGapMax;
  if (worst <= 600) {
    pass(`a retry storm cannot schedule a host past the bound (worst wait ${worst}ms against a 300ms bound)`);
  } else {
    fail(`nextStart ran away: worst wait ${worst}ms against a 300ms schedule-ahead bound`);
  }

  // (k) Recovery has to be able to outrun the penalty. Shaving a fixed 8ms off the gap meant 982
  //     successes to walk back from the ceiling, at a rate the throttle itself had capped at
  //     0.13 req/s — 131 minutes from one burst. Additive in RATE keeps the step proportional.
  // A low gap ceiling keeps this fast: reaching it needs penalties SPACED past the
  // once-per-incident window, which is itself the previous test's guarantee.
  const savedCeil = process.env.BYOJB_HTTP_HOST_GAP_MAX_MS;
  process.env.BYOJB_HTTP_HOST_GAP_MAX_MS = '1200';
  const rec = await import(`./providers/_host-scheduler.mjs?recover=${Date.now()}`);
  for (let i = 0; i < 4; i++) {
    rec.penalizeHost('recover.example', 0);
    await sleep(rec.hostState('recover.example').gap + 20);   // outlast penaltyUntil
  }
  const pinned = rec.hostState('recover.example').gap;
  let steps = 0;
  while (rec.hostState('recover.example').gap > T.MIN_HOST_GAP_MS + 0.01 && steps < 5000) {
    rec.rewardHost('recover.example');
    steps++;
  }
  if (savedCeil === undefined) delete process.env.BYOJB_HTTP_HOST_GAP_MAX_MS;
  else process.env.BYOJB_HTTP_HOST_GAP_MAX_MS = savedCeil;
  // Additive-in-rate: (floorRate - pinnedRate) / RATE_RECOVERY steps, independent of the ceiling.
  const expected = Math.ceil((1000 / T.MIN_HOST_GAP_MS - 1000 / pinned) / T.RATE_RECOVERY_PER_SUCCESS);
  if (pinned >= 1200 && steps <= expected + 2) {
    pass(`recovery from the ${pinned}ms ceiling takes ${steps} successes (rate-additive), not ~${Math.round((pinned - T.MIN_HOST_GAP_MS) / 8)}`);
  } else {
    fail(`recovery too slow or host not pinned: gap ${pinned}ms, ${steps} successes (expected <=${expected + 2})`);
  }

  // (m) One INCIDENT must produce one decrease, however many refusals it contains. A host with a
  //     window of 8 refuses all 8 in-flight requests within milliseconds — observed live as 429
  //     counts climbing in jumps of exactly 8 — and cutting per refusal compounds 2x into 2^8,
  //     pinning the host at the ceiling and collapsing throughput from 450/min to 34/min.
  resetScheduler();
  await schedule('burst.example', async () => {});
  const preBurst = hostState('burst.example');
  for (let i = 0; i < 8; i++) penalizeHost('burst.example', 0);   // 8 concurrent refusals, one incident
  const postBurst = hostState('burst.example');
  if (Math.abs(postBurst.gap - preBurst.gap * T.GAP_GROWTH) < 1e-9) {
    pass(`8 simultaneous refusals cut the gap once, not 8 times (${preBurst.gap} -> ${postBurst.gap}ms)`);
  } else {
    fail(`concurrent refusals compounded: gap ${preBurst.gap} -> ${postBurst.gap}ms, expected ${preBurst.gap * T.GAP_GROWTH}ms`);
  }

  // (l) One refused request must not compound into 2^MAX_RETRIES of gap growth. The retry loop
  //     penalises only the first attempt and extends the cooldown thereafter.
  const httpSrc = readFile('providers/_http.mjs');
  if (/attempt === 0\) penalizeHost/.test(httpSrc) && /coolHost/.test(httpSrc)) {
    pass('only the first refusal of a request widens the gap; later retries extend the cooldown');
  } else {
    fail('the retry loop penalises every attempt — one 429 will drive the host to the gap ceiling');
  }

  // (j) scan.mjs must not reintroduce a global work list or a fixed worker pool.
  const scanSrc = readFile('scan.mjs');
  if (!/parallelFetch|interleaveByHost/.test(scanSrc) && /runByHost/.test(scanSrc)) {
    pass('scan.mjs partitions by host instead of ordering one shared work list');
  } else {
    fail('scan.mjs still carries the shared FIFO (parallelFetch/interleaveByHost)');
  }

  resetScheduler();
} catch (e) {
  fail(`per-host scheduler tests crashed: ${e.message}`);
}

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
