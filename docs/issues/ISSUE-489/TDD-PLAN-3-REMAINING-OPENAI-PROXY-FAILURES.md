# TDD Plan: Remaining OpenAI Proxy E2E Failures (2)

**Scope:** Resolve the failing tests when running `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js` from test-app. **Current:** 14 passed, **2 failed**, 2 skipped (after unmapped-event test-app change). Only tests 6 and 6b still fail.

**Reference:** [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) — "OpenAI proxy E2E only – latest run."

---

## The 2 remaining failures

| # | Test | Error | Phase |
|---|------|------|-------|
| 1 | **6.** Simple function calling – assert response in agent-response | Expected `/\d{1,2}:\d{2}\|UTC/`; **received:** model fallback text ("I'm having some trouble retrieving the current time...") | Function-call reply |
| 2 | **6b.** Issue #462 / #470 – function-call flow (partner scenario) | Same; received "I'm sorry, but I couldn't retrieve the current time..." | Function-call reply |

(3b previously failed on assistant count 5 vs 3; with latest run it passes.)

---

## (Resolved) Failure 1: 3b – assistant count 5 vs 3

**Status:** Passes in latest run (14 passed, 2 failed). Kept for reference.

**RED (historical):** Test expected `[data-role="assistant"]` count === 3 (greeting + r1 + r2). With transcript mapping we had 5. Likely causes: (a) same logical message sent multiple times (e.g. conversation.item.created + .added + .done with different item ids), (b) session history on reconnect adds duplicate items, (c) test expectation too strict.

**GREEN (candidates):** (1) Relax test to assert ≥3 assistant and that r1 (Paris) is in history. (2) Or deduplicate in proxy/app by content or sequence so we only show 3. (3) Or document real API sends 5 and update test expected count.

**Refactor:** Align test with chosen behavior; update E2E-FAILURES-RESOLUTION.

---

## Failure 2 & 3: 6 and 6b – function-call reply (time/UTC)

**RED:** After "What time is it?" and function call, the **model** replies with fallback text ("I'm having some trouble retrieving the current time...", "I couldn't retrieve the current time...") instead of a reply that includes the time or "UTC". Test expects `/\d{1,2}:\d{2}|UTC/` in `[data-testid="agent-response"]`.

**What “backend/model behavior” meant:** The earlier note that this is “backend/model behavior” described the *symptom* (model output is fallback text, not time). It did **not** mean the cause is outside our stack. The failure can be in **delivery of the instructions or data** the model needs to satisfy the function-call (tool schema, function result, or prompt).

### Delivery of instructions / data (investigation)

The model must (1) know it has a `get_current_time` tool, (2) receive the function result from our backend, and (3) produce a reply that uses that result. A failure in any of these looks like “model didn’t say the time”:

| Layer | What we deliver | What to check |
|-------|------------------|----------------|
| **Session / tools** | First `Settings` → proxy → `session.update` with `session.tools` (name, description, parameters). | Proxy logs: `session.update sent to upstream (tools=N)`. Test-app sends `get_current_time` via `getFunctionDefinitions()`; proxy maps in `mapSettingsToSessionUpdate` (translator.ts). If tools=0 or API rejects/ignores tools, model won’t call or use the function. |
| **Backend /function-call** | POST `/function-call` with `{ id, name, arguments }`; handler returns `{ content: JSON.stringify({ time, timezone }) }`. | Backend must be running; test-app `forwardFunctionCallToBackend` POSTs and gets `body.content`. If backend returns `error` or wrong shape, component sends `FunctionCallResponse` with error and model may reply with “couldn’t retrieve time”. |
| **Proxy function_call_output** | Component sends `FunctionCallResponse` (id, content or result). Proxy sends `conversation.item.create` with `item: { type: 'function_call_output', call_id: msg.id, output: string }`. | `call_id` must match the request the API sent; `output` must be the JSON string (e.g. `{"time":"14:32:15","timezone":"UTC"}`). If call_id mismatch or output empty/wrong, API/model may not associate the result with the call. |
| **Instructions / prompt** | `session.instructions` = `buildInstructionsWithContext(settings)` (base prompt + context). No explicit “use function result in your reply” text. | Model may still be expected to use tool results by convention. If tools or output are correct but model still says “couldn’t retrieve”, consider adding a short instruction that the assistant should use function results in its reply when available. |

