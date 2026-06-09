#!/usr/bin/env node
// apply-rubric.mjs (NEW) — render config/rubric.yml into the mode prompt files.
//
// config/rubric.yml is the single source of truth for the evaluation rubric.
// This script injects the rendered rubric between <!-- RUBRIC:BEGIN -->/<!-- RUBRIC:END -->
// markers in the mode files the evaluation reads, so editing rubric.yml + re-running
// `npm run rubric` changes scoring without touching prompt internals.
//
// Targets:
//   modes/_profile.md  — authoritative override (survives `npm run update`); created
//                        from modes/_profile.template.md if missing.
//   modes/ofertas.md   — multi-job comparison (table only).
//   modes/_shared.md   — single-job evaluation default (table + interpretation).

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RUBRIC_PATH = join(ROOT, 'config', 'rubric.yml');

const BEGIN = '<!-- RUBRIC:BEGIN — AUTO-GENERATED from config/rubric.yml by `npm run rubric`. Do not edit by hand; edit config/rubric.yml instead. -->';
const END = '<!-- RUBRIC:END -->';
const BLOCK_RE = /<!-- RUBRIC:BEGIN[\s\S]*?<!-- RUBRIC:END -->/;

function loadRubric() {
  if (!existsSync(RUBRIC_PATH)) {
    console.error(`✗ ${RUBRIC_PATH} not found.`);
    process.exit(1);
  }
  const rubric = yaml.load(readFileSync(RUBRIC_PATH, 'utf-8')) || {};
  const dims = Array.isArray(rubric.dimensions) ? rubric.dimensions : [];
  if (dims.length === 0) {
    console.error('✗ rubric.yml has no dimensions[].');
    process.exit(1);
  }
  const total = dims.reduce((s, d) => s + Number(d.weight || 0), 0);
  if (Math.round(total) !== 100) {
    console.warn(`⚠ dimension weights sum to ${total}, not 100 — scores will still be a weighted average, but consider rebalancing.`);
  }
  return rubric;
}

function renderTable(dims) {
  const rows = dims.map(d => `| ${d.name} | ${d.weight}% | ${d.guidance || ''} |`).join('\n');
  return `| Dimension | Weight | Criteria 1-5 |\n|-----------|------|----------------|\n${rows}`;
}

function renderInterpretation(interp) {
  if (!Array.isArray(interp) || interp.length === 0) return '';
  const sorted = [...interp].sort((a, b) => Number(b.min) - Number(a.min));
  const lines = sorted.map(s => `- ${s.min}+ → ${s.label}, ${s.action}`).join('\n');
  return `\n\n**Score interpretation:**\n${lines}`;
}

function injectMarkers(filePath, body) {
  let text = readFileSync(filePath, 'utf-8');
  const block = `${BEGIN}\n${body}\n${END}`;
  if (BLOCK_RE.test(text)) {
    text = text.replace(BLOCK_RE, block);
  } else {
    text = text.trimEnd() + `\n\n${block}\n`;
  }
  writeFileSync(filePath, text, 'utf-8');
}

function main() {
  const rubric = loadRubric();
  const table = renderTable(rubric.dimensions);
  const interp = renderInterpretation(rubric.score_interpretation);

  // 1. ofertas.md — table only
  injectMarkers(join(ROOT, 'modes', 'ofertas.md'), table);

  // 2. _shared.md — table + interpretation
  injectMarkers(join(ROOT, 'modes', '_shared.md'), table + interp);

  // 3. _profile.md — authoritative override section
  const profilePath = join(ROOT, 'modes', '_profile.md');
  if (!existsSync(profilePath)) {
    const tmpl = join(ROOT, 'modes', '_profile.template.md');
    if (existsSync(tmpl)) copyFileSync(tmpl, profilePath);
    else writeFileSync(profilePath, '# User Profile Context -- career-ops\n', 'utf-8');
  }
  let profile = readFileSync(profilePath, 'utf-8');
  const overrideBody =
    'This rubric OVERRIDES the default scoring table in `_shared.md` / `ofertas.md`. ' +
    'Score each job 1-5 per dimension; the global score is the weighted average.\n\n' +
    table + interp;
  const section = `## Scoring Rubric (user-defined)\n\n${BEGIN}\n${overrideBody}\n${END}`;
  if (BLOCK_RE.test(profile)) {
    profile = profile.replace(BLOCK_RE, `${BEGIN}\n${overrideBody}\n${END}`);
  } else {
    profile = profile.trimEnd() + `\n\n${section}\n`;
  }
  writeFileSync(profilePath, profile, 'utf-8');

  console.log('✓ rubric applied to modes/_profile.md, modes/ofertas.md, modes/_shared.md');
  console.log(`  ${rubric.dimensions.length} dimensions, weights sum ${rubric.dimensions.reduce((s, d) => s + Number(d.weight || 0), 0)}`);
}

main();
