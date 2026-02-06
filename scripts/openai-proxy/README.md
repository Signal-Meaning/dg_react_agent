# OpenAI Realtime proxy – translation layer and server (Issue #381)

**Translator** (`translator.ts`): Pure mapping functions – component (Deepgram Voice Agent protocol) ↔ OpenAI Realtime client/server events.

**Server** (`server.ts`): WebSocket server that listens on a path (e.g. `/openai`), accepts component protocol, translates to OpenAI Realtime, forwards to upstream (real or mock), and translates upstream events back to component. Buffers client messages until upstream is open.

- **Unit tests**: `tests/openai-proxy.test.ts` (Jest).
- **Integration tests**: `tests/integration/openai-proxy-integration.test.ts` (Jest, `@jest-environment node`).
- **Contract**: See `docs/issues/ISSUE-381/API-DISCONTINUITIES.md`.

## Translator exports

- `mapSettingsToSessionUpdate(settings)` – component Settings → OpenAI `session.update`
- `mapInjectUserMessageToConversationItemCreate(msg)` – component InjectUserMessage → OpenAI `conversation.item.create`
- `mapSessionUpdatedToSettingsApplied(event)` – OpenAI `session.updated` → component SettingsApplied
- `mapGreetingToConversationItemCreate(greeting)` – greeting string → OpenAI `conversation.item.create` (assistant); used after session.updated (Issue #381)
- `mapGreetingToConversationText(greeting)` – greeting string → component ConversationText (assistant); sent to component after session.updated
- `mapOutputTextDoneToConversationText(event)` – OpenAI `response.output_text.done` → component ConversationText
- `mapErrorToComponentError(event)` – OpenAI `error` → component Error

## Server

- `createOpenAIProxyServer(options)` – attaches a WebSocket server to an HTTP server at `options.path`, connects to `options.upstreamUrl`, and translates messages both ways. Optional `upstreamHeaders` (e.g. `Authorization: Bearer <OPENAI_API_KEY>`) for upstream auth. Run with a mock upstream in integration tests; run with real OpenAI Realtime URL for E2E.

## Running the proxy (E2E)

**Canonical:** Run the **test-app backend** (one server for both Deepgram and OpenAI proxies):

```bash
cd test-app && npm run backend
```

That starts the backend server which hosts `/openai` (and `/deepgram-proxy`). The OpenAI proxy logic in this directory is used by that backend (e.g. via subprocess or in-process). Do not run a separate OpenAI-only process from the repo root for normal test-app usage.

**Standalone (optional):** For integration tests or when you need only the OpenAI proxy on its own HTTP server, from the **project root**:

```bash
npx tsx scripts/openai-proxy/run.ts
```

Requires `OPENAI_API_KEY` in `.env`, `test-app/.env`, or the environment. The script loads `.env` from the project root and `test-app/.env`. Listens on `http://localhost:8080/openai` by default. Use `OPENAI_PROXY_PORT` and `OPENAI_REALTIME_URL` to override. To see client/upstream activity, run with `OPENAI_PROXY_DEBUG=1`. When debug is on, the proxy uses **OpenTelemetry** logging (`scripts/openai-proxy/logger.ts`). If E2E tests never show an agent response, check proxy logs for upstream `error` events (e.g. auth or model issues).

Run OpenAI proxy E2E tests (test-app must be served; Playwright starts it via `webServer`):
   ```bash
   VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run test:e2e -- openai-proxy-e2e
   ```
   Tests are skipped when `VITE_OPENAI_PROXY_ENDPOINT` is not set.

## CLI (Issue #414)

A CLI script sends text to the proxy and prints (and optionally plays) agent responses. Useful for quick proxy testing without the test-app UI.

**1. Start the backend** (from repo root, either):

- Test-app backend (recommended): `cd test-app && npm run backend`
- Standalone proxy: `npx tsx scripts/openai-proxy/run.ts`

**2. Run the CLI** (from repo root, or from test-app):

```bash
# From repo root:
npx tsx scripts/openai-proxy/cli.ts --text "Hello, what's the weather?"
npm run openai-proxy:cli -- --text "Hello"

# From test-app (e.g. after starting backend there): same script name
npm run openai-proxy:cli -- --text "Hello"

# From stdin
echo "Hello" | npx tsx scripts/openai-proxy/cli.ts

# Custom URL (default: ws://127.0.0.1:8080/openai)
npx tsx scripts/openai-proxy/cli.ts --url ws://127.0.0.1:8080/openai --text "Hi"
# Text-only (no TTS playback)
npx tsx scripts/openai-proxy/cli.ts --text-only --text "Hi"
# Usage
npx tsx scripts/openai-proxy/cli.ts --help
```

- **Integration tests**: `npm test -- tests/integration/openai-proxy-cli.test.ts`
