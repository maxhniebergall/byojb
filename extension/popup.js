// popup.js — Career-Ops Autofill popup.
//
// Flow: ENUMERATE the page's fields (content script) → PLAN them (dashboard classifies + attaches
// values) → render groups → you click "Fill standard fields" → content script fills + highlights.
// Unmapped fields get a profile-key dropdown that persists the mapping so it's recognized next time.

const $ = (s) => document.querySelector(s);
const esc = (s) => (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let PLAN = null, TAB = null, PROFILE_KEYS = [];

const setStatus = (m) => { $('#status').textContent = m; };
const conn = (cls) => { $('#conn').className = 'dot ' + (cls || ''); };

function activeTab() { return chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => t); }
function tabMsg(id, msg) {
  return new Promise((res, rej) => chrome.tabs.sendMessage(id, msg, r => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r)));
}
function bg(msg) {
  return new Promise((res, rej) => chrome.runtime.sendMessage(msg, r => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r)));
}

const fmt = (v) => v === true ? 'Yes' : v === false ? 'No' : String(v ?? '');

async function init() {
  TAB = await activeTab();
  let en;
  try { en = await tabMsg(TAB.id, { type: 'ENUMERATE' }); }
  catch { setStatus('Open a supported application page (use the dashboard "apply / autofill ↗" link), then click the extension.'); return; }
  const fields = (en && en.fields) || [];
  if (!fields.length) { setStatus('No fillable fields found on this page.'); return; }
  setStatus('Analyzing ' + fields.length + ' fields…');

  let resp;
  try { resp = await bg({ type: 'PLAN', fields }); }
  catch { conn('err'); setStatus('Cannot reach the dashboard. Start it with `npm run dashboard:web`.'); return; }
  if (!resp || !resp.ok) { conn('err'); setStatus('Dashboard error: ' + ((resp && resp.error) || 'unknown') + '. Is it running on localhost:4173?'); return; }

  conn('ok');
  PLAN = resp.data;
  PROFILE_KEYS = PLAN.profile_keys || [];
  // The dashboard returns fields in the same order; re-attach the jfId so FILL can target elements.
  PLAN.fields = PLAN.fields.map((p, i) => ({ ...p, jfId: fields[i] && fields[i].jfId }));
  render();
}

function group(title, inner) { return `<div class="grp"><h4>${esc(title)}</h4>${inner}</div>`; }
function row(f, kind) {
  if (kind === 'unmapped') {
    const opts = PROFILE_KEYS.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
    return `<div class="row"><span class="lab" title="${esc(f.label)}">${esc(f.label || f.name)}</span>
      <select data-map="${esc(f.label)}"><option value="">— map to —</option>${opts}</select>
      <button class="sm" data-savemap="${esc(f.label)}">save</button></div>`;
  }
  return `<div class="row"><span class="lab" title="${esc(f.label)}">${esc(f.label || f.name)}</span><span class="tag">${esc(kind.replace('_', ' '))}</span></div>`;
}

function render() {
  setStatus('');
  const willFill = PLAN.fields.filter(f => f.kind === 'standard' || f.kind === 'remembered');
  const std = willFill;
  const needs = PLAN.fields.filter(f => f.kind !== 'standard' && f.kind !== 'remembered');
  $('#verdict').innerHTML = `<b>${willFill.length}</b> will fill · <b>${needs.length}</b> need you`
    + (PLAN.requiredUnresolved && PLAN.requiredUnresolved.length ? ` · <span style="color:var(--warn)">${PLAN.requiredUnresolved.length} required unresolved</span>` : '');

  let h = '';
  if (willFill.length) h += group('Will fill', willFill.map(f => `<div class="row"><span class="lab">${esc(f.label || f.name)}${f.kind === 'remembered' ? ' <span class="tag">memorized</span>' : ''}</span><span class="val">${esc(fmt(f.value))}</span></div>`).join(''));
  const titles = { file: 'Attach manually (resume)', free_text: 'Free-text — write yourself', salary: 'Salary — review, not filled', unmapped: 'Unmapped — assign below', demographic: 'EEO — left blank' };
  for (const k of ['file', 'free_text', 'salary', 'unmapped', 'demographic']) {
    const arr = needs.filter(f => f.kind === k);
    if (arr.length) h += group(titles[k], arr.map(f => row(f, k)).join(''));
  }
  $('#groups').innerHTML = h;
  $('#groups').querySelectorAll('button[data-savemap]').forEach(b => b.onclick = () => saveMapping(b.dataset.savemap));
  $('#hint').textContent = needs.length ? 'You finish the highlighted fields, then click Submit yourself.' : '';
}

async function saveMapping(label) {
  const sel = $(`select[data-map="${CSS.escape(label)}"]`);
  const key = sel && sel.value;
  if (!key) { setStatus('Pick a profile field to map to first.'); return; }
  try {
    const r = await bg({ type: 'SAVE_MAPPING', label, profileKey: key });
    if (r && r.ok) { setStatus('Mapping saved — re-analyzing…'); await init(); }
    else setStatus('Save failed: ' + ((r && r.error) || 'unknown'));
  } catch { setStatus('Save failed (dashboard offline?).'); }
}

$('#fill').onclick = async () => {
  if (!PLAN) return;
  try {
    const r = await tabMsg(TAB.id, { type: 'FILL', plan: PLAN.fields });
    setStatus(`Filled ${r.filled} field(s). Review, attach your resume if needed, then click Submit yourself.`);
  } catch { setStatus('Could not fill (reload the page and try again).'); }
};

// Remember the answers currently on the page → identical questions auto-fill next time.
$('#remember').onclick = async () => {
  let vals;
  try { vals = await tabMsg(TAB.id, { type: 'READ_VALUES' }); }
  catch { setStatus('Could not read the page (reload and try again).'); return; }
  // skip empty + file fields; the server further skips essays/salary
  const answers = (vals.fields || []).filter(f => String(f.value || '').trim() && f.type !== 'file')
    .map(f => ({ label: f.label, value: f.value, type: f.type }));
  if (!answers.length) { setStatus('No answers to remember yet — fill some fields on the page first.'); return; }
  try {
    const r = await bg({ type: 'REMEMBER', answers });
    if (r && r.ok) { setStatus(`Memorized ${r.data.saved} answer(s). Re-analyzing…`); await init(); }
    else setStatus('Save failed: ' + ((r && r.error) || 'unknown'));
  } catch { setStatus('Save failed (dashboard offline?).'); }
};

// dashboard base URL config
chrome.storage.local.get('baseUrl').then(({ baseUrl }) => { $('#base').value = baseUrl || 'http://localhost:4173'; });
$('#base').onchange = () => chrome.storage.local.set({ baseUrl: $('#base').value.trim() });

init();
