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

Run the proxy from the **project root** (the repo root where `package.json` and `node_modules` are). `npm run openai-proxy` runs from there by default.

1. Start the proxy (requires `OPENAI_API_KEY` in `.env`, `test-app/.env`, or the environment):
   ```bash
   npm run openai-proxy
   ```
   The script loads `.env` from the project root and `test-app/.env`, so you can put `OPENAI_API_KEY=sk-...` in either file. Listens on `http://localhost:8080/openai` by default. Use `OPENAI_PROXY_PORT` and `OPENAI_REALTIME_URL` to override.  
   To see client/upstream activity, run with `OPENAI_PROXY_DEBUG=1` (e.g. `OPENAI_PROXY_DEBUG=1 npm run openai-proxy`). When debug is on, the proxy uses **OpenTelemetry** logging (`scripts/openai-proxy/logger.ts`): each log is an OTel LogRecord with `SeverityNumber`, `body`, and attributes (`connection_id`, `direction`, `message_type`, `error.code`, etc.) so logs can be correlated per connection and exported to OTLP/collectors. If E2E tests never show an agent response, check proxy logs for upstream `error` events (e.g. auth or model issues).

2. Run OpenAI proxy E2E tests (test-app must be served; Playwright starts it via `webServer`):
   ```bash
   VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run test:e2e -- openai-proxy-e2e
   ```
   Tests are skipped when `VITE_OPENAI_PROXY_ENDPOINT` is not set.
