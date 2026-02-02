# Issue #381: E2E Test Plan (OpenAI Realtime Proxy)

E2E tests run in a **real browser** against the **test-app** with **VITE_OPENAI_PROXY_ENDPOINT** set to the OpenAI proxy (e.g. `ws://localhost:8080/openai`). They validate full user flows: connect, send message, receive response, multi-turn, reconnection, audio, and function calling.

**Reuse first**: The tests in this plan need not be new. Prefer reusing existing E2E tests and pointing the environment at the other proxy (e.g. `VITE_OPENAI_PROXY_ENDPOINT` instead of `VITE_DEEPGRAM_PROXY_ENDPOINT`). Same test file, same helpers (e.g. `setupTestPageWithDeepgramProxy` → `setupTestPageWithOpenAIProxy` or URL param `proxyEndpoint`). Add new specs only when no existing test covers the behavior.

## TDD Approach

1. **RED**: Add an E2E test that performs a user action and asserts an outcome (e.g. “after sending ‘hi’, agent response is visible”). Run against the current app; if the proxy is missing or broken, the test fails.
2. **GREEN**: Implement or fix the OpenAI proxy (and app integration) so the test passes.
3. **REFACTOR**: Adjust test or app for clarity; re-run E2E.

**Real API first**: Always build a passing E2E test against the real OpenAI Realtime API before developing or introducing a mock. Mocks are for speeding up or stabilizing tests once the real-API flow is green.

## Test File(s)

- **Existing**: `test-app/tests/e2e/openai-inject-connection-stability.spec.js` (single test: inject “hi”, expect agent response). Now uses `setupTestPageWithOpenAIProxy`.
- **OpenAI proxy suite**: `test-app/tests/e2e/openai-proxy-e2e.spec.js` – connection, **greeting** (1b: proxy injects greeting; component shows greeting-sent), single message, multi-turn, reconnection, basic audio, simple function calling. Uses `setupTestPageWithOpenAIProxy` and `skipIfNoOpenAIProxy()`; all tests skip when `VITE_OPENAI_PROXY_ENDPOINT` is not set.
- **Reuse**: Prefer existing specs—e.g. `deepgram-text-session-flow.spec.js`, `deepgram-backend-proxy-mode.spec.js`, `dual-channel-text-and-microphone.spec.js`, `function-calling-e2e.spec.js`—run with `VITE_OPENAI_PROXY_ENDPOINT` via `setupTestPageWithOpenAIProxy` (or URL param `proxyEndpoint`) to run the same flows against the OpenAI proxy.
- **Helpers**: `setupTestPageWithOpenAIProxy(page)` and `getOpenAIProxyParams()` in `test-app/tests/e2e/helpers/test-helpers.js` and `test-helpers.mjs`.

Use **VITE_OPENAI_PROXY_ENDPOINT** (and optional skip when unset) so these run only when the OpenAI proxy is available; same pattern as existing OpenAI E2E.

## Behaviors to Test (Write Tests First)

### 1. Connection

- **Connect through OpenAI proxy**: Load app with `proxyEndpoint= VITE_OPENAI_PROXY_ENDPOINT`. Assert connection status becomes “connected” within timeout.
- **Settings/session**: After connection, assert that the component has received session/settings (e.g. DOM or callback indicates “ready” or “settings applied”) so that injectUserMessage is allowed.

### 1b. Greeting (Issue #381) — **Done**

- **Proxy injects greeting; component shows greeting-sent**: After connection, the proxy sends the component-provided `agent.greeting` (from Settings) as **ConversationText** (assistant) after **session.updated**. The test-app marks greeting as sent (`[data-testid="greeting-sent"]`). E2E test "1b. Greeting" in openai-proxy-e2e.spec.js asserts this selector appears within 10s after establishConnectionViaText.

### 2. Single message (existing + strengthen)

- **Inject user message, receive agent response**: Send one text message (e.g. “hi”) via the text input (injectUserMessage flow). Assert that an agent response appears in the UI within a reasonable timeout (e.g. 15s). This is the current openai-inject-connection-stability test; keep it and ensure it stays green.

### 3. Basic audio test

- **Send recorded audio; assert agent response appears in the test-app element with `data-testid="agent-response"`**: Test sends pre-recorded audio (e.g. via `loadAndSendAudioSample` from `test-app/tests/e2e/fixtures/audio-helpers.js`) to the agent; the agent’s response (audio translated to text) must appear in the element identified by `[data-testid="agent-response"]`. In the test-app that element is the main agent-response display; in other UIs (e.g. voice-commerce) the same content is shown in a Message Bubble. Assert using `waitForAgentResponse` and the `[data-testid="agent-response"]` selector. **Reuse**: Run the same flow as in `dual-channel-text-and-microphone.spec.js` or `simple-mic-test.spec.js` (or equivalent) with the app pointed at the OpenAI proxy (`VITE_OPENAI_PROXY_ENDPOINT`). No new test file required if an existing audio test is parameterized by proxy endpoint or run twice (Deepgram proxy, then OpenAI proxy).
- **Current status**: **Implemented.** The OpenAI proxy implements the audio input path (component sends binary; proxy converts to base64 and sends `input_audio_buffer.append` / `commit` per [API-DISCONTINUITIES.md](./API-DISCONTINUITIES.md)). The basic audio E2E test in `openai-proxy-e2e.spec.js` runs when the proxy is available and audio fixtures exist.

