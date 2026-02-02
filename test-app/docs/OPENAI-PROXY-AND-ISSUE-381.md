# OpenAI Proxy Backend and Issue #381

**Last updated:** February 2026  
**Issue:** [#381](https://github.com/Signal-Meaning/dg_react_agent/issues/381) – OpenAI Realtime proxy

## Overview

The test app and the repo support an **OpenAI Realtime proxy** as an alternative backend to the Deepgram Voice Agent. The proxy translates the component’s protocol (Settings, InjectUserMessage, ConversationText, etc.) to/from the [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime). This document summarizes improvements made in the test-app and proxy for Issue #381 and how to use them.

**Detailed proxy and API docs:** `docs/issues/ISSUE-381/` (e.g. [README](../../docs/issues/ISSUE-381/README.md), [RUN-OPENAI-PROXY.md](../../docs/issues/ISSUE-381/RUN-OPENAI-PROXY.md), [API-DISCONTINUITIES.md](../../docs/issues/ISSUE-381/API-DISCONTINUITIES.md)).

---

## Test-app improvements (Issue #381)

### 1. **Backend selection and URL**

- The test app can connect to **Deepgram** or the **OpenAI proxy**.
- Backend is chosen via **connection mode** and **proxy endpoint** (e.g. URL input or query params).
- When running E2E with the proxy, set `VITE_OPENAI_PROXY_ENDPOINT` (e.g. `ws://localhost:8080/openai`). The app builds the WebSocket URL from `connectionMode` and `proxyEndpoint` so E2E can target the proxy without code changes.

### 2. **E2E backend env**

- **`E2E_BACKEND`** (e.g. `openai` or `deepgram`) controls which backend the E2E suite uses.
- Default is OpenAI when the proxy URL is set. Some specs **skip** when `E2E_BACKEND=deepgram` (e.g. context-retention-with-function-calling); others skip when the OpenAI proxy is in use (Deepgram-only specs: deepgram-backend-proxy-mode, deepgram-callback-test). See [E2E-PRIORITY-RUN-LIST.md](../../docs/issues/ISSUE-381/E2E-PRIORITY-RUN-LIST.md).

### 3. **Optimistic user message in context retention**

- For **context retention** flows, the test app adds the **current user message optimistically** to conversation history in `handleTextSubmit` (or equivalent) before the round-trip completes.
- This keeps the UI and context in sync when reconnecting and ensures E2E tests (e.g. context-retention-agent-usage, context-retention-with-function-calling) see the expected messages after reconnect when using the OpenAI proxy.

### 4. **Context retention E2E with OpenAI**

- **context-retention-agent-usage** and **context-retention-with-function-calling** run and **pass** against the OpenAI proxy when:
  - The proxy is running and reachable.
  - `VITE_OPENAI_PROXY_ENDPOINT` is set (and optionally `E2E_BACKEND=openai`).
- Setup uses `setupTestPageWithOpenAIProxy` (or equivalent) so the page loads with the proxy URL. The test app’s optimistic user message and context handling align with what the proxy expects.

### 5. **Function-calling E2E**

- **context-retention-with-function-calling** asserts that the client receives a **FunctionCallRequest** and that the client-side handler is invoked (e.g. `window.handleFunctionCall`), and that context is retained after reconnect.
- The test is written for the OpenAI proxy; it **skips** when `E2E_BACKEND=deepgram`. OpenAI flow is also covered by the openai-proxy-e2e “Simple function calling” spec and by integration tests.

### 6. **Greeting**

- The component sends **agent.greeting** in Settings when it’s a new connection (no context). The proxy is expected to **use** that greeting: after **session.updated**, inject the greeting as an initial assistant message (e.g. via **conversation.item.create**) and send **ConversationText** to the component so the app can show “greeting sent”. See [API-DISCONTINUITIES.md](../../docs/issues/ISSUE-381/API-DISCONTINUITIES.md) section 6 (Greeting). Implementation is in progress (TDD).

---

## Proxy improvements (Issue #381)

- **Translation layer** (`scripts/openai-proxy/translator.ts`): Settings → session.update, InjectUserMessage → conversation.item.create, session.updated → SettingsApplied, response.output_text.done / output_audio_transcript.done / function_call_arguments.done → ConversationText or FunctionCallRequest, FunctionCallResponse → conversation.item.create (function_call_output), context messages → conversation.item.create. Unit tests: `tests/openai-proxy.test.ts` (32 tests).
- **WebSocket server** (`scripts/openai-proxy/server.ts`): Forwards client ↔ upstream with translation; user echo (ConversationText role user); context in Settings → conversation.item.create per message; function-call round-trip. Integration tests: `tests/integration/openai-proxy-integration.test.ts` (11 tests).
- **Function-calling and transcript handling:** Proxy sends **FunctionCallRequest** when upstream sends **response.function_call_arguments.done**; integration tests cover transcript-only path (no FCR) and FCR-then-ConversationText order. See [INTEGRATION-TEST-PLAN.md](../../docs/issues/ISSUE-381/INTEGRATION-TEST-PLAN.md).
- **Run and env:** [RUN-OPENAI-PROXY.md](../../docs/issues/ISSUE-381/RUN-OPENAI-PROXY.md) documents env vars, how to run the proxy (`npm run openai-proxy`), and how to run unit, integration, and E2E tests.

---

## Running the test app with the OpenAI proxy

1. **Start the proxy** (from repo root):
   ```bash
   npm run openai-proxy
   ```
   (Requires `OPENAI_API_KEY` and optional `OPENAI_PROXY_DEBUG=1`.)

2. **Start the test app** with the proxy URL, e.g.:
   ```bash
   VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run dev
   ```
   (Or set the same in `.env` / `.env.local`.)

3. **E2E** (with proxy and app running):
   ```bash
   HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js
   ```
   See [RUN-OPENAI-PROXY.md](../../docs/issues/ISSUE-381/RUN-OPENAI-PROXY.md) for full commands and CI notes.

---

## Related docs

| Doc | Purpose |
|-----|--------|
| [docs/issues/ISSUE-381/README.md](../../docs/issues/ISSUE-381/README.md) | Issue #381 overview and acceptance criteria |
| [docs/issues/ISSUE-381/RUN-OPENAI-PROXY.md](../../docs/issues/ISSUE-381/RUN-OPENAI-PROXY.md) | Env, run proxy, run unit/integration/E2E tests |
| [docs/issues/ISSUE-381/API-DISCONTINUITIES.md](../../docs/issues/ISSUE-381/API-DISCONTINUITIES.md) | Component vs OpenAI protocol; greeting (section 6) |
| [test-app/ENVIRONMENT_VARIABLES.md](../ENVIRONMENT_VARIABLES.md) | Test-app env vars (e.g. `VITE_AGENT_GREETING`, `VITE_OPENAI_PROXY_ENDPOINT`) |
