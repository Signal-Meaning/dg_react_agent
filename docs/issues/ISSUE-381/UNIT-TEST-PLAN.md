# Issue #381: Unit Test Plan (OpenAI Realtime Proxy)

Unit tests target **proxy logic in isolation**: parsing, event mapping, session state, and any helpers. No live WebSocket or OpenAI API.

## TDD Approach

For each behavior below:

1. **RED**: Add a test that asserts the behavior; run and see it fail.
2. **GREEN**: Implement the minimal proxy logic to make the test pass.
3. **REFACTOR**: Clean up as needed; re-run tests.

## Suggested Test File(s)

- `tests/openai-proxy.test.ts` (or `test-app/scripts/__tests__/openai-proxy.test.ts` if the proxy lives under test-app)

## Behaviors to Test (Write Tests First)

### 1. Session / config handling

- Given a valid Realtime session config (type `realtime`, model, audio output), the proxy produces the correct upstream request or session.update payload.
- Given invalid or missing session type, the proxy rejects or normalizes appropriately (define expected behavior in test first).

### 2. Client event handling

- **session.update**: Parsed correctly; required fields (e.g. `session.type: "realtime"`) validated; forwarded or transformed as specified.
- **conversation.item.create** (e.g. user text): Parsed and mapped to OpenAI Realtime format; test expected output shape.
- **response.create**: Parsed and triggers correct upstream call (test with mock upstream).

### 3. Server event handling (from OpenAI)

- **session.created**: Parsed; relevant fields exposed or forwarded for the component.
- **conversation.item.added** / **conversation.item.done**: Parsed and mapped to the format the component expects (align with dg_react_agent contract).
- **response.output_text.done**, **response.output_audio.done**: Parsed and transformed into component events (e.g. ConversationText, audio chunks).
- **error**: Parsed and mapped to component error callback or state.

### 4. Protocol mapping (component ↔ OpenAI Realtime)

- Map **Deepgram/Voice Agent style** messages (e.g. Settings, InjectUserMessage, ConversationText) to **OpenAI Realtime** client events (session.update, conversation.item.create, etc.) – test mapping functions with known inputs/outputs.
- Map **OpenAI Realtime** server events to **component** events – test mapping functions with known inputs/outputs.

### 5. Edge cases and errors

- Malformed JSON: test that the proxy logs or returns a safe error and does not crash.
- Missing required fields in client events: test validation and error response.
- Empty or unexpected event types: test that the proxy handles them without throwing.

## Implementation Notes

- Use **mocks** for the upstream OpenAI WebSocket (or HTTP) so unit tests do not call the real API.
- Keep tests **fast** and **deterministic**; no real I/O in unit tests.
- After each slice (e.g. “session.update handling”), run the full unit suite and fix any regressions.

## Acceptance

- All unit tests for the OpenAI proxy pass.
- Every public behavior of the proxy module is covered by at least one test that was written before the implementation that made it pass.
