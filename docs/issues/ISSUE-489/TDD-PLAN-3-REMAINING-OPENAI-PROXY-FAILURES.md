# TDD Plan: Remaining OpenAI Proxy E2E Failures (2)

**Scope:** Resolve the failing tests when running `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js` from test-app. **Current:** 14 passed, **2 failed**, 2 skipped in some runs (after unmapped-event test-app change). Known failures: 6 and 6b. **3b is not resolved** — do not treat as fixed; verify with `--grep "3b"`.

**Principle: entirely automated testable solution.** All verification and resolution must be automatable. No manual inspection (e.g. running with `--headed` and checking the Network tab) is required to qualify a fix. Use E2E assertions, integration tests, and diagnostic tests (e.g. test 6d, `__functionCallDiagnostics`, backend integration tests); extend with automated network capture/assertions in Playwright if needed (e.g. `page.route` or request/response interception) so the pipeline stays fully automated.

**Reference:** [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) — "OpenAI proxy E2E only – latest run."

---

## The 2 remaining failures

| # | Test | Error | Phase |
|---|------|------|-------|
| 1 | **6.** Simple function calling – assert response in agent-response | Expected `/\d{1,2}:\d{2}\|UTC/`; **received:** model fallback text ("I'm having some trouble retrieving the current time...") | Function-call reply |
| 2 | **6b.** Issue #462 / #470 – function-call flow (partner scenario) | Same; received "I'm sorry, but I couldn't retrieve the current time..." | Function-call reply |

**Plain statement:** Tests 6 and 6b fail because the **model returns fallback text** ("I'm having trouble fetching the current time...") — i.e. an **error in the function flow** (backend, proxy, or API did not deliver the result, or the model did not use it). This is **not** a greeting issue: we are not seeing the greeting as the final response or duplicate greetings; we are seeing the model's fallback when the function result is missing or unused.

(3b had failed on assistant count 5 vs 3; status is not resolved — verify with a dedicated run.)

### Why 3b can pass while 6 and 6b fail

**3b** exercises only the **plain conversation + reconnect** path:

- Connect → Settings (no tools) → greeting → user "What is the capital of France?" → agent reply (r1, Paris) → **disconnect** → **reconnect** (context in session instructions only) → user "What did I just say?" → agent reply (r2).
- No tools, no function calls. The proxy fix (context in instructions only; no `conversation.item.create` for context; no duplicate greeting on `session.updated`) ensures exactly 3 assistant messages (greeting, r1, r2). So when that fix is in place and the API behaves, 3b can pass: it only depends on **message flow and history**, not on the function-call chain.

**6 and 6b** exercise the **function-calling** path:

- Connect → Settings **with tools** (`get_current_time`) → user "What time is it?" → API sends **FunctionCallRequest** → component calls backend `POST /function-call` → component sends **FunctionCallResponse** → proxy must send `conversation.item.create` (type `function_call_output`) to the API → **model** must use that result and reply with the time (or UTC).
- The tests fail because the **model reply** is fallback text ("I'm having trouble fetching the current time..."), not the time. The **function-call-tracker passes** (component received FunctionCallRequest), so the break is **after** the component: either (1) backend not called or returns error, (2) proxy not sending the function result correctly to the API, or (3) API/model not using the result. So 3b and 6/6b hit **different code paths**: 3b = conversation + context on reconnect; 6/6b = tools + backend + function_call_output + model using the result. Passing 3b does not imply the function-call path works.

---

## Failure 1: 3b – assistant count 5 vs 3 (status: not resolved)

**Status:** Not resolved. The proxy fix (context in instructions only, no reinjection; see [DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md](./DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md)) was intended to make 3b pass with exactly 3 assistant messages. Verify with: `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "3b"` (from test-app). Kept here for reference and message-breakdown.

**RED (historical):** Test expected `[data-role="assistant"]` count === 3 (greeting + r1 + r2). With transcript mapping we had 5. Likely causes: (a) same logical message sent multiple times (e.g. conversation.item.created + .added + .done with different item ids), (b) session history on reconnect adds duplicate items, (c) test expectation too strict.

**All messages that comprised the bad count (purpose for each, same style as 3b / 9a message breakdowns):**

| DOM # | Role | Content (short) | Purpose / source |
|---|------|-----------------|------------------|
| 1 | assistant | Hello! How can I assist you today? | **Greeting** — first connection; proxy sent ConversationText from initial session/greeting. |
| 2 | user | What is the capital of France? | **User turn 1** — user echo (or InjectUserMessage) in history. |
| 3 | assistant | The capital of France is Paris. […] | **r1** — first agent reply (Paris); from conversation.item.* for the API’s reply to user1. |
| 4 | assistant | Hello! How can I assist you today? | **Duplicate greeting** — proxy sent `storedGreeting` again on session.updated after reconnect even though context already contained it (see [DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md](./DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md) Cause 1). |
| 5 | assistant | The capital of France is Paris. […] | **Duplicate r1** — API echo of context; we injected greeting, user1, r1 via conversation.item.create on reconnect, then forwarded the API’s conversation.item.* for those as ConversationText (Cause 2). |
| 6 | user | What did I just say? | **User turn 2** — sent after reconnect; leads to r2. |

