#!/usr/bin/env node
// web/server.mjs (NEW) — local, read-only web dashboard over career-ops pipeline data.
//
// Zero external deps (Node built-in http + the js-yaml already in package.json).
// Reads:
//   reports/*.md          → evaluated jobs (score + explanation), ranked by relevance
//   data/scan-history.tsv → discovered jobs (pending evaluation)
//   config/rubric.yml     → active rubric shown alongside scores
//
// Run:  npm run dashboard:web   (then open http://localhost:4173)

import { createServer } from 'http';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.DASHBOARD_PORT || 4173);

// ── data loaders ────────────────────────────────────────────────────

function loadRubric() {
  const p = join(ROOT, 'config', 'rubric.yml');
  if (!existsSync(p)) return { dimensions: [], score_interpretation: [] };
  try { return yaml.load(readFileSync(p, 'utf-8')) || {}; } catch { return { dimensions: [] }; }
}

function field(text, label) {
  const m = text.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
  return m ? m[1].trim() : '';
}

function loadEvaluated() {
  const dir = join(ROOT, 'reports');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const text = readFileSync(join(dir, file), 'utf-8');
    const titleM = text.match(/^#\s*Evaluation:\s*(.+?)\s*--\s*(.+)$/m);
    const scoreRaw = field(text, 'Score');             // "4.2/5"
    const score = scoreRaw ? parseFloat(scoreRaw) : null;
    const tldrM = text.match(/\|\s*\*\*TL;DR\*\*\s*\|\s*(.+?)\s*\|/);
    out.push({
      company: titleM ? titleM[1].trim() : (file.replace(/\.md$/, '')),
      role: titleM ? titleM[2].trim() : '',
      score,
      url: field(text, 'URL'),
      archetype: field(text, 'Archetype'),
      legitimacy: field(text, 'Legitimacy'),
      why: tldrM ? tldrM[1].trim() : '',
      report: file,
    });
  }
  // Ranked by relevance (score desc); unscored last.
  out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return out;
}

function loadDiscovered() {
  const p = join(ROOT, 'data', 'scan-history.tsv');
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, 'utf-8').split('\n').filter(Boolean);
  const out = [];
  for (const line of lines.slice(1)) {
    const [url, first_seen, portal, title, company, status, location] = line.split('\t');
    if (!url) continue;
    out.push({ url, date: first_seen, source: portal, title, company, status, location: location || '' });
  }
  // newest first
  out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return out;
}

// ── tiny markdown → html (for report view) ──────────────────────────

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function renderReport(md) {
  const html = escapeHtml(md)
    .replace(/^###\s*(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s*(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s*(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\|.*\|)$/gm, '<code>$1</code>');
  return `<!doctype html><meta charset=utf-8><title>Report</title>
  <style>body{font:15px/1.6 -apple-system,system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#1a1a2e}
  h1{font-size:1.6rem}h2{font-size:1.2rem;margin-top:1.6rem;border-bottom:1px solid #eee;padding-bottom:.2rem}
  code{display:block;white-space:pre;font:13px ui-monospace,monospace;color:#444}a{color:#3454d1}</style>
  <p><a href="/">&larr; back to dashboard</a></p>${html.replace(/\n/g, '<br>')}`;
}

// ── server ──────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/data') {
    const payload = { rubric: loadRubric(), evaluated: loadEvaluated(), discovered: loadDiscovered() };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  if (url.pathname === '/report') {
    const f = url.searchParams.get('f') || '';
    // confine to reports/ — no path traversal
    if (!/^[\w.\-]+\.md$/.test(f) || !existsSync(join(ROOT, 'reports', f))) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderReport(readFileSync(join(ROOT, 'reports', f), 'utf-8')));
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8'));
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  console.log(`career-ops dashboard → http://localhost:${PORT}`);
});
