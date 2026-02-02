# Proxy Server: Purpose, Design, Operation, and Tests

**Last updated:** February 2026  
**Implementation:** `test-app/scripts/mock-proxy-server.js`  
**Run command:** `npm run test:proxy:server` (from `test-app/`)

This document explains the test-app proxy server: why it exists, how it is designed, how to run and configure it, and how it is tested.

---

## 1. Purpose

The proxy server exists to support **E2E and integration testing** of the Deepgram Voice Interaction React component and the test-app without exposing API keys in the browser or test fixtures.

### Why use a proxy?

1. **Security** – The frontend connects to a WebSocket URL that does not include the API key. The proxy adds the key server-side when connecting to Deepgram or OpenAI.
2. **Backend flexibility** – The same test-app can target **Deepgram** (Voice Agent or Transcription) or the **OpenAI Realtime** proxy by changing the proxy endpoint URL.
3. **Single port** – One server on port 8080 (by default) can expose:
   - **`/deepgram-proxy`** – proxies to Deepgram (agent or transcription).
   - **`/openai`** – forwards to the OpenAI Realtime proxy subprocess (default for test-app when the OpenAI key is set).
4. **Realistic E2E** – E2E tests run against a real WebSocket proxy, matching production patterns where a backend owns the API key.

### When is it used?