Expected (3 assistant): **1** = greeting, **3** = r1, and **r2** (reply to “What did I just say?”) would be the third. The two extras are **4** (duplicate greeting) and **5** (duplicate r1). So the “bad count” is: three correct assistant messages (1, 3, r2) plus two duplicates (4, 5) = 5 assistant in DOM. See [DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md](./DIAGNOSIS-3B-DUPLICATE-ASSISTANT-MESSAGES.md) for the full diagnosis and fix.

**GREEN (candidates):** (1) Relax test to assert ≥3 assistant and that r1 (Paris) is in history. (2) Or deduplicate in proxy/app by content or sequence so we only show 3. (3) Or document real API sends 5 and update test expected count.

**Refactor:** Align test with chosen behavior; update E2E-FAILURES-RESOLUTION.

---

## Failure 2 & 3: 6 and 6b – function-call reply (time/UTC)

**Root cause (plain):** 6 and 6b fail because of **fallback text** — the model says it can't fetch the time. That indicates an **error in the function flow** (result not delivered or not used), **not** greeting issues (no greeting as final response, no duplicate-greeting bug here).

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

**Suggested order:** Run (3) with `USE_REAL_APIS=1` first. If it fails, the test (or added assertions on `assistantContentAfterFunctionCall`) should identify what the real API sent — all automated. If it passes, the gap is likely E2E environment (backend URL, backend not running, or UI timing). Run (1) via `npm test -- backend-integration` and function-call-endpoint-integration to confirm the backend returns time. Document findings in this TDD plan and in [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md).

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

### Latest run evidence (function-call-tracker passes → defect is downstream)

In the latest run the failure is at the **time-pattern assertion** (`toHaveText(/\d{1,2}:\d{2}|UTC/)`), not at the `waitForFunctionCall` / `functionCallInfo.count >= 1` assertion. So the **function-call-tracker passed**: the component received a FunctionCallRequest and the handler path ran. That narrows the defect to **downstream of the component receiving the request**:

- **Backend:** Does the test-app backend receive `POST /function-call` and return `{ content: JSON.stringify({ time, timezone }) }`? If the backend is not running or returns an error, the component would send a FunctionCallResponse with `error`, and the model would reply with fallback text.
- **Proxy:** Does the proxy send `conversation.item.create` with `type: 'function_call_output'`, correct `call_id`, and `output` containing the backend result?
- **Model:** Does the real API return an assistant message that includes the time/UTC after receiving the function result? (Integration test with real API passes with a minimal backend that returns fixed time — so the API can use the result; E2E uses the same proxy/API but a different backend URL/host.)

**Received strings in latest run:** Test 6: *"I'm having trouble fetching the current time at the moment. Could you let me know your time zone or location? That way I can help you find the exact time."* Test 6b: *"I'm having trouble fetching the current time right now. Could you tell me your time zone or location so I can better assist you?"* So the model is replying with fallback text, which is consistent with either (1) no function result reached the API (backend not called or proxy didn’t send it), or (2) API received the result but the model still produced fallback text (less likely given integration test passes).

---

## How to find where the failure is

The chain is: **browser → POST /function-call → component sends FunctionCallResponse → proxy sends function_call_output → API → model reply.** Check each link in order; the first one that fails is the defect.

