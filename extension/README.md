# BYOJB Autofill & Outreach — Chrome extension

Deterministically fills the **standard** fields of a job application form (name, email, phone,
links, location, work authorization, …) from your `config/profile.yml`, flags everything that
needs you (salary, EEO, essays, unknown fields), and — after **you** click Submit — records the
application back to the dashboard (`data/applications.jsonl` → `data/applications.md`) and harvests
your free-text answers into `data/essay-answers.jsonl`.

It runs inside your own Chrome, so the submission is genuinely you: real profile, cookies, user-agent,
IP, and timezone — no automation framework, no `navigator.webdriver`, no headless browser. **The
extension never submits for you.**

## Install (unpacked, dev)

1. Start the dashboard: `npm run dashboard:web` (serves `http://localhost:4173`).
2. Open `chrome://extensions`, enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. (Optional) Pin the extension so the icon is visible.

## Use

1. In the dashboard, open a posting and click **apply / autofill ↗** (this opens the direct ATS
   apply URL — the extension works best on that page, not a company site that embeds the form).
2. Click the extension icon. It analyzes the form and shows:
   - **Will fill** — standard fields (from your profile) and **memorized** answers (see below).
   - **Needs you** — free-text/essays, salary (never auto-filled), EEO (left blank), file uploads
     (attach your resume manually — extensions can't set file inputs), and **unmapped** fields.
3. For an unmapped field, pick the matching profile field and click **save** — the mapping persists
   to `config/autofill-mapping.json` and is recognized next time.
4. Click **Fill known fields**. Review everything, attach your resume, write any free-text.
5. Click **Submit** yourself. The extension captures what you sent and records it in the dashboard's
   **Applications** tab.

## Answer memory (auto-fill repeated questions)

Beyond profile-mapped fields, the extension **memorizes the answers you pick** for custom questions
(dropdowns like "Which timezone?", "Willing to work core PST hours?", EEO selects) and **auto-fills
identical questions** on future forms — no field-by-field mapping needed.

- **Teach it**: answer the questions on the page, then click **Remember answers** in the popup. Or
  just **Submit** — your answers are learned automatically.
- **It fills**: next time the same question appears, it's filled and tagged `memorized`.
- Only *gap* answers are stored (custom + EEO questions); identity fields stay sourced from your
  profile, and essays/salary/files are never memorized. The store is `config/answer-memory.json`.
- Yes/No questions are matched to the actual dropdown **option text** ("No"), never the literal
  `false`.

## Outreach capture (LinkedIn)

A second, independent content script runs on `linkedin.com` — it never touches ATS pages, and the
autofill script never runs on LinkedIn. It does two things, and only when you click:

**Capture a contact.** On someone's `/in/…` profile, a **＋ BYOJB contact** button appears at the
bottom-right. It reads their name, title, and company off the page, guesses an *archetype*
(hiring manager / recruiter / peer engineer / exec / …), reads their **connection degree** off the
page to preselect `connected_1` / `connected_2`, and asks you to confirm before saving to
`data/contacts.jsonl`. You can also set **relevance** (0–5, blank = unrated) and **LinkedIn
activity** (active / occasional / dormant) inline — a dormant contact will never see your message.

Override the **relationship** when you actually know the person: degree is network *distance*, not
a vouch — you can be 1st-degree with a total stranger. `former_colleague` / `warm_intro` are the
ties that produce a strong referral, and the dashboard flags that distinction on every thread.

If BYOJB already knows this person, the panel loads their stored record and switches its title to
**Update contact** — your saved relationship, relevance, activity and notes come back so you can
edit rather than start over. Values you set always beat what the page says: a stored
`former_colleague` is not overwritten by the connection-degree badge. Clearing the relevance box on
a known contact un-rates them deliberately; if the dashboard can't be reached, a blank box is left
alone rather than wiping the score you set earlier.

The dropdown options are fetched live from the dashboard (`/api/vocab`), so the extension can't
drift out of sync with what the registry accepts. If the dashboard is offline it falls back to a
built-in copy, and capture still works.

**Log a message.** On `/messaging/…`, a **✎ Log message** button records a message into that
person's outreach thread (creating one if there isn't an open one). It offers you a picker of
everything it can see: whatever is sitting in the compose box, plus the recent messages already in
the thread, newest first. Picking one fills the text and sets the direction — LinkedIn marks the
other party's bubbles, so their replies come through as inbound and yours as outbound. The thread
status advances accordingly (`Sent` → `Followed Up`, or straight to `Responded`).

The compose box only holds a message you *haven't sent yet*, so reading the thread bubbles is what
makes an already-sent message loggable — that's the usual case.

The extension **never sends a message, never clicks connect/follow, and never iterates a list of
people.** You always click Send yourself. That's not a limitation — mass-identical outreach is
precisely what gets filtered out, so the value here is the record, not the sending.

### If it can't find the messages

Highlight the message text on the page, then click **✎ Log message** — "Selected text on the page"
is offered as the first choice. That path uses no selectors at all, so it works no matter how
LinkedIn rebuilds their markup. Use it as the fallback whenever automatic detection comes up empty.

### When LinkedIn changes their DOM

Profile data is read in tiers — `ld+json` → `og:title` → CSS selectors → tab title — and the panel
shows which one it used (`read via ld+json`). Messages are found by class substring, then by pure
structure (`[role=listitem]` / `li` / `p` carrying sentence-length text) when no LinkedIn class
matches at all. All queries pierce **shadow roots**, and the script runs in **every frame**, since
LinkedIn renders the conversation in a subframe while the top frame holds only nav, footer and job
ads — a plain top-frame `document.querySelector` reports "miss" on a conversation that is right
there on screen. The log button only appears in a frame that actually contains a conversation
(a compose box or message bubbles), so the shell frame can never contribute stray text. If something breaks, the field comes through blank and you type it in;
it never guesses and saves something wrong.

To debug: click the extension icon on the LinkedIn page and hit **Copy diagnostics** — it copies
what each tier returned plus a HIT/miss for every selector.

> Don't type `__byojbDump()` into the devtools console. Content scripts run in an **isolated
> world**, so their `window` is not the page's `window`, and the console (page context by default)
> reports `__byojbDump is not defined` even when the extension is working fine. The popup button
> goes through the extension messaging channel, which crosses that boundary.

`npm run test:linkedin` replays the whole content script against fixtures for each tier, so a
failure tells you exactly which one died.

## Configuration

- Dashboard URL: change it in the popup footer if you don't run on `localhost:4173`.
- Standard answers: edit the `application_profile:` block in `config/profile.yml`.
- Salary fields are never auto-filled; EEO/demographic fields are always left blank; free-text answers
  are captured (not generated) to build a corpus for a future drafting feature.

## Supported ATS

Greenhouse, Lever, Ashby, Recruitee, Breezy, BambooHR, Workable, Rippling, SmartRecruiters, Workday
(see `manifest.json` host patterns). Other forms won't trigger the content script.

Plus `www.linkedin.com` for outreach capture (separate content script, no autofill).
