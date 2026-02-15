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

**Safety – real API E2E:** Run OpenAI proxy E2E only when **OPENAI_API_KEY** is set (truthy). The proxy will not start without it. Do not run real-API E2E in environments where the key is unset or a placeholder (e.g. CI without secrets).

**Note:** The test-app defaults to the OpenAI proxy when `VITE_OPENAI_PROXY_ENDPOINT` is set (e.g. by Playwright env). See [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md) for backend selection and Deepgram-only specs.

---

## Run the proxy

**Canonical:** Run the test-app backend (one server for Deepgram and OpenAI proxies): `cd test-app && npm run backend`. The OpenAI proxy is spawned from the **voice-agent-backend** package (Issue #445); backends must not depend on the React package to run the proxy.

**Standalone (from repo root):** Run the proxy from the backend package directory:

```bash
cd packages/voice-agent-backend && npx tsx scripts/openai-proxy/run.ts
```

- Listens on **http://localhost:8080**; WebSocket path **/openai** → `ws://localhost:8080/openai`.
- Loads `.env` from the package dir or repo root; put `OPENAI_API_KEY=sk-...` in `.env` or the environment.
- Optional: `OPENAI_PROXY_PORT=9000` to use a different port.
- Optional: `OPENAI_PROXY_DEBUG=1` to log upstream→client message types.

**Integrators (e.g. voice-commerce):** Use `@signal-meaning/voice-agent-backend` only. Set spawn `cwd` to `path.dirname(require.resolve('@signal-meaning/voice-agent-backend/package.json'))` and run `npx tsx scripts/openai-proxy/run.ts`. Do not resolve or depend on `@signal-meaning/voice-agent-react` to run the proxy. See `packages/voice-agent-backend/README.md` and `docs/OPENAI-PROXY-PACKAGING.md`.

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

**Prerequisites:** Proxy running, `OPENAI_API_KEY` set (in `.env` or `test-app/.env`). E2E runs from **test-app**; Playwright uses `test-app/tests/playwright.config.mjs`.

### Canonical: OpenAI proxy E2E with real APIs (existing servers)

Run from **test-app** with dev server and backend already running. This is the usual setup when you run E2E locally.

1. **Terminal 1 – dev server**
   ```bash
   cd test-app && npm run dev
   ```
2. **Terminal 2 – backend (includes OpenAI proxy on port 8080)**
   ```bash
   cd test-app && npm run backend
   ```
   Ensure `OPENAI_API_KEY` (or `VITE_OPENAI_API_KEY`) is set in `test-app/.env` so the OpenAI proxy starts.

3. **Terminal 3 – run tests (from test-app)**
   ```bash
   cd test-app && E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e openai-inject-connection-stability
   ```
   Tests assert **no upstream agent errors** (recoverable or not); if the app receives any agent error during a test, that test fails.

### Full OpenAI proxy suite (Playwright starts servers)

If you do **not** set `E2E_USE_EXISTING_SERVER=1`, Playwright starts the dev server and backend for you. Run from **project root**:

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js test-app/tests/e2e/openai-inject-connection-stability.spec.js --config=test-app/tests/playwright.config.mjs
```

- Connection, single message, multi-turn, reconnection, basic audio, simple function calling, error handling, reconnection with context, injectUserMessage stability.
- Use `HTTPS=0` so the test-app is served over HTTP. Omit if using a pre-started dev server with `E2E_USE_EXISTING_SERVER=1`.

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
