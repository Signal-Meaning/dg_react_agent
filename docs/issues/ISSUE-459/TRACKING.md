# Issue #459 – Tracking: Resolve session.update race → conversation_already_has_active_response

Use this checklist to drive the fix to completion. **Update this file and [README.md](./README.md)** as each step is completed. This project uses **TDD**: write or adjust tests first (red), then implement until they pass (green), then refactor.

**GitHub:** [#459](https://github.com/Signal-Meaning/dg_react_agent/issues/459)

---

## Phase 1 – Investigate

| Step | Status |
|------|--------|
| Locate where session/config updates are sent in the **component** (e.g. Settings → OpenAI `session.update` or equivalent) | ⬜ |
| Locate where session/config updates are sent in **voice-agent-backend** (OpenAI proxy path) | ⬜ |
| Identify triggers: e.g. on connect, on Settings change, after function-call response, on dependency/state change | ⬜ |
| Document findings in this folder (e.g. INVESTIGATION.md or in TRACKING) | ⬜ |
| **Update README:** Mark Phase 1 complete when root cause is identified | ⬜ |

---

## Phase 2 – Tests (TDD red)

| Step | Status |
|------|--------|
| Add or identify tests that fail when session update is sent during active response (or that assert “no session update while active”) | ⬜ |
| Run tests; confirm they fail (red) or that current behavior is captured | ⬜ |
| **Update README:** Mark Phase 2 (tests) in progress/complete | ⬜ |

---

## Phase 3 – Implement gating (TDD green)

| Step | Status |
|------|--------|
| Implement “no session update while active response” in component and/or backend (where root cause lies) | ⬜ |
| Send session/config updates only: on connect/session setup, or after response/turn finished (e.g. `response.done`) | ⬜ |
| Ensure `sendFunctionCallResponse` does not trigger an immediate session update before turn is complete | ⬜ |
| Run tests; confirm they pass (green) | ⬜ |
| **Update README:** Mark Phase 3 complete | ⬜ |

---

## Phase 4 – Validate and document

| Step | Status |
|------|--------|
| Run full test suite (lint, test:mock, E2E in proxy mode) – no regressions | ⬜ |
| If real-API tests exist for OpenAI proxy/function-call flow, run and confirm no `conversation_already_has_active_response` | ⬜ |
| Document any new behavior or constraints (e.g. in API-REFERENCE, BACKEND-PROXY, or this folder) | ⬜ |
| **Update README:** All acceptance criteria checked; status table updated | ⬜ |

---

## Phase 5 – Close

| Step | Status |
|------|--------|
| Close #459 on GitHub with comment linking to `docs/issues/ISSUE-459/` (README + TRACKING) | ⬜ |
