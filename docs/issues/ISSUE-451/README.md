# Issue #451: Require all relevant tests to pass with USE_REAL_APIS (OpenAI provider) for this release

**GitHub:** [#451 Require all relevant tests to pass with USE_REAL_APIS (OpenAI provider) for this release](https://github.com/Signal-Meaning/dg_react_agent/issues/451)  
**Epic:** [#455 – Real-API tests, function-call contract, and 3pp scope](../ISSUE-455/README.md)

---

## Summary

All such tests (e.g. `onFunctionCallRequest-sendResponse.test.tsx`, `function-calling-settings.test.tsx`, and OpenAI proxy integration tests) must pass not only with mocks but also with real APIs. For this release, they must pass with the **OpenAI provider** when real API mode is enabled (e.g. `USE_REAL_OPENAI=1` and appropriate keys). Mocking alone is insufficient.

**TDD:** This project uses test-driven development. **Tests drive every step** of this issue: write or adjust tests first (red), then implement until they pass (green), then refactor. After **each phase** of work is successfully completed, **update the docs**: this README and the epic [TRACKING.md](../ISSUE-455/TRACKING.md).

---

## Acceptance Criteria

- [ ] **Scope defined** – A defined list of test files/suites that must pass with `USE_REAL_APIS` (OpenAI) is documented (e.g. in this README or TEST-STRATEGY).
- [ ] **Tests failing under real API (TDD red)** – Running the in-scope tests with `USE_REAL_OPENAI=1` (and required env/keys) either already fails in a known way or new/updated tests are added that fail under real API until implementation is in place.
- [ ] **Tests passing with real API (TDD green)** – The in-scope tests pass when run with `USE_REAL_OPENAI=1` and required environment (e.g. `OPENAI_API_KEY`); no regressions in mock-only runs.
- [ ] **Run process documented** – How to run the real-API suite is documented (env vars, keys, commands, optional CI or release-checklist step).
- [ ] **Release checklist updated** – If release #456 requires a real-API run, that step is added to the release checklist and verified.
- [ ] **Docs updated after each phase** – After each phase of work (scope, green, document, release), this README and [TRACKING.md](../ISSUE-455/TRACKING.md) are updated so progress is visible.
- [ ] **Issue closed** – #451 is closed with resolution; closure comment links to this doc and/or epic TRACKING.

---

## Scope (Phase 1 output)

**In scope for this release:** The tests that run when `USE_REAL_OPENAI=1` and `OPENAI_API_KEY` are set. Defined in **[SCOPE.md](./SCOPE.md)**:

- **File:** `tests/integration/openai-proxy-integration.test.ts`
- **Tests that run with real API:** 8 tests (5 always-on + 3 real-API-only). All 8 must pass for Acceptance Criteria.
- **Run (real API):** `USE_REAL_OPENAI=1 npm test -- tests/integration/openai-proxy-integration.test.ts` (requires `OPENAI_API_KEY`).

Unit tests that use only mocked WebSocket (`onFunctionCallRequest-sendResponse.test.tsx`, `function-calling-settings.test.tsx`) are **out of scope** for “run with real API” this release; they remain mock-based.

---

## Phases (TDD; update docs after each phase)

| Phase | What (tests drive the step) | Docs to update when phase complete |
|-------|-----------------------------|------------------------------------|
| **1 – Scope** | Define which tests must pass with USE_REAL_APIS; run them with real API and capture any failures (red). Document scope here and in TEST-STRATEGY if needed. | This README + [TRACKING.md](../ISSUE-455/TRACKING.md) |
| **2 – Green** | Implement or adjust code/tests so in-scope tests pass with `USE_REAL_OPENAI=1`. Refactor as needed. | This README + [TRACKING.md](../ISSUE-455/TRACKING.md) |
| **3 – Document** | Document how to run the real-API suite (env, keys, commands). | This README + [TRACKING.md](../ISSUE-455/TRACKING.md) |
| **4 – Release** | If release #456 needs a real-API run step, add it to the release checklist and verify. | This README + [TRACKING.md](../ISSUE-455/TRACKING.md) |

**Rule:** After each phase is successfully completed, update both this README (status below) and the epic [TRACKING.md](../ISSUE-455/TRACKING.md) so the epic and issue stay in sync.

---

## Status (update after each phase)

| Acceptance Criterion | Status |
|----------------------|--------|
| Scope defined | ✅ Phase 1 |
| Tests failing under real API (red) / baseline captured | ⬜ (run with OPENAI_API_KEY to capture) |
| Tests passing with real OpenAI (green) | ⬜ |
| Run process documented | ✅ Phase 1 (SCOPE.md + this README) |
| Release checklist updated (if needed) | ⬜ |
| Docs updated after each phase | ✅ Phase 1 |
| GitHub issue closed | ⬜ |

---

## Docs

- **[SCOPE.md](./SCOPE.md)** – Phase 1: in-scope test file and list of 8 tests that run with `USE_REAL_OPENAI=1`.
- **[../ISSUE-455/TRACKING.md](../ISSUE-455/TRACKING.md)** – Epic tracking; update it and this README after each phase.
- **[../ISSUE-455/README.md](../ISSUE-455/README.md)** – Epic summary and requirement to update both TRACKING and child README.
