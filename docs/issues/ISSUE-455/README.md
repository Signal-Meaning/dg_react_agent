# Issue #455: Epic – Real-API tests, function-call contract, and 3pp scope (voice-commerce feedback)

**Branch:** `davidrmcgee/issue455`  
**GitHub:** [#455 Epic: Real-API tests, function-call contract, and 3pp scope](https://github.com/Signal-Meaning/dg_react_agent/issues/455)  
**Target release:** [Release v0.9.0 (#456)](https://github.com/Signal-Meaning/dg_react_agent/issues/456)

---

## Summary

This epic tracks work stemming from voice-commerce team feedback: ensuring tests pass with real APIs, documenting our function-call backend contract, and clarifying scope for third-party backends. All child issues must meet their Acceptance Criteria and be tracked to completion before the epic is closed.

**Focus:** **#451** is the primary focus (tests must pass with real APIs; TDD throughout). Issues **#452–#454** are documentation-only and may be done in **any order**.

---

## Updating tracking (required)

**You must update both of the following whenever work on a child issue progresses or completes:**

1. **This epic’s [TRACKING.md](./TRACKING.md)** – Check off the relevant steps and Acceptance Criteria for that issue.
2. **The child issue’s README** (e.g. [ISSUE-451/README.md](../ISSUE-451/README.md)) – Update status tables and checkboxes to reflect progress and completion.

After each phase of work within an issue (especially #451), update both so that progress is visible and the epic can be closed when all Acceptance Criteria are met.

---

## Child issues and tracking

| # | Title | Doc | Acceptance met |
|---|--------|-----|-----------------|
| **#451** (focus) | [Require all relevant tests to pass with USE_REAL_APIS (OpenAI provider)](https://github.com/Signal-Meaning/dg_react_agent/issues/451) | [ISSUE-451/README.md](../ISSUE-451/README.md) | ✅ (close on merge) |
| #452 | [Document: Function-call backend contract is intentional; callers may customize](https://github.com/Signal-Meaning/dg_react_agent/issues/452) | [ISSUE-452/README.md](../ISSUE-452/README.md) | ✅ (close on merge) |
| #453 | [Real-API testing scope; 3pp backends out of scope](https://github.com/Signal-Meaning/dg_react_agent/issues/453) | [ISSUE-453/README.md](../ISSUE-453/README.md) | ✅ (close on merge) |
| #454 | [Document: Third parties maintain their own backend contracts](https://github.com/Signal-Meaning/dg_react_agent/issues/454) | [ISSUE-454/README.md](../ISSUE-454/README.md) | ✅ (close on merge) |

**Tracking detail:** [TRACKING.md](./TRACKING.md) – Acceptance Criteria and stepwise progress for each child. Update it and the child README as work completes.

---

## Epic Acceptance Criteria

- [x] **#451** – All Acceptance Criteria in ISSUE-451/README met; tests pass with real OpenAI; both TRACKING.md and ISSUE-451/README updated. Close #451 on GitHub when merging PR.
- [x] **#452** – All Acceptance Criteria in ISSUE-452/README met; both TRACKING.md and ISSUE-452/README updated. Close #452 on GitHub when merging PR.
- [x] **#453** – All Acceptance Criteria in ISSUE-453/README met; both TRACKING.md and ISSUE-453/README updated. Close #453 on GitHub when merging PR.
- [x] **#454** – All Acceptance Criteria in ISSUE-454/README met; both TRACKING.md and ISSUE-454/README updated. Close #454 on GitHub when merging PR.
- [ ] All four GitHub issues closed with resolution linked to this epic (do when merging PR).
- [x] Release v0.9.0 (#456) checklist updated as needed (e.g. real-API test run).

---

## Docs in this folder

- **[README.md](./README.md)** – This file; epic summary, child index, and **requirement to update both TRACKING and child READMEs**.
- **[TRACKING.md](./TRACKING.md)** – Per-issue Acceptance Criteria and progress; update this and the child issue’s README when work completes (or after each phase within an issue).
