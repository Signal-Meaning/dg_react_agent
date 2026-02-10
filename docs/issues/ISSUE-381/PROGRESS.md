# Issue #381: Progress Overview

**Single place for progress against the OpenAI Realtime proxy.**  
**GitHub Issue**: [#381](https://github.com/Signal-Meaning/dg_react_agent/issues/381)

---

## Status at a glance

| Area | Status | Details |
|------|--------|---------|
| **Phase 1 – Unit tests** | ✅ Done | 28 tests in `tests/openai-proxy.test.ts` (incl. greeting) |
| **Phase 2 – Integration tests** | ✅ Done | 12 tests in `tests/integration/openai-proxy-integration.test.ts` (incl. function-calling API gap, greeting) |
| **Phase 3 – E2E (OpenAI proxy suite)** | ✅ 9 tests | openai-proxy-e2e + openai-inject-connection-stability; 8 pass, 1 flaky |
| **Phase 4 – Remaining E2E with OpenAI** | ✅ Done | context-retention **pass**; context-retention-with-function-calling **pass** (when proxy running, API sends function_call_arguments.done); declarative-props **skip** when OpenAI |
| **Phase 5 – Docs & CI** | ✅ Done | [RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md): env, run proxy, run tests; CI runs proxy unit + integration |

---

## Phase 1 – Unit tests (translator)

- **File:** `tests/openai-proxy.test.ts`
- **Count:** 28 tests
- **Coverage:** Settings → session.update (including tools), InjectUserMessage → conversation.item.create, session.updated → SettingsApplied, response.output_text.done / output_audio_transcript.done / function_call_arguments.done → ConversationText or FunctionCallRequest, FunctionCallResponse → conversation.item.create (function_call_output), context message → conversation.item.create, greeting → conversation.item.create and ConversationText (Issue #381), error mapping, binary → input_audio_buffer.append, edge cases (multiple tools, function-call with args).
- **Run:** `npm run test -- tests/openai-proxy.test.ts`
- **Plan:** [UNIT-TEST-PLAN.md](./UNIT-TEST-PLAN.md)

---

## Phase 2 – Integration tests (proxy WebSocket)

- **File:** `tests/integration/openai-proxy-integration.test.ts`
- **Count:** 12 tests
- **Coverage:** Listen + upgrade, Settings → session.update → SettingsApplied, InjectUserMessage → conversation.item.create + response.create → ConversationText (assistant), binary → input_audio_buffer.append + commit + response.create, **function-call round-trip** (mock sends function_call_arguments.done → client gets FunctionCallRequest → client sends FunctionCallResponse → upstream gets function_call_output), **FCR then CT order** when upstream sends .done, **transcript-only path** (upstream sends only output_audio_transcript.done or output_text.done with "Function call: ..." → client gets ConversationText only, no FunctionCallRequest), **transcript then .done** (client gets CT, FCR, CT), **user echo** (InjectUserMessage → client gets ConversationText role user), **context in Settings** (agent.context.messages → upstream gets N conversation.item.create), **greeting** (agent.greeting → after session.updated, client gets ConversationText and upstream gets conversation.item.create assistant).
- **Run:** `npm run test -- tests/integration/openai-proxy-integration.test.ts`
- **Plan:** [INTEGRATION-TEST-PLAN.md](./INTEGRATION-TEST-PLAN.md)

---

## Phase 3 – E2E (OpenAI proxy suite)

- **Specs:** `openai-proxy-e2e.spec.js`, `openai-inject-connection-stability.spec.js`
- **Count:** 9 tests (Basic audio, Simple function calling, injectUserMessage stability, Connection, Single message, Multi-turn, Reconnection, Error handling, Reconnection with context).
- **Result:** 8 pass, 1 flaky (Reconnection with context).
- **Run:** `HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js`
- **Plan:** [E2E-TEST-PLAN.md](./E2E-TEST-PLAN.md)

---

## Phase 4 – Remaining E2E (run with OpenAI proxy)

When running the **full** E2E suite with `VITE_OPENAI_PROXY_ENDPOINT` set:

| Spec / area | Result | Notes |
|-------------|--------|--------|
| context-retention-agent-usage | ✅ Pass | Uses setupTestPageWithOpenAIProxy; test app optimistic user message in handleTextSubmit. |
| context-retention "verify context format" | ✅ Pass | Same setup. |
| declarative-props (Deepgram function-call) | ⏭️ Skip | skipIfOpenAIProxy; OpenAI flow covered by openai-proxy-e2e "Simple function calling" + integration test. |
| context-retention-with-function-calling | ✅ Pass | Passes when proxy is running and real API sends response.function_call_arguments.done. Test asserts client received FunctionCallRequest and handler invoked (requestCount > 0); context retention after reconnect verified. |
| deepgram-backend-proxy-mode (Deepgram) | ⏭️ Skip | Deepgram-only; skipIfOpenAIProxy. |
| callback-test (Deepgram transcript/VAD) | ⏭️ Skip | Deepgram-only; skipIfOpenAIProxy for those tests. |

**Backend selection:** Test-app defaults to OpenAI (`proxyEndpoint` default in App.tsx). For E2E runs use env: `E2E_BACKEND=openai` (default) or `E2E_BACKEND=deepgram`. URL is built with `connectionMode` + `proxyEndpoint` query params (the “URL input” the app reads). context-retention-with-function-calling runs with OpenAI only (skips when `E2E_BACKEND=deepgram`).

**Full list and commands:** [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md)

---

## What’s done (summary)

1. **Proxy translator** – All mappings implemented and unit-tested (session, InjectUserMessage, FunctionCallRequest/Response, context, audio, error).
2. **Proxy server** – WebSocket server; forwards client ↔ upstream with translation; user echo, context in Settings, function-call round-trip implemented and integration-tested.
3. **OpenAI proxy E2E suite** – 9 tests; connection, messaging, reconnection, basic audio, function calling, error handling covered.
4. **Context retention E2E** – Both tests pass against OpenAI proxy (setup + test app optimistic user message).
5. **Declarative-props function-call** – Skip when OpenAI; when run (e.g. Deepgram), test requires real function call (no fake pass).
6. **Backend/callback skips** – deepgram-backend-proxy-mode and callback-test (transcript/VAD) skip when OpenAI proxy.
7. **Context retention with function calling** – E2E passes when proxy is running and real API sends `response.function_call_arguments.done`; test asserts FCR received, handler invoked, and context retained after reconnect.
8. **Greeting (Issue #381)** – Proxy uses component-provided `agent.greeting` from Settings: after **session.updated**, injects greeting via **conversation.item.create** (upstream) and **ConversationText** (component). Unit tests (2) and integration test (1); translator `mapGreetingToConversationItemCreate` / `mapGreetingToConversationText`; server stores greeting on Settings and injects after session.updated. E2E: openai-proxy-e2e includes a test that asserts `[data-testid="greeting-sent"]` after connection (validates greeting is sent to the component).

---

## What’s left

- **Flaky:** openai-proxy-e2e “Reconnection with context” (Test 9) — passed on retry; worth re-running or increasing timeout if it recurs.
- **Transcript-only path:** If real API sometimes sends only transcript (“Function call: …”) and not `response.function_call_arguments.done`, integration tests document current behavior (client gets ConversationText only); optional future: synthesize FunctionCallRequest from transcript or document limitation.

---

## What’s next

1. **Stabilize flaky test:** Re-run "Reconnection with context" in isolation; if it fails again, consider longer timeout or retries.
2. **Transcript-only function-call:** Document or implement (optional).


---

## Where to look next

| Need | Document |
|------|----------|
| **This overview** | [PROGRESS.md](./PROGRESS.md) (this file) |
| **Phase 5 – env, run proxy, run tests** | [RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md) |
| **E2E run order, commands, remaining specs** | [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md) |
| **Component vs OpenAI protocol** | [API-DISCONTINUITIES.md](./API-DISCONTINUITIES.md) |
| **Phased implementation** | [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md) |
| **Unit test plan** | [UNIT-TEST-PLAN.md](./UNIT-TEST-PLAN.md) |
| **Integration test plan** | [INTEGRATION-TEST-PLAN.md](./INTEGRATION-TEST-PLAN.md) |
| **E2E test plan** | [E2E-TEST-PLAN.md](./E2E-TEST-PLAN.md) |
| **Issue root** | [README.md](./README.md) |
