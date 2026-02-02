# Issue #381: TDD Overview

## Test-Driven Development Workflow

This feature follows the project’s TDD rules:

1. **RED**: Write failing tests first that define expected behavior.
2. **GREEN**: Implement the minimum code needed to make those tests pass.
3. **REFACTOR**: Improve structure and clarity while keeping tests green.
4. **REPEAT**: Continue the cycle for each slice of behavior.

## Rules

- **Do not** add production code for a behavior without a failing test for it.
- **Do not** skip or defer tests; they are the specification.
- Tests define requirements; implementation satisfies them.

## Order of Work

1. **Unit tests** – Proxy logic in isolation (request/response handling, event mapping, session lifecycle helpers). Write failing tests, then implement the proxy module to satisfy them.
2. **Integration tests** – Proxy WebSocket server behavior and its contract with the component (or a test harness). Write failing tests, then wire the proxy so they pass.
3. **E2E tests** – Full flow: app → proxy → OpenAI Realtime API. Always build a passing E2E test against the real Realtime API first; only then develop or introduce a mock. Write failing E2E specs first, then ensure the proxy and app integration make them pass.
4. **Existing component tests** – Run the full component test suite with the OpenAI backend (e.g. `VITE_OPENAI_PROXY_ENDPOINT`). Fix any regressions; no new behavior without new tests.

## Test Layers

| Layer | Scope | Tools | Location |
|-------|--------|--------|----------|
| Unit | Proxy logic (parsing, mapping, session state) | Jest | `tests/` (e.g. `openai-proxy*.test.ts`) |
| Integration | Proxy WebSocket server + component contract | Jest + mocks or test server | `tests/integration/` or `tests/` |
| E2E | Browser → app → proxy → backend | Playwright | `test-app/tests/e2e/` (OpenAI proxy specs) |

## References

- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Realtime WebSocket](https://platform.openai.com/docs/guides/realtime-websocket)
- [OpenAI Realtime conversations / session lifecycle](https://platform.openai.com/docs/guides/realtime-conversations)
- Existing Deepgram proxy: `test-app/scripts/mock-proxy-server.js`
- Existing OpenAI E2E: `test-app/tests/e2e/openai-inject-connection-stability.spec.js`
