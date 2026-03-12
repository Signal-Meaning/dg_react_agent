# TDD Plan: Issue #522 — conversation_already_has_active_response after successful function call

**Issue:** [#522 Bug: conversation_already_has_active_response after successful function call — duplicate requests and agent fallback (voice-commerce #1066)](https://github.com/Signal-Meaning/dg_react_agent/issues/522)

**Consumer:** voice-commerce (consumer tracking: voice-commerce GitHub Issue #1066)

**Principle:** Tests first (RED), then implementation (GREEN), then refactor. All checkboxes start unchecked; check each when that step is **done**.

**Recovery (new chat):** Fixes 1 & 2 are done (v0.10.3). Post–v0.10.3 voice-commerce reported "no agent response after search" — API not sending `response.done`/`response.output_text.done` after `function_call_output`. We added: (1) **REQUIRED-UPSTREAM-CONTRACT.md**; (2) **20s proxy timeout** (unstick); (3) **conversation.item.done** (function_call_output) as completion signal (per spec); (4) refactor `sendDeferredResponseCreate()`. E2E 6 and 6b **pass** with real API after backend restart. **Remaining steps:** See **REMAINING-STEPS.md** (release, partner validation, close issue).

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

- [x] **Integration (mock):** In `tests/integration/openai-proxy-integration.test.ts`, add or extend a test that asserts: after client sends FunctionCallResponse, the proxy does **not** send `response.create` to the upstream until the mock has sent `response.done` or `response.output_text.done`. Without the fix, the proxy currently sends `response.create` immediately, so the test must capture “messages sent to upstream” and assert order: function_call_output item first, then no `response.create` until after completion event.
- [x] **Integration (real API, if applicable):** Ensure existing real-API test “Issue #470 real-API: function-call flow completes without conversation_already_has_active_response” (or equivalent) still passes after the proxy change; run with `USE_REAL_APIS=1`.
- [x] **E2E (if in repo):** Any E2E that asserts no `conversation_already_has_active_response` during a single function-call flow (e.g. test-app or partner test) should pass after the fix.

**Done when:** New/updated tests are in place and **fail** when the proxy sends `response.create` immediately after function_call_output (RED).

### 1.2 GREEN — Implementation

- [x] **Proxy:** In `packages/voice-agent-backend/scripts/openai-proxy/server.ts`, in the `FunctionCallResponse` branch (~350–358):
  - **Remove** the immediate `upstream.send(JSON.stringify({ type: 'response.create' }))` and `onResponseStarted()`.
  - **Set** `pendingResponseCreateAfterFunctionCallOutput = true` and **do not** send `response.create` here.
  - **Keep** sending `AgentThinking` to the client so the component can clear “waiting for next agent message” and idle timeout can run when the turn completes.
  - Rely on the existing handlers for `response.output_text.done` and `response.done` to send the deferred `response.create` when received (they already have the `if (pendingResponseCreateAfterFunctionCallOutput) { ... upstream.send(JSON.stringify({ type: 'response.create' })); ... }` logic).
- [x] **Protocol doc:** Update `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` to state that after FunctionCallResponse we **defer** `response.create` until `response.done` or `response.output_text.done` (remove or correct any wording that suggests sending immediately for Issue #489).

**Done when:** Proxy no longer sends `response.create` in the FunctionCallResponse branch; it only sends it from the `response.output_text.done` / `response.done` handlers when `pendingResponseCreateAfterFunctionCallOutput` is true. All tests from 1.1 pass (GREEN).

### 1.3 REFACTOR

- [x] Simplify or add comments in `server.ts` so the “defer until completion” contract is clear for future readers. (Contract and timeout documented in REQUIRED-UPSTREAM-CONTRACT.md and enforced via timeout; see Follow-up below.)
- [x] **Done when:** Code is clear and tests remain green.

---

## Fix 2: Do not treat `conversation_already_has_active_response` as fatal

**Goal:** When the API returns an error with code `conversation_already_has_active_response`, the component and/or proxy should **not** treat it as a fatal connection failure that triggers reconnection, re-Settings, or retries (which cause duplicate function calls).

### 2.1 RED — Tests that would fail without the fix

- [x] **Unit or integration:** Add or extend a test: when the upstream sends an `error` event with `code: 'conversation_already_has_active_response'`, the proxy either (a) does not forward it as a fatal error that would trigger client re-Settings, or (b) forwards it in a way the component treats as non-fatal (e.g. not as “connection error” / “component failure”). Define expected behavior (e.g. forward as warning or specific error type that does not trigger reconnect).
- [x] **Component (if change is in voice-agent-react):** If the component is the one that triggers re-Settings on this error, add a test that when the component receives this error from the backend it does **not** reconnect or re-send Settings. Document where the “fatal” handling lives (proxy vs component).

**Done when:** Tests are written and **fail** with current behavior (RED).

### 2.2 GREEN — Implementation

- [x] **Proxy:** In the upstream `error` message handler in `server.ts`, if `componentError.code === 'conversation_already_has_active_response'`, log at INFO and **do not forward** the error to the client (client never sees it, so no reconnect/re-Settings).
- [x] **Component (if applicable):** If the component treats any backend Error as fatal and re-Settings, add a branch so that when the error code is `conversation_already_has_active_response` it does **not** trigger reconnection or re-Settings. Optionally still surface a non-fatal warning to the app. (Not required when proxy suppresses the error.)

**Done when:** The API error no longer triggers retries or re-Settings; tests from 2.1 pass (GREEN).

### 2.3 REFACTOR

- [x] Align error handling with other “expected” or “recoverable” API errors (e.g. `idle_timeout`) if applicable. Document in protocol or types which error codes are non-fatal. (Documented in PROTOCOL-AND-MESSAGE-ORDERING.md §5 error row; `conversation_already_has_active_response` logged INFO, not forwarded.)
- [x] **Done when:** Behavior is consistent and tests remain green.

---

## Validation and release

- [x] **Real API:** Run integration (and, if available, E2E) with real OpenAI API where applicable (`USE_REAL_APIS=1`) to confirm no `conversation_already_has_active_response` in the function-call flow. See project rules: proxy/API defects must be validated against real API before release.
- [x] **E2E in this repo (same scenario as voice-commerce):** Test **6b** in `test-app/tests/e2e/openai-proxy-e2e.spec.js` — “Issue #462 / #470: function-call flow completes without conversation_already_has_active_response (partner scenario)”. It uses `assertNoRecoverableAgentErrors(page)` (fails if any agent error, including `conversation_already_has_active_response`). **Run from test-app:** Backend and dev server running, then: `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6b"`. See test-app/tests/e2e/README.md. This is our equivalent of voice-commerce’s Issue #1066 E2E. **Validated:** Passed with real API after item.done mitigation (backend restarted; agent returned time; 0 recoverable errors).
- [ ] **Partner test (voice-commerce repo):** Partner cannot validate without release. After release, voice-commerce run their own E2E in **their** repo after upgrading. Document in release notes that partners can use that test (or our test 6b) to validate post-upgrade.
- [x] **Idle timeout / completion:** Ensure that deferring `response.create` does not break the idle-timeout-after-function-call flow (component still receives completion signal when upstream sends `response.done` / `response.output_text.done`). Existing E2E or integration tests for that path should still pass. _(issue-487-idle-timeout-after-function-result-component.test.tsx: 4/4 passed.)_
- [x] **Release:** Version bump and release notes for voice-agent-backend (and voice-agent-react if changed). Note pairing of backend + react versions if needed. _(Backend 0.2.8; component 0.10.3; release created; see RELEASE-CHECKLIST.md.)_

**Done when:** All validation steps pass and release is qualified.

---

## Follow-up: Enforcing the required upstream contract (post–v0.10.3)

**Context:** After v0.10.3, voice-commerce reported "no agent response after the search" — the proxy correctly deferred `response.create` until `response.done`/`response.output_text.done`, but in their environment the **real API was not sending** those events after `function_call_output`, so the proxy waited indefinitely and the client hit idle timeout. We had the spec but were not **enforcing** it.

**Done:**

- [x] **Document required upstream contract:** Added `packages/voice-agent-backend/scripts/openai-proxy/REQUIRED-UPSTREAM-CONTRACT.md`. States: after we send `function_call_output`, the API **MUST** send `response.done` or `response.output_text.done` within a reasonable time; if not, the next turn never starts. References PROTOCOL-AND-MESSAGE-ORDERING and server.ts.
- [x] **Proxy timeout (enforcement + recovery):** In `server.ts`, when we set `pendingResponseCreateAfterFunctionCallOutput = true` after FunctionCallResponse, we start a 20s timer (`DEFERRED_RESPONSE_CREATE_TIMEOUT_MS`). If the upstream has not sent `response.done` or `response.output_text.done` when the timer fires: log **ERROR** ("Required upstream contract violated: upstream did not send response.done or response.output_text.done after function_call_output within Nms"), then send the deferred `response.create` anyway so the conversation can continue instead of hanging. Timer is cleared when we receive completion or on upstream close/error.
- [x] **Tie real-API test to contract:** REQUIRED-UPSTREAM-CONTRACT.md § Enforcement states that the test *"Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone"* enforces the contract when run with `USE_REAL_APIS=1`; release checklist (`.github/ISSUE_TEMPLATE/release-checklist.md`) already requires real-API integration tests for proxy/API behavior releases. No change to checklist text was made; the contract doc explicitly names this test as the enforcement.

**Handoff for new chat:** If continuing work on #522 or voice-commerce #1066: (1) Run real-API integration test and E2E 6b when keys available; (2) If "no agent response" persists, check proxy/backend logs for *"Required upstream contract violated"* — that confirms the API is not sending completion and the timeout unstick has fired. **Finding:** In the same environment, integration (in-process proxy → real API) **passes** (including AgentAudioDone after function call) but E2E (forwarder → subprocess proxy → real API) **fails** (6 and 6b both fail at time-pattern). See **FINDINGS.md** and **DEFECT-ISOLATION-PROPOSAL.md** for topology difference and next steps (backend logs, CAPTURE_UPSTREAM_AFTER_FCR, E2E diagnostic).

**Debug run (LOG_LEVEL + E2E 6):** User restarted backend intending debug logs and reran test 6. (1) **backend:log** previously hardcoded `LOG_LEVEL=info`, so debug was not applied; **fixed** in test-app/package.json so `LOG_LEVEL=debug npm run backend:log` is respected. (2) **Playwright error-context snapshot** at failure shows **agentState: "thinking"** and **Session: "closed"** — WebSocket was closed and the component never received the follow-up. (3) **Backend debug log (with fixed script):** Subprocess proxy log shows that after we send **function_call_output**, the API sent only **conversation.item.added** and **conversation.item.done** for that item; it did **not** send **response.done** or **response.output_text.done**. ~10 s later the upstream closed (code 1005). So **hypothesis A confirmed**: the API did not fulfil the required contract (REQUIRED-UPSTREAM-CONTRACT.md) in this run. See FINDINGS.md § "Debug log analysis (LOG_LEVEL=debug run)".

**Spec and mitigation (conversation.item.done):** Per [OpenAI Realtime API: conversation.item.done](https://platform.openai.com/docs/api-reference/realtime-server-events/conversation-item-done), that event is "Returned when a conversation item is finalized." When the client sends `conversation.item.create` (function_call_output), the server adds the item and may send only `conversation.item.added` and `conversation.item.done` (no `response.done`). The spec does **not** require the API to send a new `response.done` after accepting the function_call_output item. The proxy therefore **treats `conversation.item.done`** with **`item.type === 'function_call_output'`** as a valid completion signal and sends the deferred `response.create` immediately (REQUIRED-UPSTREAM-CONTRACT.md). **Isolated test:** Integration test *"Issue #522: conversation.item.done (function_call_output) triggers deferred response.create; client gets next turn"* in `openai-proxy-integration.test.ts` — mock sends only item.added + item.done (no response.done); asserts proxy sends one response.create and client receives AgentAudioDone and ConversationText. Run with mock only (no USE_REAL_APIS). **E2E:** After backend restart with the mitigation, test 6 passes with real API (agent-response shows time, e.g. "The current time is 14:46 UTC.").

---

## References

- **Issue:** [#522](https://github.com/Signal-Meaning/dg_react_agent/issues/522)
- **Consumer:** voice-commerce Issue #1066
- **Protocol:** `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md`
- **Required contract:** `packages/voice-agent-backend/scripts/openai-proxy/REQUIRED-UPSTREAM-CONTRACT.md` — Proxy sends deferred response.create on response.done, response.output_text.done, or **conversation.item.done** (function_call_output) per spec; 20s timeout unstick if none received.
- **Proxy logic:** `packages/voice-agent-backend/scripts/openai-proxy/server.ts` (FunctionCallResponse branch; `sendDeferredResponseCreate()`; `response.output_text.done` / `response.done` / `conversation.item.done` for function_call_output; `DEFERRED_RESPONSE_CREATE_TIMEOUT_MS`)
- **Related issues:** #459 (session.update race), #462 (audio.done vs text.done), #470 (defer response.create until output_text.done/response.done), #489 (idle timeout; introduced immediate response.create after function_call_output)
- **Findings and isolation:** `docs/issues/ISSUE-522/FINDINGS.md` (integration vs E2E runs; root cause; E2E 6/6b validation). `docs/issues/ISSUE-522/DEFECT-ISOLATION-PROPOSAL.md` (hypotheses, tests, recommended order).
- **Remaining steps:** `docs/issues/ISSUE-522/REMAINING-STEPS.md` — summary. **Release checklist:** `docs/issues/ISSUE-522/RELEASE-CHECKLIST.md` (aligned with `.github/ISSUE_TEMPLATE/release-checklist.md`); use for version bump, pre-release tests, release docs, publish, post-release, close issue.
- **OpenAI Realtime API:** [response.create](https://platform.openai.com/docs/api-reference/realtime-client-events/response/create), [response.done](https://platform.openai.com/docs/api-reference/realtime-server-events/response/done), [conversation.item.done](https://platform.openai.com/docs/api-reference/realtime-server-events/conversation-item-done) — only one response active at a time; item.done = item finalized.
