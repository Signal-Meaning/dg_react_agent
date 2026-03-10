# Issues 512–515, 517: OpenAI Proxy Unmapped Events, Retries, Release Gates (voice-commerce #908)

**Branch:** `issue-512-515-openai-proxy-unmapped-events`  
**PR:** [#516](https://github.com/Signal-Meaning/dg_react_agent/pull/516)  
**Source:** Voice-commerce bug report (voice-commerce Issue #908), 2026-03-10

---

## Overview

| Issue | Title | Doc |
|-------|--------|-----|
| **#512** | Treat unmapped upstream events as warnings (not fatal) | [TDD-PLAN-512-UNMAPPED-EVENTS-WARNINGS.md](./TDD-PLAN-512-UNMAPPED-EVENTS-WARNINGS.md) |
| **#513** | Release gate / test coverage for upstream event types | [TDD-PLAN-513-RELEASE-GATE-UPSTREAM-EVENTS.md](./TDD-PLAN-513-RELEASE-GATE-UPSTREAM-EVENTS.md) |
| **#514** | No retries when function call succeeds | [TDD-PLAN-514-NO-RETRIES-ON-SUCCESS.md](./TDD-PLAN-514-NO-RETRIES-ON-SUCCESS.md) |
| **#515** | Release: patch for 512–514 (and related) | [GitHub #515](https://github.com/Signal-Meaning/dg_react_agent/issues/515) · [RELEASE-CHECKLIST-515.md](./RELEASE-CHECKLIST-515.md) (run when work concludes) |
| **#517** | Root cause of unmapped events (proxy/translator pipeline) | [TDD-PLAN-517-ROOT-CAUSE-UNMAPPED-EVENTS.md](./TDD-PLAN-517-ROOT-CAUSE-UNMAPPED-EVENTS.md) |

---

## Master progress (TDD across 512–515)

**Keep this file current:** As you complete each RED / GREEN / REFACTOR / Verified step, check the box in this README and in the corresponding TDD plan. Update both so progress is plain and the backlog stays accurate.

### #512 — Unmapped upstream events → warnings

- [x] **RED:** Failing test(s) added: unmapped event does **not** cause client to receive `Error` with `unmapped_upstream_event`; proxy logs warning only.
- [x] **GREEN:** Proxy logs warning and continues; no `Error` sent to client for unmapped events.
- [x] **REFACTOR:** Comments/docs updated; integration test expectation updated (no longer expect Error for unmapped).
- [x] **Verified:** Real-API or fixture run: no retry/re-Settings triggered by unmapped events. Mock test "Issue #512: unmapped upstream event … does NOT yield Error" passes; with USE_REAL_APIS=1, SettingsApplied/session.updated flow runs without Error from unmapped events.

**TDD plan:** [TDD-PLAN-512-UNMAPPED-EVENTS-WARNINGS.md](./TDD-PLAN-512-UNMAPPED-EVENTS-WARNINGS.md)

---

### #513 — Release gate / test coverage for upstream event types

- [x] **RED:** Test or checklist added: known non-fatal event types do not emit **error** to client.
- [x] **GREEN:** Regression test passes (or release checklist item and docs in place).
- [x] **REFACTOR:** Document supported / ignored-with-warning / unknown event types.
- [x] **Verified:** New unmapped event types would be caught by test or process.

**TDD plan:** [TDD-PLAN-513-RELEASE-GATE-UPSTREAM-EVENTS.md](./TDD-PLAN-513-RELEASE-GATE-UPSTREAM-EVENTS.md)

---

### #514 — No retries on successful function calls

- [x] **RED:** Test(s) added: after successful function call (host sends result), no duplicate function call or re-Settings triggered.
- [x] **GREEN:** Retry/re-Settings logic does not fire on success path (and #512 fix removes unmapped-event-driven retries).
- [ ] **REFACTOR:** Clarify retry conditions in code/docs.
- [ ] **Verified:** E2E or integration: single user message → single function call → single result; no duplicate calls.

**TDD plan:** [TDD-PLAN-514-NO-RETRIES-ON-SUCCESS.md](./TDD-PLAN-514-NO-RETRIES-ON-SUCCESS.md)

---

### #515 — Patch release

- [ ] All acceptance criteria for #512, #513, #514 (and #517 if in scope) met and merged.
- [ ] Release checklist (issue #515 body) executed: version bump, docs, E2E, real-API qualification where required.
- [ ] Patch published; changelog includes fixes for 512, 513, 514, 517.

---

### #517 — Root cause of unmapped events (proxy/translator)

- [x] **Observe:** Identify which upstream `msg.type` values hit the unmapped branch (logs or tests).
- [x] **Fix:** For each: add mapping or explicit ignore branch in server.ts (or fix parsing/routing).
- [x] **REFACTOR:** Update UPSTREAM-EVENT-COMPLETE-MAP.md; document parsing/routing assumptions.
- [ ] **Verified:** Previously unmapped types no longer (or less often) hit unmapped branch; no regression.

**TDD plan:** [TDD-PLAN-517-ROOT-CAUSE-UNMAPPED-EVENTS.md](./TDD-PLAN-517-ROOT-CAUSE-UNMAPPED-EVENTS.md)

---

## References

- **Upstream event coverage plan:** [UPSTREAM-EVENT-COVERAGE-PLAN.md](./UPSTREAM-EVENT-COVERAGE-PLAN.md) — how we identified missing branches and how to guarantee completeness (unmapped = unknown future only).
- **Proxy unmapped handling:** `packages/voice-agent-backend/scripts/openai-proxy/server.ts` (unmapped `else` branch; logs full payload truncated to 4096 chars).
- **Component error handling:** `src/components/DeepgramVoiceInteraction/index.tsx` (“Error received after sending Settings with functions”); test-app `App.tsx` `handleError` (unmapped_upstream_event).
- **Upstream event map:** `packages/voice-agent-backend/scripts/openai-proxy/UPSTREAM-EVENT-COMPLETE-MAP.md`.
- **Integration test (unmapped):** `tests/integration/openai-proxy-integration.test.ts` — “Protocol: unmapped upstream event … yields Error (unmapped_upstream_event)”.
- **.cursorrules:** Backend/Proxy Defects, Release Qualification (real API).
