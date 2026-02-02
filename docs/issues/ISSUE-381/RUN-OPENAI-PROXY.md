# Issue #381: Run the OpenAI proxy and tests (Phase 5)

**Single reference** for environment variables, running the proxy, and running unit, integration, and E2E tests. See [PROGRESS.md](./PROGRESS.md) for phase status.

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| **OPENAI_API_KEY** | Proxy (server) | Required to connect proxy to OpenAI Realtime API. Set in `.env`, `test-app/.env`, or shell. |
| **OPENAI_PROXY_PORT** | Proxy | Port for the proxy HTTP server (default `8080`). WebSocket path is `/openai`. |
| **OPENAI_REALTIME_URL** | Proxy | Upstream WebSocket URL (default OpenAI Realtime). Override for a mock or alternate endpoint. |
| **OPENAI_PROXY_DEBUG** | Proxy | Set to `1` to enable proxy logging (upstream→client message types, function_call_arguments.done, transcript-like events). |
| **VITE_OPENAI_PROXY_ENDPOINT** | Test-app / E2E | WebSocket URL for the test-app to use the OpenAI proxy (e.g. `ws://localhost:8080/openai`). Playwright passes this to the test-app; default in config is `ws://localhost:8080/openai`. |
| **E2E_BACKEND** | E2E only | `openai` (default) or `deepgram`. Chooses which proxy params to use for specs that support both. URL is built with `connectionMode` + `proxyEndpoint` query params. |
| **HTTPS** | Test-app dev server | Set to `0` when Playwright starts the test-app so the app is served over HTTP (avoids TLS issues in Chromium). Does not affect the proxy. |
| **VITE_BASE_URL** | Test-app | Base URL for the test-app (default `http://localhost:5173`). Override if you run the app on a different host/port. |

**Note:** The test-app defaults to the OpenAI proxy when `VITE_OPENAI_PROXY_ENDPOINT` is set (e.g. by Playwright env). See [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md) for backend selection and Deepgram-only specs.

---

## Run the proxy

From the **project root** (repo root where `package.json` is):

```bash
# With API key in .env or test-app/.env
npm run openai-proxy
```

- Listens on **http://localhost:8080**; WebSocket path **/openai** → `ws://localhost:8080/openai`.
- Loads `.env` and `test-app/.env`; put `OPENAI_API_KEY=sk-...` in either.
- Optional: `OPENAI_PROXY_PORT=9000` to use a different port.
- Optional: `OPENAI_PROXY_DEBUG=1 npm run openai-proxy` to log upstream→client message types (useful to confirm `response.function_call_arguments.done` is received).

See `scripts/openai-proxy/README.md` for more (translator, server, OpenTelemetry logging).

---

## Run unit tests (proxy translator)

No proxy server or API key needed; tests use in-memory mappings.

```bash
npm run test -- tests/openai-proxy.test.ts
```

- **32 tests** – Settings → session.update, InjectUserMessage, FunctionCallRequest/Response, context, session.updated → SettingsApplied, response events → ConversationText/FunctionCallRequest, error mapping, binary → input_audio_buffer.append, edge cases.

---

## Run integration tests (proxy WebSocket server)

No real OpenAI API needed; tests use a **mock upstream** WebSocket server.

```bash
npm run test -- tests/integration/openai-proxy-integration.test.ts
```

- **11 tests** – Listen + upgrade, Settings → session.update → SettingsApplied, InjectUserMessage round-trip, binary + commit + response.create, function-call round-trip (FunctionCallRequest → FunctionCallResponse → function_call_output), FCR then CT order, transcript-only path (no FCR), transcript then .done order, user echo, context in Settings.
- Runs in Node (Jest); same as other Jest tests in CI.

---

## Run E2E tests (OpenAI proxy)

**Prerequisites:** Proxy running (`npm run openai-proxy`), `OPENAI_API_KEY` set. Playwright starts the test-app by default (`webServer` in `playwright.config`).

### Full OpenAI proxy suite (9 tests)

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js
```

- Connection, single message, multi-turn, reconnection, basic audio, simple function calling, error handling, reconnection with context, injectUserMessage stability.
- Use `HTTPS=0` so the test-app is served over HTTP (recommended). Omit if using a pre-started dev server with `E2E_USE_EXISTING_SERVER=1`.

### Context retention with function calling (1 test)

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/context-retention-with-function-calling.spec.js --retries=0
```

- Passes when the real API sends `response.function_call_arguments.done`; asserts client receives FunctionCallRequest and handler is invoked, then context retained after reconnect.
- Long timeout (120s); run with proxy restarted if you previously saw only ConversationText (transcript-only).

### Single test by title

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Simple function calling"
```

More commands and ordering: [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md).

---

## CI

- **Unit and integration tests:** Run in the existing **Jest** job (`npm run test` or `npm run test:mock`). No proxy server or `OPENAI_API_KEY` required; proxy unit tests use translator only; integration tests use a mock upstream. Ensure `tests/openai-proxy.test.ts` and `tests/integration/openai-proxy-integration.test.ts` are included in the Jest run (they are by default).
- **E2E tests:** Require a running proxy and `OPENAI_API_KEY`. Options:
  - **Optional CI job:** Add a job that starts the proxy (with a secret `OPENAI_API_KEY`), then runs the OpenAI proxy E2E suite. Skip the job or mark optional if the secret is not set.
  - **Manual / scheduled:** Run E2E locally or in a scheduled workflow when credentials are available.
- **Documentation:** This file and [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md) give contributors the commands to run proxy and tests locally and in CI.