- **E2E tests** – Playwright runs the test-app; the app connects to `ws://localhost:8080/...` (or the configured proxy URL). The proxy is started separately or by Playwright’s `webServer` (see [Operation](#3-operation)).
- **Manual testing** – Run `npm run test:proxy:server` in one terminal and the test-app in another to exercise proxy mode.
- **CI** – The same proxy can serve both Deepgram and OpenAI E2E runs when both API keys are present.

---

## 2. Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Single HTTP server (port 8080 by default)                              │
│                                                                         │
│  Path /deepgram-proxy  ──►  WebSocketServer  ──►  Deepgram              │
│       (when DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY set)              │
│       • Agent: wss://agent.deepgram.com/v1/agent/converse               │
│       • Transcription: wss://api.deepgram.com/v1/listen                │
│                                                                         │
│  Path /openai          ──►  WebSocketServer (forwarder)  ──►  Subprocess│
│       (when OPENAI_API_KEY or VITE_OPENAI_API_KEY set)                 │
│       • Forwards to ws://127.0.0.1:8081/openai                           │
│       • Subprocess: npx tsx scripts/openai-proxy/run.ts (port 8081)     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **One process, one port (8080).**  
- **Deepgram path** – Implemented in `mock-proxy-server.js`: accepts client WebSocket, opens a second WebSocket to Deepgram with the API key (token subprotocol), and forwards messages both ways. Service type (agent vs transcription) comes from the query parameter `service`.  
- **OpenAI path** – Implemented by spawning the existing **OpenAI Realtime proxy** (`scripts/openai-proxy/run.ts`) on an internal port (8081). The main server attaches a WebSocket server on path `/openai` that **forwards** each client connection to `ws://127.0.0.1:8081/openai`. The subprocess does the protocol translation (component protocol ↔ OpenAI Realtime).

### API key rules

- **At least one key required** – The server exits with code 1 if neither a Deepgram key nor an OpenAI key is set.
- **Deepgram** – Uses `DEEPGRAM_API_KEY` or `VITE_DEEPGRAM_API_KEY`. Key is normalized (e.g. optional `dgkey_` prefix stripped) and sent to Deepgram via WebSocket subprotocol.
- **OpenAI** – Uses `OPENAI_API_KEY` or `VITE_OPENAI_API_KEY`. Passed to the subprocess; the OpenAI proxy adds it when calling the OpenAI API.

### Optional auth and CORS

- **Auth token** – Query param `token` can be used for optional proxy authentication (validated in `verifyClient`; not forwarded to Deepgram/OpenAI).
- **CORS** – Origin is validated; security headers are set on upgrade responses. Invalid or blocked origins are rejected.

### Internal details

- **Deepgram** – Message queuing so messages from Deepgram are not dropped before the client is ready (see Issue #329). Query params (except `service` and `token`) are forwarded to Deepgram.
- **OpenAI** – Subprocess is started with `OPENAI_PROXY_PORT=8081`. The main server waits until port 8081 is listening, then attaches the `/openai` forwarder. On shutdown, the subprocess is killed (SIGTERM).

---

## 3. Operation

### How to run

From the **test-app** directory:

```bash
cd test-app
npm run test:proxy:server
```

Or from the repo root:

```bash
node test-app/scripts/mock-proxy-server.js
```

The server binds to **port 8080** (or `PROXY_PORT`) and logs which endpoints are active.

### Environment variables

Loaded from **`test-app/.env`** unless `SKIP_DOTENV=1` (used by integration tests).

| Variable | Purpose | Default |
|----------|---------|---------|
| `DEEPGRAM_API_KEY` or `VITE_DEEPGRAM_API_KEY` | Deepgram API key; enables `/deepgram-proxy` | — |
| `OPENAI_API_KEY` or `VITE_OPENAI_API_KEY` | OpenAI API key; enables `/openai` (subprocess) | — |
| `PROXY_PORT` | Port for the main server | `8080` |
| `PROXY_PATH` | WebSocket path for Deepgram | `/deepgram-proxy` |
| `SKIP_DOTENV` | If `1`, do not load `test-app/.env` | — |

At least one of the Deepgram or OpenAI keys must be set; otherwise the process exits with code 1.

### Startup output

Example with **both** keys set:

```
🚀 Mock Backend Proxy Server starting...
   Deepgram: ws://localhost:8080/deepgram-proxy → wss://agent.deepgram.com/v1/agent/converse
   API Key: 61a75ff2...
   OpenAI:   ws://localhost:8080/openai (subprocess on 8081)

✅ Mock Backend Proxy Server running on port 8080
   Deepgram: ws://localhost:8080/deepgram-proxy
   OpenAI:   ws://localhost:8080/openai (default for test-app)

   To use in test-app:
   VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai  (default)
   VITE_DEEPGRAM_PROXY_ENDPOINT=ws://localhost:8080/deepgram-proxy

   Press Ctrl+C to stop
```

With only one key set, only the corresponding endpoint lines are printed.

### Shutdown

- **SIGINT** (Ctrl+C) or **SIGTERM** – Both WebSocket servers are closed, the OpenAI subprocess (if any) is killed, and the HTTP server is closed before the process exits.

### Using with the test-app

- **Deepgram only** – Set `VITE_DEEPGRAM_PROXY_ENDPOINT=ws://localhost:8080/deepgram-proxy` (or use connection mode + proxy URL in the UI).
- **OpenAI (default)** – Set `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai`. The test-app uses this as the default proxy when present.
- **E2E** – Playwright can start the proxy via `webServer` in `test-app/tests/playwright.config.mjs`, or you can start it yourself and run with `E2E_USE_EXISTING_SERVER=1`.

See [OPENAI-PROXY-AND-ISSUE-381.md](./OPENAI-PROXY-AND-ISSUE-381.md) and repo `docs/issues/ISSUE-381/RUN-OPENAI-PROXY.md` for OpenAI proxy details.

---

## 4. Tests

The proxy server is covered by **unit**, **integration**, and **E2E** tests. The following focuses on how each layer exercises the proxy.

### 4.1 Unit tests (Deepgram routing)

**File:** `test-app/tests/mock-proxy-server.test.js`

**What they do:**  
Test **inlined helpers** that mirror the Deepgram logic in the server:

- **Service type detection** – `service=agent` vs `service=transcription` (or pathname) from the request URL.
- **Endpoint routing** – Agent → `wss://agent.deepgram.com/v1/agent/converse`, transcription → `wss://api.deepgram.com/v1/listen`.
- **Query parameter forwarding** – All query params except `service` and `token` are forwarded to Deepgram.

**What they do not do:**  
They do **not** start the server or open WebSocket connections to `/deepgram-proxy` or `/openai`.

**Run (from repo root):**

```bash
npm test -- mock-proxy-server
```

### 4.2 Integration tests (proxy process)

**File:** `test-app/tests/mock-proxy-server-integration.test.js`

**What they do:**  
Spawn the real `mock-proxy-server.js` with controlled env (using `SKIP_DOTENV=1` so `.env` is not loaded):

1. **At least one key required** – Neither Deepgram nor OpenAI key set → process must exit with code 1 and stderr containing “at least one of DEEPGRAM_API_KEY or OPENAI_API_KEY is required”.
2. **Starts with Deepgram key** – Only `DEEPGRAM_API_KEY` set → process stays up until SIGTERM (no immediate exit).
3. **Starts with OpenAI key** – Only `OPENAI_API_KEY` set → process stays up until SIGTERM (subprocess and forwarder start asynchronously).

These tests assert that the server’s **startup and key checks** behave correctly; they do not assert WebSocket traffic on `/deepgram-proxy` or `/openai`.

**Run (from repo root):**

```bash
npm test -- mock-proxy-server-integration
```

### 4.3 E2E tests (test-app + proxy)

**What they do:**  
Playwright drives the test-app in a browser. The app connects to the proxy (e.g. `ws://localhost:8080/deepgram-proxy` or `ws://localhost:8080/openai`). The proxy is assumed to be **already running** (started manually or by Playwright’s `webServer`).

**Specs that assume the proxy:**

| Spec | Proxy path | Purpose |
|------|------------|---------|
| `test-app/tests/e2e/deepgram-backend-proxy-mode.spec.js` | `/deepgram-proxy` | Connection, agent responses, reconnection, proxy unavailable handling |
| `test-app/tests/e2e/deepgram-backend-proxy-authentication.spec.js` | `/deepgram-proxy` | Auth token in proxy connection, optional auth, invalid/expired token |
| `test-app/tests/e2e/api-key-security-proxy-mode.spec.js` | `/deepgram-proxy` | API key not in client URLs/DOM/console |
| `test-app/tests/e2e/openai-proxy-e2e.spec.js` | `/openai` | OpenAI proxy: connection, single message, multi-turn, reconnection, basic audio, simple function calling |
| Others (e.g. context retention, function calling) | Depends on `VITE_OPENAI_PROXY_ENDPOINT` or proxy mode | Various flows through proxy |

E2E tests do **not** start the proxy server logic themselves; they assume it is running and only assert app behavior and, where relevant, that the app talks to the expected proxy URL.

**Run (from test-app, proxy already running):**

```bash
cd test-app
# Terminal 1:
npm run test:proxy:server
# Terminal 2:
USE_PROXY_MODE=true npm run test:e2e
```

Or let Playwright start the dev server and proxy (see `test-app/tests/playwright.config.mjs`).

### 4.4 Test coverage summary and gaps

**File:** `test-app/tests/PROXY-SERVER-TEST-COVERAGE.md`

That document lists:

- **Requirements** – At least one key, Deepgram path, OpenAI path, both on one port, startup message.
- **Current tests** – Unit (Deepgram routing), integration (key requirement + startup), E2E (test-app + proxy).
- **Gaps** – No tests that (1) open a WebSocket to `/openai` and assert the forwarder, (2) assert both `/deepgram-proxy` and `/openai` on the same port with both keys set, or (3) assert the exact startup message text.

---

## 5. Related documentation

- **[OPENAI-PROXY-AND-ISSUE-381.md](./OPENAI-PROXY-AND-ISSUE-381.md)** – OpenAI proxy backend, test-app changes, and E2E usage.
- **[PROXY-SERVER-TEST-COVERAGE.md](../tests/PROXY-SERVER-TEST-COVERAGE.md)** – Requirements vs. tests and how to run them.
- **Repo `docs/issues/ISSUE-381/`** – OpenAI proxy implementation, RUN-OPENAI-PROXY, API discontinuities, E2E plan.
- **Repo `docs/BACKEND-PROXY/`** – Backend proxy interface and implementation guides (generic backend proxy pattern).
