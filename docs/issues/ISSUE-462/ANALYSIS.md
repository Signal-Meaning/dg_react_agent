# Issue #462 – Log capture and analysis

**Date:** 2026-02-15  
**Capture method:** Local integration tests with `LOG_LEVEL=debug` (mock upstream).  
**Goal:** Establish baseline message order and identify why `conversation_already_has_active_response` still occurs at voice-commerce on 0.9.1/0.2.1.

---

## 1. Capture method

- **Tests run:** `tests/integration/openai-proxy-integration.test.ts` with `LOG_LEVEL=debug`.
- **Proxy logging:** `logLevel` is now passed from `process.env.LOG_LEVEL` into `createOpenAIProxyServer` in the integration test (for both mock and real-API runs). OTel `ConsoleLogRecordExporter` emits each proxy log line to the test run’s stdout.
- **Artifacts:**
  - `docs/issues/ISSUE-462/capture-issue459-test.log` – Issue #459 test (InjectUserMessage → item.added → response.create; client sends Settings while response active).
  - `docs/issues/ISSUE-462/capture-function-call-test.log` – Function-call flow (Settings → session.updated → function_call_arguments.done → client sends FunctionCallResponse → response.output_text.done).

Upstream in these runs is the **mock** (no real OpenAI), so we do not see `conversation_already_has_active_response`; we only see proxy message order and client↔upstream flow.

---

## 2. Log excerpt (message order)

### 2.1 Issue #459 test (no session.update while response active)

Proxy log sequence (body + `message_type` where present):

| # | body | message_type |
|---|------|--------------|
| 1 | client connected | — |
| 2 | upstream open | — |
| 3 | client → upstream | InjectUserMessage |
| 4 | upstream → client | conversation.item.added |
| 5 | client → upstream | Settings |
| 6 | upstream → client | response.output_text.done |
| 7 | upstream closed | — |

**Observation:** Client sends **Settings** after `conversation.item.added` but before the mock sends `response.output_text.done` (mock delays `.done`). The proxy does **not** log a second `client → upstream` with `session.update`; the test asserts the mock receives exactly one `session.update` (on first Settings) and none after `response.create`. So in this scenario the #459 gating behaves as intended: no `session.update` while response is active.

### 2.2 Function-call test (session.updated → function_call_arguments.done → FunctionCallResponse)

Proxy log sequence:

| # | body | message_type |
|---|------|--------------|
| 1 | client connected | — |
| 2 | upstream open | — |
| 3 | client → upstream | Settings |
| 4 | session.created received (waiting for session.updated…) | — |
| 5 | upstream → client | session.updated |
| 6 | upstream → client | response.function_call_arguments.done |
| 7 | upstream→client: response.function_call_arguments.done → sending FunctionCallRequest + ConversationText | — |
| 8 | client → upstream | FunctionCallResponse |
| 9 | upstream → client | response.output_text.done |
| 10 | upstream closed | — |

**Observation:** One Settings (→ one session.update), one FunctionCallResponse (→ conversation.item.create + response.create), then response.output_text.done. No extra session.update in this flow under the mock.

---

## 3. When does the proxy clear `responseInProgress`?

From `packages/voice-agent-backend/scripts/openai-proxy/server.ts`:

- **Set `true`:** when sending `response.create` (after item.added for InjectUserMessage; on FunctionCallResponse).
- **Set `false`:** on **either** `response.output_text.done` **or** `response.output_audio.done`.

So the proxy considers the response “done” as soon as **either** text or audio reports done. If the **real** OpenAI Realtime API sends `response.output_audio.done` **before** `response.output_text.done` for a turn, we clear `responseInProgress` on audio.done. A subsequent client message (e.g. Settings from a re-render or state update) would then cause the proxy to send `session.update` while the API might still consider the response active until `response.output_text.done`. That could produce `conversation_already_has_active_response`.

**Hypothesis for #462:** We may be clearing `responseInProgress` too early by clearing on the first of `output_audio.done` / `output_text.done`. The fix would be to clear only when the turn is fully done, e.g.:

- Clear only on `response.output_text.done` (if that is the canonical “turn done” for the API), or  
- Track both and clear only after **both** `response.output_audio.done` and `response.output_text.done` have been received for the current response.

(Exact behavior depends on OpenAI Realtime API semantics; may need to confirm with API docs or a real-API trace.)

---

## 4. Session.update and response.create counts (from tests)

- **session.update:** Integration test “Issue #459: does not send session.update while response is active” asserts the mock receives **one** `session.update` per connection (first Settings only) and **none** after `response.create` until the response completes. Our capture is consistent with that.
- **response.create:** In the function-call test the mock receives one `response.create` for the function-call result (after FunctionCallResponse). No duplicate response.create in the captured flow.

So under the mock we see the expected counts; the remaining risk is **ordering/timing with the real API** (e.g. audio.done before text.done and early clear of `responseInProgress`).

---

## 5. Next steps

1. **Confirm with real API or voice-commerce log:** Get a proxy log from a **failing** run (voice-commerce or local with real OpenAI and `LOG_LEVEL=debug`). Check for a second `session.update` or for Settings arriving immediately after an `output_audio.done` and before `output_text.done`.
2. **Implement and test fix:** If the hypothesis holds, change the proxy to clear `responseInProgress` only when the turn is fully done (e.g. only on `response.output_text.done`, or when both output_audio.done and output_text.done have been received for the current response). Re-run integration tests and, if possible, a real-API function-call flow.
3. **Optional:** Add proxy debug logs that explicitly record “session.update sent” and “responseInProgress cleared” so future captures make session.update count and clear timing obvious.
