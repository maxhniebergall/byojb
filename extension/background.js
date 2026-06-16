// background.js — Career-Ops Autofill service worker.
//
// All dashboard (localhost) requests go through here: with host_permissions granted, the
// service worker's fetch bypasses page CORS (a content script's fetch would not). It proxies
// three calls: PLAN (classify + values), SAVE_MAPPING (persist a new field mapping), and
// SUBMITTED (record the application after you submit).

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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'PLAN') sendResponse({ ok: true, data: await postJson('/api/autofill/plan', { fields: msg.fields }) });
      else if (msg.type === 'SAVE_MAPPING') sendResponse({ ok: true, data: await postJson('/api/autofill/mapping', { label: msg.label, profileKey: msg.profileKey }) });
      else if (msg.type === 'REMEMBER') sendResponse({ ok: true, data: await postJson('/api/autofill/remember', { answers: msg.answers }) });
      else if (msg.type === 'SUBMITTED') sendResponse({ ok: true, data: await postJson('/api/application/submitted', msg.payload) });
      else sendResponse({ ok: false, error: 'unknown message' });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true; // keep the channel open for the async response
});
