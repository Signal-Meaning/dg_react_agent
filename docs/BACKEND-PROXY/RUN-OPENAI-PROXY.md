# Run the OpenAI proxy and tests

**Single reference** for environment variables, running the OpenAI translation proxy, and running unit, integration, and E2E tests. (Originally Issue #381 Phase 5; phase status: [ISSUE-381 PROGRESS](../issues/ISSUE-381/PROGRESS.md).)

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| **OPENAI_API_KEY** | Proxy (server) | Required to connect proxy to OpenAI Realtime API. Set in `.env`, `test-app/.env`, or shell. |
| **OPENAI_PROXY_PORT** | Proxy | Port for the proxy HTTP server (default `8080`). WebSocket path is `/openai`. |
| **OPENAI_REALTIME_URL** | Proxy | Upstream WebSocket URL (default OpenAI Realtime). Override for a mock or alternate endpoint. |
| **LOG_LEVEL** | Proxy | Optional. Proxy logger honors this (e.g. `debug`); see `packages/voice-agent-backend/scripts/openai-proxy/logger.ts` (Issue #531). |
| **OPENAI_PROXY_DEBUG** | Proxy | Set to `1` to alias verbose logging (legacy; prefer `LOG_LEVEL` where documented). |
| **USE_REAL_APIS** | Jest (repo root) | Set to `1` with **OPENAI_API_KEY** to run the **real-API subset** in `tests/integration/openai-proxy-integration.test.ts`. See [TEST-STRATEGY.md](../development/TEST-STRATEGY.md). |
| **OPENAI_MANAGED_PROMPT_ID** | Jest (optional) | Non-empty → runs Issue **#539** managed-prompt real-API integration test; unset → that test **skips**. Optional: **OPENAI_MANAGED_PROMPT_VERSION**, **OPENAI_MANAGED_PROMPT_VARIABLES** (JSON object string). See [TDD-MANAGED-PROMPT-REAL-API.md](../issues/ISSUE-542/TDD-MANAGED-PROMPT-REAL-API.md). |
| **VITE_OPENAI_PROXY_ENDPOINT** | Test-app / E2E | WebSocket URL for the test-app to use the OpenAI proxy (e.g. `ws://localhost:8080/openai`). Playwright passes this to the test-app; default in config is `ws://localhost:8080/openai`. |
| **E2E_BACKEND** | E2E only | `openai` (default) or `deepgram`. Chooses which proxy params to use for specs that support both. URL is built with `connectionMode` + `proxyEndpoint` query params. |
| **HTTPS** | Test-app dev server / main backend | Controls Vite and the **test-app backend** outer server (Deepgram/OpenAI upgrade). It is **not** forwarded into the OpenAI proxy subprocess (EPIC-546). When the backend uses HTTPS, `attachVoiceAgentUpgrade` sets `OPENAI_PROXY_INSECURE_DEV_TLS` on the child unless PEM paths are set. |
| **OPENAI_PROXY_TLS_KEY_PATH** / **OPENAI_PROXY_TLS_CERT_PATH** | OpenAI proxy (`run.ts`) | Optional. Both required for HTTPS using PEM files (e.g. mkcert). |
| **OPENAI_PROXY_INSECURE_DEV_TLS** | OpenAI proxy (`run.ts`) | Set to `1` or `true` for in-memory localhost self-signed TLS in **non-production**. Disallowed when `NODE_ENV=production`. |
| **VITE_BASE_URL** | Test-app | Base URL for the test-app (default `http://localhost:5173`). Override if you run the app on a different host/port. |

**Safety – real API E2E:** Run OpenAI proxy E2E only when **OPENAI_API_KEY** is set (truthy). The proxy will not start without it. Do not run real-API E2E in environments where the key is unset or a placeholder (e.g. CI without secrets).

**Note:** The test-app defaults to the OpenAI proxy when `VITE_OPENAI_PROXY_ENDPOINT` is set (e.g. by Playwright env). See [E2E-PRIORITY-RUN-LIST.md](../issues/ISSUE-381/E2E-PRIORITY-RUN-LIST.md) for backend selection and Deepgram-only specs.

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

**Integrators (e.g. voice-commerce):** Use `@signal-meaning/voice-agent-backend` only. Set spawn `cwd` to `path.dirname(require.resolve('@signal-meaning/voice-agent-backend/package.json'))` and run `npx tsx scripts/openai-proxy/run.ts`. Do not resolve or depend on `@signal-meaning/voice-agent-react` to run the proxy. See `packages/voice-agent-backend/README.md` and [OPENAI-PROXY-PACKAGING.md](../OPENAI-PROXY-PACKAGING.md).

---

## Run unit tests (proxy translator)

No proxy server or API key needed; tests use in-memory mappings.

```bash
npm test -- tests/openai-proxy.test.ts
```

- Covers `mapSettingsToSessionUpdate`, inject/context/function-call mappings, error mapping, and related translator behavior (see Jest output for current count).

---

## Run integration tests (proxy WebSocket server)

**Mock upstream (default / CI):** No `OPENAI_API_KEY` required for the mock leg; Jest starts an in-process mock OpenAI server.

```bash
npm test -- tests/integration/openai-proxy-integration.test.ts
```

- Exercises WebSocket upgrade, Settings → `session.update` → `session.updated` → SettingsApplied, **InjectUserMessage** queue before session ready (Issue **#534**, mock), binary gating, function-call ordering, protocol rows in [PROTOCOL-SPECIFICATION.md](../../tests/integration/PROTOCOL-SPECIFICATION.md), and more. **Test count** varies as specs grow; rely on `npm test` output.
- Runs in Node (`@jest-environment node`).

**Live OpenAI (local / release qualification):**

```bash
USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts
```

- Requires **OPENAI_API_KEY** (e.g. from `.env` / `test-app/.env`). Mock-only tests skip; tests whose names include `real-API` (and similar) run against the live Realtime API. For Epic **#542** / `session.update` mapping qualification, this run is **required** when keys are available ([TEST-STRATEGY.md](../development/TEST-STRATEGY.md)).
- Optional: `OPENAI_MANAGED_PROMPT_ID=pmpt_...` to include the managed-prompt test ([TDD-MANAGED-PROMPT-REAL-API.md](../issues/ISSUE-542/TDD-MANAGED-PROMPT-REAL-API.md)).
- Helpers: `tests/integration/helpers/real-api-json-ws-session.ts`, `tests/integration/helpers/managed-prompt-env.ts`.

**Further reading:** [REALTIME-SESSION-UPDATE-FIELD-MAP.md](../../packages/voice-agent-backend/scripts/openai-proxy/REALTIME-SESSION-UPDATE-FIELD-MAP.md), [Epic #542](../issues/ISSUE-542/README.md).

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
- **Context when reconnecting:** The proxy receives context only in the first Settings per connection. When a reconnection is made, the app must pass `agentOptions.context` with the conversation history so the new connection’s first message is Settings with context. See [PROTOCOL-AND-MESSAGE-ORDERING.md](../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) § 2.2 and test-app README § "When is context sent to the backend?".
- Long timeout (120s); run with proxy restarted if you previously saw only ConversationText (transcript-only).

### Single test by title

```bash
HTTPS=0 VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npx playwright test test-app/tests/e2e/openai-proxy-e2e.spec.js --grep "Simple function calling"
```

More commands and ordering: [E2E-PRIORITY-RUN-LIST.md](../issues/ISSUE-381/E2E-PRIORITY-RUN-LIST.md).

---

## CI

- **Unit and integration tests:** Run in the existing **Jest** job (`npm run test` or `npm run test:mock`). No proxy server or `OPENAI_API_KEY` required; proxy unit tests use translator only; integration tests use a mock upstream. Ensure `tests/openai-proxy.test.ts` and `tests/integration/openai-proxy-integration.test.ts` are included in the Jest run (they are by default).
- **E2E tests:** Require a running proxy and `OPENAI_API_KEY`. Options:
  - **Optional CI job:** Add a job that starts the proxy (with a secret `OPENAI_API_KEY`), then runs the OpenAI proxy E2E suite. Skip the job or mark optional if the secret is not set.
  - **Manual / scheduled:** Run E2E locally or in a scheduled workflow when credentials are available.
- **Documentation:** This file and [E2E-PRIORITY-RUN-LIST.md](../issues/ISSUE-381/E2E-PRIORITY-RUN-LIST.md) give contributors the commands to run proxy and tests locally and in CI.
