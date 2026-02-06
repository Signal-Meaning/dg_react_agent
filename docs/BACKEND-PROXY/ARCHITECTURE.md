# Backend proxy architecture (test-app)

This document describes how the **single backend server** for the test-app is structured, how the two proxies (Deepgram and OpenAI) are implemented without duplication (DRY), and the single canonical way to run the backend.

## Single backend server

The test-app uses **one backend process** that:

- Listens on one HTTP(S) server (default port 8080).
- Hosts **both** proxy endpoints on that server:
  - **Deepgram**: path `/deepgram-proxy` (configurable via `PROXY_PATH`) — pass-through to Deepgram Voice Agent (and optionally transcription) API.
  - **OpenAI**: path `/openai` — translation proxy (component protocol ↔ OpenAI Realtime API).
- Is the **only** supported way to run proxies for the test-app. There is no separate “run OpenAI proxy from repo root” workflow.

**How to run the backend (canonical):**

```bash
cd test-app
npm run backend
```

Environment: load keys from `test-app/.env` (e.g. `DEEPGRAM_API_KEY` or `VITE_DEEPGRAM_API_KEY`, `OPENAI_API_KEY` or `VITE_OPENAI_API_KEY`). At least one must be set. See `test-app/scripts/backend-server.js` (or equivalent) for `PROXY_PORT`, `PROXY_PATH`, and HTTPS.

## DRY: one implementation per proxy

### OpenAI proxy — single implementation

- **Implementation lives only in:** `scripts/openai-proxy/` (repo root):
  - `server.ts`: WebSocket server that accepts component protocol, translates via `translator.ts`, talks to OpenAI Realtime upstream.
  - `translator.ts`: Component ↔ OpenAI Realtime message mapping.
  - `run.ts`: Optional standalone entry (creates HTTP server and attaches the proxy); used when running the OpenAI proxy alone (e.g. for integration tests or legacy usage).
- **No duplicate OpenAI proxy logic elsewhere.** The test-app backend server does **not** reimplement the OpenAI proxy; it either:
  - **Spawns** `scripts/openai-proxy/run.ts` on an internal port and forwards `/openai` traffic to it, or
  - **Attaches** the same `createOpenAIProxyServer()` to its shared HTTP server (if refactored to run with tsx and import the module).
- So: **one** place that implements “component protocol → OpenAI Realtime” and “OpenAI Realtime → component protocol”.

### Deepgram proxy — single implementation

- **Implementation lives only in:** the test-app backend server script (e.g. `test-app/scripts/backend-server.js`).
- Behavior: **pass-through** WebSocket proxy (client ↔ Deepgram). No protocol translation; the component already speaks the Deepgram Voice Agent protocol. The backend adds auth (e.g. API key) and forwards messages.
- **No duplicate Deepgram proxy logic elsewhere.** There is no second file or repo that implements “proxy to Deepgram” for the test-app.

### Summary (DRY)

| Proxy    | Single implementation location              | Used by test-app backend as        |
|----------|---------------------------------------------|-------------------------------------|
| OpenAI   | `scripts/openai-proxy/` (server + translator) | Subprocess or in-process attachment |
| Deepgram | test-app backend server script              | In-process pass-through at path     |

So we are **DRY**: each proxy’s behavior is implemented in one place; the backend server only composes them.

## Common structure and patterns

- **One HTTP(S) server** is created by the backend server script.
- **Routing by path:** The server’s `upgrade` handler routes by path:
  - `/openai` → OpenAI proxy (either forwarder to subprocess or `createOpenAIProxyServer` attached to the same server).
  - `/deepgram-proxy` (or `PROXY_PATH`) → Deepgram pass-through handler.
- **Same pattern for both:** “Attach a WebSocket handler at a path.” For Deepgram, that handler is the inline pass-through logic. For OpenAI, it is either a forwarder to the subprocess or the OpenAI proxy module attached to the same server. So both are “path → handler” on a single server; only the handler implementation differs (pass-through vs translation proxy).
- **Function endpoints:** The same backend server can host HTTP endpoints for function-calling or other testing; they live alongside the two proxy paths on the same server.

## No redundant launch from project root

- **Removed:** A separate npm script at the **repo root** that runs only the OpenAI proxy (e.g. `npm run openai-proxy`). That would be a second way to “run a proxy” and conflicts with “one backend server.”
- **Canonical:** Run the backend from the test-app with `cd test-app && npm run backend`. That starts the single server that hosts both proxies (and any function endpoints). Integration or E2E tests that need the OpenAI proxy use the same backend server (or, for Jest integration tests that import `scripts/openai-proxy/server.ts`, they exercise the **module** only, not the npm script).

## References

- [Component–Proxy Contract](./COMPONENT-PROXY-CONTRACT.md) — protocol and readiness contract for all proxies.
- [Interface Contract](./INTERFACE-CONTRACT.md) — proxy interface and reference implementation.
- `scripts/openai-proxy/README.md` — OpenAI proxy module (translation layer and server API).
