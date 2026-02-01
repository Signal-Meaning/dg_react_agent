# Issue #381: E2E Test Plan (OpenAI Realtime Proxy)

E2E tests run in a **real browser** against the **test-app** with **VITE_OPENAI_PROXY_ENDPOINT** set to the OpenAI proxy (e.g. `ws://localhost:8080/openai`). They validate full user flows: connect, send message, receive response, multi-turn, reconnection, audio, and function calling.

**Reuse first**: The tests in this plan need not be new. Prefer reusing existing E2E tests and pointing the environment at the other proxy (e.g. `VITE_OPENAI_PROXY_ENDPOINT` instead of `VITE_DEEPGRAM_PROXY_ENDPOINT`). Same test file, same helpers (e.g. `setupTestPageWithDeepgramProxy` → `setupTestPageWithOpenAIProxy` or URL param `proxyEndpoint`). Add new specs only when no existing test covers the behavior.

## TDD Approach

1. **RED**: Add an E2E test that performs a user action and asserts an outcome (e.g. “after sending ‘hi’, agent response is visible”). Run against the current app; if the proxy is missing or broken, the test fails.
2. **GREEN**: Implement or fix the OpenAI proxy (and app integration) so the test passes.
3. **REFACTOR**: Adjust test or app for clarity; re-run E2E.

**Real API first**: Always build a passing E2E test against the real OpenAI Realtime API before developing or introducing a mock. Mocks are for speeding up or stabilizing tests once the real-API flow is green.

## Test File(s)

- **Existing**: `test-app/tests/e2e/openai-inject-connection-stability.spec.js` (single test: inject “hi”, expect agent response).
- **Reuse**: Prefer existing specs—e.g. `text-session-flow.spec.js`, `backend-proxy-mode.spec.js`, `dual-channel-text-and-microphone.spec.js`, `function-calling-e2e.spec.js`, `issue-351-function-call-proxy-mode.spec.js`—run with `VITE_OPENAI_PROXY_ENDPOINT` (and a setup helper that points the app at the OpenAI proxy). Same test file, different proxy endpoint.
- **New/expanded**: Add new specs only when no existing test covers the behavior (e.g. a dedicated `openai-proxy-e2e.spec.js` for OpenAI-only cases if desired).

Use **VITE_OPENAI_PROXY_ENDPOINT** (and optional skip when unset) so these run only when the OpenAI proxy is available; same pattern as existing OpenAI E2E.

## Behaviors to Test (Write Tests First)

### 1. Connection

- **Connect through OpenAI proxy**: Load app with `proxyEndpoint= VITE_OPENAI_PROXY_ENDPOINT`. Assert connection status becomes “connected” within timeout.
- **Settings/session**: After connection, assert that the component has received session/settings (e.g. DOM or callback indicates “ready” or “settings applied”) so that injectUserMessage is allowed.

### 2. Single message (existing + strengthen)

- **Inject user message, receive agent response**: Send one text message (e.g. “hi”) via the text input (injectUserMessage flow). Assert that an agent response appears in the UI within a reasonable timeout (e.g. 15s). This is the current openai-inject-connection-stability test; keep it and ensure it stays green.

### 3. Basic audio test

- **Send recorded audio, receive audio response shown as text in Message Bubble**: Test sends pre-recorded audio (e.g. via `loadAndSendAudioSample` from `test-app/tests/e2e/fixtures/audio-helpers.js`) to the agent; agent responds with audio that is translated to text and shown in the Message Bubble (`[data-testid="agent-response"]`). Assert that an agent response appears after the audio input (e.g. `waitForAgentResponse`). **Reuse**: Run the same flow as in `dual-channel-text-and-microphone.spec.js` or `simple-mic-test.spec.js` (or equivalent) with the app pointed at the OpenAI proxy (`VITE_OPENAI_PROXY_ENDPOINT`). No new test file required if an existing audio test is parameterized by proxy endpoint or run twice (Deepgram proxy, then OpenAI proxy).

### 4. Simple function calling test