**GREEN (implemented):** (1) **Instruction when tools present:** Proxy appends to `session.instructions` when tools are present: *"When you receive results from tool calls, use them in your reply to the user."* (translator.ts). Unit test in `tests/openai-proxy.test.ts`. **Result:** E2E 6 and 6b still fail after re-run — test 6 receives model fallback text ("I'm sorry, but I couldn't retrieve the current time right now..."); test 6b sometimes receives greeting only (31× "Hello! How can I assist you today?"). So the instruction alone did not fix the delivery gap.

**GREEN (candidates):** (2) Verify backend returns time and proxy sends correct `function_call_output`. (3) Verify tools in first `session.update`. (4) Ensure proxy maps post–function-call model reply to ConversationText. (5) **Use integration tests to isolate** (see below).

**Refactor:** See [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md) Phase 5.

---

### Identify and isolate the failure with integration tests

Use the same TDD process: add or run integration tests that **narrow down** where the chain breaks (backend → proxy → API → proxy → client). Then fix the failing link.

| Step | Purpose | Test / action |
|------|--------|----------------|
| **1. Backend isolation** | Confirm the backend used by E2E returns time. | **Existing:** `test-app/tests/function-call-endpoint-integration.test.js` (POST /function-call, get_current_time, assert 200 and `content` with time). It spawns the same backend implementation (backend-server.js + function-call-handlers.js) on port 18407. The E2E backend runs the same code on port 8080 via `npm run backend`. Run the integration test to verify the handler contract; if E2E 6/6b fail, ensure the backend is running on 8080 when running E2E. |
| **2. Proxy → upstream (function_call_output)** | Confirm the proxy sends correct `conversation.item.create` (function_call_output) with `call_id` and `output` when client sends FunctionCallResponse. | **Existing (mock):** `tests/integration/openai-proxy-integration.test.ts` — "translates response.function_call_arguments.done to FunctionCallRequest and FunctionCallResponse to conversation.item.create (function_call_output)" and "maps FunctionCallResponse with result (no content) to conversation.item.create with stringified output". They assert the mock receives `function_call_output` with correct shape. **Add (optional):** Assert `output` contains time-like JSON when content is time payload. |
| **3. Real-API function-call flow (client receives reply with function result)** | Confirm that with real API + real backend, the client receives at least one assistant message whose content includes the function result (time or UTC). | **Existing:** `tests/integration/openai-proxy-integration.test.ts` — `(useRealAPIs ? it : it.skip)('Issue #470 real-API: function-call flow completes without conversation_already_has_active_response')`. It POSTs to an in-process minimal backend (returns `{ content: '{"time":"12:00","timezone":"UTC"}' }`), sends FunctionCallResponse, and asserts no `conversation_already_has_active_response` and that **some** assistant content after the function call includes `12:00` or `UTC`. **Run:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` and filter for this test. If it **fails** (e.g. "assistant response did not include function result"), the failure is in proxy↔real API or the real API never returns a reply with the time — isolate with logs (what assistant messages did we get?). If it **passes**, the E2E failure may be test-app-specific (e.g. different backend URL, backend not running, or timing in browser). |
| **4. Mock: post–function-call reply → ConversationText** | Confirm that when the upstream sends a conversation.item with the model’s reply (e.g. transcript "The time is 12:00 UTC"), the client receives ConversationText with that content. | **Existing (mock):** The mock in the integration test sends a fixed assistant reply after function_call_output; the test asserts the client receives ConversationText (assistant) with that content. **Add (optional):** A dedicated test: mock sends `conversation.item.done` with content part containing time string; assert client receives exactly one ConversationText containing that time. |
| **5. E2E vs integration parity** | Align E2E environment with integration test. | Ensure test-app E2E uses the same backend contract: when running E2E 6/6b, the test-app’s `proxyEndpoint` resolves to a backend that serves POST /function-call and returns `{ content: JSON.stringify({ time, timezone }) }`. If the integration test passes with real API but E2E fails, compare: backend URL, backend implementation (test-app scripts/backend vs in-process minimal backend), and whether the browser actually sends FunctionCallResponse (e.g. add temporary E2E log or use existing function-call-tracker). |

**Suggested order:** Run (3) with `USE_REAL_APIS=1` first. If it fails, inspect `assistantContentAfterFunctionCall` in the test (or add a log) to see what the real API sent back — that tells us whether the model is replying with time or with fallback text. If it passes, the gap is likely E2E environment (backend URL, backend not running, or UI timing). Then run (1) against the test-app backend to confirm it returns time. Document findings in this TDD plan and in [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md).

### Integration test (3) result and E2E test alignment

**Finding:** The real-API integration test *"Issue #470 real-API: function-call flow completes without conversation_already_has_active_response"* **passes** when run with `USE_REAL_APIS=1`. So the proxy↔API path and client receipt of assistant content including time/UTC are correct in the integration environment. The same backend serves other E2E tests (e.g. connection, message, reconnection). So the E2E failures (6, 6b) are not simply "backend not running" — they may be **test setup or protocol handling** (e.g. tests not using the same utilities as other specs, or not waiting for the function-call protocol before asserting).

**E2E test alignment (tests 6 and 6b):**

| Item | Change |
|------|--------|
| **Function-calling prerequisites** | Tests 6 and 6b call `setupFunctionCallingTest(page, { useBackend: true })` **before** `setupTestPageForBackend(...)`, matching other function-calling E2E tests (e.g. issue-351, function-calling-e2e). `useBackend: true` sets tracking arrays (`functionCallRequests`, `functionCallResponses`) and optional `testFunctions` (same definitions as other tests) but does **not** set `handleFunctionCall`, so the app uses `forwardFunctionCallToBackend` (backend path). |
| **Use shared setup** | They then use `setupTestPageForBackend(page, { extraParams: { 'test-mode': 'true', 'enable-function-calling': 'true' } })` so navigation matches other backend tests (e.g. test 7). |
| **Wait for function-call receipt** | After sending "What time is it?", tests call `waitForFunctionCall(page, { timeout: 20000 })` and assert `functionCallInfo.count >= 1` before waiting for the time pattern in `agent-response`. So we **isolate**: if the tracker never increments, the component did not receive a FunctionCallRequest (protocol/setup issue); if the tracker increments but the model still replies with fallback text, the issue is backend/proxy/API delivery of the result to the model. |
| **Backend URL** | The app derives the function-call base URL from the proxy endpoint (same host:port as proxy). When using `setupTestPageForBackend`, the proxy endpoint comes from `getBackendProxyParams()` (same as other tests). Backend implementation: `test-app/scripts/backend-server.js` + `function-call-handlers.js`. |

**If E2E 6/6b still fail:** (a) If `waitForFunctionCall` fails (count 0), the component is not receiving FunctionCallRequest — check proxy/API and that `enable-function-calling` is in the URL. (b) If the tracker increments but agent-response is still fallback text, the issue is backend return value, proxy `function_call_output`, or model not using the result. Document in [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md).

---

## TDD workflow

1. **RED:** Reproduce (or add failing unit/integration test).
2. **GREEN:** Minimal change to pass.
3. **REFACTOR:** Clean up; keep tests green.

---

## Success criteria

- [x] 3b passes (assistant count and r1-in-history) — passes in latest run.
- [ ] 6 and 6b pass (agent-response shows time/UTC after function call).
- [ ] `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js` → 0 failures (excluding existing skips).

---

## How to run

From test-app:

```bash
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js
```

Single test:

```bash
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "3b"
```
