#!/usr/bin/env node
// research-ledger.mjs — append-only record of company research ATTEMPTS.
//
// Without this, a company whose careers page is dead never gets an `llm_fit`, so it never
// leaves the `llm_fit == null` queue and re-emits at the head forever — the LLM re-fetches
// the same 404 every run. The ledger records failures as well as successes, and applies an
// exponential backoff window so an unresearchable company steps aside for the ones behind it.
//
// Append-only, exactly like scan.mjs's scan-ledger (scan.mjs:310-338): an append cannot
// truncate history the way a full rewrite can, so the record survives a killed run.
//
// Only CONSECUTIVE failures count toward backoff — a later `ok` resets the counter, so a
// company that was merely down once is not permanently exiled.

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

export const RESEARCH_LEDGER_PATH = 'data/company-research-ledger.tsv';
const HEADER = 'key\tattempted_at\tstatus\tdetail\n';

// A company's about page and pay policy change far more slowly than its job board, so the
// 24h default that suits scanning is far too eager here. One week.
export const DEFAULT_SKIP_HOURS = Number(process.env.BYOJB_RESEARCH_SKIP_HOURS ?? 168);

export const STATUSES = ['ok', 'fetch_failed', 'no_evidence', 'skipped'];
const isFailure = (s) => s === 'fetch_failed' || s === 'no_evidence';

// key → { last: epochMs, fails: consecutiveFailures, status, detail }
export function loadResearchLedger(path = RESEARCH_LEDGER_PATH) {
  const out = new Map();
  if (!existsSync(path)) return out;
  const lines = readFileSync(path, 'utf-8').split('\n');
  // Rows are appended chronologically, so a single forward pass gives the latest state and
  // lets the consecutive-failure counter reset naturally on each `ok`.
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const [key, at, status, detail = ''] = line.split('\t');
    if (!key || !at) continue;
    const t = Date.parse(at);
    if (!Number.isFinite(t)) continue;
    const prev = out.get(key);
    const fails = isFailure(status) ? ((prev?.fails || 0) + 1) : 0;
    // Guard against an out-of-order line: never move `last` backwards.
    out.set(key, { last: Math.max(t, prev?.last || 0), fails, status, detail });
  }
  return out;
}

// Exponential backoff, capped at 16x the base so a permanently-dead company is retried
// roughly quarterly rather than never (a careers page can come back).
export function backoffHours(fails, base = DEFAULT_SKIP_HOURS) {
  if (!base || fails <= 0) return base;
  return Math.min(base * Math.pow(2, fails), base * 16);
}

// True when the company is inside its backoff window and should be skipped this run.
export function inBackoff(entry, base = DEFAULT_SKIP_HOURS, now = Date.now()) {
  if (!entry || !base) return false;
  return (now - entry.last) < backoffHours(entry.fails, base) * 3600_000;
}

export function appendResearchAttempts(entries, path = RESEARCH_LEDGER_PATH) {
  if (!entries?.length) return;
  if (!existsSync(path)) writeFileSync(path, HEADER, 'utf-8');
  const clean = (s) => String(s ?? '').replace(/[\t\n\r]+/g, ' ').slice(0, 300);
  const rows = entries.map(e =>
    `${clean(e.key)}\t${e.at || new Date().toISOString()}\t${clean(e.status || 'ok')}\t${clean(e.detail)}`
  ).join('\n') + '\n';
  appendFileSync(path, rows, 'utf-8');
}
