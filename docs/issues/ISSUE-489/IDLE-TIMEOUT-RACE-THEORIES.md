# Idle Timeout After Function Call — Race Condition Theories

This doc captures theories for why the E2E test "should re-enable idle timeout after function calls complete" fails and what might fix it (especially in the proxy).

## Proxy logging and test gaps (assume proxy bug)

**Upstream events on receipt:** The OpenAI proxy **does** log upstream events when it receives them. Every upstream **JSON** message is logged at INFO with `body: 'upstream → client'` and attribute `message_type: msg.type` (see `server.ts`). So we can see in backend logs which event types the API sent. If `response.done` or `response.output_text.done` never appears after a function call, either the API did not send it or a proxy bug dropped it before the log (e.g. parse error or wrong branch).

**Real-API integration test:** We do **not** have an integration test that runs against the **real** OpenAI API and asserts that the proxy receives `response.done` or `response.output_text.done` (or equivalent) after the client sends a function result. The openai-proxy integration suite has real-API tests (USE_REAL_APIS=1) for function-call flow and other scenarios, but none that explicitly assert "proxy received completion event from upstream after FunctionCallResponse." Adding such a test would show whether the real API sends those events and whether the proxy logs and forwards them.

**How to run E2E with proxy logs:** Run the backend in one terminal with `LOG_LEVEL=info` (e.g. `cd test-app && LOG_LEVEL=info npm run backend`), then run the E2E spec in another (e.g. `USE_PROXY_MODE=true npm run test:e2e -- test-app/tests/e2e/issue-373-idle-timeout-during-function-calls.spec.js`). Inspect the backend terminal for `message_type: response.done` or `message_type: response.output_text.done` after the function call.

## 1. Client: AGENT_MESSAGE_RECEIVED before AGENT_STATE_CHANGED (ordering)

**What happens today**

- `WebSocketManager` calls `onAgentMessageReceived()` **before** `emit(message)`.
- So when we receive `AgentThinking`, the IdleTimeoutService handles `AGENT_MESSAGE_RECEIVED` first: it clears `waitingForNextAgentMessageAfterFunctionResult` and calls `updateTimeoutBehavior()`.
- At that moment the service's `currentState.agentState` is still the **previous** value (e.g. `idle`), because `AGENT_STATE_CHANGED` is driven by a **useEffect** that runs after the next React render (after the component processes the message and dispatches state).
- So we can briefly satisfy `canStartTimeout()` (idle, not waiting, etc.) and **start** the 10s timeout.
- Later, React re-renders, the effect runs, we get `AGENT_STATE_CHANGED` to `thinking` and stop the timeout. So we don't see the timeout fire from this race under normal timing.

**If it were a problem**

- If React batching or slow renders delayed `AGENT_STATE_CHANGED` long enough, we could fire the timeout while the UI is "thinking". So far this is theoretical; the more likely failure mode is that the component never sees "agent done" for the turn (see below).

**Possible client fix**

- In IdleTimeoutService, when handling `AGENT_MESSAGE_RECEIVED`, clear the "waiting" flag and stop the max-wait timer but **do not** call `updateTimeoutBehavior()`. Rely on the next event (e.g. `AGENT_STATE_CHANGED` to `thinking` or `idle`) to run `updateTimeoutBehavior()`, so we never start the idle timeout in the same tick as "message received" before the component has updated state.

---

## 2. Proxy/API: response.done only after response.create (deadlock)

**Theory**

- We defer `response.create` until we see `response.output_text.done` or `response.done` (to avoid `conversation_already_has_active_response`).
- If the **API** only sends `response.done` (or `response.output_text.done`) **after** we send `response.create` (e.g. "I'm done when you ask for the next turn"), we get a deadlock: we never send `response.create`, so the API never sends `response.done`. The requirement is **agent done** for the turn (idle enabled when agent is done). When **muted**, "done" is when text is displayed—the component must not insist on audio; when in "thinking" and ConversationText (assistant) has been received with no audio following, the component transitions to idle so the idle timeout can run (fixed in component; see tests in issue-487-idle-timeout-after-function-result-component.test.tsx).

**Implication**

- Without a "agent done" signal (when unmuted: end of audio; when muted: text displayed), the component stays in "thinking" (or "speaking") and the idle timer never starts; the E2E test never sees the timeout fire.

**Proxy-side fix (if API allows)**

- If the Realtime API contract allows it: when we have `pendingResponseCreateAfterFunctionCallOutput` and we receive `conversation.item.added` for the item we created (function_call_output), send `response.create` once. If the API then sends `response.done`, we send AgentAudioDone and the flow unblocks. If we get `conversation_already_has_active_response`, we'd need a different strategy (e.g. retry after a short delay or rely on another event). This depends on the real API's ordering guarantees.

---

## 3. Proxy: response.done vs response.output_text.done order

**Theory**

- If the API sends `response.done` **before** `response.output_text.done`, the proxy may send a completion signal twice. That's redundant but should not prevent the timeout; the client should still transition to idle on the first "agent done" signal.
- If the API sends `response.output_text.done` first, we're in the normal path. Ordering here is unlikely to be the root cause of "timeout never fires."

---

## 4. API never sends completion for function-call turn

**Theory**

- For the function-call turn, the real API might not send `response.done` or `response.output_text.done` at all (or only under conditions we don't meet). Then the proxy never sends a completion signal for that turn; when unmuted the component never sees "agent done" (end of audio) and the idle timeout never starts. When muted, the component can still treat "text displayed" (ConversationText assistant) as agent done and transition to idle.

**How to confirm**

- The proxy logs at INFO when it receives `response.done` or `response.output_text.done` (and logs every upstream JSON message type). Run E2E with the backend in another terminal (LOG_LEVEL=info) and check backend output. If neither completion type appears after a function call, the API is not sending completion for that turn (or a proxy bug prevents us from logging it).

**Proxy fix**

- Only if the API contract is known and allows it: send a completion signal to the client in some other case (e.g. when we see a specific upstream event that implies "turn done" for function calls). That would be a protocol-specific fix and must match the real API behavior.

---

## Summary

| Theory | Where | Likely fix |
|--------|--------|------------|
| AGENT_MESSAGE_RECEIVED before state update | Client (IdleTimeoutService) | Don't call `updateTimeoutBehavior()` in `AGENT_MESSAGE_RECEIVED`; let next event drive it. |
| response.done only after response.create | Proxy / API contract | Try sending `response.create` when we see item.added for our function_call_output (if API allows). |
| response.done vs output_text.done order | Proxy | Unlikely root cause; at most double completion signal. |
| API never sends completion | API / proxy | Confirm with proxy logs; proxy fix only if API has another "turn done" event we can map. |

The most plausible explanations for the failing E2E test are (2) or (4): either a deadlock with `response.create` / `response.done` ordering, or the API not sending completion for the function-call turn. Run backend with LOG_LEVEL=info during E2E to see which upstream events the proxy receives; add a real-API integration test that asserts proxy receives completion events after function call to distinguish API vs proxy bugs.
