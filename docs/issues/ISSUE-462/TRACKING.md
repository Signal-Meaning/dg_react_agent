# Issue #462 – Tracking: conversation_already_has_active_response still on 0.9.1/0.2.1

Use this checklist to drive the fix to completion. **Update this file and [README.md](./README.md)** as each step is completed.

**GitHub:** [#462](https://github.com/Signal-Meaning/dg_react_agent/issues/462)  
**Parent:** [#459](https://github.com/Signal-Meaning/dg_react_agent/issues/459)

**Code change for capture:** Integration test `openai-proxy-integration.test.ts` now passes `logLevel: process.env.LOG_LEVEL` into `createOpenAIProxyServer` so that `LOG_LEVEL=debug npm test -- …` emits proxy OTel logs to stdout (saved to capture-*.log).

---

## Phase 1 – Get proxy log and analyse

| Step | Status |
|------|--------|
| Get proxy log excerpt for one failing run (voice-commerce follow-up or our own capture) | ✅ Local capture: integration tests with LOG_LEVEL=debug (mock upstream). See capture-issue459-test.log, capture-function-call-test.log. |
| If our own capture: run with `LOG_LEVEL=debug`; see [VOICE-COMMERCE-RESPONSE-2026-02-16.md](../ISSUE-459/VOICE-COMMERCE-RESPONSE-2026-02-16.md) for their capture steps | ✅ Ran `LOG_LEVEL=debug npm test -- tests/integration/openai-proxy-integration.test.ts -t "…"`; proxy gets logLevel via process.env.LOG_LEVEL in test. |
| Analyse: session.update count (expect 1 per connection) | ✅ From test assertions and log: one session.update per connection in captured flows. |
| Analyse: response.create count for the turn (expect 1 for function-call result) | ✅ One response.create for function-call turn in captured flow. |
| Analyse: message order; look for second session.update, second response.create, or responseInProgress cleared too early | ✅ See [ANALYSIS.md](./ANALYSIS.md). Hypothesis: responseInProgress cleared on either output_audio.done or output_text.done may clear too early if real API sends audio.done before text.done. |
| Document findings in this folder (e.g. ANALYSIS.md or in TRACKING) | ✅ [ANALYSIS.md](./ANALYSIS.md) |
| **Update README:** Mark Phase 1 complete when analysis is done | ✅ |

---

## Phase 2 – Fix and test

| Step | Status |
|------|--------|
| Implement fix (proxy or component as needed) | ✅ TDD: added failing test (Issue #462: no session.update after output_audio.done until output_text.done); implemented proxy change: do not clear responseInProgress on response.output_audio.done, only on response.output_text.done (server.ts). |
| Add/update tests per TDD; lint and test:mock and openai-proxy-integration pass | ✅ New integration test; full openai-proxy-integration suite (40 tests) passes. |
| E2E as per release checklist | ⬜ Run when doing patch release (per release checklist). |
| **Update README:** Mark Phase 2 complete | ✅ |

---

## Phase 3 – Release and follow-up

| Step | Status |
|------|--------|
| Patch release (e.g. 0.9.2 / 0.2.2) and publish | ⬜ |
| Follow up with voice-commerce with release and resolution | ⬜ (only after release) |
| Close #462 on GitHub with comment linking to `docs/issues/ISSUE-462/` | ⬜ |
| Update #459 with resolution pointer | ⬜ |
| **Update README:** All acceptance criteria checked | ⬜ (after close) |
