# Issue #451: Require all relevant tests to pass with USE_REAL_APIS (OpenAI provider) for this release

**GitHub:** [#451 Require all relevant tests to pass with USE_REAL_APIS (OpenAI provider) for this release](https://github.com/Signal-Meaning/dg_react_agent/issues/451)  
**Epic:** [#455 – Real-API tests, function-call contract, and 3pp scope](../ISSUE-455/README.md)

---

## Summary

All such tests (e.g. `onFunctionCallRequest-sendResponse.test.tsx`, `function-calling-settings.test.tsx`, and OpenAI proxy integration tests) must pass not only with mocks but also with real APIs. For this release, they must pass with the **OpenAI provider** when real API mode is enabled (e.g. `USE_REAL_OPENAI=1` and appropriate keys). Mocking alone is insufficient.

---

## Completion criteria (track to conclusion)

- [ ] **Scope defined** – List which test files/suites must pass with `USE_REAL_APIS` (OpenAI).
- [ ] **Tests passing** – Those tests pass when run with `USE_REAL_OPENAI=1` (and required env/keys).
- [ ] **Documented** – How to run the real-API suite (env vars, keys, optional CI or release-checklist step).
- [ ] **Release checklist** – If the release (#456) requires a real-API run, that step is added and verified.
- [ ] **Issue closed** – #451 closed with resolution; link to this doc or to epic TRACKING.md.

---

## Status

| Criterion | Status |
|----------|--------|
| Scope defined | ⬜ |
| Tests passing with real OpenAI | ⬜ |
| Run instructions documented | ⬜ |
| Release checklist updated (if needed) | ⬜ |
| GitHub issue closed | ⬜ |

---

## Docs

- **[../ISSUE-455/TRACKING.md](../ISSUE-455/TRACKING.md)** – Epic tracking checklist for this issue.
