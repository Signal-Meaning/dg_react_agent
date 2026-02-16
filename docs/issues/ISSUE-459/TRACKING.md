# Issue #459 – Tracking: Resolve session.update race → conversation_already_has_active_response

Use this checklist to drive the fix to completion. **Update this file and [README.md](./README.md)** as each step is completed.

**GitHub:** [#459](https://github.com/Signal-Meaning/dg_react_agent/issues/459)

---

## TDD workflow (mandatory order)

This project uses **test-driven development**. The cycle is:

1. **RED** – Write or adjust tests that define the desired behavior *before* implementation. Run tests and confirm they **fail** (or fail in the right way) so we have a failing specification.
2. **GREEN** – Implement the minimum change so those tests **pass**. No new behavior without a test first.
3. **REFACTOR** – Improve code (naming, structure, duplication) while keeping all tests green.

For this issue:

- **Phase 2 = RED.** Add or change tests so they assert “proxy does not send session.update while there is an active response.” Run the test suite and confirm the new/updated tests **fail** (current code sends session.update without gating). Do **not** implement gating in the proxy until Phase 2 is done and red is confirmed.
- **Phase 3 = GREEN.** Implement gating in the proxy (e.g. use `responseInProgress` for all response.create paths and skip or defer session.update when true). Run tests until the Phase 2 tests **pass**.
- **Refactor** – After green, tidy the implementation (e.g. in Phase 3 or Phase 4) without changing behavior; tests stay green.

---

## Phase 1 – Investigate

| Step | Status |
|------|--------|
| Locate where session/config updates are sent in the **component** (e.g. Settings → OpenAI `session.update` or equivalent) | ✅ Component sends Settings once per connection; no re-send on agentOptions change (Issue #399). |
| Locate where session/config updates are sent in **voice-agent-backend** (OpenAI proxy path) | ✅ `server.ts` `forwardClientMessage`: first Settings → `mapSettingsToSessionUpdate` → `upstream.send(session.update)`. Duplicate Settings already gated by `hasForwardedSessionUpdate`. |
| Identify triggers: e.g. on connect, on Settings change, after function-call response, on dependency/state change | ✅ Only trigger is client sending Settings (on connect). No gating on “active response.” |
| Document findings in this folder (e.g. INVESTIGATION.md or in TRACKING) | ✅ [INVESTIGATION.md](./INVESTIGATION.md) |
| **Update README:** Mark Phase 1 complete when root cause is identified | ✅ |

---

## Phase 2 – Tests (TDD red)

**Do this phase before any gating implementation.** Goal: a failing test that specifies “no session.update while active response.”

| Step | Status |
|------|--------|
| Add or identify tests that assert: proxy does **not** send `session.update` to upstream while a response is active (e.g. client sends Settings after response.create but before response.*.done; mock or assertion expects zero or deferred session.update) | ✅ Added `tests/integration/openai-proxy-integration.test.ts`: “Issue #459: does not send session.update while response is active”. Client sends InjectUserMessage first (no Settings), mock sends item.added → proxy sends response.create; mock delays response.output_text.done (mockDelayResponseDoneMs); client sends Settings; assert no session.update after response.create in mockReceived. |
| Run test suite; confirm the new/updated tests **fail** (red) with current code | ✅ Test fails: `expect(sessionUpdateAfterResponse).toBe(false)` — Received: true (proxy currently sends session.update after response.create). |
| **Update README:** Mark Phase 2 (tests) in progress/complete | ✅ |

---

## Phase 3 – Implement gating (TDD green)

**Start only after Phase 2 is red.** Goal: make the Phase 2 tests pass with minimal implementation, then refactor if needed.

| Step | Status |
|------|--------|
| Implement “no session update while active response” in proxy (see [INVESTIGATION.md](./INVESTIGATION.md): set/clear `responseInProgress` for all response.create paths; when handling Settings, skip or defer session.update if `responseInProgress`) | ⬜ |
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
