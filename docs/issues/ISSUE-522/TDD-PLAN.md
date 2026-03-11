# TDD Plan: Issue #522 — conversation_already_has_active_response after successful function call

**Issue:** [#522 Bug: conversation_already_has_active_response after successful function call — duplicate requests and agent fallback (voice-commerce #1066)](https://github.com/Signal-Meaning/dg_react_agent/issues/522)

**Consumer:** voice-commerce (consumer tracking: voice-commerce GitHub Issue #1066)

**Principle:** Tests first (RED), then implementation (GREEN), then refactor. All checkboxes start unchecked; check each when that step is **done**.

---

## Checkbox legend

- `[ ]` — **Not done** (to be implemented or verified).
- `[x]` — **Done** (implemented and verified; update this doc when the step is complete).

---

## Summary and root cause

**Symptom:** After a successful function call (backend 200, host sends `FunctionCallResponse`, UI updates), the client receives from the API `conversation_already_has_active_response`. The component surfaces this as a connection/component failure, leading to retries and re-Settings, so the **same** function is invoked multiple times (e.g. 4× for one user utterance).

**Root cause (code):** The proxy sends `response.create` **immediately** after sending `conversation.item.create` (function_call_output) to the upstream (`server.ts` ~350–358, Issue #489). That assumed the real API sends `response.done` in the same batch as or before our FunctionCallResponse. In voice-commerce’s environment the API has **not** finished the current response when we send `response.create`, so the API correctly returns `conversation_already_has_active_response`.

**Secondary:** When this API error is received, the stack treats it as a fatal failure and triggers re-Settings/retries, causing duplicate function calls.

**Desired behavior:**

1. **Respect “one active response at a time”:** Do **not** send `response.create` until the server has sent `response.done` (or `response.output_text.done`) for the current response. After sending function_call_output, **defer** `response.create` until the proxy receives one of those events from upstream.
2. **Do not treat this error as fatal:** If the API returns `conversation_already_has_active_response`, do not treat it as a connection failure that triggers reconnection, re-Settings, or retries.

---

## Fix 1: Defer `response.create` until `response.done` / `response.output_text.done` after FunctionCallResponse

**Goal:** After the proxy sends `conversation.item.create` (function_call_output) to the upstream, do **not** send `response.create` immediately. Send it only when the proxy receives `response.done` or `response.output_text.done` from upstream (per OpenAI Realtime API: only one response active at a time).

### 1.1 RED — Tests that would fail without the fix

- [ ] **Integration (mock):** In `tests/integration/openai-proxy-integration.test.ts`, add or extend a test that asserts: after client sends FunctionCallResponse, the proxy does **not** send `response.create` to the upstream until the mock has sent `response.done` or `response.output_text.done`. Without the fix, the proxy currently sends `response.create` immediately, so the test must capture “messages sent to upstream” and assert order: function_call_output item first, then no `response.create` until after completion event.
- [ ] **Integration (real API, if applicable):** Ensure existing real-API test “Issue #470 real-API: function-call flow completes without conversation_already_has_active_response” (or equivalent) still passes after the proxy change; run with `USE_REAL_APIS=1`.
- [ ] **E2E (if in repo):** Any E2E that asserts no `conversation_already_has_active_response` during a single function-call flow (e.g. test-app or partner test) should pass after the fix.

**Done when:** New/updated tests are in place and **fail** when the proxy sends `response.create` immediately after function_call_output (RED).

### 1.2 GREEN — Implementation

- [ ] **Proxy:** In `packages/voice-agent-backend/scripts/openai-proxy/server.ts`, in the `FunctionCallResponse` branch (~350–358):
  - **Remove** the immediate `upstream.send(JSON.stringify({ type: 'response.create' }))` and `onResponseStarted()`.
  - **Set** `pendingResponseCreateAfterFunctionCallOutput = true` and **do not** send `response.create` here.
  - **Keep** sending `AgentThinking` to the client so the component can clear “waiting for next agent message” and idle timeout can run when the turn completes.
  - Rely on the existing handlers for `response.output_text.done` and `response.done` to send the deferred `response.create` when received (they already have the `if (pendingResponseCreateAfterFunctionCallOutput) { ... upstream.send(JSON.stringify({ type: 'response.create' })); ... }` logic).
- [ ] **Protocol doc:** Update `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` to state that after FunctionCallResponse we **defer** `response.create` until `response.done` or `response.output_text.done` (remove or correct any wording that suggests sending immediately for Issue #489).

**Done when:** Proxy no longer sends `response.create` in the FunctionCallResponse branch; it only sends it from the `response.output_text.done` / `response.done` handlers when `pendingResponseCreateAfterFunctionCallOutput` is true. All tests from 1.1 pass (GREEN).

### 1.3 REFACTOR

- [ ] Simplify or add comments in `server.ts` so the “defer until completion” contract is clear for future readers.
- [ ] **Done when:** Code is clear and tests remain green.

---

## Fix 2: Do not treat `conversation_already_has_active_response` as fatal

**Goal:** When the API returns an error with code `conversation_already_has_active_response`, the component and/or proxy should **not** treat it as a fatal connection failure that triggers reconnection, re-Settings, or retries (which cause duplicate function calls).

### 2.1 RED — Tests that would fail without the fix

- [ ] **Unit or integration:** Add or extend a test: when the upstream sends an `error` event with `code: 'conversation_already_has_active_response'`, the proxy either (a) does not forward it as a fatal error that would trigger client re-Settings, or (b) forwards it in a way the component treats as non-fatal (e.g. not as “connection error” / “component failure”). Define expected behavior (e.g. forward as warning or specific error type that does not trigger reconnect).
- [ ] **Component (if change is in voice-agent-react):** If the component is the one that triggers re-Settings on this error, add a test that when the component receives this error from the backend it does **not** reconnect or re-send Settings. Document where the “fatal” handling lives (proxy vs component).

**Done when:** Tests are written and **fail** with current behavior (RED).

### 2.2 GREEN — Implementation

- [x] **Proxy:** In the upstream `error` message handler in `server.ts`, if `componentError.code === 'conversation_already_has_active_response'`, log at INFO and **do not forward** the error to the client (client never sees it, so no reconnect/re-Settings).
- [ ] **Component (if applicable):** If the component treats any backend Error as fatal and re-Settings, add a branch so that when the error code is `conversation_already_has_active_response` it does **not** trigger reconnection or re-Settings. Optionally still surface a non-fatal warning to the app. (Not required when proxy suppresses the error.)

**Done when:** The API error no longer triggers retries or re-Settings; tests from 2.1 pass (GREEN).

### 2.3 REFACTOR

- [ ] Align error handling with other “expected” or “recoverable” API errors (e.g. `idle_timeout`) if applicable. Document in protocol or types which error codes are non-fatal.
- [ ] **Done when:** Behavior is consistent and tests remain green.

---

## Validation and release

- [ ] **Real API:** Run integration (and, if available, E2E) with real OpenAI API where applicable (`USE_REAL_APIS=1`) to confirm no `conversation_already_has_active_response` in the function-call flow. See project rules: proxy/API defects must be validated against real API before release.
- [ ] **Partner test:** Voice-commerce test “OpenAI function call flow completes without conversation_already_has_active_response (Issue #1066)” in `frontend/tests/e2e/openai-provider.e2e.test.js` — pass criteria: flow completes without that error and without duplicate function calls. Document in release notes that partners can use this to validate.
- [ ] **Idle timeout / completion:** Ensure that deferring `response.create` does not break the idle-timeout-after-function-call flow (component still receives completion signal when upstream sends `response.done` / `response.output_text.done`). Existing E2E or integration tests for that path should still pass.
- [ ] **Release:** Version bump and release notes for voice-agent-backend (and voice-agent-react if changed). Note pairing of backend + react versions if needed.

**Done when:** All validation steps pass and release is qualified.

---

## References

- **Issue:** [#522](https://github.com/Signal-Meaning/dg_react_agent/issues/522)
- **Consumer:** voice-commerce Issue #1066
- **Protocol:** `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md`
- **Proxy logic:** `packages/voice-agent-backend/scripts/openai-proxy/server.ts` (FunctionCallResponse branch ~305–363; `response.output_text.done` ~529–546; `response.done` ~708–724)
- **Related issues:** #459 (session.update race), #462 (audio.done vs text.done), #470 (defer response.create until output_text.done/response.done), #489 (idle timeout; introduced immediate response.create after function_call_output)
- **OpenAI Realtime API:** [response.create](https://platform.openai.com/docs/api-reference/realtime-client-events/response/create), [response.done](https://platform.openai.com/docs/api-reference/realtime-server-events/response/done) — only one response active at a time for the default conversation.
