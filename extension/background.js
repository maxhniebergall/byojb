// background.js — BYOJB Autofill service worker.
//
// All dashboard (localhost) requests go through here: with host_permissions granted, the
// service worker's fetch bypasses page CORS (a content script's fetch would not). It proxies
// the autofill calls — PLAN (classify + values), SAVE_MAPPING (persist a new field mapping),
// SUBMITTED (record the application after you submit) — and the LinkedIn outreach calls,
// CAPTURE_CONTACT and LOG_OUTREACH.

const DEFAULT_BASE = 'http://localhost:4173';
async function base() {
  const { baseUrl } = await chrome.storage.local.get('baseUrl');
  return (baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
}

async function postJson(pathname, payload) {
  const res = await fetch((await base()) + pathname, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function getJson(pathname) {
  const res = await fetch((await base()) + pathname);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Log a message against a person, opening a thread if they have no open one. Keeping this in
// the worker (rather than making the content script orchestrate two calls) means a mid-flight
// tab navigation can't leave a contact saved with its message dropped.
async function logOutreach({ contact, direction, body, channel }) {
  const saved = await postJson('/api/contact', contact);
  if (saved.error) throw new Error(saved.error);
  const open = (await getJson('/api/outreach')).rows
    .filter(r => r.contact_key === saved.key && r.open)
    .sort((a, b) => String(b.last_updated || '').localeCompare(String(a.last_updated || '')))[0];
  if (open) {
    const r = await postJson('/api/outreach/message', { key: open.key, direction, body });
    return { key: open.key, status: r.status };
  }
  // Create empty, then post the message, so the direction is honored (create always logs
  // its inline `body` as outbound) and the status transition follows the same rules as the UI.
  const created = await postJson('/api/outreach/create', {
    contact_key: saved.key, channel: channel || 'linkedin_dm', intent: 'direct_pitch',
  });
  if (created.error) throw new Error(created.error);
  const r = await postJson('/api/outreach/message', { key: created.key, direction, body });
  return { key: created.key, status: r.status };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'PLAN') sendResponse({ ok: true, data: await postJson('/api/autofill/plan', { fields: msg.fields }) });
      else if (msg.type === 'SAVE_MAPPING') sendResponse({ ok: true, data: await postJson('/api/autofill/mapping', { label: msg.label, profileKey: msg.profileKey }) });
      else if (msg.type === 'REMEMBER') sendResponse({ ok: true, data: await postJson('/api/autofill/remember', { answers: msg.answers }) });
      else if (msg.type === 'SUBMITTED') sendResponse({ ok: true, data: await postJson('/api/application/submitted', msg.payload) });
      else if (msg.type === 'CAPTURE_CONTACT') sendResponse({ ok: true, data: await postJson('/api/contact', msg.contact) });
      else if (msg.type === 'LOG_OUTREACH') sendResponse({ ok: true, data: await logOutreach(msg) });
      else if (msg.type === 'OUTREACH_LIST') sendResponse({ ok: true, data: await getJson('/api/outreach') });
      else if (msg.type === 'VOCAB') sendResponse({ ok: true, data: await getJson('/api/vocab') });
      else if (msg.type === 'CONTACT_LOOKUP') {
        const q = new URLSearchParams(Object.entries(msg.query || {}).filter(([, v]) => v)).toString();
        sendResponse({ ok: true, data: await getJson('/api/contact/lookup?' + q) });
      }
      else sendResponse({ ok: false, error: 'unknown message' });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true; // keep the channel open for the async response
});
