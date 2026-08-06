// Extracts the real render functions out of the shipped HTML and runs them against LIVE API
// data — the closest thing to a browser check without a browser. Verifies the one thing that
// actually matters visually: an imputed number must never render like a listed one.
import { readFileSync } from 'fs';

const PORT = 4199;
const esc = s => (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const get = async (p) => (await fetch(`http://localhost:${PORT}${p}`)).json();

function extract(file, from, to) {
  const s = readFileSync(file, 'utf8');
  const src = [...s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  return src.slice(src.indexOf(from), to ? src.indexOf(to) : undefined);
}

let fail = 0;
const check = (cond, label, extra = '') => {
  if (cond) console.log(`     ✓ ${label}`);
  else { console.log(`     ✗ ${label} ${extra}`); fail++; }
};

// ── postings.html: compCell ────────────────────────────────────────
const compSrc = extract('web/postings.html', 'function comp(c)', 'function th(k,l)');
const compCell = new Function('esc', compSrc + '; return compCell;')(esc);

const { rows } = await get('/api/postings');
const listed = rows.find(r => r.comp_source === 'listed');
const inferred = rows.find(r => r.comp_source === 'company_inferred');
const direct = rows.find(r => r.comp_source === 'company_direct');
const none = rows.find(r => !r.comp_source && !r.comp);

const hL = compCell(listed), hI = compCell(inferred), hD = compCell(direct), hN = compCell(none);
console.log(`     listed   → ${hL}`);
console.log(`     direct   → ${hD.slice(0, 110)}`);
console.log(`     inferred → ${hI.slice(0, 110)}`);
console.log(`     none     → ${hN}`);

check(!hL.includes('~') && !hL.includes('est') && !hL.includes('<span'), 'listed comp renders plain, unmarked');
check(hI.includes('~') && hI.includes('est') && hI.includes('italic'), 'inferred renders as a marked estimate');
check(hD.includes('co.') && !hD.includes('~'), 'company-direct is marked but not shown as an estimate');
check(hN === '·', 'no comp information renders as ·');
// The invariant is that an imputed row carries no listed SALARY — not that `comp` is absent
// entirely. A JD that mentions equity but states no range extracts as
// `{min:null, max:null, currency:null, equity:true}`, which is a real fact worth keeping and is
// still correctly imputed (COMPUTERS.comp falls through to the band on `c.max ?? c.min`).
// 73 rows look like this after the re-extraction pass; asserting `comp === null` tested the
// object's presence rather than the separation of listed and imputed figures.
check(inferred.comp?.min == null && inferred.comp?.max == null,
  'the imputed row carries NO listed salary figures (fields stay separate)');
// the whole point: an estimate must be visually distinguishable from a listed figure
check(hL !== hI && hI !== hD, 'all three states render differently');
// provenance must be inspectable
check(hI.includes('title=') && hI.includes('NOT listed'), 'imputed cell carries provenance in a tooltip');

// ── companies.html: compBandsHtml ──────────────────────────────────
const bandSrc = extract('web/companies.html', 'const money=', '// ==================== COMPANIES');
const compBandsHtml = new Function('esc', bandSrc + '; return compBandsHtml;')(esc);

const co = await get('/api/company?key=greenhouse:canonical');
const html = compBandsHtml(co);
check(html.includes('Pay bands'), 'company pane renders a Pay bands section');
check(html.includes('inferred'), 'derivation pill is rendered');
check(html.includes('e2e test row'), 'the researched band\'s method line is shown verbatim');
check(/US\$1[0-9]{2}k/.test(html), 'band formats with a currency prefix', html.slice(0, 200));

// a company with no bands must degrade gracefully, not blow up
const empty = compBandsHtml({ comp_bands: [], aggregates: { live_relevant: 5, live_relevant_no_comp: 5 } });
check(empty.includes('No pay bands on record'), 'a company with no bands shows an honest empty state');
check(empty.includes('comp-research target'), 'the empty state points at the research opportunity');

process.exit(fail ? 1 : 0);
