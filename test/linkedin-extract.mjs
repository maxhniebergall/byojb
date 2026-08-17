#!/usr/bin/env node
// test/linkedin-extract.mjs — regression test for the extension's LinkedIn extraction.
//
//   npm run test:linkedin
//
// Selector rot is the EXPECTED failure mode for anything that reads LinkedIn: their CSS classes
// are obfuscated and get renamed without notice. linkedin.js therefore reads in tiers —
// ld+json → og:title → DOM → document.title — and this test pins each tier by serving a fixture
// that only that tier can satisfy. If LinkedIn changes something, this tells you which tier died.
//
// Kept out of `npm test` because it launches a browser; run it when touching extension/linkedin.js.

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const src = readFileSync(join(ROOT, 'extension', 'linkedin.js'), 'utf8');

let passed = 0, failed = 0;
const check = (label, got, want) => {
  if (got === want) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); failed++; }
};

const CASES = [
  {
    label: 'ld+json wins, even when every CSS class is obfuscated',
    file: 'profile-ldjson.html', path: '/in/dana-reyes-demo/',
    want: { name: 'Dana Reyes', title: 'Engineering Manager, Platform', company: 'Northwind', source: 'ld+json' },
  },
  {
    label: 'og:title carries the load when there is no ld+json',
    file: 'profile-ogonly.html', path: '/in/priya-nair/',
    want: { name: 'Priya Nair', title: 'Staff Software Engineer', company: 'Acme Corp', source: 'og:title' },
  },
  {
    label: 'legacy DOM selectors still work with no structured data',
    file: 'profile-domonly.html', path: '/in/lee-chen/',
    want: { name: 'Lee Chen', title: 'VP of Engineering', company: 'Globex', source: 'dom' },
  },
];

console.log('\n🔗 LinkedIn extraction\n');
const browser = await chromium.launch();

