---
name: triage-jobs
description: Sandbox-optimized combined Stage 2 Triage and Stage 3 Research pipeline for job postings, driven by core-strategy.yml.
---

# Skill: triage-jobs (Combined Triage & Research)

Use this skill when you need to process undecided job postings in the queue (`data/postings-personal.jsonl` and `data/posting-research.jsonl`) under your own coding context without automated scripts.

The **ultimate goal of this skill is to completely deplete the queue of undecided postings** (driving the `remaining` count in the stats to `0`). It implements a **unified, sandbox-optimized pipeline** that combines Stage 2 (triage ranking) and Stage 3 (facet extraction/research) in a single pass for highly rated roles, repeating the 100-item loop consecutively until no undecided postings remain.

---

## Strategic Setup

Before starting, always load and read the following configuration files:
1.  **[core-strategy.yml](../../../config/core-strategy.yml):** Defines the active profile/rubric links, triage-to-research gate score, and specific questions to answer during research.
2.  **[profile.yml](../../../config/profile.yml):** Outlines the candidate's target roles, anti-targets, compensation floors, and location requirements.
3.  **[rubric.yml](../../../config/rubric.yml):** Single source of truth for weighting dimensions (e.g., North Star alignment, CV match, remote & timezone fit).

---

## Strict Pipeline Constraints

To maintain consistency and prevent redundant user execution prompts, you **MUST** adhere to the following file path and parameter contracts without deviation:
*   **Batch Size:** You **MUST** run the emit command with exactly `100` postings (`--emit 100`). Do not reduce it to 50 or expand it to 150+ unless explicitly directed by the user.
*   **Fixed File Paths:** You **MUST** use these exact relative paths in the workspace for all temporary and payload files. Do not use absolute paths, `/tmp`, or root directories:
    *   Emitted Batch File: `scratch/emitted-jobs.json`
    *   Triage Scores File: `scratch/job-scores.json`
    *   Research Facets File: `scratch/job-research.json`
    *   Fit Brief Directory: `data/posting-fit/`
*   **No Agent-Written Automation Scripts:** You **MUST NOT** write, generate, or execute any new scripts (Python, JS, shell, etc.) in `scratch/` or other directories to automate, filter, parse, or rank the job postings. All evaluations, triage scoring, and research facet extractions must be executed inside your own reasoning context. Ad-hoc script automation is a violation of pipeline integrity.
*   **No Diagnostic Inline Commands:** You **MUST NOT** run inline diagnostic shell commands (such as `node -e "..."` or python command-line scripts) to query, count, or filter the JSONL postings databases (`data/postings-personal.jsonl` or `data/posting-research.jsonl`). If you need to analyze database counts or gaps, parse and analyze the files silently in your context using the pre-authorized `view_file` tool, or rely on the pre-approved standard stats command (`node llm-triage-jobs.mjs --stats`).
*   **No Standalone Research Emits:** You **MUST NOT** run standalone research emit commands (such as `node llm-triage-jobs.mjs --emit-research <number>`). The research queue is processed in-memory directly from the high-fit candidates of the `--emit 100` batch. Standalone research emits are deprecated in this unified skill and violate the approval-optimized flow.

---

## Unified Triage & Research Loop

To minimize user command-approval delays, execute this combined flow on batches of 100 postings at a time, performing all evaluations and file writes before initiating any database update commands. Repeat this loop iteratively until the queue is completely depleted.

### Step 1: Emit the Batch
Run the command to capture undecided postings:
```bash
node llm-triage-jobs.mjs --emit 100 > scratch/emitted-jobs.json
```
*   **Inspection Warning (Zero-Approval):** Never run terminal commands (such as `cat`, `head`, or inline `node -e` scripts) just to inspect the JSON schema of `scratch/emitted-jobs.json`. Instead, use the `view_file` tool to read the first few lines of the file. File reading is pre-authorized and silent, avoiding unnecessary user command-approval prompts.

