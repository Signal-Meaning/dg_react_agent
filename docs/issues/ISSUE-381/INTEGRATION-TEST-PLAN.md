# Issue #381: Integration Test Plan (OpenAI Realtime Proxy)

Integration tests target **the proxy as a WebSocket server** and its **contract with the dg_react_agent component**: real WebSocket connections, but optionally a mocked OpenAI upstream.

## TDD Approach

1. **RED**: Write an integration test that connects to the proxy, sends a client event, and asserts the proxy’s response or downstream behavior. Run and see it fail (e.g. proxy not implemented or wrong path).
2. **GREEN**: Implement or adjust the proxy server so the test passes.
3. **REFACTOR**: Improve server structure; re-run tests.

## Suggested Location

- `tests/integration/openai-proxy-integration.test.ts` or under `test-app/scripts/` if the proxy lives there.
- Use a real WebSocket client (e.g. `ws` in Node) to connect to the proxy; upstream can be a mock WebSocket server that simulates OpenAI.

## Behaviors to Test (Write Tests First)

### 1. Proxy server lifecycle

- Server listens on the configured path (e.g. `/openai`) and port (e.g. 8080).
- Accepts WebSocket upgrade; connection is established.
- Closes cleanly on shutdown (no hanging connections).

### 2. Connection and session bootstrap

- Client connects and sends `session.update` with `session.type: "realtime"` (and any required fields). Proxy forwards to upstream (or mock) and does not close the connection.
- Client receives a `session.created`-like event (or equivalent) from the proxy after successful upstream session creation.

### 3. Inject user message (component → proxy → upstream)

- Client sends a message equivalent to **InjectUserMessage** / **conversation.item.create** (user text). Proxy translates to OpenAI Realtime format and sends to upstream.
- Upstream (mock) responds with a text or audio response. Proxy translates back and sends to client; test asserts the client receives the expected event type and payload shape.

### 4. Component contract (dg_react_agent)

- Events that the **component** sends (e.g. Settings, InjectUserMessage, conversation items) are correctly translated by the proxy into OpenAI Realtime client events.
- Events that the **component** expects (e.g. ConversationText, agent audio, errors) are correctly produced by the proxy from OpenAI Realtime server events. Tests can use a mock upstream that emits known server events and assert the proxy sends the expected format to the client.

### 5. Error and disconnect handling

- Upstream closes with code 1000 (or error code): proxy closes the client connection and does not leave the client in a stuck state.
- Upstream returns an error event: proxy maps it to the format the component expects; test asserts client receives an error event.

### 6. Authentication

- If the proxy is required to add an API key or token when calling OpenAI, test that the proxy uses the configured credential and does not leak it to the client (e.g. test that client never receives the raw key).

### 7. Function-call round-trip (implemented)

- Mock upstream sends `response.function_call_arguments.done`; proxy sends **FunctionCallRequest** to client. Client sends **FunctionCallResponse**; proxy sends `conversation.item.create` (item type `function_call_output`) and `response.create` to upstream. Test asserts client received FunctionCallRequest with correct id/name and upstream received function_call_output.

### 7a. Function-calling API gap (implemented)

- **Transcript-only path:** When upstream sends *only* `response.output_audio_transcript.done` or `response.output_text.done` with content "Function call: …" (no `response.function_call_arguments.done`), proxy sends only **ConversationText**. Client does *not* receive **FunctionCallRequest**. Tests document E2E behavior when the real API sends function-call info only in transcript.
- **Order when both:** When upstream sends `output_audio_transcript.done` then `response.function_call_arguments.done`, proxy sends ConversationText (from transcript), then FunctionCallRequest, then ConversationText (from .done). Client receives CT, FCR, CT so the component gets both display and handler.

### 8. User echo (implemented)

- When client sends **InjectUserMessage**, proxy echoes **ConversationText** (role `user`) with same content to the client so the app can add the message to conversation history (context on reconnect). Test asserts client receives ConversationText (user) with matching content.

### 9. Context in Settings (implemented)

- When client sends **Settings** with `agent.context.messages`, proxy sends `session.update` then one **conversation.item.create** per context message (user/assistant) to upstream. Test asserts upstream received session.update and N conversation.item.create with correct roles.

## Implementation Notes

- **Mock upstream**: Implement a small WebSocket server that simulates OpenAI Realtime (sends `session.created`, `response.output_text.done`, etc.) so integration tests do not depend on the live OpenAI API.
- **Real WebSocket**: Use real TCP/WebSocket for the proxy; avoid mocking the WebSocket layer in integration tests so we validate the actual server behavior.
- Run integration tests in CI; keep them reasonably fast (e.g. short timeouts, single connection per test where possible).

## Acceptance

- All integration tests pass.
- Each test was written before the implementation that made it pass (or the implementation was adjusted to satisfy the test).
