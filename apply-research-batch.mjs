// Materializes fit-brief files from a research batch, then applies facets via llm-triage-jobs.
// Input JSON: [{ key, extracted:{...}, llm_reason, fit_brief_text }]
// Writes data/posting-fit/<sk(key)>.md and builds the apply payload with fit_brief paths.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sk } from './posting-core.mjs';

const ROOT = process.cwd();
const inFile = process.argv[2];
const items = JSON.parse(readFileSync(inFile, 'utf-8'));

const applyItems = items.map(it => {
  const rel = `data/posting-fit/${sk(it.key)}.md`;
  writeFileSync(join(ROOT, rel), it.fit_brief_text.trim() + '\n');
  return { key: it.key, extracted: it.extracted, llm_reason: it.llm_reason, fit_brief: rel };
});

const tmp = join(ROOT, 'data', '.apply-tmp.json');
writeFileSync(tmp, JSON.stringify(applyItems));
execFileSync('node', ['llm-triage-jobs.mjs', '--apply', tmp], { stdio: 'inherit' });
