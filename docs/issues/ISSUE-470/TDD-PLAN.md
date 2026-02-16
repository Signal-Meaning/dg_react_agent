# TDD Plan: Resolve the #462 Partner-Scenario Coverage Gap (Issue #470)

**Goal:** Add coverage that exercises the #462 partner (voice-commerce) scenario so the defect is corrected: connect → Settings → one user message → one function call → one backend HTTP → one FunctionCallResponse → API response, with **no** `conversation_already_has_active_response`. See [SCOPE.md](./SCOPE.md) for the scenario.

**TDD cycle:** Red (write failing test or prove gap) → Green (test passes) → Refactor.

---

## Phase 1: E2E test (recommended primary)

E2E runs the full partner flow: real test-app, real component, real proxy, real OpenAI; backend HTTP via test-app’s `/api/function-call` (or equivalent). This matches how voice-commerce runs their E2E.

### 1.1 RED — Add a failing or coverage test

- **Where:** `test-app/tests/e2e/openai-proxy-e2e.spec.js` (or a dedicated `issue-462-partner-scenario.spec.js`).
- **Test name (example):** `Issue #462 / #470: function-call flow completes without conversation_already_has_active_response (partner scenario)`.
- **Steps:**
  1. `setupTestPageWithOpenAIProxy(page)` with function-calling enabled (same as existing test 6).
  2. `establishConnectionViaText(page, 30000)`.
  3. `waitForSettingsApplied(page, 15000)`.
  4. Send **one** user message that triggers a function call (e.g. “What time is it?” or a prompt known to trigger the test-app’s function).
  5. Wait for FunctionCallRequest (test-app handles it and calls backend HTTP, then sends FunctionCallResponse).
  6. Wait for agent response (ConversationText or completion).
  7. **Assert:** No `conversation_already_has_active_response` occurred.
     - **Option A:** `assertNoRecoverableAgentErrors(page)` (and agent-error-count remains 0). If the component calls `onError` with that error, the test-app’s error count will increment and the assert will fail.
     - **Option B:** Capture console or component errors and assert no error with `code === 'conversation_already_has_active_response'` or message containing that string. If the test-app does not expose error code in the DOM, add a `data-testid="last-agent-error-code"` (or similar) for this E2E, or use console listener in the test.
- **Run:** `cd test-app && USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e` (or the new spec), with real OpenAI API key so the proxy talks to live OpenAI. Skip in CI when no key (or run in CI with secret key).
- **RED criterion:** If the test is new and the scenario previously failed at voice-commerce, run it against current code; it may **pass** (proxy fix is in). Then RED is “we didn’t have this test before”; the “fix” is adding the test. If at any point the test fails (error count &gt; 0 or that error code appears), that is RED; then fix until GREEN.

### 1.2 GREEN — Test passes

- Ensure the full flow runs and the assertion holds: no `conversation_already_has_active_response`, and agent response is received.
- If the test fails: fix proxy or test-app behavior until the test passes (proxy fix for #462 is already in; failures may be environment or timing).
- Document in `docs/issues/ISSUE-462/` or TRACKING that this E2E covers the partner scenario (flow + assertion).

**Phase 1.2 outcome (2025-02):** Test was run with real OpenAI proxy (`USE_REAL_APIS=1`, `npm run test:e2e -- openai-proxy-e2e --grep "6b.*462"`). The test **failed** (RED): `agent-error-count` was 1. The Event Log showed the exact error we guard against: *"Conversation already has an active response in progress: resp_…. Wait until the response is finished before creating a new one."* So the E2E correctly reproduces the partner scenario and catches `conversation_already_has_active_response`. Investigation required to fix proxy/component and get to GREEN.

### 1.3 REFACTOR

- Reuse helpers from `openai-proxy-e2e.spec.js` and `test-helpers.js` (e.g. `establishConnectionViaText`, `waitForSettingsApplied`, `sendTextMessage`, `waitForAgentResponseEnhanced`). Add a helper for “wait for function call, send response, wait for agent reply” if not already present.
- If a dedicated spec file is used, keep it small and reference SCOPE.md and ISSUE-462.

---

## Phase 2: Integration test (optional supplement)

An integration test in `tests/integration/openai-proxy-integration.test.ts` that runs **against the real API** and reproduces the **function-call path** (not just InjectUserMessage → second Settings):

- Client connects to proxy (upstream = real OpenAI).
- Send Settings → SettingsApplied.
- Send InjectUserMessage (e.g. prompt that triggers a function call from the API).
- When upstream sends `response.function_call_arguments.done`, client sends FunctionCallResponse (conversation.item.create + response.create path).
- Wait for response completion (output_text.done or full response).
- **Assert:** No Error message containing `conversation_already_has_active_response`.

This is more work than E2E (mock doesn’t drive real function-call timing; real API must send a function call). E2E is the primary recommended path; this integration test is optional if we want a second real-API signal for the same scenario.

---

## Phase 3: Documentation and closure

- **Document:** In `docs/issues/ISSUE-462/TRACKING.md` or README, state that the partner scenario is covered by: [E2E test name and file] (and optionally integration test).
- **Release:** Once the E2E (and optional integration) test is in place and passing against the real API (or documented skip in CI), the release is complete per [SCOPE.md](./SCOPE.md).

---

## Checklist (for this branch)

- [x] **Phase 1.1** — E2E test added (openai-proxy-e2e or new spec) that runs partner scenario and asserts no `conversation_already_has_active_response`.
- [ ] **Phase 1.2** — Test passes with real OpenAI proxy (local run with OPENAI_API_KEY). *Run completed; test fails with conversation_already_has_active_response (RED); investigation to follow.*
- [ ] **Phase 1.3** — Refactor: reuse helpers; document coverage in ISSUE-462.
- [ ] **Phase 2** (optional) — Real-API integration test for function-call path with same assertion.
- [ ] **Phase 3** — ISSUE-462 docs updated; SCOPE.md definition-of-done (2) satisfied.

---

## References

- Scenario: [SCOPE.md](./SCOPE.md) (The scenario).
- Existing E2E: `test-app/tests/e2e/openai-proxy-e2e.spec.js` (test 6 — simple function calling; currently allows up to 2 errors).
- Helpers: `test-app/tests/e2e/helpers/test-helpers.js` (`assertNoRecoverableAgentErrors`, `assertAgentErrorsAllowUpstreamTimeouts`, `establishConnectionViaText`, `waitForSettingsApplied`, `sendTextMessage`, `waitForAgentResponseEnhanced`).
- Backend contract: `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md`; test-app `POST /api/function-call` and function-call handlers.
