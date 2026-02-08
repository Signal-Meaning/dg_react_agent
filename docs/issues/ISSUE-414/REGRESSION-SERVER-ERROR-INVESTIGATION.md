# Regression: OpenAI "server had an error" after successful response

**Issue:** [#414](https://github.com/Signal-Meaning/dg_react_agent/issues/414)  
**Status:** Investigation pending; tests written to **fail** when the defect is present.

---

## Summary

The test-app (and any app using the OpenAI proxy) receives an error from the OpenAI Realtime API **after** a successful turn: *"The server had an error while processing your request..."*. Playback and the turn complete successfully; then the upstream sends an `error` event. This is a **regression** that we should investigate and resolve, not only work around.

**Observed timing (manual test):** Connection start 20:25:33 → "Audio playback finished" → error at 20:25:38. So the error appears **~5 seconds after connection start**, and **immediately or within 1–2 seconds after "Audio playback finished"**. The warning is the next log line after playback finished, so the upstream likely sends the error very soon after the turn/playback completes.

---

## Suspected: test-app not handling OpenAI audio playback correctly

- **Voice-to-voice (OpenAI):** The OpenAI Realtime flow sends both **text** (e.g. `response.output_text.done`, transcript) and **audio** (`response.output_audio.delta` / `.done`) for playback. The test-app should play the agent’s TTS like it does for Deepgram.
- **Observed in manual testing:** User **cannot hear playback** (or at most an initiating scratch on the speaker). This suggests the **test-app may be failing to handle audio from the OpenAI flow correctly** (e.g. binary PCM format, sample rate, buffering, or the component path for OpenAI vs Deepgram). We may not have updated the test-app for the OpenAI voice-to-voice case yet.
- **Why this might matter:** The "server had an error" appears right after "Audio playback finished" in the log. If playback is actually broken (no real audio played, or only a scratch), the component may still transition to "playback finished" and idle, and the upstream may still send the error. Investigating whether the test-app correctly receives, buffers, and plays OpenAI PCM could be part of the regression investigation.
- **Integration tests:** They only wait for `ConversationText` (text path); they do **not** exercise playback. So integration tests do not verify that the test-app handles OpenAI audio correctly.

---

## Why the UI "passes" but tests must fail

We added a **workaround** so the app doesn't break in the UI:

- When the component receives this error and the agent is already **idle** (e.g. just after playback finished), it marks the error as **recoverable** and the host (test-app) shows a **warning** instead of a hard error: *"You can continue or reconnect."*
- So the UI keeps working, but the **underlying problem remains**: the upstream is still sending an error after a successful response.

Treating the error as recoverable **must not** let tests pass. Both integration and E2E tests are written so that **when this error is encountered, the test fails** (demonstrating the defect is present).

---

## Trap: tests fail when the defect is present

### Integration tests (`tests/integration/openai-proxy-integration.test.ts`)

- **Any upstream Error → test fails:** Every test that receives a message with `type: 'Error'` from the proxy calls `done(new Error(...))`, so the test **fails**.
- **Late-arriving error:** Real-API tests ("translates InjectUserMessage...", "echoes user message...") wait **5 seconds** after a successful response before calling `done()`. If the "server had an error" arrives within that window, the test **fails**. If the error arrives after 5s, that run can still pass; passing with real APIs means no error was received within the wait window.
- **Proxy-forwards-error test (mock, passes):** The mock-only test *"when upstream sends error after session.updated, client receives Error (proxy forwards error)"* has the mock send an `error` event after `session.updated`. When the client receives the proxy-forwarded `type: 'Error'`, the test asserts the message and **passes**. This verifies the proxy forwards upstream errors; we do not force a failing test with mocks.

### E2E tests (`test-app/tests/e2e/`)

- **Error-count assertion:** At the end of each OpenAI proxy E2E test, `assertNoRecoverableAgentErrors(page)` runs. It waits **3 seconds** (so late-arriving errors are reflected), then asserts that `agent-error-count` and `recoverable-agent-error-count` in the test-app DOM are **0**. The test-app increments both when it receives any agent error (recoverable or not). So when the upstream "server had an error" occurs during a test run, the assertion fails and the test **fails**.

### Summary

| Layer        | When error is present | Result   |
|-------------|------------------------|----------|
| UI (workaround) | User sees warning      | App keeps working |
| Integration     | Client receives `type: 'Error'` or error arrives within 5s | Test **fails** |
| E2E             | Counts > 0 after 3s wait     | Test **fails** |

---

## session.update configuration investigation (2026-02 TDD cycles)

**Methodology:** Strict TDD — write a failing test first (red), then fix the code (green), then verify with real API (manual test). Four cycles were run to test whether any `session.update` audio/turn_detection configuration eliminates the 5-second server error.

### Cycle 1: `session.turn_detection: null` (top-level)

- **Hypothesis:** Disabling server VAD via `turn_detection: null` at session top level prevents the idle timeout error.
- **Test (red):** Asserted `sessionUpdate.session.turn_detection === null`. Failed: `Received: undefined`.
- **Fix (green):** Added `turn_detection: null` to `mapSettingsToSessionUpdate` at session top level. Test passed; full suite (865 tests) passed.
- **Manual result:** OpenAI rejected it: **"Unknown parameter: 'session.turn_detection'"**. The GA API does not accept `turn_detection` at session top level.
- **Source:** [OpenAI Realtime API developer blog](https://developers.openai.com/blog/realtime-api/) — GA examples show `session.audio.input.turn_detection` nesting, not top-level.

### Cycle 2: `session.audio.input.turn_detection: null`

- **Hypothesis:** GA API nests turn_detection under `audio.input`. Setting it to `null` disables server VAD.
- **Test (red):** Asserted `sessionUpdate.session.audio.input.turn_detection === null`. Failed: `audio` was `undefined`.
- **Fix (green):** Changed to `audio: { input: { turn_detection: null } }`. Updated `OpenAISessionUpdate` interface type. Test passed; full suite passed.
- **Manual result:** No "Unknown parameter" error — the GA nesting was accepted. But the **5-second server error persisted**.
- **Sources:**
  - [Community: turn_detection null breaks manual audio control](https://community.openai.com/t/turn-detection-null-breaks-manual-audio-control-in-realtime-api-web-rtc/1146451) — reports `turn_detection: null` is broken in GA API.
  - [Community: should be able to turn off server VAD](https://community.openai.com/t/correct-me-if-im-wrong-but-i-should-be-able-to-turn-off-server-vad-right/1359229)

### Cycle 3: `session.audio.input.turn_detection: { type: 'server_vad', create_response: false }`

- **Hypothesis:** Instead of disabling VAD, keep it active but prevent auto-response with `create_response: false`. The proxy handles turn detection manually (debounce + `response.create`).
- **Test (red):** Asserted `audio.input.turn_detection.type === 'server_vad'` and `create_response === false`. Failed: turn_detection was `null`, not an object.
- **Fix (green):** Changed to `{ type: 'server_vad', create_response: false, interrupt_response: true }`. Test passed; full suite passed.
- **Manual result:** Accepted by API — but **5-second server error STILL persisted**.
- **Source:** [OpenAI Realtime VAD docs](https://platform.openai.com/docs/guides/realtime-vad) — documents `create_response` and `interrupt_response` options.

### Cycle 4: No audio config at all

- **Hypothesis:** Sending partial audio config (turn_detection without `audio.input.format`) puts the session in a broken audio input state. The official examples include `audio.input.format` alongside turn_detection. Removing all audio config lets OpenAI use defaults.
- **Test (red):** Asserted `sessionUpdate.session.audio === undefined`. Failed: audio had the turn_detection config from cycle 3.
- **Fix (green):** Removed all audio config from `mapSettingsToSessionUpdate`. Test passed; full suite passed.
- **Manual result:** **5-second server error STILL persisted** even when we tried a minimal session.update (only `type`, `model`, `instructions`). That diagnostic option has since been removed.

### Conclusion

The 5-second "server had an error" is **NOT caused by session.update configuration**. Four TDD cycles confirmed:

| Cycle | Configuration | API accepted? | Error resolved? |
|-------|--------------|---------------|-----------------|
| 1 | `session.turn_detection: null` (top-level) | No ("Unknown parameter") | N/A |
| 2 | `session.audio.input.turn_detection: null` | Yes | No |
| 3 | `session.audio.input.turn_detection: { server_vad, create_response: false }` | Yes | No |
| 4 | No audio config at all | Yes | No |

The error appears to be **server-side default behavior** — likely the default server VAD idle timeout firing ~5-6 seconds after session establishment when no audio input is provided. The `idle_timeout_ms` parameter (documented in VAD config) may control this, but we have not yet confirmed its default value or tested overriding it.

**Current state:** `mapSettingsToSessionUpdate` sends no audio config (cycle 4). The code comments document the full investigation history. The test asserts `session.audio === undefined` and `session.turn_detection === undefined`.

---

## OpenAI Realtime API reference URLs

These URLs were collected during the investigation. They document the protocol, known issues, and community-reported behaviors relevant to the server error.

### Official documentation

- **Realtime VAD configuration:** https://platform.openai.com/docs/guides/realtime-vad — Documents `turn_detection` options including `type`, `create_response`, `interrupt_response`, `idle_timeout_ms`, `silence_duration_ms`.
- **Client events reference:** https://platform.openai.com/docs/api-reference/realtime-client-events — Full list of client-to-server events (`session.update`, `input_audio_buffer.append`, `response.create`, etc.).
- **GA API developer blog:** https://developers.openai.com/blog/realtime-api/ — Shows GA API session.update format with `session.audio.input.turn_detection` nesting (not top-level).
- **Realtime conversations guide:** https://platform.openai.com/docs/guides/realtime-conversations — Session format, audio encoding, and protocol overview.

### Community reports and known issues

- **Server error reports:** https://community.openai.com/t/openai-realtime-api-server-error/1373435 — Multiple users reporting "The server had an error while processing your request" in Realtime API sessions.
- **turn_detection: null broken:** https://community.openai.com/t/turn-detection-null-breaks-manual-audio-control-in-realtime-api-web-rtc/1146451 — Setting `turn_detection: null` in GA API reportedly does not work as expected.
- **Disabling server VAD:** https://community.openai.com/t/correct-me-if-im-wrong-but-i-should-be-able-to-turn-off-server-vad-right/1359229 — Discussion of whether server VAD can be fully disabled.
- **Idle timeout behavior:** https://community.openai.com/t/websocket-cant-distinguish-idle-timeout-from-regular-speech-stopped-is-this-expected/1371509 — Reports that idle timeout (~5-6s default) fires and cannot be easily distinguished from speech-stopped events.
- **GA format issues (beta vs GA):** https://community.openai.com/t/realtime-api-beta-realtime-api-ga-receiving-type-error-with-session-audio-input-format/1355366 — Differences between beta and GA API format for session.update.
- **SDK beta header mismatch:** https://github.com/openai/openai-node/issues/1641 — `openai-node` SDK sends beta headers that can cause the API to use a different format than expected (fixed in openai-node 5.23.1).

---

## What we need to do

1. **Investigate root cause (updated)**
   - ~~Hypotheses to pursue: session/context/greeting handling, session.update audio config.~~ **Ruled out** by TDD cycles 1–4 (see above).
   - Remaining hypotheses:
     - **Server VAD idle timeout (`idle_timeout_ms`):** The default may be ~5-6 seconds. When no audio input is provided after session establishment, the server VAD fires an idle timeout and sends an error. Need authoritative documentation of the default value and whether it can be overridden (e.g. set to a very high value or disabled).
     - **Message ordering / protocol compliance:** The WebSocket protocol mixes binary (PCM audio) and text (JSON control messages). Investigate whether our message ordering or content types violate the expected protocol.
     - **Upstream bug:** The error message ("The server had an error… You can continue or reconnect") may be a known upstream behavior that OpenAI has not resolved. Gather more evidence from community reports.
   - Ruled out so far: greeting injection (greeting-text-only didn't remove it), full session payload (minimal-session didn't remove it), all session.update audio configurations (TDD cycles 1–4).

2. **Document the protocol** ✅ **Done (2026-02).**
   - **See:** [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) — catalogs client → proxy and proxy → upstream events, upstream → proxy handling, **frame types (text vs binary)**, and ordering (session.created vs session.updated, response.create after item confirmation, etc.).
   - The OpenAI Realtime WebSocket carries both binary (PCM from `response.output_audio.delta`) and text (JSON). The proxy sends only TTS PCM as binary to the client; all other messages as text.

3. **Fix the regression**
   - Change proxy and/or component behavior so that the upstream no longer sends this error after a successful turn (or document an upstream bug and a proper mitigation).
   - Re-evaluate the **recoverable** workaround: keep it only as a safety net for genuine post-response upstream errors, or remove it once the regression is resolved.
   - **Do NOT suppress errors** — the proxy must forward all upstream errors to the client.

4. **Verify**
   - Reproduce the error in a minimal setup (e.g. test-app + proxy + real API), then confirm it no longer occurs after the fix.
   - Ensure integration and E2E tests still pass with real APIs when the error no longer occurs. The deterministic trap test can be updated (e.g. to expect no error) or removed once the regression is fixed.

---

## References

- Main issue: `docs/issues/ISSUE-414/README.md` (sections "Server had an error after response" and "Test-app and OpenAI voice-to-voice (text + audio)").
- Proxy: `scripts/openai-proxy/server.ts` (forwards upstream `type: 'error'` as `type: 'Error'` to client), `run.ts`.
- Component: `src/components/DeepgramVoiceInteraction/index.tsx` (recoverable error when idle + "server had an error" message).
- Test-app: `test-app/src/App.tsx` (`handleError`, `agentErrorCount`, `recoverableAgentErrorCount`; E2E asserts both stay 0).
- Integration proxy-forwards-error test: `tests/integration/openai-proxy-integration.test.ts` – *"when upstream sends error after session.updated, client receives Error (proxy forwards error)"* (mock-only, passes).