async function pageFor(file, path) {
  const p = await browser.newPage();
  const body = readFileSync(join(HERE, 'fixtures', file), 'utf8');
  await p.route('**/*', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await p.goto('https://www.linkedin.com' + path);
  // Minimal chrome.* surface so the content script's IIFE runs outside an extension context.
  await p.addScriptTag({ content: 'window.chrome={runtime:{onMessage:{addListener(){}},sendMessage(){},lastError:null}};' });
  await p.addScriptTag({ content: src });
  return p;
}

for (const c of CASES) {
  const p = await pageFor(c.file, c.path);
  const d = await p.evaluate(() => window.__byojbDump());
  console.log(`\n${c.label}`);
  for (const k of Object.keys(c.want)) check(`${k}`, d.profile[k], c.want[k]);
  check('capture button rendered', !!(await p.$('#byojb-fab button')), true);
  await p.close();
}

// Messaging: no structured data exists, so the thread name comes from the DOM and the profile
// URL is recovered from the thread's own link — that URL is what makes the contact match exact
// instead of forking a duplicate person on a name near-miss.
{
  const p = await pageFor('messaging.html', '/messaging/thread/abc/');
  const d = await p.evaluate(() => window.__byojbDump());
  console.log('\nmessaging thread');
  check('page detected as messaging', d.page, 'messaging');
  check('thread name', d.thread.name, 'Dana Reyes');
  check('profile url recovered from the thread link', d.thread.linkedin_url, 'https://www.linkedin.com/in/dana-reyes-demo/');
  check('log button rendered', !!(await p.$('#byojb-fab button')), true);
  await p.close();
}

// Reading the thread bubbles is what makes an already-sent message loggable — the compose box
// only ever holds something you HAVEN'T sent yet.
for (const [label, file] of [['messages read from thread bubbles', 'messaging-thread.html'],
                             ['…still read when the class suffixes are renamed', 'messaging-renamed.html']]) {
  const p = await pageFor(file, '/messaging/thread/abc/');
  const d = await p.evaluate(() => window.__byojbDump());
  const m = d.messages || [];
  console.log(`\n${label}`);
  check('all three bubbles found', m.length, 3);
  check('oldest-first ordering', (m[0] || {}).body, 'Thanks for reaching out! What are you working on now?');
  check('their message marked inbound', (m[0] || {}).direction, 'in');
  check('my reply marked outbound', (m[1] || {}).direction, 'out');
  check('body text is the message, not the whole bubble chrome',
    (m[2] || {}).body, "Nice. Send me your resume and I'll pass it to our platform EM.");
  await p.close();
}

// The real LinkedIn shape: the <li> carries a DIFFERENT class than the bubble, so the substring
// selector matches the bubble AND its own "…__body" child. Without de-nesting, every message is
// captured twice.
{
  const p = await pageFor('messaging-nested.html', '/messaging/thread/abc/');
  const d = await p.evaluate(() => window.__byojbDump());
  const m = d.messages || [];
  console.log('\nnested bubble markup (real LinkedIn shape)');
  check('three messages, not six', m.length, 3);
  check('no duplicate of the first message', m.filter(x => x.body.startsWith('Thanks for reaching out')).length, 1);
  check('their message marked inbound', (m[0] || {}).direction, 'in');
  check('my reply marked outbound', (m[1] || {}).direction, 'out');
  await p.close();
}

// The conversation overlay docks over the feed — no /messaging/ URL, so URL-based detection alone
// never offers the log button there.
{
  const p = await pageFor('messaging-overlay.html', '/feed/');
  const d = await p.evaluate(() => window.__byojbDump());
  console.log('\nconversation overlay on the feed');
  check('detected as messaging despite the /feed/ URL', d.page, 'messaging');
  check('overlay messages read', (d.messages || []).length, 2);
  const labels = await p.$$eval('#byojb-fab button', els => els.map(e => e.textContent));
  check('log button offered', labels.includes('✎ Log message'), true);
  await p.close();
}

// A conversation overlay open on top of a profile: both actions are valid at once.
{
  const p = await browser.newPage();
  const body = readFileSync(join(HERE, 'fixtures', 'messaging-overlay.html'), 'utf8');
  await p.route('**/*', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await p.goto('https://www.linkedin.com/in/dana-reyes-demo/');
  await p.addScriptTag({ content: 'window.chrome={runtime:{onMessage:{addListener(){}},sendMessage(){},lastError:null}};' });
  await p.addScriptTag({ content: src });
  console.log('\noverlay open on a profile');
  const labels = await p.$$eval('#byojb-fab button', els => els.map(e => e.textContent));
  check('both capture and log offered', labels.length, 2);
  await p.close();
}

// Reproduces the real-world failure: LinkedIn renders the conversation inside a shadow root, so
// document.querySelector finds nothing — every msg-* selector AND `div[contenteditable]` "miss"
// on a page you're plainly reading a conversation on.
{
  const p = await pageFor('messaging-shadow.html', '/messaging/thread/abc/');
  const d = await p.evaluate(() => window.__byojbDump());
  console.log('\nconversation inside a shadow root');
  check('shadow root detected', d.shadowRoots >= 1, true);
  check('messages read through the shadow boundary', (d.messages || []).length, 2);
  check('inbound marker survives the pierce', (d.messages[0] || {}).direction, 'in');
  await p.click('#byojb-fab button');
  const labels = await p.$$eval('#byojb-pick option', els => els.map(e => e.textContent));
  check('compose-box draft found in the shadow root too', labels.some(l => l.startsWith('✎')), true);
  await p.close();
}

// Every LinkedIn class name renamed away. Only structure is left, so only the structural
// fallback can find anything.
{
  const p = await pageFor('messaging-noclasses.html', '/messaging/thread/abc/');
  const d = await p.evaluate(() => window.__byojbDump());
  console.log('\nno msg-* classes anywhere (structural fallback)');
  check('messages still found', (d.messages || []).length >= 2, true);
  check('first message text intact', (d.messages[0] || {}).body, 'Thanks for reaching out! What are you working on now?');
  check('domSample reports real class names for future selectors', (d.domSample || []).length > 0, true);
  await p.close();
}

// The escape hatch: highlighted text needs no selector to match, so it survives any DOM change.
{
  const p = await pageFor('messaging-noclasses.html', '/messaging/thread/abc/');
  await p.evaluate(() => {
    const el = document.querySelectorAll('[role="listitem"]')[1];
    const r = document.createRange(); r.selectNodeContents(el);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await p.click('#byojb-fab button');
  console.log('\nselected-text escape hatch');
  const labels = await p.$$eval('#byojb-pick option', els => els.map(e => e.textContent));
  check('selection offered first', labels[0], '✂ Selected text on the page');
  check('selection is what lands in the textarea',
    await p.inputValue('#byojb-body'), 'Mostly distributed systems work at Northwind these days.');
  await p.close();
}

// The real LinkedIn messaging DOM, including the screen-reader "X sent the following message at
// HH:MM" rows that sit between bubbles. Those are chrome, not messages.
{
  const p = await pageFor('messaging-real.html', '/messaging/thread/abc/');
  const d = await p.evaluate(() => window.__byojbDump());
  const m = d.messages || [];
  console.log('\nreal messaging DOM');
  check('only the two real messages, no meta rows', m.length, 2);
  check('no "sent the following message" row survived',
    m.some(x => /sent the following/i.test(x.body)), false);
  check('their message is inbound', (m[0] || {}).direction, 'in');
  check('my reply is outbound', (m[1] || {}).direction, 'out');
  check('thread name', d.thread.name, 'Jaz Guram');
  // The opaque /in/ACoAA… id is stable but forks the contact when the same person is later
  // captured from their profile page, which uses the vanity slug.
  check('vanity slug preferred over the opaque member id',
    d.thread.linkedin_url, 'https://www.linkedin.com/in/jazguram/');
  await p.close();
}

// The messaging SHELL frame: it matches the /messaging/ URL but holds no conversation — only nav,
// footer and job ads. It must offer nothing at all, or its structural fallback scrapes that junk.
{
  const p = await pageFor('messaging-shell.html', '/messaging/thread/abc/');
  const d = await p.evaluate(() => window.__byojbDump());
  console.log('\nmessaging shell frame (no conversation)');
  check('no messages scraped from footer / job ads', (d.messages || []).length, 0);
  check('no log button offered here', await p.$('#byojb-fab button'), null);
  await p.close();
}

// The log panel is where this is actually used: the draft and every thread bubble must be
// offered as choices, and picking one must fill the textarea AND flip the direction to match.
{
  const p = await pageFor('messaging-thread.html', '/messaging/thread/abc/');
  await p.click('#byojb-fab button');
  console.log('\nlog panel');
  const labels = await p.$$eval('#byojb-pick option', els => els.map(e => e.textContent));
  check('draft + 3 messages offered', labels.length, 4);
  check('compose-box draft offered first', labels[0], '✎ Draft in the compose box');
  check('textarea pre-filled with the draft', await p.inputValue('#byojb-body'), 'Just sent it over — thanks Dana!');
  check('direction defaults to outbound for the draft', await p.inputValue('#byojb-dir'), 'out');
  check('newest thread message offered next', labels[1].startsWith('←'), true);

  await p.selectOption('#byojb-pick', '1');
  check('picking their reply loads its text',
    await p.inputValue('#byojb-body'), "Nice. Send me your resume and I'll pass it to our platform EM.");
  check('…and flips the direction to inbound', await p.inputValue('#byojb-dir'), 'in');

  await p.selectOption('#byojb-pick', '2');
  check('picking my own message flips it back to outbound', await p.inputValue('#byojb-dir'), 'out');
  await p.close();
}

// A blank page must yield NOTHING — never "LinkedIn" as somebody's name. Saving boilerplate as a
// contact is worse than an empty form, because it silently pollutes the registry.
{
  const p = await browser.newPage();
  await p.route('**/*', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>LinkedIn</title><body></body>' }));
  await p.goto('https://www.linkedin.com/in/nobody/');
  await p.addScriptTag({ content: 'window.chrome={runtime:{onMessage:{addListener(){}},sendMessage(){},lastError:null}};' });
  await p.addScriptTag({ content: src });
  const d = await p.evaluate(() => window.__byojbDump());
  console.log('\nunreadable page');
  check('no name invented', d.profile.name, '');
  check('source reported as none', d.profile.source, 'none');
  await p.close();
}

// LinkedIn shows connection distance as a 1st/2nd/3rd badge. Reading it fills the relationship
// field from fact rather than memory — the reason connected_1/connected_2 exist at all.
{
  const p = await pageFor('profile-degree.html', '/in/jazguram/');
  const d = await p.evaluate(() => window.__byojbDump());
  console.log('\nconnection degree');
  check('2nd-degree badge read off the page', d.degree, '2');
  await p.click('#byojb-fab button');
  await p.waitForTimeout(300);
  check('relationship preselected as connected_2', await p.inputValue('#byojb-rel'), 'connected_2');
  check('relevance field present and blank (unrated)', await p.inputValue('#byojb-relevance'), '');
  check('activity field defaults to unknown', await p.inputValue('#byojb-activity'), 'unknown');
  // Degree is distance, not a vouch — it must never preselect a strong tie.
  check('does not claim a strong tie', ['former_colleague','warm_intro'].includes(await p.inputValue('#byojb-rel')), false);
  const rels = await p.$$eval('#byojb-rel option', e => e.map(x => x.value));
  check('both LinkedIn degrees offered', rels.includes('connected_1') && rels.includes('connected_2'), true);
  await p.close();
}

// Re-capturing someone you already know must EDIT them, not silently reset them. The panel is
// driven here against a stubbed lookup, so this pins the prefill wiring without a live dashboard.
{
  const p = await pageFor('profile-prefill.html', '/in/prefill-test/');
  await p.evaluate(() => {
    // Replace the stub with one that answers CONTACT_LOOKUP like the dashboard would.
    window.chrome.runtime.sendMessage = (msg, cb) => {
      if (msg.type === 'VOCAB') return cb({ ok: true, data: {
        archetypes: ['hiring_manager', 'recruiter', 'other'],
        relationships: ['former_colleague', 'connected_1', 'connected_2', 'cold'],
        activity_levels: ['unknown', 'active', 'occasional', 'dormant'] } });
      if (msg.type === 'CONTACT_LOOKUP') return cb({ ok: true, data: { found: true, thread_count: 2, contact: {
        name: 'Prefill Test', title: 'EM', company: 'Acme', archetype: 'recruiter',
        relationship: 'former_colleague', relevance: 4, activity: 'dormant', notes: 'Met at conf.' } } });
      if (msg.type === 'CAPTURE_CONTACT') { window.__saved = msg.contact; return cb({ ok: true, data: { ok: true } }); }
      return cb({ ok: false });
    };
  });
  await p.click('#byojb-fab button');
  await p.waitForTimeout(400);
  console.log('\nre-capturing a known contact');
  // innerText reflects the CSS text-transform, so compare case-insensitively.
  check('panel switches to update mode', /update contact/i.test(await p.innerText('#byojb-panel h4')), true);
  check('stored relevance loaded', await p.inputValue('#byojb-relevance'), '4');
  check('stored activity loaded', await p.inputValue('#byojb-activity'), 'dormant');
  // A stored relationship must beat the page-read degree: you know the person, LinkedIn doesn't.
  check('stored relationship beats the degree badge', await p.inputValue('#byojb-rel'), 'former_colleague');
  check('stored archetype loaded', await p.inputValue('#byojb-arch'), 'recruiter');
  check('stored notes loaded', await p.inputValue('#byojb-notes'), 'Met at conf.');
  // Clearing the box on a known contact is a deliberate un-rating and must be sent.
  await p.fill('#byojb-relevance', '');
  await p.click('#byojb-save'); await p.waitForTimeout(300);
  check('deliberate un-rating is sent', await p.evaluate(() => window.__saved.relevance), '');
  await p.close();
}

// If the lookup never answers, a blank relevance box must NOT be sent — otherwise an offline
// dashboard or a slow worker silently destroys a score you set earlier.
{
  const p = await pageFor('profile-prefill.html', '/in/prefill-test/');
  await p.evaluate(() => {
    window.chrome.runtime.sendMessage = (msg, cb) => {
      if (msg.type === 'CAPTURE_CONTACT') { window.__saved = msg.contact; return cb({ ok: true, data: { ok: true } }); }
      // VOCAB and CONTACT_LOOKUP never call back — simulates a dead dashboard.
    };
  });
  await p.click('#byojb-fab button');
  await p.waitForTimeout(2200); // let the vocab timeout elapse
  console.log('\nlookup unavailable');
  check('panel still opened', !!(await p.$('#byojb-panel')), true);
  await p.click('#byojb-save'); await p.waitForTimeout(300);
  check('blank relevance omitted, so no rating is destroyed',
    await p.evaluate(() => 'relevance' in window.__saved), false);
  await p.close();
}

await browser.close();
console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
