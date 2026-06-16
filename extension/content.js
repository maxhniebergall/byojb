// content.js — Career-Ops Autofill content script.
//
// Runs in YOUR Chrome on the ATS application page: enumerates visible form fields, applies
// deterministic fill values (computed by the dashboard, never an LLM), highlights the fields
// that need you, and — when YOU click Submit — captures every field's value back to the
// dashboard. The fill is plain DOM manipulation in your real tab; the submit is your own
// click, so the request is genuinely you (real cookies/UA/IP/timezone, no automation flags).
(() => {
  const TEXTLIKE = new Set(['text', 'email', 'tel', 'url', 'number', 'search', 'password', '']);
  let idSeq = 0;

  const cleanText = (s) => (s || '').replace(/\s+/g, ' ').replace(/[* ]+$/, '').trim();

  function visible(el) {
    if (el.disabled) return false;
    const t = (el.type || '').toLowerCase();
    if (t === 'hidden') return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    if (parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 && r.height <= 1) return false;       // offscreen/zero-size honeypots
    if (el.closest('[aria-hidden="true"]')) return false;
    return true;
  }

  // Resolve a field's human label: <label for>, wrapping <label>, aria-*, container label, placeholder.
  function labelFor(el) {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && cleanText(l.textContent)) return cleanText(l.textContent);
    }
    const wrap = el.closest('label');
    if (wrap) {
      const clone = wrap.cloneNode(true);
      clone.querySelectorAll('input,select,textarea').forEach(n => n.remove());
      const t = cleanText(clone.textContent);
      if (t) return t;
    }
    const al = el.getAttribute('aria-label');
    if (al) return cleanText(al);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
      if (cleanText(t)) return cleanText(t);
    }
    const cont = el.closest('div,fieldset,section,li,p');
    if (cont) { const lbl = cont.querySelector('label'); if (lbl && cleanText(lbl.textContent)) return cleanText(lbl.textContent); }
    if (el.placeholder) return cleanText(el.placeholder);
    return cleanText(el.name || '');
  }

  function fillable(el) {
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'SELECT') return el.type === 'select-one';
    if (tag === 'INPUT') { const t = (el.type || 'text').toLowerCase(); return TEXTLIKE.has(t) || t === 'file'; }
    return false;
  }

  function collect() {
    const els = [...document.querySelectorAll('input,select,textarea')].filter(el => fillable(el) && visible(el));
    return els.map(el => {
      if (!el.dataset.jfId) el.dataset.jfId = 'jf-' + (++idSeq);
      const tag = el.tagName;
      const type = tag === 'TEXTAREA' ? 'textarea' : tag === 'SELECT' ? 'select' : (el.type || 'text').toLowerCase();
      return {
        jfId: el.dataset.jfId, label: labelFor(el), name: el.name || el.id || '', type,
        required: !!(el.required || el.getAttribute('aria-required') === 'true'),
        maxlength: el.maxLength > 0 ? el.maxLength : undefined, _el: el,
      };
    });
  }

  // Set a value the way React/Vue validators expect: native setter + input/change events.
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Coerce a yes/no-ish value to a boolean (booleans OR the literal strings true/false/yes/no), else null.
  function asYesNo(value) {
    if (value === true || value === false) return value;
    const s = String(value).trim().toLowerCase();
    if (/^(yes|true|y)$/.test(s)) return true;
    if (/^(no|false|n)$/.test(s)) return false;
    return null;
  }

  function fillSelect(el, value) {
    const opts = [...el.options].filter(o => o.value !== '' || cleanText(o.textContent));
    let opt = null;
    // yes/no questions: match the OPTION TEXT ("No"), never write the literal "false"
    const yn = asYesNo(value);
    if (yn !== null) {
      const want = yn ? /^\s*(yes|true)\b/i : /^\s*(no|false)\b/i;
      opt = opts.find(o => want.test(cleanText(o.textContent))) || opts.find(o => want.test(o.value));
    }
    if (!opt) {
      const v = String(value).toLowerCase().trim();
      opt = opts.find(o => o.value.toLowerCase() === v || cleanText(o.textContent).toLowerCase() === v)
        || (v.length > 1 && opts.find(o => cleanText(o.textContent).toLowerCase().includes(v)));
    }
    if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    return false;
  }

  // Never put a raw boolean into a text field — a yes/no answer is "Yes"/"No", not "true"/"false".
  const textValue = (v) => v === true ? 'Yes' : v === false ? 'No' : String(v);

  const HL = { free_text: '2px solid #e0b341', salary: '2px solid #e0556e', demographic: '2px dashed #9aa0c0', unmapped: '2px solid #e0b341', file: '2px solid #7c8cff' };
  function highlight(el, kind) { if (HL[kind]) { el.style.outline = HL[kind]; el.style.outlineOffset = '1px'; } }

  const byId = (jfId) => document.querySelector(`[data-jf-id="${CSS.escape(jfId)}"]`);

  function doFill(plan) {
    let filled = 0;
    for (const f of plan) {
      const el = byId(f.jfId); if (!el) continue;
      // 'standard' (from profile) and 'remembered' (a saved answer to this exact question) both fill
      if ((f.kind === 'standard' || f.kind === 'remembered') && f.value !== '' && f.value != null) {
        if (el.tagName === 'SELECT') { if (fillSelect(el, f.value)) filled++; else highlight(el, 'unmapped'); }
        else if ((el.type || '') === 'file') highlight(el, 'file');
        else { setNativeValue(el, textValue(f.value)); filled++; }
      } else {
        highlight(el, f.kind);
      }
    }
    return filled;
  }

  function readValue(el) {
    if (el.tagName === 'SELECT') { const o = el.options[el.selectedIndex]; return o ? cleanText(o.textContent) : el.value; }
    if ((el.type || '') === 'file') return el.files && el.files[0] ? el.files[0].name : '';
    return el.value;
  }
  const snapshotFields = () => collect().map(f => ({ label: f.label, name: f.name, type: f.type, required: f.required, value: readValue(f._el) }));
  const resumeName = () => { const fi = document.querySelector('input[type=file]'); return fi && fi.files && fi.files[0] ? fi.files[0].name : ''; };

  // ── submit capture (you click Submit; we record what you sent) ──
  let lastSent = 0;
  function captureSubmit() {
    const now = Date.now();
    if (now - lastSent < 4000) return;   // dedup submit event + button-click fallback
    lastSent = now;
    const payload = {
      apply_url: location.href, fields: snapshotFields(), resume_name: resumeName(),
      submitted_at: new Date().toISOString(), snapshot: (document.body.innerText || '').slice(0, 4000),
    };
    try { chrome.runtime.sendMessage({ type: 'SUBMITTED', payload }); } catch (e) { /* dashboard offline; background queues nothing in v1 */ }
  }
  document.addEventListener('submit', captureSubmit, true);
  // SPA fallback (Ashby etc. submit via JS, not a form submit event):
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button,[role=button],input[type=submit]');
    if (!b) return;
    const t = (b.innerText || b.value || '').trim();
    if (/^(submit|apply|send application|submit application)$/i.test(t)) setTimeout(captureSubmit, 600);
  }, true);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'ENUMERATE') sendResponse({ fields: collect().map(({ _el, ...f }) => f) });
    else if (msg.type === 'FILL') sendResponse({ filled: doFill(msg.plan || []) });
    // Current values on the page (for "remember my answers") — same shape as the submit snapshot.
    else if (msg.type === 'READ_VALUES') sendResponse({ fields: snapshotFields() });
    return false;
  });
})();