### Step 2: Stage 2 Triage (Prerank)
Read the emitted postings in `scratch/emitted-jobs.json` and rank each posting 1-5 based on title, location, and excerpt.
*   **Exclusion Gate:** Exclude (`llm_rank: 1`) any roles that trigger the `hard_filters` defined in `rubric.yml` (e.g., mismatched geographic eligibility, mandatory onsite/hybrid policies, or roles violating target constraints in `profile.yml`).
*   **Company Policy Cache:** Maintain a memory lookup cache of verified company hiring policies (e.g., remote eligibility, hub restrictions, timezone expectations) to avoid redundant web searches. Use `search_web` to verify ambiguous policies and add new findings to your cache.
*   **Triage Gate:** Compare the assigned `llm_rank` against the `min_rank_for_research` threshold defined in `core-strategy.yml`. If a posting meets or exceeds this threshold, immediately flag it for **Stage 3 Research**.

### Step 3: Stage 3 Research (For High-Fit Postings)
For each posting that cleared the triage gate, execute these steps:
1.  **Read the Full JD & Handle Incomplete JDs:**
    *   If the posting has the field `"has_body": true`, read the local JD body file at `"body_file"`.
    *   **Fallback Protocol:** If the local JD file is extremely short, generic, or lacks requirements/stack information, do not rely on it alone. Perform a targeted web search (e.g., `"Company Name" "Role Title" tech stack` or remote hiring policies) or fetch the source URL to retrieve the full requirements.
2.  **Early Compensation Boundary Check:**
    *   Look for compensation/salary ranges early. Compare them against the candidate's absolute walk-away minimum floor defined in `profile.yml`.
    *   If the maximum salary ceiling of the role is below the candidate's walk-away minimum, immediately assign a **Skip** recommendation in the fit verdict to avoid spending unnecessary research effort.
3.  **Answer Core Strategy Questions:**
    Extract facts from the full JD to answer the questions in `core-strategy.yml`:
    *   **Tech Stack:** Languages, libraries, clouds, datastores, and infra tools.
    *   **On-call & Emergency Support:** On-call rotations, page frequency, emergency expectations.
    *   **Work Environment & Location Policy:** Remote eligibility constraints, true remote vs hybrid, timezone core hours.
    *   **Vibes & Work Culture:** Work-life balance signals, pace, stability (funding stage/profitability) vs startup pressure. Pay close attention to organizational patterns (e.g., intense collaboration styles, frequent firefighting, high-pressure environments) that clash with the candidate's preferences or work style priorities in `profile.yml`.
4.  **Map to Structured Facet Schema:**
    Map these findings into the strict facet JSON format expected by `research-jobs.md` (e.g., `yoe_min`, `remote_policy`, `geo_eligibility`, `languages`, `technologies`, `on_call`, `autonomy`, `culture`, `company_stage`).
5.  **Write Prose Fit Verdict:**
    Save a short personal verdict (Recommend, Aligns, Concerns, Verdict) to `data/posting-fit/<sk(key)>.md`. If skipped due to compensation or location, document this clearly in the verdict.

### Step 4: Write & Apply Payloads
1.  **Triage Scores:** Write the Stage 2 rankings for all triaged postings (Rank 1-3) and initial Rank 4-5 items to `scratch/job-scores.json`:
    ```json
    [
      { "key": "...", "llm_rank": 1, "llm_reason": "Hard filter exclusion" }
    ]
    ```
2.  **Research Facets:** Write the Stage 3 extracted facets and fit verdicts to `scratch/job-research.json`:
    ```json
    [
      {
        "key": "...",
        "extracted": { ...schema... },
        "fit_brief": "data/posting-fit/<sk(key)>.md",
        "llm_reason": "Target role, high fit"
      }
    ]
    ```
3.  **Apply All Changes (Consecutive Executions):**
    To streamline command approvals for the user, wait until all triage files, research files, and fit briefs are fully written. Then, run the application and scoring commands sequentially in a single turn so the user can approve them all quickly:
    ```bash
    node llm-triage-jobs.mjs --apply scratch/job-scores.json && node llm-triage-jobs.mjs --apply scratch/job-research.json && node score-postings.mjs && node llm-triage-jobs.mjs --stats
    ```