### 4. Simple function calling test

- **Trigger client-side function call; assert response in the test-app element with `data-testid="agent-response"`**: Connect with a session that includes tools/functions; send a message that triggers a function call; assert that the function is invoked (e.g. callback or DOM) and that the agent’s follow-up response appears in the element with `[data-testid="agent-response"]` (in voice-commerce that is a Message Bubble). **Reuse**: Run the same flow as in `function-calling-e2e.spec.js` or `issue-351-function-call-proxy-mode.spec.js` with the app pointed at the OpenAI proxy. Same test file, different proxy endpoint (e.g. `setupTestPageWithOpenAIProxy` or URL param).

### 5. Multi-turn

- **Sequential messages**: After first message and response, send a second message (e.g. “What did I just say?”). Assert second agent response appears. Validates that the connection stays open and the session supports multiple exchanges (addresses issue #380–style behavior).

### 6. Reconnection

- **Disconnect then send**: Disconnect the session (e.g. stop button or simulate disconnect). Send a new message. Assert that the app reconnects (or re-establishes session) and the user receives a response. Validates reconnection path with the OpenAI proxy.

**OpenAI Realtime API timeout/idle behavior**: Session duration is documented as up to **60 minutes** (post-GA). A specific **idle timeout** (e.g. how long with no activity before the server closes the connection) is not clearly documented in the official Realtime API docs. Community reports mention WebSocket disconnects (e.g. close code 1006) and disconnects after `session.update`. Reconnection E2E tests should cover both **user-initiated** disconnect (stop button) and **server-side** closure (e.g. after idle or upstream close), so the app and proxy handle both cases. See [Realtime API session timeout (post-GA)](https://community.openai.com/t/realtime-api-session-timeout-post-ga/1357331) and [Developer notes on the Realtime API](https://developers.openai.com/blog/realtime-api/).

### 7. Error handling

- **Proxy unavailable**: With proxy down or wrong URL, assert that the app shows an appropriate error or connection state (e.g. “closed” or error message) and does not hang indefinitely.
- **Upstream error**: If feasible (e.g. proxy returns an error event), assert that the UI or connection state reflects the error appropriately.

### 8. Parity with Deepgram proxy E2E

- **Same flows as Deepgram**: Where applicable, mirror the structure of `deepgram-text-session-flow.spec.js` and `deepgram-backend-proxy-mode.spec.js` for the OpenAI proxy: connection, settings, first message, sequential messages, disconnect/reconnect. This gives a “comprehensive” OpenAI proxy E2E suite and ensures the component works with both backends.

## Implementation Notes

- **Reuse by proxy endpoint**: Run the same E2E test file against Deepgram proxy (e.g. `VITE_DEEPGRAM_PROXY_ENDPOINT` / `setupTestPageWithDeepgramProxy`) or OpenAI proxy (e.g. `VITE_OPENAI_PROXY_ENDPOINT` / `setupTestPageWithOpenAIProxy`) via URL param or helper. Parameterize or duplicate the describe block with a different `proxyEndpoint` so one suite runs against Deepgram and one against OpenAI where applicable.
- **Skip when proxy not set**: Use `skipIfNoOpenAIProxy()` (or equivalent) so E2E that require the OpenAI proxy are skipped when `VITE_OPENAI_PROXY_ENDPOINT` is not set (e.g. in CI without an OpenAI proxy).
- **Timeout**: Use timeouts that allow for real API latency (e.g. 15–30s for agent response).
- **Existing component tests**: Run the full component test suite with the OpenAI backend (e.g. by pointing the test app at the OpenAI proxy). All existing tests must pass; add new E2E only for new behaviors.

## Missing OpenAI E2E tests

See **[MISSING-OPENAI-E2E-TESTS.md](./MISSING-OPENAI-E2E-TESTS.md)** for candidates that are (1) representative of Deepgram coverage we don’t yet have for OpenAI, or (2) compelled by the OpenAI Realtime API. Recommended next: **Instructions / session instructions** E2E (TDD). Others (server close, SettingsApplied, idle after greeting, transcript-absent) are optional or deferred.

## Acceptance

- All E2E tests in the OpenAI proxy suite pass when the proxy is running and `VITE_OPENAI_PROXY_ENDPOINT` is set. **Current:** 10 tests (connection, greeting 1b, single message, multi-turn, reconnection, basic audio, simple function calling, injectUserMessage stability, error handling, reconnection with context); 9 pass, 1 flaky (reconnection with context).
- The existing openai-inject-connection-stability test remains and passes.
- At least: connection, **greeting** (proxy injects greeting → component shows `[data-testid="greeting-sent"]`), single message, **basic audio** (send recorded audio → agent response text appears in `[data-testid="agent-response"]`), **simple function calling** (response in `[data-testid="agent-response"]`), multi-turn, and reconnection are covered by E2E tests (reused where possible; tests need not be new).
- Where possible, the same test files run against both Deepgram and OpenAI proxies by pointing the environment at the other proxy.
