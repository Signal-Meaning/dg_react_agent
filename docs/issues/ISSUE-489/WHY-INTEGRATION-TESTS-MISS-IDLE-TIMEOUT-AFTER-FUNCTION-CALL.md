# Why API Integration Tests Don't Capture "Idle Timeout After Function Call" Defects

## Policy: E2E and real APIs

1. **E2E must guarantee protocol elements per proxy.** We must have E2E tests that guarantee the necessary protocol elements appear for **each** proxy (OpenAI and Deepgram). For example: after the client sends a function result, the client must receive at least one message that allows the component to clear "waiting for next agent message" (e.g. AgentThinking, ConversationText, or AgentAudioDone). E2E tests should assert this (e.g. via WebSocket capture) for the backend in use.
2. **All E2E tests should use real APIs at a minimum.** Validation of proxy and component behavior must run against the real provider APIs where possible. We still do not have complete coverage for the component in mocks; E2E is the primary place we validate the full path.
3. **Real API path first.** We always focus on getting the real API path implemented and working first; mock-only success is not sufficient for release qualification when the fix involves proxy or backend behavior.

## The defect (e.g. voice-commerce #1058 / Issue #487)

**Observed:** After the app sends a function result, the user is idle for 10+ seconds. **Expected:** Connection closes on idle timeout. **Actual (OpenAI path):** Connection never closes; E2E times out.

The root cause sits at the **intersection** of:

1. **Proxy:** Does it send a message to the client after the function result (e.g. AgentThinking, ConversationText, or AgentAudioDone) so the component can clear "waiting for next agent message"?
2. **Component:** Does it clear that state and start the idle timer when it receives such a message or agent-state signal?
3. **Real API:** Does the upstream send events (e.g. `response.output_text.done` or `response.done`) in an order and timing the proxy translates into a client message?

## Proxy logging and real-API integration test gap

**Upstream events on receipt:** The OpenAI proxy **does** log upstream events when it receives them. Every upstream **JSON** message is logged at INFO with `body: 'upstream → client'` and attribute `message_type: msg.type` (see `packages/voice-agent-backend/scripts/openai-proxy/server.ts`). So we can see in backend logs which event types the API sent. If we assume a proxy bug, the first check is: during the failing E2E run, does the proxy log `response.done` or `response.output_text.done` after the function call? If yes, the bug is in the proxy (e.g. not forwarding). If no, either the API did not send it or the proxy dropped it before the log.

**How to run E2E with proxy logs:** Run the backend in one terminal with `LOG_LEVEL=info` (e.g. `cd test-app && LOG_LEVEL=info npm run backend`). Run the E2E spec in another (e.g. `USE_PROXY_MODE=true npm run test:e2e -- test-app/tests/e2e/issue-373-idle-timeout-during-function-calls.spec.js`). Inspect the backend terminal for upstream message types; look for `response.done` or `response.output_text.done` after the function call completes.

**Real-API integration test gap:** We do **not** have an integration test that runs against the **real** OpenAI API and asserts that the **proxy** receives `response.done` or `response.output_text.done` (or equivalent) after the client sends a function result. The openai-proxy integration tests (`tests/integration/openai-proxy-integration.test.ts`) include real-API tests (USE_REAL_APIS=1) for function-call flow and other scenarios, but none that explicitly assert "proxy received a completion event from upstream after FunctionCallResponse." Adding such a test would show with real APIs whether the proxy receives and (optionally) logs those events, helping distinguish "API never sends completion" from "proxy bug." **See [PROTOCOL-ASSURANCE-GAPS.md](./PROTOCOL-ASSURANCE-GAPS.md)** for this and other critical protocol assurances that are missing real-API or explicit "proxy received upstream event" coverage.

## Why API integration tests don't catch it

### 1. They don't run the component

The OpenAI proxy integration tests (`tests/integration/openai-proxy-integration.test.ts`) use a **raw WebSocket client** that sends and receives JSON. They do **not** run the React component, so:

- There is no **IdleTimeoutService**, no "waiting for next agent message" state, and no idle timer.
- There is no assertion that "connection closes after idle timeout following a function call."
- The tests can assert only that the **proxy** sends certain messages to the client (e.g. ConversationText, AgentAudioDone). They cannot assert that the **component** then starts the idle timer and closes the connection.

So any defect that depends on **component state + idle timeout** is invisible to these tests.

### 2. They assert protocol translation, not end-to-end behavior

Integration tests assert **protocol translation** in isolation, for example:

- Client sends `FunctionCallResponse` → proxy sends `conversation.item.create` (function_call_output) to upstream.
- Mock sends `response.output_text.done` → proxy sends ConversationText + AgentAudioDone to client.

They do **not** assert:

- "Within N seconds of the client sending FunctionCallResponse, the client receives at least one message that would allow the component to clear 'waiting for next agent message' (e.g. AgentThinking, ConversationText, or AgentAudioDone)."

So if the **real** API never sends `response.output_text.done` or `response.done` in time (or at all), the integration test with the **mock** still passes (because the mock is controlled to send those events). The test never fails when the proxy fails to send a client message after the function result.

