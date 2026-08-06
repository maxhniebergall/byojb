// linkedin.js — BYOJB outreach capture on LinkedIn.
//
// Two jobs, both explicitly human-in-the-loop:
//   1. On a /in/<slug> profile, a floating button captures the person into data/contacts.jsonl.
//   2. On /messaging/*, a button logs the message YOU wrote into that contact's outreach thread.
//
// It NEVER sends a message, never clicks a connect/follow button, and never iterates a list of
// people. Automated template blasts are exactly what recruiters and hiring managers filter out —
// the value here is the record-keeping, not the sending. You always click Send yourself.
//
// This is a separate content script from content.js (which handles ATS autofill) so neither one
// ever runs on the other's pages.

(() => {
  if (window.__byojbLinkedIn) return;
  window.__byojbLinkedIn = true;

  // ── selectors ─────────────────────────────────────────────────────
  // LinkedIn's DOM churns constantly. Every entry is a list tried in order, and every
  // extraction failure degrades to an empty string that you fill in on the dashboard —
  // we never guess and save garbage.
  const SELECTORS = {
    profileName: ['h1.text-heading-xlarge', 'main h1', 'section h1', '.pv-text-details__left-panel h1', 'h1'],
    profileHeadline: ['.text-body-medium.break-words', '.pv-text-details__left-panel .text-body-medium', 'main h1 ~ div'],
    profileCompany: ['button[aria-label^="Current company"] .t-14', '.pv-text-details__right-panel .t-14.t-normal'],
    threadName: [
      '.msg-entity-lockup__entity-title', 'h2.msg-entity-lockup__entity-title', '.msg-thread__link-to-profile',
      '.msg-title-bar h2', '.msg-conversation-card__title-row .msg-conversation-listitem__participant-names',
      'a[href*="/in/"] h2',
    ],
    threadProfileLink: ['a.msg-thread__link-to-profile[href*="/in/"]', '.msg-title-bar a[href*="/in/"]', 'a[href*="/in/"]'],
    degree: ['.dist-value', '.distance-badge', 'span[class*="distance-badge"]', '.pv-top-card__distance-badge'],
    composeBox: ['.msg-form__contenteditable', 'div[role="textbox"][contenteditable="true"]', 'div[contenteditable="true"]'],
    // Message bubbles. `[class*=…]` matches on a class SUBSTRING, so a renamed suffix
    // (msg-s-event-listitem--v2, …) still matches — the usual way these break.
    messageItem: ['li[class*="msg-s-event-listitem"]', '[class*="msg-s-event-listitem"]', '.msg-s-message-list__event', 'li.msg-s-message-list__event'],
    messageBody: ['[class*="msg-s-event-listitem__body"]', '[class*="msg-s-event__content"] p', 'p'],
  };

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // ── shadow-DOM-piercing queries ───────────────────────────────────
  // document.querySelector does NOT descend into shadow roots, and LinkedIn renders parts of the
  // messaging UI inside them — which is why every msg-* selector, and even `div[contenteditable]`,
  // can report "miss" on a page where you're plainly looking at a conversation.
  function eachRoot(fn, root = document) {
    fn(root);
    let hosts;
    try { hosts = root.querySelectorAll('*'); } catch { return; }
    for (const el of hosts) if (el.shadowRoot) eachRoot(fn, el.shadowRoot);
  }

  function deepQueryAll(sel) {
    const out = [];
    eachRoot((root) => { try { out.push(...root.querySelectorAll(sel)); } catch { /* bad selector */ } });
    return out;
  }
  const deepQuery = (sel) => deepQueryAll(sel)[0] || null;

  const pick = (names) => {
    for (const sel of SELECTORS[names] || []) {
      const el = deepQuery(sel);
      const txt = el && clean(el.innerText || el.textContent);
      if (txt) return txt;
    }
    return '';
  };

  // ── structured-data extraction ────────────────────────────────────
  // LinkedIn's CSS classes are obfuscated and get renamed without warning, so class selectors are
  // the LAST resort, not the first. These two sources are part of LinkedIn's public/SEO contract
  // and change far less often:
  //   1. <script type="application/ld+json"> — a Person node with name / jobTitle / worksFor
  //   2. Open Graph meta tags — og:title is "Name - Headline", og:description carries the rest
  // Each reader returns null when it can't find anything, so readProfile() can fall through.

  function fromLdJson() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(s.textContent || '{}'); } catch { continue; }
      const nodes = data['@graph'] || (Array.isArray(data) ? data : [data]);
      for (const n of nodes) {
        if (!n || n['@type'] !== 'Person' || !n.name) continue;
        // Only trust a Person node that is about THIS profile — a page also embeds other people
        // (post authors, "people also viewed"), and grabbing the wrong one is worse than nothing.
        const slug = (location.pathname.match(/^\/in\/([^/]+)/) || [])[1];
        if (slug && n.url && !String(n.url).toLowerCase().includes(slug.toLowerCase())) continue;
        const job = Array.isArray(n.jobTitle) ? n.jobTitle[0] : n.jobTitle;
        const works = Array.isArray(n.worksFor) ? n.worksFor[0] : n.worksFor;
        return {
          name: clean(n.name),
          title: clean(job || ''),
          company: clean((works && (works.name || works['@name'])) || ''),
          source: 'ld+json',
        };
      }
    }
    return null;
  }

  // Parse a "Jane Doe - Engineering Manager at Acme | LinkedIn" style string. Returns null when
  // what's left is boilerplate — an untitled page is literally "LinkedIn", and saving that as
  // someone's name is exactly the kind of garbage this must never produce.
  function parseTitleString(raw, source) {
    let t = clean(raw);
    if (!t) return null;
    t = t.replace(/\s*\|\s*LinkedIn\s*$/i, '').replace(/^\(\d+\)\s*/, '').trim();
    const m = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    const name = clean(m ? m[1] : t);
    const headline = clean(m ? m[2] : '');
    if (!name || /^(linkedin|messaging|feed|profile)$/i.test(name)) return null;
    return { name, headline, source };
  }

  function fromMeta() {
    const el = document.querySelector('meta[property="og:title"], meta[name="og:title"]');
    return parseTitleString(el && el.getAttribute('content'), 'og:title');
  }

  function fromDocTitle() { return parseTitleString(document.title, 'document.title'); }

  // Layered read: structured data first, DOM scraping last. `source` is surfaced in the panel so
  // a silent failure is visible rather than looking like the person simply has no title.
  // Precedence, strongest evidence first: structured Person data → the og:title LinkedIn
  // publishes for sharing → the page's own heading → the tab title (weakest — it's boilerplate
  // on a slow load, which is how "LinkedIn" would otherwise end up saved as someone's name).
  function readProfile() {
    const out = { name: '', title: '', company: '', headline: '', source: '' };
    const take = (name, source) => { if (!out.name && name) { out.name = name; out.source = out.source || source; } };

    const ld = fromLdJson();
    if (ld) Object.assign(out, ld);

    const meta = fromMeta();
    if (meta) { take(meta.name, meta.source); if (meta.headline) out.headline = out.headline || meta.headline; }

    take(pick('profileName'), 'dom');

    const domHeadline = pick('profileHeadline');
    if (domHeadline) out.headline = out.headline || domHeadline;

    const doc = fromDocTitle();
    if (doc) { take(doc.name, doc.source); if (doc.headline) out.headline = out.headline || doc.headline; }

    // Split "Staff Engineer at Acme" only to fill gaps — never overwrite ld+json's structured values.
    const split = splitHeadline(out.headline);
    if (!out.title) out.title = split.title;
    if (!out.company) out.company = split.company || pick('profileCompany');
    if (!out.headline) out.headline = [out.title, out.company].filter(Boolean).join(' at ');
    if (!out.source) out.source = 'none';
    return out;
  }

  // The messaging pane has no structured data, so this stays DOM-based — but it also tries to
  // recover the profile URL from the thread's link, which makes the contact match exact.
  function readThread() {
    // Collect every candidate slug, then prefer a readable vanity one. LinkedIn often links the
    // thread by opaque member id (/in/ACoAAAYLL7MB…); that's stable, but capturing the same person
    // from their profile later yields /in/jazguram/ and forks them into two contacts.
    const slugs = [];
    for (const sel of SELECTORS.threadProfileLink) {
      for (const a of deepQueryAll(sel)) {
        const m = (a.getAttribute('href') || '').match(/\/in\/([^/?#]+)/);
        if (m && !slugs.includes(m[1])) slugs.push(m[1]);
      }
    }
    const vanity = slugs.find(s => !/^ACoA/i.test(s));
    const slug = vanity || slugs[0] || '';
    const url = slug ? `https://www.linkedin.com/in/${slug}/` : '';
    let name = pick('threadName');
    // Fall back to the tab title: "(3) Messaging | Jane Doe | LinkedIn"
    if (!name) {
      const parts = clean(document.title).replace(/^\(\d+\)\s*/, '').split('|').map(clean)
        .filter(p => p && !/^(messaging|linkedin)$/i.test(p));
      name = parts[0] || '';
    }
    return { name, linkedin_url: url };
  }

  // The messages already in the thread, oldest → newest. The compose box only holds a message you
  // haven't sent yet, so without this there is nothing to log for a conversation that's underway.
  //
  // Direction: LinkedIn marks the other party's bubbles with an "--other" class. When that marker
  // is missing we return direction '' rather than guessing — the panel then makes YOU pick, which
  // is better than silently filing their reply as something you wrote.
  function readMessages(limit = 12) {
    let items = [];
    let usedFallback = false;
    for (const sel of SELECTORS.messageItem) {
      const found = deepQueryAll(sel);
      if (found.length) { items = found; break; }
    }
    // Class-agnostic fallback: when none of LinkedIn's class names match — they rename them, and
    // shadow roots hide them — fall back to STRUCTURE. Any list item or paragraph carrying a
    // sentence-length run of text is a candidate. This is deliberately generous: you pick the
    // right one from the dropdown, so a few false positives cost a scroll, while missing the real
    // message costs the whole feature.
    // …but ONLY inside a frame that actually holds a conversation. Run it on the messaging shell
    // and it happily returns the footer, the nav, and every job ad on the page.
    if (!items.length && hasConversation()) {
      usedFallback = true;
      const seen = new Set();
      for (const el of [...deepQueryAll('[role="listitem"]'), ...deepQueryAll('li'), ...deepQueryAll('p')]) {
        const t = clean(el.innerText || el.textContent);
        if (t.length < 20 || t.length > 2000 || seen.has(t)) continue;
        seen.add(t);
        items.push(el);
      }
    }
    // Substring matching is what makes these selectors survive renames, but it also means
    // "msg-s-event-listitem" matches the bubble AND its own "…__body" child. Keep only the
    // outermost matches, or every message gets logged twice.
    items = items.filter(el => !items.some(other => other !== el && other.contains(el)));
    const out = [];
    for (const el of items) {
      let body = '';
      for (const sel of SELECTORS.messageBody) {
        let sub;
        try { sub = el.querySelector(sel); } catch { continue; }
        if (sub && clean(sub.innerText || sub.textContent)) { body = clean(sub.innerText || sub.textContent); break; }
      }
      if (usedFallback) {
        // Here the element IS the message; a stray <p> match would return only a fragment of it.
        body = clean(el.innerText || el.textContent);
      } else if (!body) {
        // A matched row with no message body is thread chrome, not a message — the timestamp
        // separators and the screen-reader "Jaz Guram sent the following message at 10:22 AM"
        // rows both land here. Skipping them is what keeps the picker showing real messages.
        continue;
      }
      // Belt and braces: that meta line is also emitted inline by some layouts.
      if (/\bsent the following messages?\b/i.test(body)) continue;
      if (!body) continue;
      const cls = String(el.className || '');
      const marked = /--other\b|--other-/.test(cls);
      // Only claim a direction when the marker is actually present somewhere in the thread;
      // if LinkedIn dropped it entirely, every bubble would look outgoing.
      out.push({ body, direction: marked ? 'in' : '', el });
    }
    const anyMarked = out.some(m => m.direction === 'in');
    for (const m of out) { if (anyMarked && !m.direction) m.direction = 'out'; delete m.el; }
    return out.slice(-limit);
  }

  const bg = (msg) => new Promise((res, rej) =>
    chrome.runtime.sendMessage(msg, r => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r)));

  const isProfile = () => /^\/in\/[^/]+/.test(location.pathname);

  // Messaging isn't only the /messaging/ route — LinkedIn also opens conversations in an overlay
  // bubble docked over the feed or a profile. That overlay has the same message DOM but a totally
  // unrelated URL, so detect the CONVERSATION being present, not the path.
  // Deliberately does NOT test the generic `div[contenteditable]` compose fallback — profiles have
  // their own rich-text boxes, and a false positive would offer "Log message" with nothing to log.
  // Only real conversation markers count.
  const hasConversation = () => {
    for (const sel of [...SELECTORS.messageItem, '[class*="msg-overlay-conversation"]', '.msg-form__contenteditable', '[contenteditable="true"]']) {
      if (deepQuery(sel)) return true;
    }
    return false;
  };
  const isMessaging = () => location.pathname.startsWith('/messaging') || hasConversation();

  // Canonical profile URL — strip the query string and trailing path so the same person always
  // derives the same contact key on the dashboard (contactKey() keys on the /in/ slug).
  function profileUrl() {
    const m = location.pathname.match(/^\/in\/([^/]+)/);
    return m ? `https://www.linkedin.com/in/${m[1]}/` : '';
  }

  // LinkedIn shows connection distance as a "1st" / "2nd" / "3rd+" badge next to the name. Reading
  // it means the relationship field is filled from fact rather than from memory — which is the
  // whole point of having connected_1 / connected_2 as options.
  function readDegree() {
    for (const sel of SELECTORS.degree) {
      const m = clean((deepQuery(sel) || {}).innerText).match(/([123])(?:st|nd|rd)/i);
      if (m) return m[1];
    }
    // Fall back to the header text: "Jane Doe · 2nd" / "2nd degree connection".
    const hdr = clean((deepQuery('main') || document.body || {}).innerText).slice(0, 600);
    const m = hdr.match(/(?:·\s*|\b)([123])(?:st|nd|rd)\b/i);
    return m ? m[1] : '';
  }

  // Degree is network DISTANCE, not a vouch — it never implies former_colleague/warm_intro, which
  // are the ties that actually carry weight in a referral.
  const relationshipFromDegree = (d) => d === '1' ? 'connected_1' : d === '2' ? 'connected_2' : 'cold';

  // Guess the archetype from the headline so the common case needs no editing. Order matters:
  // "Engineering Manager" must beat the bare "engineer" test. You can always correct it in the
  // confirm chip before saving — a wrong archetype skews which outreach playbook you'd use.
  function guessArchetype(headline) {
    const h = (headline || '').toLowerCase();
    if (/\b(recruiter|talent|sourcer|talent acquisition|ta partner)\b/.test(h)) return 'recruiter';
    if (/\b(vp|head of|director|cto|founder|co-founder|chief)\b/.test(h)) return 'exec';
    if (/\b(engineering manager|em|eng manager|software development manager|sdm|manager)\b/.test(h)) return 'hiring_manager';
    if (/\b(engineer|developer|swe|architect|tech lead|programmer)\b/.test(h)) return 'peer_engineer';
    return 'other';
  }

  // Headline is usually "Senior Staff Engineer at Acme" — split it into title + company.
  function splitHeadline(headline) {
    const m = (headline || '').match(/^(.*?)\s+(?:at|@)\s+(.+)$/i);
    if (m) return { title: m[1].trim(), company: m[2].split('|')[0].trim() };
    return { title: (headline || '').split('|')[0].trim(), company: pick('profileCompany') };
  }

  // ── UI ────────────────────────────────────────────────────────────
  const CSS = `
    #byojb-fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;font:13px/1.4 -apple-system,system-ui,Segoe UI,sans-serif;}
    #byojb-fab button{background:#7c8cff;color:#0b0c18;border:none;border-radius:99px;padding:.55rem .95rem;font-weight:700;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.35);}
    #byojb-panel{position:fixed;right:18px;bottom:64px;z-index:2147483000;width:320px;background:#1a1c33;color:#e8e9f3;border:1px solid #2a2d4a;border-radius:12px;padding:.8rem;box-shadow:0 8px 28px rgba(0,0,0,.5);font:13px/1.45 -apple-system,system-ui,Segoe UI,sans-serif;}
    #byojb-panel h4{margin:0 0 .5rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:#9aa0c0;}
    #byojb-panel label{display:block;font-size:.7rem;text-transform:uppercase;color:#9aa0c0;margin:.45rem 0 .15rem;}
    #byojb-panel input,#byojb-panel select,#byojb-panel textarea{width:100%;background:#0c0d1c;border:1px solid #2a2d4a;color:#e8e9f3;border-radius:6px;padding:.3rem .4rem;font:inherit;}
    #byojb-panel textarea{min-height:70px;font:11px/1.45 ui-monospace,monospace;}
    #byojb-panel .row{display:flex;gap:.4rem;margin-top:.6rem;align-items:center;}
    #byojb-panel button{background:#23264a;color:#e8e9f3;border:1px solid #2a2d4a;border-radius:7px;padding:.35rem .7rem;cursor:pointer;font:inherit;}
    #byojb-panel button.primary{background:#3ec98a;color:#0b0c18;border-color:#3ec98a;font-weight:700;}
    #byojb-msg{font-size:.76rem;color:#9aa0c0;margin-top:.4rem;min-height:1em;}
    #byojb-msg.err{color:#e0556e;} #byojb-msg.ok{color:#3ec98a;}
  `;

  function ensureStyle() {
    if (document.getElementById('byojb-css')) return;
    const s = document.createElement('style');
    s.id = 'byojb-css'; s.textContent = CSS;
    document.documentElement.appendChild(s);
  }

  function closePanel() { const p = document.getElementById('byojb-panel'); if (p) p.remove(); }

  const opts = (list, cur) => list.map(v => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('');
  // Offline fallbacks only. The live lists come from the dashboard's /api/vocab so the extension
  // can't drift out of sync with what the registry actually accepts.
  const FALLBACK_VOCAB = {
    archetypes: ['hiring_manager', 'recruiter', 'peer_engineer', 'exec', 'alumni', 'former_colleague', 'other'],
    relationships: ['former_colleague', 'warm_intro', 'alumni', 'shared_employer', 'connected_1', 'connected_2', 'cold'],
    activity_levels: ['unknown', 'active', 'occasional', 'dormant'],
  };
  let VOCAB = FALLBACK_VOCAB;
  // Never let this block the UI: a hung service worker or a stopped dashboard must not stop you
  // capturing a contact, so it races a short timeout and the panel renders from FALLBACK_VOCAB.
  async function loadVocab() {
    try {
      const r = await Promise.race([
        bg({ type: 'VOCAB' }),
        new Promise((res) => setTimeout(() => res(null), 1500)),
      ]);
      if (r && r.ok && r.data && r.data.archetypes) VOCAB = { ...FALLBACK_VOCAB, ...r.data };
    } catch { /* dashboard offline — the fallback lists still let you capture */ }
    return VOCAB;
  }

  // Re-populate a <select> in place, keeping whatever is already chosen.
  function refreshSelect(id, list) {
    const el = document.getElementById(id);
    if (!el || !list) return;
    const cur = el.value;
    el.innerHTML = opts(list, cur);
    if (cur && list.includes(cur)) el.value = cur;
  }

  function panel(html) {
    closePanel(); ensureStyle();
    const d = document.createElement('div');
    d.id = 'byojb-panel'; d.innerHTML = html;
    document.body.appendChild(d);
    return d;
  }
  const say = (text, cls = '') => { const m = document.getElementById('byojb-msg'); if (m) { m.textContent = text; m.className = cls; } };

  // ── capture a contact from a profile page ─────────────────────────
  function openCapturePanel() {
    const prof = readProfile();
    const { name, title, company, headline } = prof;
    const degree = readDegree();
    // Render synchronously from whatever vocabulary we have, then upgrade in place once the
    // dashboard answers. Blocking the panel on a fetch means an offline dashboard = no capture.
    const v = VOCAB;
    const p = panel(`
      <h4>Capture contact <span style="float:right;font-weight:400;text-transform:none;letter-spacing:0">read via ${esc(prof.source)}</span></h4>
      <label>Name</label><input id="byojb-name" value="${esc(name)}">
      <label>Title</label><input id="byojb-title" value="${esc(title)}">
      <label>Company</label><input id="byojb-company" value="${esc(company)}">
      <label>Archetype</label><select id="byojb-arch">${opts(v.archetypes, guessArchetype(headline || title))}</select>
      <label>Relationship${degree ? ` — read ${degree}${degree === '1' ? 'st' : degree === '2' ? 'nd' : 'rd'} degree off the page` : ' — a former colleague vouching is worth far more than a cold DM'}</label>
      <select id="byojb-rel">${opts(v.relationships, relationshipFromDegree(degree))}</select>
      <label>Relevance (0–5, blank = unrated)</label>
      <input id="byojb-relevance" type="number" min="0" max="5" step="0.5" placeholder="—">
      <label>LinkedIn activity — a dormant contact will never see your message</label>
      <select id="byojb-activity">${opts(v.activity_levels, 'unknown')}</select>
      <label>Notes — shared context, what to reference</label><textarea id="byojb-notes"></textarea>
      <div class="row"><button class="primary" id="byojb-save">Save contact</button><button id="byojb-close">Cancel</button></div>
      <div id="byojb-msg"></div>`);
    if (!name) say('Could not read this page — type the fields in. (See the console for a BYOJB dump.)', 'err');
    else if (!title) say('Read the name but not the title — check it.', '');

    // Upgrade the dropdowns once the live vocabulary lands, then prefill from the stored contact
    // if we already know this person. Order matters: the vocabulary must contain the stored value
    // before we try to select it, or e.g. connected_2 silently falls back to the first option.
    loadVocab().then((live) => {
      if (!document.getElementById('byojb-arch')) return; // panel closed meanwhile
      refreshSelect('byojb-arch', live.archetypes);
      refreshSelect('byojb-rel', live.relationships);
      refreshSelect('byojb-activity', live.activity_levels);
      return prefillExisting();
    }).catch(() => { /* offline — the panel still works as a fresh capture */ });

    // Tracks whether we know this person's stored state. Until we do, a blank relevance box means
    // "unknown", NOT "clear the rating" — otherwise a lookup failure silently wipes a score you
    // set earlier. Only once prefill has succeeded is a blank box a deliberate un-rating.
    let knownState = false;

    async function prefillExisting() {
      let r;
      try { r = await bg({ type: 'CONTACT_LOOKUP', query: { linkedin_url: profileUrl(), name } }); }
      catch { return; }
      const d = r && r.ok && r.data;
      if (!d || !d.found) { knownState = true; return; } // confirmed new: blank really is unrated
      const c = d.contact || {};
      const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
      // Personal judgements are yours and always win — the page can't know them.
      set('byojb-rel', c.relationship); set('byojb-arch', c.archetype);
      set('byojb-activity', c.activity);
      const rel = document.getElementById('byojb-relevance');
      if (rel) rel.value = c.relevance == null ? '' : c.relevance;
      const notes = document.getElementById('byojb-notes');
      if (notes && !notes.value) notes.value = c.notes || '';
      // Page-derived identity only fills gaps: a title read live off the profile is fresher than
      // a stored one, but don't blank a stored value the page failed to read this time.
      for (const [id, v] of [['byojb-name', c.name], ['byojb-title', c.title], ['byojb-company', c.company]]) {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = v || '';
      }
      knownState = true;
      const threads = d.thread_count ? ` · ${d.thread_count} thread${d.thread_count === 1 ? '' : 's'}` : '';
      say(`Editing existing contact${threads} — saved values loaded.`, 'ok');
      const h = p.querySelector('h4');
      if (h) h.firstChild.textContent = 'Update contact ';
    }

    p.querySelector('#byojb-close').onclick = closePanel;
    p.querySelector('#byojb-save').onclick = async () => {
      const payload = {
        name: val('byojb-name'), title: val('byojb-title'), company: val('byojb-company'),
        archetype: val('byojb-arch'), relationship: val('byojb-rel'), notes: val('byojb-notes'),
        activity: val('byojb-activity'),
        linkedin_url: profileUrl(), source: 'linkedin',
      };
      // Blank relevance is only sent (as an explicit un-rating) once we've confirmed what the
      // stored value is. If the lookup never answered, omitting the field leaves the existing
      // score untouched rather than destroying it.
      const relRaw = val('byojb-relevance');
      if (relRaw !== '' || knownState) payload.relevance = relRaw;
      if (!payload.name && !payload.linkedin_url) { say('Need a name or a profile URL.', 'err'); return; }
      try {
        const r = await bg({ type: 'CAPTURE_CONTACT', contact: payload });
        if (r && r.ok) say('Saved → dashboard Contacts tab.', 'ok');
        else say('Failed: ' + ((r && r.error) || 'unknown'), 'err');
      } catch { say('Dashboard offline — start it with `npm run dashboard`.', 'err'); }
    };
  }

  // ── log a message from the messaging page ─────────────────────────
  function openLogPanel() {
    const { name: who, linkedin_url } = readThread();
    // Two sources: the compose box (a message you're about to send) and the bubbles already in
    // the thread (anything you've sent or received). You pick which one to log.
    let draft = '';
    for (const sel of SELECTORS.composeBox) {
      const el = deepQuery(sel);
      if (el && clean(el.innerText)) { draft = clean(el.innerText); break; }
    }
    // Whatever you highlighted on the page. This is the escape hatch: it needs no selector to
    // match anything, so it keeps working no matter how LinkedIn rebuilds their DOM.
    let selected = '';
    try { selected = clean(String(window.getSelection() || '')); } catch { /* no selection */ }

    const msgs = readMessages();
    // Newest first — logging the message you just sent is by far the common case.
    const choices = [];
    if (selected) choices.push({ label: `✂ Selected text on the page`, body: selected, direction: '' });
    if (draft) choices.push({ label: '✎ Draft in the compose box', body: draft, direction: 'out' });
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      const arrow = m.direction === 'in' ? '←' : m.direction === 'out' ? '→' : '·';
      choices.push({ label: `${arrow} ${m.body.slice(0, 46)}${m.body.length > 46 ? '…' : ''}`, body: m.body, direction: m.direction });
    }

    const p = panel(`
      <h4>Log outreach message</h4>
      <label>Contact name (must match, or a new contact is created)</label><input id="byojb-name" value="${esc(who)}">
      <label>LinkedIn URL (optional, but makes the match exact)</label><input id="byojb-li" value="${esc(linkedin_url)}" placeholder="https://www.linkedin.com/in/…">
      ${choices.length ? `<label>Which message (${choices.length} found)</label>
      <select id="byojb-pick">${choices.map((c, i) => `<option value="${i}">${esc(c.label)}</option>`).join('')}</select>` : ''}
      <label>Direction</label><select id="byojb-dir"><option value="out">→ I sent this</option><option value="in">← they replied</option></select>
      <label>Message</label><textarea id="byojb-body">${esc(choices.length ? choices[0].body : '')}</textarea>
      <div class="row"><button class="primary" id="byojb-log">Log message</button><button id="byojb-close">Cancel</button></div>
      <div id="byojb-msg">Logging only — you still click Send yourself.</div>`);
    if (!who) say('Could not read the thread name — type it in.', 'err');
    if (!choices.length) say('Nothing readable found — highlight the message on the page and reopen this, or just paste it in.', 'err');

    // Selecting a message fills the textarea and pre-sets the direction; you can still edit both,
    // and an unmarked bubble leaves the direction on whatever you last chose rather than guessing.
    const pickEl = p.querySelector('#byojb-pick');
    if (pickEl) {
      const sync = () => {
        const c = choices[Number(pickEl.value)] || {};
        p.querySelector('#byojb-body').value = c.body || '';
        if (c.direction) p.querySelector('#byojb-dir').value = c.direction;
      };
      pickEl.onchange = sync;
      sync();
    }

    p.querySelector('#byojb-close').onclick = closePanel;
    p.querySelector('#byojb-log').onclick = async () => {
      const body = val('byojb-body');
      if (!body) { say('Nothing to log.', 'err'); return; }
      try {
        const r = await bg({
          type: 'LOG_OUTREACH',
          contact: { name: val('byojb-name'), linkedin_url: val('byojb-li'), source: 'linkedin' },
          direction: val('byojb-dir'), body, channel: 'linkedin_dm',
        });
        if (r && r.ok) say(`Logged on thread ${r.data.key} (${r.data.status}).`, 'ok');
        else say('Failed: ' + ((r && r.error) || 'unknown'), 'err');
      } catch { say('Dashboard offline — start it with `npm run dashboard`.', 'err'); }
    };
  }

  const val = (id) => (document.getElementById(id) || {}).value?.trim() || '';
  const esc = (s) => (s ?? '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── floating button, kept in sync with LinkedIn's client-side routing ──
  // Both actions can apply at once — a conversation overlay docked over someone's profile is a
  // normal way to work — so render a button per available mode rather than picking a winner.
  function renderFab() {
    // With all_frames enabled this runs in every frame, so only draw where there's something to
    // act on — otherwise LinkedIn's tracking iframes each sprout their own button.
    const inTop = window.top === window;
    const modes = [];
    if (isProfile() && inTop) modes.push('capture');
    // Require a REAL conversation in THIS frame — never just the /messaging/ URL. LinkedIn renders
    // the thread in a subframe, so the top frame matches the URL while containing only the shell
    // (nav, footer, job ads). Offering the button there is what scraped "LinkedIn Corporation ©"
    // as a message.
    if (hasConversation()) modes.push('log');
    const key = modes.join(',');
    const existing = document.getElementById('byojb-fab');
    if (!key) { if (existing) existing.remove(); return; }
    if (existing && existing.dataset.mode === key) return;
    if (existing) existing.remove();
    ensureStyle();
    const d = document.createElement('div');
    d.id = 'byojb-fab'; d.dataset.mode = key;
    d.innerHTML = modes.map(m => `<button data-mode="${m}">${m === 'capture' ? '＋ BYOJB contact' : '✎ Log message'}</button>`).join(' ');
    d.querySelectorAll('button').forEach(b => {
      b.onclick = () => (b.dataset.mode === 'capture' ? openCapturePanel() : openLogPanel());
    });
    document.body.appendChild(d);
  }

  // ── diagnostics ───────────────────────────────────────────────────
  // Selector rot is the expected failure mode here, so make it debuggable without a rebuild:
  // Reach it from the extension popup ("Copy diagnostics") — NOT by typing __byojbDump() into the
  // devtools console. A content script runs in an isolated world, so its `window` is not the
  // page's `window` and the console (page context by default) can't see this at all.
  const pageDump = () => {
    const d = {
      url: location.href, page: isProfile() ? 'profile' : isMessaging() ? 'messaging' : 'other',
      ldJson: fromLdJson(), meta: fromMeta(), docTitle: fromDocTitle(), profile: isProfile() ? readProfile() : null,
      thread: isMessaging() ? readThread() : null,
      messages: isMessaging() ? readMessages() : null,
      ldJsonBlocks: document.querySelectorAll('script[type="application/ld+json"]').length,
      // Frame + shadow context: a "nothing matches" result is almost always one of these two.
      frame: { isTop: window.top === window, url: location.href.slice(0, 120), iframes: document.querySelectorAll('iframe').length },
      shadowRoots: (() => { let n = 0; eachRoot(() => n++); return n - 1; })(),
      degree: isProfile() ? readDegree() : '',
      hasSelection: !!clean(String(window.getSelection() || '')),
      // Real tag/class names of the text-bearing elements actually on this page — what to write
      // the next generation of selectors against.
      domSample: (() => {
        const out = [];
        eachRoot((root) => {
          let els; try { els = root.querySelectorAll('*'); } catch { return; }
          for (const el of els) {
            if (out.length >= 15) return;
            const t = clean(el.innerText || el.textContent);
            if (t.length < 25 || t.length > 300) continue;
            if ([...el.children].some(c => clean(c.innerText || c.textContent) === t)) continue;
            out.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 90), text: t.slice(0, 60) });
          }
        });
        return out;
      })(),
      selectorHits: Object.fromEntries(Object.entries(SELECTORS).map(([k, list]) =>
        [k, list.map(s => { try { return `${s} → ${document.querySelector(s) ? 'HIT' : 'miss'}`; } catch { return `${s} → invalid`; } })])),
    };
    console.log('[BYOJB] page dump', d);
    return d;
  };
  // Also expose it in the isolated world, which is where the extension's own devtools context runs.
  window.__byojbDump = pageDump;
  console.log('[BYOJB] outreach helper attached on', location.pathname,
    '— use the popup\'s "Copy diagnostics" button to debug extraction');

  // LinkedIn is an SPA: pathname changes without a page load, so poll rather than rely on
  // document_idle firing again. Cheap, and immune to whatever router they ship next.
  // Re-evaluate every tick, not only on a path change: opening the conversation overlay changes
  // no URL, and the message list hydrates well after document_idle. renderFab() is a no-op when
  // the available modes haven't changed, so this stays cheap.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; closePanel(); }
    renderFab();
  }, 800);
  renderFab();

  // The popup asks what page we're on so it can show the outreach panel instead of autofill.
  chrome.runtime.onMessage.addListener((msg, _s, respond) => {
    // The popup asks for this so diagnostics survive the isolated-world boundary.
    if (msg && msg.type === 'DIAGNOSE') { respond({ ok: true, dump: pageDump() }); return true; }
    if (msg && msg.type === 'LINKEDIN_CONTEXT') {
      // sendMessage reaches every frame and the FIRST reply wins, so a frame with nothing to say
      // must stay quiet — otherwise the messaging shell answers before the frame holding the
      // actual conversation does, and the popup reports the nav's idea of who you're talking to.
      if (!isProfile() && !hasConversation()) return false;
      const onProfile = isProfile();
      const prof = onProfile ? readProfile() : { name: '', title: '', company: '', headline: '', source: '' };
      const thread = isMessaging() ? readThread() : { name: '', linkedin_url: '' };
      respond({
        ok: true, page: onProfile ? 'profile' : isMessaging() ? 'messaging' : 'other',
        name: onProfile ? prof.name : thread.name,
        title: prof.title, company: prof.company, source: prof.source,
        archetype: guessArchetype(prof.headline || prof.title),
        degree: onProfile ? readDegree() : '',
        linkedin_url: onProfile ? profileUrl() : thread.linkedin_url,
      });
      return true;
    }
    return false;
  });
})();
