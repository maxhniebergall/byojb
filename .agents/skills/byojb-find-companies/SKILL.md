---
name: byojb-find-companies
description: Hunt for target companies matching criteria → portals.yml
arguments: args
user-invocable: true
license: MIT
---

# BYOJB -- Find Companies

This command searches for new companies that match your profile preferences, target industries, and location criteria, and appends them to your `portals.yml`.

## Execution
Follow the instructions in `modes/find-companies.md`. Typically, this involves:
1. Identifying target company criteria in `config/company_criteria.yml`.
2. Running the company finder script or searching:
   `node find-companies.mjs`