| Step | What to check | How | If it fails → |
|------|----------------|-----|----------------|
| **1. Backend receives and responds** | Does the app in the browser actually call `POST /function-call` and get 200 with a body that has `content` (time JSON)? | **Automated only:** App already exposes `window.__functionCallDiagnostics` (URL, status, hasContent, errorMessage). Test 6d asserts on it; extend 6d or add E2E network capture (e.g. Playwright `page.route` or request listener) to assert OPTIONS/POST to `/function-call` (status, CORS headers) if needed. No manual inspection. | If no request, or status not 200, or body has `error`: defect is **backend URL (CORS/origin), backend down, or backend returned error**. Fix: URL derivation, backend, or handler; re-run automated tests. |
| **2. Component sends FunctionCallResponse** | After the backend returns, does the component call `sendResponse` with `result` (or `content`) and no `error`? | The function-call-tracker already confirms the component received the **request**. To confirm the **response** is sent: in the test-app, where it forwards to the backend, temporarily set `window.__lastFunctionCallResponseSent = { id, hasResult: !!result, hasError: !!error }`. In the test, after `waitForFunctionCall`, do `await page.evaluate(() => window.__lastFunctionCallResponseSent)`. If `hasError: true`, the backend returned an error to the app. | If the app never sends a response, or sends with `error`: defect is **app logic or backend returned error**. If the app sends `result` correctly, move to step 3. |
| **3. Proxy sends function_call_output** | Does the proxy, when it receives FunctionCallResponse from the client, send `conversation.item.create` with `type: 'function_call_output'`, correct `call_id`, and `output` set to the backend result string? | **Automated only:** Proxy writes to `E2E_FUNCTION_CALL_DEBUG_LOG` (test-results/e2e-function-call-output.json) when sending function_call_output; test 6d asserts on that file. Extend with unit/integration test that mocks the client sending FunctionCallResponse and asserts the proxy sends the corresponding upstream message. No manual log inspection. | If the proxy never writes the debug file or `output` is empty/wrong: defect is **proxy** (not mapping FunctionCallResponse, or wrong call_id/output). If the proxy sends it correctly, move to step 4. |
| **4. API/model uses the result** | Does the real API return an assistant message that includes the time (or UTC) after receiving the function result? | The **integration test** (real API + in-process minimal backend) **passes** and asserts assistant content includes `12:00` or `UTC`. So in that environment the API does return a time-based reply. In E2E the only difference is the backend (test-app backend, same handler code). So either (a) the E2E backend returns something different (step 1–2), or (b) the proxy sends a different payload in E2E (step 3), or (c) timing/ordering. If steps 1–3 are green, add a proxy log of the **upstream** assistant message(s) after function_call_output and confirm they contain time/UTC. | If steps 1–3 pass but the model reply in E2E still has no time: defect is **timing/ordering or API behavior** in the E2E setup. Compare proxy logs (E2E vs integration) for messages after function_call_output. |

**Minimal instrumentation checklist:** (1) In the app: log or expose backend request URL, response status, and whether `sendResponse` was called with `result` or `error`. (2) In the proxy: when sending `function_call_output`, log `call_id` and `output` length or prefix. (3) Run E2E 6 once with that instrumentation; the first step that does not match expectations is the failing link.

### Automated diagnostic (test 6d) and result

**Test 6d** runs the same flow as test 6 but after `waitForFunctionCall` reads `window.__functionCallDiagnostics` (app) and `test-results/e2e-function-call-output.json` (proxy, when Playwright started the backend). It asserts step 1 (backend 200, hasContent), step 2 (responseSent.hasResult), step 3 (proxy wrote function_call_output with non-empty output). Instrumentation: `functionCallBackend.ts` sets `__functionCallDiagnostics`; proxy writes to `E2E_FUNCTION_CALL_DEBUG_LOG` when sending function_call_output; Playwright config sets that env for the backend.

**Diagnostic result (runs):**

- **When Playwright starts backend:** Step 1 failed — 0 responses in network capture (browser→backend connection-level failure). Backend integration tests (Node→backend) pass; gap is browser reachability when Playwright starts the backend.
- **When user starts backend and frontend (existing servers):** Step 1 and Step 2 **pass**. Evidence from run: `diagnostics.status` 200, `hasContent` true, `contentPreview` `{"time":"21:49:18","timezone":"UTC"}`, `responseSent.hasResult` true. Network capture: 1 POST to `/function-call`, 1 response status 200 with `Access-Control-Allow-Origin: http://localhost:5173`. Step 3 fails only because `E2E_FUNCTION_CALL_DEBUG_LOG` is not set when the backend is started manually — the proxy writes that file only when the env is set (Playwright sets it when it starts the backend). So **browser→backend is verified** when the backend is user-started. **Backend log evidence:** With info logging enabled on the backend, logs will show the incoming POST to `/function-call` and the 200 response; the primary automated evidence is the test output above (diagnostics + network capture). Step 3 is a test-environment detail: assert only when Playwright started the backend (or when user sets the env). Test 6d skips Step 3 assertions when `E2E_USE_EXISTING_SERVER` is set so 6d can pass with user-started servers when steps 1–2 pass. To run 6d with your own backend and have it pass: `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6d"` (from test-app).
---

## Next steps

Given: integration test (3) passes (proxy↔API path works); E2E 6/6b alignment is done; function-call-tracker passes (component receives the request). The break is **downstream** — backend, proxy `function_call_output`, or model.

