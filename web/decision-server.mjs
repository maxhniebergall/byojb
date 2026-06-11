#!/usr/bin/env node
// web/decision-server.mjs (NEW) — interactive decision console over the company registry.
//
// Read+write, localhost-only. Shows the ranked queue, lets you open a company, edit its
// research note + fit verdict, edit its ranking value (llm_fit), and decide keep/skip.
// Writes back to data/companies-personal.jsonl and the report .md files. After deciding,
// run `node generate-watchlist.mjs` to push keeps onto the scan watchlist.
//
//   npm run dashboard:decisions   →  http://localhost:4174

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.DECISIONS_PORT || 4174);
const PERSONAL = join(ROOT, 'data', 'companies-personal.jsonl');
const RESEARCH = join(ROOT, 'data', 'company-research.jsonl');
const RESEARCH_DIR = join(ROOT, 'data', 'company-research');
const FIT_DIR = join(ROOT, 'data', 'company-fit');

const sk = (key) => key.replace(/[:/]/g, '-');
const loadJsonl = (p) => existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } }) : [];
const savePersonal = (rows) => writeFileSync(PERSONAL, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
const researchPath = (key) => join(RESEARCH_DIR, sk(key) + '.md');
function fitPath(key, personalRow) {
  if (personalRow?.fit_brief) return join(ROOT, personalRow.fit_brief);
  return join(FIT_DIR, sk(key) + '.md');
}
const readMd = (p) => existsSync(p) ? readFileSync(p, 'utf8') : '';

function body(req) {
  return new Promise((res) => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { res(JSON.parse(d || '{}')); } catch { res({}); } }); });
}
const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

// Pull careers/about/source links out of a research note. Subagent notes use full https URLs in
// the "Sources:" line; older enriched notes use bare domains — handle both. Returns {url,label}.
function extractLinks(md, name = '') {
  if (!md) return [];
  let urls = [...md.matchAll(/https?:\/\/[^\s,)<>"'\]]+/g)].map(m => m[0].replace(/[.,;)]+$/, ''));
  if (urls.length === 0) {
    const src = (md.match(/^Sources:.*/im) || [''])[0];
    urls = [...src.matchAll(/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,]*)?/gi)].map(m => 'https://' + m[0].replace(/[.,;]+$/, ''));
  }
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const mainLabel = (h) => { const p = h.split('.'); return p.length >= 2 ? p[p.length - 2] : h; };
  // Keep only the COMPANY'S OWN domain (matched to its name) — drops job aggregators / data sites.
  const nameNorm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isOwn = (u) => {
    const ml = mainLabel(host(u));
    return ml.length >= 3 && nameNorm.length >= 3 && (nameNorm.includes(ml) || ml.includes(nameNorm.slice(0, 8)));
  };
  let kept = urls.filter(isOwn);
  if (kept.length === 0) kept = urls; // fallback: name didn't match any domain — show what we have
  const label = (u) => {
    const s = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const tag = /career|job/i.test(u) ? 'careers' : /about|values|culture|handbook|life-?at|company/i.test(u) ? 'about' : /blog|engineering/i.test(u) ? 'blog' : '';
    return { url: u, label: s.length > 48 ? s.slice(0, 47) + '…' : s, tag };
  };
  const seen = new Set();
  return kept.filter(u => !seen.has(u) && seen.add(u)).slice(0, 8).map(label);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const personal = loadJsonl(PERSONAL);
  const research = new Map(loadJsonl(RESEARCH).map(r => [r.key, r]));

  // ── queue: companies, ranked, with decision state ──
  if (url.pathname === '/api/queue') {
    const rows = personal.filter(p => !p.excluded_by_type).map(p => {
      const r = research.get(p.key) || {};
      // score = the 0-5 ranking (web-researched llm_fit, else world-knowledge prerank llm_rank)
      const score = p.llm_fit ?? p.llm_rank ?? null;
      // tier orders the queue: researched > preranked > raw-heuristic-only (keeps scales from mixing)
      const tier = p.llm_fit != null ? 2 : p.llm_rank != null ? 1 : 0;
      return {
        key: p.key, name: p.name || r.name, provider: p.provider || r.provider,
        company_type: r.company_type || 'unknown', remote_relevant: r.remote_relevant ?? null,
        score, tier, relevance_score: p.relevance_score ?? 0,
        llm_fit: p.llm_fit ?? null, llm_rank: p.llm_rank ?? null,
        decision: p.decision || 'undecided', researched: !!p.fit_brief, reason: p.llm_reason || '',
      };
    }).sort((a, b) => (b.tier - a.tier) || ((b.score ?? -1) - (a.score ?? -1)) || (b.relevance_score - a.relevance_score));
    return json(res, rows);
  }

  // ── company detail ──
  if (url.pathname === '/api/company') {
    const key = url.searchParams.get('key');
    const p = personal.find(x => x.key === key);
    if (!p) return json(res, { error: 'not found' }, 404);
    const r = research.get(key) || {};
    const research_note = readMd(researchPath(key));
    return json(res, {
      key, name: p.name || r.name, provider: p.provider || r.provider, careers_url: r.careers_url || p.careers_url || '',
      company_type: r.company_type, total: r.total, relevant: r.relevant, remote_relevant: r.remote_relevant,
      sample_titles: r.sample_titles || [], llm_fit: p.llm_fit ?? null, llm_rank: p.llm_rank ?? null,
      relevance_score: p.relevance_score ?? null, decision: p.decision || 'undecided', reason: p.llm_reason || '',
      research_note, fit_verdict: readMd(fitPath(key, p)),
      links: extractLinks(research_note, p.name || r.name || ''),   // company's own careers/about pages
    });
  }

  // ── mutations ──
  if (req.method === 'POST' && url.pathname === '/api/decision') {
    const { key, decision } = await body(req);
    if (!['keep', 'skip', 'undecided'].includes(decision)) return json(res, { error: 'bad decision' }, 400);
    const p = personal.find(x => x.key === key); if (!p) return json(res, { error: 'not found' }, 404);
    p.decision = decision; p.last_reviewed = 'web'; savePersonal(personal);
    return json(res, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/rank') {
    const { key, llm_fit } = await body(req);
    const p = personal.find(x => x.key === key); if (!p) return json(res, { error: 'not found' }, 404);
    const v = Number(llm_fit);
    if (!(v >= 0 && v <= 5)) return json(res, { error: 'rank must be 0-5' }, 400);
    p.llm_fit = v; savePersonal(personal);
    return json(res, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/api/report') {
    const { key, which, content } = await body(req);
    if (!['research', 'fit'].includes(which)) return json(res, { error: 'bad report type' }, 400);
    const p = personal.find(x => x.key === key); if (!p) return json(res, { error: 'not found' }, 404);
    const dir = which === 'research' ? RESEARCH_DIR : FIT_DIR;
    mkdirSync(dir, { recursive: true });
    const path = which === 'research' ? researchPath(key) : fitPath(key, p);
    writeFileSync(path, String(content), 'utf8');
    if (which === 'fit' && !p.fit_brief) { p.fit_brief = path.replace(ROOT + '/', ''); savePersonal(personal); }
    return json(res, { ok: true });
  }

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(readFileSync(join(ROOT, 'web', 'decisions.html'), 'utf8'));
  }
  res.writeHead(404); res.end('not found');
});
server.listen(PORT, () => console.log(`decision console → http://localhost:${PORT}`));
