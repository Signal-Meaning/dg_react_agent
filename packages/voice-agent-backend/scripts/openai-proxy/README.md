# OpenAI Realtime proxy – translation layer and server (Issue #381)

**Translator** (`translator.ts`): Pure mapping functions – component (Deepgram Voice Agent protocol) ↔ OpenAI Realtime client/server events.

**Server** (`server.ts`): WebSocket server that listens on a path (e.g. `/openai`), accepts component protocol, translates to OpenAI Realtime, forwards to upstream (real or mock), and translates upstream events back to component. Buffers client messages until upstream is open.

- **Unit tests**: `tests/openai-proxy.test.ts` (Jest).
- **Integration tests**: `tests/integration/openai-proxy-integration.test.ts` (Jest, `@jest-environment node`).
- **Contract:** [PROTOCOL-AND-MESSAGE-ORDERING.md](./PROTOCOL-AND-MESSAGE-ORDERING.md) (wire protocol and ordering); [docs/issues/ISSUE-381/API-DISCONTINUITIES.md](../../docs/issues/ISSUE-381/API-DISCONTINUITIES.md) (API mapping).

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

## Protocol and message ordering

**Full spec:** [PROTOCOL-AND-MESSAGE-ORDERING.md](./PROTOCOL-AND-MESSAGE-ORDERING.md)

- **Wire contract:** Client sends JSON as **text** and microphone PCM as **binary**. Proxy → client: **only** decoded TTS from `response.output_audio.delta` is sent as **binary**; all other messages (SettingsApplied, ConversationText, Error, conversation.item.*, etc.) are sent as **text**. Sending JSON as binary would route it into the component’s audio pipeline (Issue #414).
- **Ordering:** Proxy sends `SettingsApplied` only after upstream `session.updated` (not on `session.created`). Context and greeting are applied after session is configured. `response.create` is sent only after the upstream confirms the corresponding item(s) (e.g. after `conversation.item.added` for InjectUserMessage).

## Running the proxy (E2E)

**Canonical:** Run the **test-app backend** (one server for both Deepgram and OpenAI proxies):

```bash
cd test-app && npm run backend
```

That starts the backend server which hosts `/openai` (and `/deepgram-proxy`). The OpenAI proxy logic in this directory is used by that backend (e.g. via subprocess or in-process). Do not run a separate OpenAI-only process from the repo root for normal test-app usage.

**Standalone (optional):** Run from **this package directory** (voice-agent-backend). From repo root: `cd packages/voice-agent-backend && npx tsx scripts/openai-proxy/run.ts`. Requires `OPENAI_API_KEY` in `.env` or the environment; the script loads `.env` from the package dir and parent dirs. Listens on `http://localhost:8080/openai` by default. Use `OPENAI_PROXY_PORT` and `OPENAI_REALTIME_URL` to override. To see client/upstream activity, run with `OPENAI_PROXY_DEBUG=1`. When debug is on, the proxy uses **OpenTelemetry** logging (`logger.ts` in this directory). If E2E tests never show an agent response, check proxy logs for upstream `error` events (e.g. auth or model issues).

**Greeting-text-only (diagnostic):** Set `OPENAI_PROXY_GREETING_TEXT_ONLY=1` so the proxy sends the greeting to the client only (UI shows it) and does not send `conversation.item.create` (greeting) to OpenAI. If the error stops, the greeting injection was the cause. (Testing showed the error can persist without it, so the trigger may be elsewhere.)

**Idle timeout:** The proxy sends **`idle_timeout_ms`** in `session.update` from **Settings.agent.idleTimeoutMs** (shared with the component; no separate env var). When the upstream closes due to idle timeout, the proxy logs at INFO ("expected idle timeout closure") and sends code **`idle_timeout`**; the component treats it as expected closure. See PROTOCOL-AND-MESSAGE-ORDERING.md §3.9.

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

**Audio playback (omit `--text-only`):** The CLI streams agent TTS to your system speaker using the `speaker` package (PCM 24 kHz mono 16-bit from the OpenAI Realtime API). If `speaker` is not available (e.g. missing system audio libraries), the CLI falls back to text-only and prints a short message to stderr.

- **Integration tests**: `npm test -- tests/integration/openai-proxy-cli.test.ts`