| Priority | Action | Purpose |
|----------|--------|--------|
| **1** | **Confirm backend during E2E** | When running E2E 6/6b, ensure `npm run backend` is running on the same host/port the test-app uses (e.g. 8080). Run `test-app/tests/function-call-endpoint-integration.test.js` to verify the same backend implementation returns time; then run E2E with that backend up. |
| **2** | **Automated instrumentation and assertions** | Use existing `__functionCallDiagnostics` and proxy debug file (test 6d); extend with E2E network capture (Playwright request/response interception for `/function-call`) to assert OPTIONS/POST status and headers in the test. That identifies which link fails (backend not called, backend error, proxy not sending result, or API/model) without manual steps. |
| **3** | **Verify 3b** | Run `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "3b"` from test-app. If 3b fails, treat it as an open failure and track with 6/6b. |
| **4** | **Fix the failing link** | Once (1)–(2) show where the chain breaks (e.g. backend URL wrong in browser, proxy not sending `function_call_output`, or backend returns error), implement the fix and re-run 6 and 6b. |
| **5** | **Document** | Update this plan and [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) with findings and any code changes. |

---

## E2E test adjustments (for 6 and 6b to pass)

**Already in place:** Tests 6 and 6b use `setupFunctionCallingTest(page, { useBackend: true })`, `setupTestPageForBackend` with `enable-function-calling`, and `waitForFunctionCall` before asserting time. The test flow is correct; the failure is in the system under test (function flow), not the test design.

**Backend check (added):** When the backend does not support `get_current_time` (e.g. not running, or different implementation), the tests used to fail with fallback-text. Now tests 6 and 6b call `isGetCurrentTimeBackendReachable()` at the start and **skip with a clear message** if the check fails: *"Backend does not support get_current_time; start backend (e.g. npm run backend) or run without E2E_USE_EXISTING_SERVER so Playwright starts it"*. Helper: `test-app/tests/e2e/helpers/test-helpers.js` → `isGetCurrentTimeBackendReachable()` (derives backend URL from proxy endpoint and POSTs `get_current_time`; returns true only if the backend responds with 200).

**No other test changes required:** When Playwright starts the webServer (default), it starts both the dev server and `npm run backend` on port 8080, so the backend is up. When using `E2E_USE_EXISTING_SERVER=1`, the user must start the backend; the new check avoids a confusing failure. To make 6 and 6b **pass** (not just skip cleanly), the underlying function-flow defect must be fixed (see Next steps).

---

## Backend integration tests (Issue #489)

**`test-app/tests/backend-integration.test.js`** exercises the real backend (backend-server.js) as a single process: proxy WebSocket(s) and POST /function-call with CORS. It fills the gap between function-call-endpoint-integration.test.js (same backend code, isolated port, no CORS/proxy assertions) and E2E (browser → backend). Run from test-app: `npm test -- backend-integration`. Covers: (1) server and proxy — GET /, TCP, Deepgram proxy path reachable; (2) POST /function-call contract — get_current_time, timezone, unknown function, missing fields, X-Trace-Id; (3) CORS — OPTIONS with Origin returns 200 and preflight headers, POST with Origin returns Access-Control-Allow-Origin. Port 18408 (no clash with 18407 or 8080).

---

## TDD workflow

1. **RED:** Reproduce (or add failing unit/integration test).
2. **GREEN:** Minimal change to pass.
3. **REFACTOR:** Clean up; keep tests green.

---

## Success criteria

- [ ] 3b passes (assistant count and r1-in-history) — not resolved; verify with `--grep "3b"`.
- [ ] 6 and 6b pass (agent-response shows time/UTC after function call).
- [ ] `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js` → 0 failures (excluding existing skips).

---

## How to run

From test-app:

```bash
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js
```

**Run only the 2 failing tests (6 and 6b):**

```bash
cd test-app
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6. Simple function calling|6b. Issue #462"
```

Single test (e.g. 6 only):

```bash
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6. Simple function calling"
```

Other single test:

```bash
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "3b"
```

**Backend integration (no E2E):**

```bash
cd test-app
npm test -- backend-integration
```

---

## What to resolve next

| Priority | Item | Why |
|----------|------|-----|
| **1** | **Browser → backend for 6/6b** | Diagnostic 6d shows `errorMessage: "Failed to fetch"` — browser’s fetch to POST /function-call fails before any response. Backend integration tests (CORS + /function-call) pass when run from Node; the gap is browser → same backend (CORS or connection from app origin). **Automated resolution:** Extend 6d or add E2E test that uses Playwright to capture and assert on requests/responses to `/function-call` (OPTIONS + POST status and CORS headers); fix until that test and 6/6b pass. No manual inspection. |
| **2** | **Proxy response.done + function_call_output (G.6)** | Once the browser receives 200 from /function-call, the proxy must send `function_call_output` and the API must start the next turn. PLAN § G.6: when we receive `response.done` and `pendingResponseCreateAfterFunctionCallOutput` is true, send `response.create`. Implement and validate with real API; re-run 6/6b. |
| **3** | **Verify 3b** | Run `--grep "3b"` with real APIs; if it fails (assistant count or r1-in-history), track separately from 6/6b. |
