# Issue #414: CLI script – OpenAI proxy integration (text-in, playback + text of agent responses)

**Branch:** `davidrmcgee/issue414`  
**GitHub:** [#414](https://github.com/Signal-Meaning/dg_react_agent/issues/414)  
**Labels:** enhancement

---

## Summary

Add or extend a script that integrates with the OpenAI proxy to send command-line text as input and play back and display the agent's spoken and text responses.

---

## Goals

- **Input:** Text provided via command line (e.g. `script "Hello, what's the weather?"`) or stdin.
- **Integration:** Script connects to the existing OpenAI proxy (e.g. `ws://127.0.0.1:8080/openai` when backend is running) and uses the same protocol as the component (Settings, `conversation.item.create` / inject user message, etc.).
- **Output:**
  - **Playback:** Play agent TTS audio (e.g. via system audio or saved file).
  - **Text:** Show agent response text (transcript or response content) in the terminal or to stdout.

---

## Scope

- New script or extension of an existing script (e.g. under `scripts/openai-proxy/` or `scripts/`) that:
  - Accepts API key (env or flag) and optional proxy URL.
  - Sends one or more user text messages and receives agent responses.
  - Renders response text and plays audio (or optionally text-only mode).
- Document how to run the backend and then this script for quick CLI testing of the proxy.

---

## Acceptance criteria

- [x] Script takes text input from CLI (args or stdin).
- [x] Script connects to OpenAI proxy and sends user message(s); receives and displays agent text.
- [x] Option to play agent TTS audio (or skip if text-only).
- [x] Docs or usage (e.g. `--help`) for running with `npm run backend` and the script.

---

## Status

### Done

- **Tests (TDD):** `tests/integration/openai-proxy-cli.test.ts` – minimal WebSocket server that speaks the component protocol; CLI with `--text`, stdin, and `--help`; all three tests pass.
- **CLI script:** `scripts/openai-proxy/cli.ts` – connects to proxy, sends Settings → waits for SettingsApplied → sends InjectUserMessage → prints assistant ConversationText; supports `--url`, `--text`, `--text-only`, `--help`; reads message from stdin when `--text` is omitted.
- **Docs:** `scripts/openai-proxy/README.md` – "CLI (Issue #414)" section: how to run backend then CLI, examples, `npm run openai-proxy:cli`.
- **npm script:** `openai-proxy:cli` in `package.json` for `npm run openai-proxy:cli -- --text "..."`.

### Audio playback (done)

- When not using `--text-only`, the CLI streams agent TTS to the system speaker via the **speaker** package (Node writable stream). It handles `response.output_audio.delta` (base64 PCM) and `response.output_audio.done`; PCM is 24 kHz mono 16-bit per the OpenAI Realtime API. If `speaker` is unavailable, the CLI falls back to text-only and logs to stderr.
- **Why a different lib than the test-app?** The test-app (and component) use the **Web Audio API** (`AudioContext`, `createAudioBuffer` / `playAudioBuffer` in `src/utils/audio/`) in the browser. The CLI runs in **Node.js**, where there is no `AudioContext`; the **speaker** package is the Node equivalent for streaming PCM to the system output. Same format (PCM 24 kHz 16-bit), different environment.
- **Dependency:** `speaker` in devDependencies (optional at runtime: CLI still works with `--text-only` if speaker fails to load).

### Test-app TTS and E2E diagnostic

- **Proxy → binary:** The proxy sends **raw PCM binary** frames to the client when it receives `response.output_audio.delta` (base64) from upstream, so the test-app plays TTS via the same path as Deepgram (binary → component → Web Audio).
- **WebSocket binaryType:** In `WebSocketManager`, `ws.binaryType = 'arraybuffer'` is set so binary frames are delivered as `ArrayBuffer` and handled synchronously; previously Blob delivery caused async ordering issues and playback could fail to start.
- **E2E diagnostic:** `test-app/tests/e2e/openai-proxy-tts-diagnostic.spec.js` – Connects via OpenAI proxy, sends a message, waits for playback to start, then asserts binary count and that `audio-playing-status` became true. Run:  
  `VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai E2E_USE_EXISTING_SERVER=1 npx playwright test openai-proxy-tts-diagnostic`  
  (Start test-app and backend first, or let Playwright start them.)

### TTS buzzing fix (odd-length PCM)

- **Cause:** PCM16 is 2 bytes per sample. Upstream (e.g. OpenAI) can send chunks with an odd number of bytes. The previous code **truncated** the last byte to keep buffers even, which misaligned the sample stream and caused **buzzing** at chunk boundaries.
- **Fix:** In `AudioManager.queueAudio`, we **carry the odd byte** into the next chunk instead of dropping it: prepend any carried byte to the new chunk, then if the combined length is odd, store the last byte and process the rest; otherwise process the full chunk. `pendingPcmByte` is cleared when playback is stopped so the next stream starts clean.
- **Code:** `src/utils/audio/AudioManager.ts` (pending byte carry); `src/utils/audio/AudioUtils.ts` still truncates as a fallback for other callers and logs that it may cause buzz if streamed.

### "Server had an error" after response (OpenAI Realtime)

- **Observed:** Test-app sometimes shows "The server had an error while processing your request" from the agent *after* a successful turn (e.g. right after "Audio playback finished"). Greeting-text-only and minimal-session diagnostics did not remove the error, so the trigger is not our session or greeting payload.
- **Likely cause:** Known OpenAI Realtime API behavior: the server can send an `error` event after a successful response (see [community reports](https://community.openai.com/t/realtime-api-the-server-had-an-error-while-processing-your-request/978856)). The CLI often "succeeds" because it exits on first ConversationText and closes the connection before the error arrives.
- **Workaround:** When the component receives this error and the agent is already **idle** (e.g. just finished playback), it passes `recoverable: true` on the error to the host. The test-app then logs a warning ("You can continue or reconnect") instead of a hard error, so the user can keep using the app or reconnect.

- **Why integration tests don't see it:** The integration tests (`tests/integration/openai-proxy-integration.test.ts`) use a **mock** upstream WebSocket that we control. The mock only sends the events we program (e.g. `session.updated`, `response.output_text.done`). We never tell the mock to send an `error` event. The test-app, in contrast, connects to the real proxy, which connects to the **real** OpenAI API, so it receives whatever the live API sends—including the post-response error. So integration tests verify protocol translation and proxy behavior; they do not reproduce live OpenAI API behavior.

---

## References

- OpenAI proxy: `scripts/openai-proxy/` (e.g. `run.ts`, `server.ts`)
- Backend: `npm run backend`; proxy URL typically `ws://127.0.0.1:8080/openai`
- Component–proxy protocol: `docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md`, `docs/BACKEND-PROXY/INTERFACE-CONTRACT.md`
- Test run order and real upstream: `docs/development/TEST-STRATEGY.md`
