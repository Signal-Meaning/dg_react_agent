# Issue #522: Findings from integration vs E2E runs

**Source:** Terminal output from same environment (backend + test-app running; real API). See DEFECT-ISOLATION-PROPOSAL.md for hypotheses and next steps.

---

## Summary

- **Integration tests (real API)** — **all pass**, including function-call flow and AgentAudioDone.
- **E2E tests 6 and 6b** — **fail** at the same assertion: `agent-response` never shows the time; it stays on the greeting.
- **E2E test 6d** — **passes**: backend POST /function-call returns 200, app sends the result.

So: the **proxy logic works** when the proxy runs in-process (integration). It **fails in E2E** where the proxy runs as a **subprocess** behind a **forwarder**. Backend and app path are confirmed by 6d.

---

## What was run

1. **Integration (repo root)**  
   `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`  
   - Proxy: **in-process** (Jest `beforeAll` creates HTTP server + `createOpenAIProxyServer`, connects **directly** to `wss://api.openai.com/...`).  
   - Client: **Node WebSocket** (Jest).  
   - Result: **18 passed**, including:
     - `Issue #470 real-API: function-call flow completes without conversation_already_has_active_response (USE_REAL_APIS=1)` (4048 ms)
     - `Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone (proxy received completion)` (985 ms)

2. **E2E (test-app, existing server)**  
   `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js`  
   - Proxy: **subprocess** (`npx tsx scripts/openai-proxy/run.ts` on port 8081, spawned by backend).  
   - Path: **browser → backend :8080 (forwarder) → subprocess proxy :8081 → real API**.  
   - Client: **browser** (test-app + component).  
   - Result: **6 and 6b failed** (timeout waiting for time pattern; `agent-response` stayed "Hello! How can I assist you today?"). **6d passed** and showed POST /function-call 200, `responseSent.hasResult: true`.

---

## Implications

1. **Same proxy code** (`server.ts`) is used in both flows. So the difference is **topology and/or environment**, not a missing branch in the proxy.
2. **Backend and app path are OK**: 6d shows the app got FunctionCallRequest, called POST /function-call (200), and sent the result. So the defect is **after** the app sends FunctionCallResponse (proxy → API → proxy → client/UI).
3. **Possible causes for E2E-only failure:**
   - **F1. Subprocess / forwarder:** Subprocess proxy or the WebSocket forwarder (attach-upgrade.js `createOpenAIWss`) drops, reorders, or mis-handles frames (e.g. binary vs text) so completion or the next turn never reaches the browser. Forwarder code is a simple pipe (`data`, `isBinary`); still worth confirming with logs.
   - **F2. API session / timing:** Integration and E2E use **different** API sessions (different connections). The real API might sometimes not send `response.done` / `response.output_text.done` after `function_call_output` in the E2E session (timing, rate limit, or session-specific behavior). Integration would then pass “by luck” in a session that did send completion.
   - **F3. Component / test-app (hypothesis E):** The browser receives the follow-up (ConversationText with time and/or AgentAudioDone) but the test-app or component does not update `[data-testid="agent-response"]`. Less likely if the forwarder is a dumb pipe, but we have not yet confirmed whether the **client** (browser) ever receives the follow-up.

---

## 6d diagnostic (step 1–2)

6d output showed:

- `POST /function-call` → 200, CORS, body with `"time":"18:07:27","timezone":"UTC"`.
- `responseSent`: `hasResult: true`, `hasError: false`.

So the backend received the function result and the app sent it; the defect is **downstream** (proxy ↔ API or proxy → client).

---

## Next steps (aligned with DEFECT-ISOLATION-PROPOSAL)

