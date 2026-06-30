---
name: byojb
description: Build Your Own Job Board (BYOJB) command center
arguments: command
user-invocable: true
argument-hint: "[scan | find-companies | triage-companies | research-companies | triage-jobs | research-jobs]"
license: MIT
---

# BYOJB -- Help & Command List

This is the central command list for **Build Your Own Job Board (BYOJB)**.

Please run the dedicated command for the pipeline step you want to execute:
- `/byojb-scan`               → Scan target portals for new postings (zero LLM tokens)
- `/byojb-find-companies`     → Hunt for target companies matching criteria → portals.yml
- `/byojb-triage-companies`   → Stage 2: LLM company fit ranking (no web fetch)
- `/byojb-research-companies` → Stage 3: LLM company careers page scraping
- `/byojb-triage-jobs`        → Stage 2: LLM postings ranking (no web fetch)
- `/byojb-research-jobs`      → Stage 3: LLM JD facet extraction
