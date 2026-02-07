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

## What we need to do

1. **Investigate root cause**  
   - Determine why OpenAI sends an `error` event after a successful response when the test-app (or our proxy/component) is the client, while the same proxy works for the CLI (which often exits before the error arrives).  
   - Hypotheses to pursue: message ordering, duplicate or unexpected client events, session/context/greeting handling, **test-app handling of OpenAI audio playback** (see "Suspected: test-app not handling OpenAI audio playback correctly" above), or something specific to the browser/WebSocket path.  
   - Ruled out so far: greeting injection (greeting-text-only didn't remove it), full session payload (minimal-session didn't remove it).  
   - See community reports, e.g. [OpenAI Realtime – server had an error](https://community.openai.com/t/realtime-api-the-server-had-an-error-while-processing-your-request/978856).

2. **Fix the regression**  
   - Change proxy and/or component behavior so that the upstream no longer sends this error after a successful turn (or document an upstream bug and a proper mitigation).  
   - Re-evaluate the **recoverable** workaround: keep it only as a safety net for genuine post-response upstream errors, or remove it once the regression is resolved.

3. **Verify**  
   - Reproduce the error in a minimal setup (e.g. test-app + proxy + real API), then confirm it no longer occurs after the fix.  
   - Ensure integration and E2E tests still pass with real APIs when the error no longer occurs. The deterministic trap test can be updated (e.g. to expect no error) or removed once the regression is fixed.

---

## References

- Main issue: `docs/issues/ISSUE-414/README.md` (sections "Server had an error after response" and "Test-app and OpenAI voice-to-voice (text + audio)").
- Proxy: `scripts/openai-proxy/server.ts` (forwards upstream `type: 'error'` as `type: 'Error'` to client), `run.ts`.
- Component: `src/components/DeepgramVoiceInteraction/index.tsx` (recoverable error when idle + "server had an error" message).
- Test-app: `test-app/src/App.tsx` (`handleError`, `agentErrorCount`, `recoverableAgentErrorCount`; E2E asserts both stay 0).
- Integration proxy-forwards-error test: `tests/integration/openai-proxy-integration.test.ts` – *"when upstream sends error after session.updated, client receives Error (proxy forwards error)"* (mock-only, passes).