1. **Backend/proxy logs (E2E run)**  
   Run backend with `LOG_LEVEL=debug` and, if available, `CAPTURE_UPSTREAM_AFTER_FCR=1`. Run E2E 6 or 6b once, then inspect:
   - Backend stdout/stderr (and any log file if used).
   - Subprocess proxy: does it log "Received response.done from upstream" or "response.output_text.done" after sending function_call_output? Does it log the contract violation (timeout)?
   - `test-results/upstream-after-function-call.json` (if CAPTURE_UPSTREAM_AFTER_FCR=1): do we see `response.done` or `response.output_text.done` in the captured window?
   - `test-results/e2e-function-call-output.json` (when LOG_LEVEL=debug): confirms function_call_output was sent; optional for this defect.

2. **E2E diagnostic (proposal step 5)**  
   In test-app test mode, expose last N agent protocol messages (e.g. `window.__lastAgentMessages`). In 6 or 6b, after timeout (or when the assertion fails), read that and check whether **ConversationText (assistant)** with time-like content or **AgentAudioDone** was ever received. That distinguishes:
   - Proxy/forwarder never sent follow-up (F1/F2) vs  
   - Client received it but UI did not update (F3).

3. **Step 0 outcome**  
   In the same run, **test 6 and 6b both failed** at the same line (time pattern). So the failure is the **shared** post–function_call_output path (no time in UI), not 6b’s strict error assertion. Focus isolation on that path.

---

## E2E run with debug attempt + Playwright snapshot

**Run:** Backend restarted (user intended `LOG_LEVEL=debug`); then E2E test 6 run via `--grep '6\.'`. Test failed again at the same assertion (agent-response never showed time).

### Backend log level

The `backend:log` script in test-app was **overriding** `LOG_LEVEL`: it ran `LOG_LEVEL=info node scripts/backend-server.js`, so `LOG_LEVEL=debug npm run backend:log` did **not** pass debug to the backend (backend saw `info`). **Fix:** `backend:log` was updated to run `node scripts/backend-server.js` without setting LOG_LEVEL, so the caller’s env (e.g. `LOG_LEVEL=debug npm run backend:log`) is respected. For a true debug run, use `LOG_LEVEL=debug npm run backend:log` after this fix and inspect the timestamped log (and subprocess proxy output) for "Received response.done", "response.output_text.done", or "Required upstream contract violated".

### Playwright error-context snapshot (at failure)

From `test-results/.../error-context.md` for the failing test 6:

- **Core Component State (agentState):** `thinking` — Component never left "thinking"; it did not receive a completion signal (e.g. AgentAudioDone) or the next assistant message that would clear it.
- **Session:** `closed` (and "closedclosed" in UI) — The WebSocket session was **closed** at snapshot time. So the connection dropped before (or without) the client receiving the follow-up.
- **Agent Response:** "Hello! How can I assist you today?" (greeting only).
- **Conversation History:** (1) assistant: Hello! How can I assist you today? (2) user: What time is it? — No second assistant message (time). So the client either never received ConversationText (assistant) with the time, or the connection closed before it could be applied.
- **Settings Applied:** "false" at snapshot — May reflect session/connection state at capture time.
- **User Message from Server:** "What time is it?" — User message was sent; function-call flow was triggered from the app’s perspective.

**Conclusion from snapshot:** The WebSocket was **closed** and the component stayed in **thinking**. That supports **F1/F2**: the connection (proxy, forwarder, or API) likely closed before the follow-up (completion + next turn) could be delivered to the browser. Next: (1) Run backend with actual `LOG_LEVEL=debug` (using the fixed script) and capture backend/subprocess logs during E2E 6 to see whether the proxy logged completion or contract violation and whether the subprocess or forwarder closed the connection; (2) Add E2E diagnostic (step 5) to confirm whether the client ever received any follow-up message before close.

---

## Debug log analysis (LOG_LEVEL=debug run)

Backend was run with `LOG_LEVEL=debug npm run backend:log` (fixed script); E2E test 6 was run against it. Test failed again (agent-response stayed on greeting). Subprocess proxy debug output (connection c2) shows the following.

### Event order (c2)

