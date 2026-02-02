# Issue #381: Implementation Phases (TDD)

Phased implementation so that **tests come first** and each phase ends with a green test suite.

---

## Phase 1: Unit tests and proxy core logic ✅

**Goal**: Proxy module exists and satisfies unit tests for parsing, mapping, and session logic.

1. Create test file(s) for the OpenAI proxy (see [UNIT-TEST-PLAN.md](./UNIT-TEST-PLAN.md)).
2. **RED**: Write failing unit tests for:
   - Session/config handling
   - Client event parsing and mapping (e.g. session.update, conversation.item.create)
   - Server event parsing and mapping (e.g. session.created, response.output_text.done)
   - Protocol mapping (component ↔ OpenAI Realtime)
   - Edge cases (malformed JSON, missing fields)
3. **GREEN**: Implement the proxy module (or minimal stub) so all unit tests pass.
4. **REFACTOR**: Clean up module structure and naming.
5. **Checkpoint**: All new unit tests pass; no regression in existing tests.

**Done**: `tests/openai-proxy.test.ts` (32 tests) and `scripts/openai-proxy/translator.ts`. Covers Settings → session.update (including tools), InjectUserMessage, FunctionCallRequest/Response ↔ conversation.item.create (function_call_output), context → conversation.item.create, session.updated → SettingsApplied, response.output_text.done / output_audio_transcript.done / function_call_arguments.done → ConversationText or FunctionCallRequest, error → Error, binary → input_audio_buffer.append. Edge cases: multiple tools, function-call with non-empty arguments. Run: `npm run test -- tests/openai-proxy.test.ts`.

---

## Phase 2: Integration tests and WebSocket server ✅

**Goal**: Proxy runs as a WebSocket server and satisfies integration tests.

1. Create integration test file(s) (see [INTEGRATION-TEST-PLAN.md](./INTEGRATION-TEST-PLAN.md)).
2. **RED**: Write failing integration tests for:
   - Server listens on `/openai` (or configured path)
   - Connection and session bootstrap (session.update → session.created)
   - Inject user message (client → proxy → mock upstream → proxy → client)
   - Component contract (correct event shapes to/from client)
   - Error and disconnect handling
   - Authentication (if applicable)
3. **GREEN**: Implement or extend the proxy WebSocket server and wire it to the logic from Phase 1. Use a mock upstream so tests do not call the real OpenAI API.
4. **REFACTOR**: Improve server structure and error handling.
5. **Checkpoint**: All integration tests pass; unit tests still pass.

**Done**: `tests/integration/openai-proxy-integration.test.ts` (7 tests, `@jest-environment node`) and `scripts/openai-proxy/server.ts`. Tests: listen + upgrade, Settings → session.update → SettingsApplied, InjectUserMessage → conversation.item.create + response.create → ConversationText (assistant), binary → input_audio_buffer.append + commit + response.create, **function-call round-trip** (mock sends function_call_arguments.done → client gets FunctionCallRequest → client sends FunctionCallResponse → upstream gets function_call_output), **user echo** (InjectUserMessage → client gets ConversationText role user), **context in Settings** (agent.context.messages → upstream gets N conversation.item.create). Mock upstream in test; proxy uses translator from Phase 1. Run: `npm run test -- tests/integration/openai-proxy-integration.test.ts`.

---

## Phase 3: E2E tests and full stack ✅

**Goal**: Test-app works end-to-end with the OpenAI proxy; E2E suite is comprehensive and green.

1. Ensure the proxy is reachable at the configured endpoint (e.g. `ws://localhost:8080/openai`) when the test-app and proxy are run (see [E2E-TEST-PLAN.md](./E2E-TEST-PLAN.md)).
2. **RED**: Add or extend E2E tests for:
   - Connection through OpenAI proxy
   - Single message (existing openai-inject-connection-stability case)
   - Multi-turn (sequential messages)
   - Reconnection after disconnect
   - Error handling (proxy down, wrong URL)
   - Parity with Deepgram proxy flows where applicable
3. **GREEN**: Fix proxy and/or app integration so all E2E tests pass (use real OpenAI Realtime API or a stable mock that matches the API).
4. **REFACTOR**: Stabilize timeouts and assertions; remove flakiness.
5. **Checkpoint**: All OpenAI proxy E2E tests pass when `VITE_OPENAI_PROXY_ENDPOINT` is set; existing E2E tests (Deepgram) still pass.

**Done**: Proxy run script `scripts/openai-proxy/run.ts` (npm script `openai-proxy`) with `OPENAI_API_KEY` and optional `OPENAI_PROXY_PORT`/`OPENAI_REALTIME_URL`; server supports optional `upstreamHeaders` for upstream auth. E2E suite `test-app/tests/e2e/openai-proxy-e2e.spec.js`: connection, single message, multi-turn, reconnection, basic audio, function calling, and error handling (wrong proxy URL → connection closed/error within timeout). Run proxy: `OPENAI_API_KEY=sk-... npm run openai-proxy`. Run E2E: `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run test:e2e -- openai-proxy-e2e`. See `scripts/openai-proxy/README.md`.

---

## Phase 4: Existing component tests with OpenAI backend

**Goal**: No regressions when the component uses the OpenAI backend.

1. Run the **full** component test suite (Jest unit/integration tests for dg_react_agent) with the component configured to use the OpenAI proxy where applicable (e.g. via env or test harness).
2. **RED**: Identify any failing tests (these are regressions).
3. **GREEN**: Fix proxy or component integration so that:
   - All existing component tests pass with the Deepgram backend.
   - All existing component tests pass with the OpenAI backend (or with a clear, documented exception for tests that are Deepgram-only).
4. **REFACTOR**: Document which tests run against which backend and any required setup.
5. **Checkpoint**: Full component test suite green for both backends (or exceptions documented).

---

## Phase 5: Documentation and CI ✅

**Goal**: Docs and CI reflect the new proxy and tests.

1. **Document env and run** – **[RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md)** describes:
   - Environment variables: `OPENAI_API_KEY`, `OPENAI_PROXY_PORT`, `OPENAI_REALTIME_URL`, `OPENAI_PROXY_DEBUG`, `VITE_OPENAI_PROXY_ENDPOINT`, `E2E_BACKEND`, `HTTPS`, `VITE_BASE_URL`
   - How to run the proxy: `npm run openai-proxy` from project root
   - How to run unit tests: `npm run test -- tests/openai-proxy.test.ts`
   - How to run integration tests: `npm run test -- tests/integration/openai-proxy-integration.test.ts`
   - How to run E2E: `HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test ...` (full commands in doc)
   - CI: unit and integration run in existing Jest job; E2E optional (proxy + API key)
2. **CI**: Unit and integration tests for the OpenAI proxy run in the existing Jest job (no extra env). E2E requires proxy + `OPENAI_API_KEY`; doc describes optional CI job or manual/scheduled run.
3. **Checkpoint**: New contributors can follow [RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md) to run and test the OpenAI proxy; CI runs proxy unit and integration tests.

---

## Summary

| Phase | Focus | Exit criterion |
|-------|--------|-----------------|
| 1 | Unit tests + proxy core logic | Unit tests green |
| 2 | Integration tests + WebSocket server | Integration tests green |
| 3 | E2E tests + full stack | OpenAI E2E suite green ✅ |
| 4 | Component tests with OpenAI backend | No regressions; suite green |
| 5 | Documentation + CI | [RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md); Jest runs proxy tests ✅ |

Each phase follows **test first (RED)** then **implementation (GREEN)** then **refactor**. Do not move to the next phase until the current phase’s checkpoint is met.