- **Trigger client-side function call and see response in UI**: Connect with a session that includes tools/functions; send a message that triggers a function call; assert that the function is invoked (e.g. callback or DOM) and that the agent’s follow-up response appears in the Message Bubble. **Reuse**: Run the same flow as in `function-calling-e2e.spec.js` or `issue-351-function-call-proxy-mode.spec.js` with the app pointed at the OpenAI proxy. Same test file, different proxy endpoint (e.g. `setupTestPageWithOpenAIProxy` or URL param).

### 5. Multi-turn

- **Sequential messages**: After first message and response, send a second message (e.g. “What did I just say?”). Assert second agent response appears. Validates that the connection stays open and the session supports multiple exchanges (addresses issue #380–style behavior).

### 6. Reconnection

- **Disconnect then send**: Disconnect the session (e.g. stop button or simulate disconnect). Send a new message. Assert that the app reconnects (or re-establishes session) and the user receives a response. Validates reconnection path with the OpenAI proxy.

**OpenAI Realtime API timeout/idle behavior**: Session duration is documented as up to **60 minutes** (post-GA). A specific **idle timeout** (e.g. how long with no activity before the server closes the connection) is not clearly documented in the official Realtime API docs. Community reports mention WebSocket disconnects (e.g. close code 1006) and disconnects after `session.update`. Reconnection E2E tests should cover both **user-initiated** disconnect (stop button) and **server-side** closure (e.g. after idle or upstream close), so the app and proxy handle both cases. See [Realtime API session timeout (post-GA)](https://community.openai.com/t/realtime-api-session-timeout-post-ga/1357331) and [Developer notes on the Realtime API](https://developers.openai.com/blog/realtime-api/).

### 7. Error handling

- **Proxy unavailable**: With proxy down or wrong URL, assert that the app shows an appropriate error or connection state (e.g. “closed” or error message) and does not hang indefinitely.
- **Upstream error**: If feasible (e.g. proxy returns an error event), assert that the UI or connection state reflects the error appropriately.

### 8. Parity with Deepgram proxy E2E

- **Same flows as Deepgram**: Where applicable, mirror the structure of `text-session-flow.spec.js` and `backend-proxy-mode.spec.js` for the OpenAI proxy: connection, settings, first message, sequential messages, disconnect/reconnect. This gives a “comprehensive” OpenAI proxy E2E suite and ensures the component works with both backends.

## Implementation Notes

- **Reuse by proxy endpoint**: Run the same E2E test file against Deepgram proxy (e.g. `VITE_DEEPGRAM_PROXY_ENDPOINT` / `setupTestPageWithDeepgramProxy`) or OpenAI proxy (e.g. `VITE_OPENAI_PROXY_ENDPOINT` / `setupTestPageWithOpenAIProxy`) via URL param or helper. Parameterize or duplicate the describe block with a different `proxyEndpoint` so one suite runs against Deepgram and one against OpenAI where applicable.
- **Skip when proxy not set**: Use `skipIfNoOpenAIProxy()` (or equivalent) so E2E that require the OpenAI proxy are skipped when `VITE_OPENAI_PROXY_ENDPOINT` is not set (e.g. in CI without an OpenAI proxy).
- **Timeout**: Use timeouts that allow for real API latency (e.g. 15–30s for agent response).
- **Existing component tests**: Run the full component test suite with the OpenAI backend (e.g. by pointing the test app at the OpenAI proxy). All existing tests must pass; add new E2E only for new behaviors.

## Acceptance

- All E2E tests in the OpenAI proxy suite pass when the proxy is running and `VITE_OPENAI_PROXY_ENDPOINT` is set.
- The existing openai-inject-connection-stability test remains and passes.
- At least: connection, single message, **basic audio** (send recorded audio → agent audio response → text in Message Bubble), **simple function calling**, multi-turn, and reconnection are covered by E2E tests (reused where possible; tests need not be new).
- Where possible, the same test files run against both Deepgram and OpenAI proxies by pointing the environment at the other proxy.
