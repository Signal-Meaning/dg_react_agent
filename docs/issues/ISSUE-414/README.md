# Issue #414: CLI script – OpenAI proxy integration (text-in, playback + text of agent responses)

**Branch:** `davidrmcgee/issue414`  
**GitHub:** [#414](https://github.com/Signal-Meaning/dg_react_agent/issues/414)  
**Labels:** enhancement

**For current protocol/error understanding and doc index:** [CURRENT-UNDERSTANDING.md](./CURRENT-UNDERSTANDING.md).

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

### Test-app and OpenAI voice-to-voice (text + audio) – suspected playback handling gap

- **OpenAI flow has both text and audio:** With a voice-to-voice agent like OpenAI Realtime, the upstream sends both **text** (e.g. `response.output_text.done`, transcript) and **audio** (`response.output_audio.delta` / `.done`) for playback. The test-app should handle both; we may not have updated it fully for the OpenAI flow yet.
- **Observed:** In manual testing with the test-app against the OpenAI proxy, **playback is not heard** (or at most an initiating scratch on the speaker). This suggests the **test-app may be failing to handle audio playback from the OpenAI flow correctly** (e.g. format, buffering, or component path for OpenAI binary PCM).
- **Integration test is text-only:** The integration tests (`openai-proxy-integration.test.ts`) send `InjectUserMessage` and wait for `ConversationText` (from `response.output_text.done`). There is **no playback** in that test; it does not exercise the full voice-to-voice path. So integration tests do not verify OpenAI audio playback in the test-app.
- **Implications:** Fixing or verifying OpenAI audio playback in the test-app is a separate track; the "server had an error" appears right after "Audio playback finished" in logs, so if playback is broken (e.g. no real audio played), the relationship between playback handling and the upstream error may be worth investigating. See [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md).

### TTS buzzing fix (odd-length PCM)

- **Cause:** PCM16 is 2 bytes per sample. Upstream (e.g. OpenAI) can send chunks with an odd number of bytes. The previous code **truncated** the last byte to keep buffers even, which misaligned the sample stream and caused **buzzing** at chunk boundaries.
- **Fix:** In `AudioManager.queueAudio`, we **carry the odd byte** into the next chunk instead of dropping it: prepend any carried byte to the new chunk, then if the combined length is odd, store the last byte and process the rest; otherwise process the full chunk. `pendingPcmByte` is cleared when playback is stopped so the next stream starts clean.
- **Code:** `src/utils/audio/AudioManager.ts` (pending byte carry); `src/utils/audio/AudioUtils.ts` still truncates as a fallback for other callers and logs that it may cause buzz if streamed.

### "Server had an error" after response (OpenAI Realtime)

- **Observed:** Test-app sometimes shows "The server had an error while processing your request" from the agent *after* a successful turn (e.g. right after "Audio playback finished"). Greeting-text-only and minimal-session diagnostics did not remove the error, so the trigger is not our session or greeting payload.
- **Likely cause:** Known OpenAI Realtime API behavior: the server can send an `error` event after a successful response (see [community reports](https://community.openai.com/t/openai-realtime-api-server-error/1373435)). The CLI often "succeeds" because it exits on first ConversationText and closes the connection before the error arrives.
- **Workaround (UI only):** When the component receives this error and the agent is already **idle** (e.g. just finished playback), it passes `recoverable: true` on the error to the host. The test-app then logs a warning ("You can continue or reconnect") instead of a hard error, so the user can keep using the app or reconnect. **Tests do not treat it as success:** both integration and E2E tests are written to **fail** when this error is encountered (see below and [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md)).

- **session.update configuration investigation (2026-02):** Four TDD cycles tested whether session.update audio/turn_detection config causes the error. All four passed mock tests but failed manual testing — the 5-second error persisted regardless:
  1. `session.turn_detection: null` (top-level) → rejected by GA API ("Unknown parameter")
  2. `session.audio.input.turn_detection: null` → accepted, error persists
  3. `session.audio.input.turn_detection: { server_vad, create_response: false }` → accepted, error persists
  4. No audio config at all → error STILL persists

  **Conclusion:** The error is **not caused by session.update configuration**. Likely server-side default VAD idle timeout behavior. See [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md) for full details, source URLs, and remaining hypotheses.

- **Test status (after session config: turn_detection null + format):**
  - **Real-API firm audio:** Passes 5/5. **Greeting flow:** Passes with default Settings (idleTimeoutMs 10s). Idle timeout is shared via Settings.agent.idleTimeoutMs (no separate env var). See [CURRENT-UNDERSTANDING.md §2.1](./CURRENT-UNDERSTANDING.md#21-real-api-verification-firm-audio-test) and [RESOLUTION-PLAN.md](./RESOLUTION-PLAN.md).
  - **Integration (mock):** 38 passed (timing fix for "sends at most one response.create per turn" applied).
- **Regression trap (tests fail when defect is present):**
  - **Integration:** `tests/integration/openai-proxy-integration.test.ts` – Any test that receives a message with `type: 'Error'` from the proxy calls `done(new Error(...))`, so the test **fails**. Real-API tests wait **5s** after a successful response before finishing, so a late-arriving "server had an error" within that window causes a failure. A mock-only test *"when upstream sends error after session.updated, client receives Error (proxy forwards error)"* verifies the proxy forwards upstream errors (test **passes** when client receives the Error). With mocks we do not simulate a failing run; with real API, if the upstream sends the error within 5s, the test fails.
  - **E2E:** `test-app/tests/e2e/` OpenAI proxy specs call `assertNoRecoverableAgentErrors(page)`, which waits 3s then asserts `agent-error-count` and `recoverable-agent-error-count` are 0. The test-app increments both when it receives any agent error (recoverable or not). So when the upstream error occurs during an E2E run, the test **fails**.
  - **Caveat:** If the real API sends the error **after** the 5s (integration) or 3s (E2E) window, that run can still pass. Passing with real APIs means no error was received within the wait window, not that the defect is fixed.
  - **Summary:** The workaround keeps the UI usable; the tests ensure we fail when an error is received within the wait window.

---

## Next steps

See **[NEXT-STEPS.md](./NEXT-STEPS.md)** for what to do next (server error regression, optional E2E/playback hardening).

---

## References

- OpenAI proxy: `scripts/openai-proxy/` (e.g. `run.ts`, `server.ts`)
- Backend: `npm run backend`; proxy URL typically `ws://127.0.0.1:8080/openai`
- Component–proxy protocol: `docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md`, `docs/BACKEND-PROXY/INTERFACE-CONTRACT.md`
- Test run order and real upstream: `docs/development/TEST-STRATEGY.md`
