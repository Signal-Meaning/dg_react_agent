# Required Upstream Contract: OpenAI Realtime API (function-call flow)

The proxy’s behavior after a **FunctionCallResponse** (sending `conversation.item.create` with `function_call_output`) depends on a **required contract** with the OpenAI Realtime API. We document it here and **enforce** it so violations are detected and the flow can recover instead of hanging.

---

## Contract

**After the client (via the proxy) sends `conversation.item.create` with type `function_call_output`, the proxy sends the deferred `response.create` when it receives any of:**

1. **`response.done`** — “Returned when a Response is done streaming. Always emitted, no matter the final state.” (Preferred when the API sends it.)
2. **`response.output_text.done`** — Same response lifecycle; proxy treats as completion.
3. **`conversation.item.done`** for an item of type **`function_call_output`** — Per [OpenAI Realtime: conversation.item.done](https://platform.openai.com/docs/api-reference/realtime-server-events/conversation-item-done): “Returned when a conversation item is finalized.” When the client sends `conversation.item.create` (e.g. function_call_output), the server adds the item and emits `conversation.item.added` and/or `conversation.item.done` when that item is finalized. The spec does **not** require the API to send a new `response.done` after accepting the function_call_output item; in practice the API may only send item confirmation. The proxy therefore treats **`conversation.item.done`** with **`item.type === 'function_call_output'`** as a valid completion signal and sends the deferred `response.create` immediately, so the next turn can start without waiting for `response.done`/`response.output_text.done`.

**Why:** The proxy defers sending the next `response.create` until it receives one of the above (Issue #522, #462, #470). That avoids `conversation_already_has_active_response`. If the API never sends any of these, the proxy would never send the deferred `response.create`; the 20s timeout (see Enforcement) unsticks in that case.

**References:**

- [OpenAI Realtime: response.done](https://platform.openai.com/docs/api-reference/realtime-server-events/response/done) — “Returned when a Response is done streaming. Always emitted, no matter the final state.”
- [OpenAI Realtime: conversation.item.done](https://platform.openai.com/docs/api-reference/realtime-server-events/conversation-item-done) — “Returned when a conversation item is finalized.”
- [OpenAI Realtime: response.create](https://platform.openai.com/docs/api-reference/realtime-client-events/response/create) — “Only one Response can write to the default Conversation at a time.”
- Proxy: `server.ts` (FunctionCallResponse branch; `response.done` / `response.output_text.done` / `conversation.item.done` for function_call_output); `PROTOCOL-AND-MESSAGE-ORDERING.md` §4.

---

## Enforcement

1. **Documentation:** This file and `PROTOCOL-AND-MESSAGE-ORDERING.md` state the contract so implementers and consumers know the assumption.

2. **Timeout in the proxy:** If the proxy has sent `function_call_output` and set `pendingResponseCreateAfterFunctionCallOutput`, it starts a timer (`DEFERRED_RESPONSE_CREATE_TIMEOUT_MS`, 20 seconds). If the upstream has not sent `response.done`, `response.output_text.done`, or `conversation.item.done` (for the function_call_output item) when the timer fires:
   - The proxy logs an **ERROR**: *“Required upstream contract violated: upstream did not send response.done, response.output_text.done, or conversation.item.done (function_call_output) after function_call_output within Nms.”*
   - The proxy then sends the deferred **`response.create`** anyway so the conversation can continue (next turn starts) instead of hanging until the client’s idle timeout.
   - This both **detects** the violation (logs, observable in backend/proxy logs) and **recovers** (user can still get a follow-up response).

3. **Tests:**
   - **Mock:** The integration mock sends `response.done` (or `response.output_text.done`) when it receives `function_call_output`, so the proxy’s expected path is tested. See `tests/integration/openai-proxy-integration.test.ts` (e.g. Issue #470).
   - **Real API:** The test *“Issue #489 real-API: after FunctionCallResponse client receives AgentAudioDone”* asserts that after the client sends FunctionCallResponse, the client receives a completion signal (AgentAudioDone) within a timeout. That implies the proxy received `response.done` or `response.output_text.done` from the real API. When `USE_REAL_APIS=1` and `OPENAI_API_KEY` is set, this test **enforces** that the real API satisfies the contract for the tested flow. For proxy/API releases, run this test (and E2E 6b) with the real API when keys are available; see release checklist and `docs/development/TEST-STRATEGY.md`.

---

## When the contract is violated (real API)

If in production the API does **not** send `response.done`, `response.output_text.done`, or `conversation.item.done` (for the function_call_output item) after a function result (e.g. for certain tools, payloads, or regions):

- **Before enforcement:** The proxy waited indefinitely; the client saw no agent follow-up and often hit idle timeout (“Idle timeout reached - closing agent connection”).
- **After enforcement:** After 20 seconds the proxy logs the contract violation and sends `response.create` anyway, so the next turn can start and the user may still get a reply. Backend/proxy logs will show the ERROR for investigation (e.g. with OpenAI, or to adjust timeout/behavior).

Consumers (e.g. voice-commerce) can check proxy/backend logs for *“Required upstream contract violated”* to confirm the API is not sending completion and escalate or adjust accordingly.
