# Issue #455: Epic – Real-API tests, function-call contract, and 3pp scope (voice-commerce feedback)

**Branch:** `davidrmcgee/issue455`  
**GitHub:** [#455 Epic: Real-API tests, function-call contract, and 3pp scope](https://github.com/Signal-Meaning/dg_react_agent/issues/455)  
**Target release:** [Release v0.9.0 (#456)](https://github.com/Signal-Meaning/dg_react_agent/issues/456)

---

## Summary

This epic tracks work stemming from voice-commerce team feedback: ensuring tests pass with real APIs, documenting our function-call backend contract, and clarifying scope for third-party backends. All child issues must be completed and tracked to conclusion before the epic is closed.

---

## Child issues and tracking

| # | Title | Doc | Conclusion status |
|---|--------|-----|-------------------|
| #451 | [Require all relevant tests to pass with USE_REAL_APIS (OpenAI provider)](https://github.com/Signal-Meaning/dg_react_agent/issues/451) | [ISSUE-451/README.md](../ISSUE-451/README.md) | ⬜ Open |
| #452 | [Document: Function-call backend contract is intentional; callers may customize](https://github.com/Signal-Meaning/dg_react_agent/issues/452) | [ISSUE-452/README.md](../ISSUE-452/README.md) | ⬜ Open |
| #453 | [Real-API testing scope; 3pp backends out of scope](https://github.com/Signal-Meaning/dg_react_agent/issues/453) | [ISSUE-453/README.md](../ISSUE-453/README.md) | ⬜ Open |
| #454 | [Document: Third parties maintain their own backend contracts](https://github.com/Signal-Meaning/dg_react_agent/issues/454) | [ISSUE-454/README.md](../ISSUE-454/README.md) | ⬜ Open |

**Tracking detail:** [TRACKING.md](./TRACKING.md) – checklist and progress for each child to proper conclusion.

---

## Epic completion criteria

- [ ] **#451** – All relevant tests pass with `USE_REAL_APIS` (OpenAI provider); conclusion documented in ISSUE-451.
- [ ] **#452** – Docs state function-call contract is intentional and callers may customize; conclusion documented in ISSUE-452.
- [ ] **#453** – Real-API scope and 3pp-out-of-scope documented; conclusion documented in ISSUE-453.
- [ ] **#454** – Docs state 3pp maintain their own backend contracts; conclusion documented in ISSUE-454.
- [ ] All four GitHub issues closed with resolution linked to this epic.
- [ ] Release v0.9.0 (#456) checklist updated as needed (e.g. real-API test run).

---

## Docs in this folder

- **[README.md](./README.md)** – This file; epic summary and child index.
- **[TRACKING.md](./TRACKING.md)** – Per-issue checklist and progress to conclusion.
