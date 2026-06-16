# Career-Ops Autofill — Chrome extension

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

## Configuration

- Dashboard URL: change it in the popup footer if you don't run on `localhost:4173`.
- Standard answers: edit the `application_profile:` block in `config/profile.yml`.
- Salary fields are never auto-filled; EEO/demographic fields are always left blank; free-text answers
  are captured (not generated) to build a corpus for a future drafting feature.

## Supported ATS

Greenhouse, Lever, Ashby, Recruitee, Breezy, BambooHR, Workable, Rippling, SmartRecruiters, Workday
(see `manifest.json` host patterns). Other forms won't trigger the content script.
