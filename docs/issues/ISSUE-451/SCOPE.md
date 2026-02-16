# Issue #451 – Scope: tests that must pass with USE_REAL_APIS (OpenAI)

**Phase 1 output.** This document defines which tests are in scope for “all relevant tests must pass with USE_REAL_APIS (OpenAI provider)” for this release.

## In-scope test file

| File | Description |
|------|-------------|
| `tests/integration/openai-proxy-integration.test.ts` | OpenAI proxy integration; when `USE_REAL_APIS=1` and `OPENAI_API_KEY` are set, a subset of tests run against the live OpenAI Realtime API. |

## Tests that run when `USE_REAL_APIS=1` and `OPENAI_API_KEY` is set

When `useRealAPIs` is true, mock-only tests (`itMockOnly`) are skipped. The following **9 tests** run and must all pass:

| # | Test name |
|---|-----------|
| 1 | `listens on configured path and accepts WebSocket upgrade` |
| 2 | `client connecting to OpenAI proxy reaches open state (component connection-status "connected")` |
| 3 | `translates Settings to session.update and session.updated to SettingsApplied` |
| 4 | `translates InjectUserMessage to conversation.item.create + response.create and response.output_text.done to ConversationText` |
| 5 | `Issue #414 real-API: firm audio connection — no Error from upstream within 12s after sending audio (USE_REAL_APIS=1)` |
| 6 | `Issue #414 real-API: firm audio (speech-like audio) — no Error from upstream within 12s (USE_REAL_APIS=1)` |
| 7 | `echoes user message as ConversationText (role user) when client sends InjectUserMessage` |
| 8 | `Issue #414 real-API: greeting flow must not produce error (USE_REAL_APIS=1)` |
| 9 | `Issue #462: does not send session.update after output_audio.done until output_text.done` (runs with both mock and real API; real-API path asserts no conversation_already_has_active_response) |

## How to run

- **Without real API (mocks):**  
  `npm run test:mock -- tests/integration/openai-proxy-integration.test.ts`  
  → 38 passed, 3 skipped (the 3 real-API-only tests above are skipped).

- **With real API (Phase 2 green):**  
  `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`  
  → Requires `OPENAI_API_KEY` in `.env`, `test-app/.env`, or environment.  
  → When set, the 9 tests above run; all must pass for Acceptance Criteria.  
  → **Phase 2 fix:** Proxy sends `turn_detection: null` so only the proxy sends `input_audio_buffer.commit`; real API no longer returns "buffer too small ... 0.00ms" (see `packages/voice-agent-backend/scripts/openai-proxy/translator.ts`).

## Out of scope for this release

- **Unit tests** that use only mocked WebSocket (`onFunctionCallRequest-sendResponse.test.tsx`, `function-calling-settings.test.tsx`) are not in scope for “run with real API” for this release; they remain mock-based. Equivalent coverage for function-call and Settings behavior with the OpenAI provider is provided by the integration tests above and by E2E when run with `USE_REAL_APIS`.
- **E2E tests** (e.g. `test-app/tests/e2e/` with `USE_REAL_APIS=1`) may be added to scope in a later phase or release; current focus is the Jest integration suite above.

## References

- `docs/development/TEST-STRATEGY.md` – run order, mocks vs real.
- `tests/integration/openai-proxy-integration.test.ts` – `useRealAPIs`, `itMockOnly`, `(useRealAPIs ? it : it.skip)`.
