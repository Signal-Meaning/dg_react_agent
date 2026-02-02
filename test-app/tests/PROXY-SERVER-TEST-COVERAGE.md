# Proxy Server Test Coverage

**Target**: `test-app/scripts/mock-proxy-server.js` (run via `npm run test:proxy:server`)

## Requirements (implemented behavior)

1. **At least one API key required**: Server exits with code 1 when neither `DEEPGRAM_API_KEY`/`VITE_DEEPGRAM_API_KEY` nor `OPENAI_API_KEY`/`VITE_OPENAI_API_KEY` is set.
2. **Deepgram proxy (when key present)**: Path `/deepgram-proxy` proxies WebSocket to Deepgram (agent or transcription).
3. **OpenAI proxy (when key present)**: Path `/openai` forwards to OpenAI Realtime proxy subprocess; default for test-app.
4. **Both on one port**: When both keys are set, both `/deepgram-proxy` and `/openai` are available on the same port (default 8080).
5. **Startup message**: Logs which endpoints are active (Deepgram, OpenAI, or both).

## Current tests

### Unit (Deepgram routing only)

| Location | What it tests |
|----------|----------------|
| `test-app/tests/mock-proxy-server.test.js` | **Deepgram only**: Inlined helpers for service type detection, endpoint routing (agent vs transcription), query param forwarding. Does **not** start the server or hit `/deepgram-proxy` or `/openai`. |

### Integration (proxy server process)

| Location | What it tests |
|----------|----------------|
| `test-app/tests/mock-proxy-server-integration.test.js` | **API key requirement**: Spawns `mock-proxy-server.js` with `SKIP_DOTENV=1` and (1) neither key → exit code 1 and error message; (2) only `DEEPGRAM_API_KEY` → process stays up until SIGTERM; (3) only `OPENAI_API_KEY` → process stays up until SIGTERM. |

### E2E (test-app + proxy)

| Location | What it tests |
|----------|----------------|
| `test-app/tests/e2e/deepgram-backend-proxy-mode.spec.js` | Test-app connecting to proxy; assumes proxy already running at `ws://localhost:8080/deepgram-proxy`. |
| `test-app/tests/e2e/deepgram-backend-proxy-authentication.spec.js` | Auth token handling via proxy. |
| `test-app/tests/e2e/api-key-security-proxy-mode.spec.js` | API key not exposed in client when using proxy. |
| `test-app/tests/e2e/openai-proxy-e2e.spec.js` | Test-app with OpenAI proxy (`VITE_OPENAI_PROXY_ENDPOINT`). |

E2E tests assume the proxy is started separately; they do not assert that the proxy serves both endpoints when both keys are set.

## Gaps (what we don’t test yet)

- **Server process**: That with only `OPENAI_API_KEY` the server starts and `/openai` is reachable (subprocess + forwarder).
- **Both endpoints**: That with both keys set, both `/deepgram-proxy` and `/openai` accept WebSocket connections on the same port.
- **Startup message**: That the logged endpoints match the keys present (Deepgram only, OpenAI only, or both).

## How to run

```bash
# Unit (Deepgram routing helpers)
npm test -- mock-proxy-server

# Integration (API key requirement; from repo root so Jest finds test-app/tests)
npm test -- mock-proxy-server-integration

# E2E (start proxy first)
cd test-app && npm run test:proxy:server   # then in another terminal:
USE_PROXY_MODE=true npm run test:e2e
```