1. Settings → session.updated → greeting sent to client.
2. InjectUserMessage → upstream sends conversation.item.added/done (user "What time is it?"), response.created, response.output_item.added, conversation.item.added (function_call get_current_time), response.function_call_arguments.done, conversation.item.done, response.output_item.done.
3. **upstream → client: response.done** — proxy logs *"Received response.done from upstream — sending AgentAudioDone to client"*. This is for the **function-call-request** turn (API finished requesting the function), not for the turn after we send the result.
4. **debug Function call request** (POST /function-call to backend).
5. **client → upstream: FunctionCallResponse** → *"FunctionCallResponse from client → function_call_output sent to upstream"*.
6. **upstream → client:** conversation.item.added (function_call_output, `"time":"21:25:34","timezone":"UTC"`), conversation.item.done.
7. **No** response.done or response.output_text.done after the function_call_output.
8. **upstream closed** — `upstream.close_code: 1005`, `upstream.close_reason: ''`. Timestamp ~10 s after the function_call_output item.

### Root cause (from this log)

- After we send **function_call_output**, the API sent only **conversation.item.added** and **conversation.item.done** for that item (ack of our result). It did **not** send **response.done** or **response.output_text.done** for that response.
- So the proxy never cleared `pendingResponseCreateAfterFunctionCallOutput` and never sent the deferred **response.create** (the 20 s timeout would do so, but the connection closed first).
- About **10 s** after the function_call_output, the **upstream closed** the WebSocket (1005, no reason). The client saw the connection close (Session closed, agentState stuck in "thinking") and never received a follow-up assistant message.

**Conclusion:** **Hypothesis A is confirmed** for this run: the real API did not send response.done or response.output_text.done after function_call_output. It acknowledged the result (item.added/done) then closed the connection before our 20 s timeout. So the defect is **upstream not fulfilling the required contract** (REQUIRED-UPSTREAM-CONTRACT.md) in this scenario.

**Spec and mitigation (implemented):** Per [OpenAI Realtime API: conversation.item.done](https://platform.openai.com/docs/api-reference/realtime-server-events/conversation-item-done), that event is "Returned when a conversation item is finalized." The spec does **not** require the API to send `response.done` after accepting a client-created function_call_output item; the API may only send `conversation.item.added` and `conversation.item.done`. We **can** treat `conversation.item.done` for an item of type `function_call_output` as the completion signal and send the deferred `response.create` in that case. The proxy now does so (REQUIRED-UPSTREAM-CONTRACT.md, server.ts). **Isolated test:** *"Issue #522: conversation.item.done (function_call_output) triggers deferred response.create; client gets next turn"* — mock sends only item.added + item.done (no response.done); asserts one response.create and client receives AgentAudioDone and ConversationText.

**E2E validation:** After deploying the item.done mitigation and restarting the backend, E2E tests 6 and 6b were run with real API (`E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep '6\.'` and `--grep '6b'`). **Test 6 passed** — agent-response showed the time (e.g. "The current time is 14:46 UTC."). **Test 6b passed** — function-call flow completes without conversation_already_has_active_response (partner scenario; 0 recoverable errors; e.g. "The current time is 14:57 UTC."). The real API sends item.added + item.done after function_call_output; the proxy advances the turn correctly and no duplicate/retry errors occur.

---

## References

- DEFECT-ISOLATION-PROPOSAL.md — hypotheses A–E, tests 1–6, recommended order.
- TDD-PLAN.md — Fix 1 & 2, recovery, follow-up.
- test-app/scripts/backend-server.js — spawns OpenAI proxy subprocess, sets E2E_FUNCTION_CALL_DEBUG_LOG when LOG_LEVEL=debug. test-app/package.json `backend:log` no longer overrides LOG_LEVEL so `LOG_LEVEL=debug npm run backend:log` works.
- packages/voice-agent-backend/src/attach-upgrade.js — `createOpenAIWss` forwarder (client ↔ subprocess proxy).
- Playwright error-context (test-results/.../error-context.md) — page snapshot at failure; shows agentState "thinking", Session "closed", no second assistant message.