### 3. Mock upstream hides real API timing and ordering

The mock is scripted: e.g. "when you receive function_call_output, send response.done." The **real** API may:

- Send events in a different order.
- Take much longer to send the next event.
- Omit an event the mock always sends.

So integration tests that only run against the mock do not validate that the **proxy** sends something to the client in the real-world case (e.g. immediately after FunctionCallResponse, or within a bounded time). The proxy fix (e.g. sending AgentThinking as soon as we send the function result) is not covered by an integration test that asserts "we received ConversationText after the mock sent output_text.done."

### 4. Component integration tests use mocks, not the proxy

The component-level test for this scenario (`issue-487-idle-timeout-after-function-result-component.test.tsx`) **mocks** WebSocketManager and AudioManager. It injects a single FunctionCallRequest and asserts "we don't close within 9.5s" and "we do close after function result when ConversationText (assistant) received and no audio (muted)." It does **not** talk to the real proxy and does **not** assert "we **do** close after 10s when the **real** backend sends a completion signal." So it cannot fail when the proxy (or real API) never sends that signal.

## What captures this defect

1. **E2E test (existing):** The test "should re-enable idle timeout after function calls complete" in `issue-373-idle-timeout-during-function-calls.spec.js` runs the **real component** and **real proxy** (with real APIs). It asserts that after a function call and 12s idle, the idle timeout fires or the connection closes. That targets this defect; it fails when the proxy (or API) never sends a message that lets the component clear the flag. **Current state:** This test fails on the OpenAI path (timeout never fires).

2. **E2E protocol contract (added):** An E2E test guarantees that **for the proxy in use** (OpenAI or Deepgram), after the client sends FunctionCallResponse the client receives at least one of: AgentThinking, ConversationText (assistant), or AgentAudioDone. This is asserted via WebSocket capture so we guarantee the necessary protocol elements appear for each proxy. See `issue-373-idle-timeout-during-function-calls.spec.js` ("should receive protocol signal after function call (AgentThinking or equivalent)").

3. **Integration test (added):** The OpenAI proxy integration test suite includes a **protocol contract** test: "Within N ms of the client sending FunctionCallResponse, the client receives at least one of: AgentThinking, ConversationText (assistant), or AgentAudioDone." This catches a proxy that never sends any of those after the function result (e.g. regression removing the AgentThinking send). It does not assert component behavior; it isolates proxy vs component. See `tests/integration/openai-proxy-integration.test.ts` (Issue #487 protocol contract). This test uses the **mock** upstream; there is no integration test with **real** API that asserts the proxy receives upstream completion events after function call.

### Similar protocol contract tests

Other critical transitions that could be covered by similar contract tests if we want to lock protocol behavior:

- **After Settings:** Client receives SettingsApplied within N ms (already implied by many tests that wait for SettingsApplied before proceeding).
- **After InjectUserMessage:** Client receives ConversationText (user) echo within N ms (proxy sends user echo immediately; could add an explicit contract test).
- **After upstream sends function_call_arguments.done:** Client receives FunctionCallRequest (and optionally ConversationText) in order (existing mock-only test covers order).

The FunctionCallResponse → AgentThinking-or-equivalent contract is the one that was missing and that we added; the others are either already covered or lower risk.

## Summary

| Test type | Runs component? | Runs proxy? | Upstream | Asserts idle timeout after function call? | Asserts protocol after FunctionCallResponse? | Asserts proxy receives completion from real API? |
|-----------|-----------------|-------------|----------|-------------------------------------------|---------------------------------------------|--------------------------------------------------|
| openai-proxy-integration | No (raw WS client) | Yes | Mock or real | No | **Yes** (Issue #487 contract) | **No** |
| issue-487 component test | Yes | No (mocked WS) | N/A | No (only "don't close within 9.5s"; "do close when ConversationText + muted") | No | No |
| issue-373 E2E "re-enable idle timeout..." | Yes | Yes | Real | **Yes** (currently failing) | — | No |
| issue-373 E2E "should receive protocol signal after function call" | Yes | Yes | Real | — | **Yes** (per proxy) | No |

E2E tests should use real APIs at a minimum; we still do not have complete component coverage in mocks. Proxy logs every upstream JSON message type at INFO; run backend with LOG_LEVEL=info during E2E to see what the API sent. We do not yet have an integration test with real API that asserts the proxy receives completion events after function call.

## Current test state

- **issue-373 E2E** (`issue-373-idle-timeout-during-function-calls.spec.js`): 4 passed, 1 failed. The failing test is "should re-enable idle timeout after function calls complete" (idle timeout never fires; connection never closes). All five tests use the real proxy and real API when the backend is running.
- **issue-487 component integration**: Both tests pass (do not close within window; do close when ConversationText assistant received and muted).
- **issue-489 greeting idle timeout**: Both tests pass.
- To see proxy logs during E2E: run the backend in a separate terminal with `LOG_LEVEL=info` (e.g. `cd test-app && LOG_LEVEL=info npm run backend`), then run the E2E spec and inspect the backend terminal for upstream `message_type` (e.g. `response.done`, `response.output_text.done`) after the function call.
