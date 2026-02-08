# Issue #414: E2E test run results

**Purpose:** Record how to run E2E tests with saved output, and capture results/failures from a full run (run from `test-app`, stopped early). See [NEXT-STEPS.md](./NEXT-STEPS.md) for follow-up.

---

## 1. How to run E2E and save output

**Run from `test-app`** (recommended; uses `test-app/tests/playwright.config.mjs` and `test-app/.env`):

```bash
cd test-app && npm run test:e2e 2>&1 | tee e2e-run.log
```

- Output is printed to the terminal and saved to `test-app/e2e-run.log`.
- To save under repo root instead: `cd test-app && npm run test:e2e 2>&1 | tee ../e2e-run.log`

**With real APIs and existing server** (backend + dev server already running):

```bash
cd test-app && E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true USE_REAL_APIS=1 npm run test:e2e 2>&1 | tee e2e-run.log
```

**From repo root** (uses root `playwright.config.js`; test dir is still `test-app/tests/e2e`):

```bash
npm run test:e2e 2>&1 | tee e2e-run.log
```

Root also has `npm run test:e2e:log` which runs `playwright test 2>&1 | tee e2e-run.log` (saves to root).

---

## 2. Run summary (2026-02 – stopped early)

- **When:** Full E2E run from `test-app`; run was stopped early before all 242 tests completed.
- **Environment:** Playwright baseURL `http://localhost:5173`, proxy endpoints `ws://localhost:8080/deepgram-proxy`, `ws://localhost:8080/openai`, `PW_ENABLE_AUDIO: false`.
- **Result:** 56 passed, 11 failed, 5 interrupted, 8 skipped, 162 did not run. Total time ~2.3m before stop.

---

## 3. Failed tests (11)

| # | Spec | Test | Failure |
|---|------|------|---------|
| 1 | `declarative-props-api.spec.js:381` | function call response via callback return value › should handle async function call response via Promise return | `expect(responseSent).toBe(true)` — received false (function call response not sent). |
| 2 | `deepgram-backend-proxy-mode.spec.js:111` | Backend Proxy Mode › should connect through configured endpoint (proxy or direct) | (Failure detail not in excerpt; proxy/direct connection assertion.) |
| 3 | `deepgram-backend-proxy-mode.spec.js:137` | Backend Proxy Mode › should work with agent responses (proxy or direct mode) | (Failure detail not in excerpt.) |
| 4 | `deepgram-backend-proxy-mode.spec.js:271` | Backend Proxy Mode › should handle reconnection (proxy or direct mode) | (Failure detail not in excerpt.) |
| 5 | `deepgram-callback-test.spec.js:63` | Callback Test Suite › should test onTranscriptUpdate callback with existing audio sample | `page.waitForFunction` 30s timeout — transcript element never had content. |
| 6 | `deepgram-callback-test.spec.js:103` | Callback Test Suite › should test onUserStartedSpeaking callback with existing audio sample | `expect(vadState.UserStartedSpeaking).toBeTruthy()` — received null. |
| 7 | `deepgram-extended-silence-idle-timeout.spec.js:12` | Deepgram: Extended Silence Idle Timeout › should demonstrate connection closure with >10 seconds of silence | `page.waitForFunction` 30s timeout — `[data-testid="user-started-speaking"]` never changed from "Not detected". |
| 8 | `deepgram-greeting-idle-timeout.spec.js:37` | Greeting Idle Timeout › should timeout after greeting completes (Issue #139) | `page.waitForFunction` 30s timeout — `[data-testid="audio-playing-status"]` never became `'true'`. |
| 9 | `deepgram-greeting-idle-timeout.spec.js:148` | Greeting Idle Timeout › should timeout after initial greeting on page load | `expect(timeoutResult.actualTimeout).toBeGreaterThanOrEqual(8000)` — received 6056 (connection closed earlier than ~10s). |
| 10 | `deepgram-greeting-idle-timeout.spec.js:181` | Greeting Idle Timeout › should NOT play greeting if AudioContext is suspended | When AudioContext was running, `expect(audioPlayed).toBe(true)` — received false (greeting audio not reported played). |
| 11 | `deepgram-interim-transcript-validation.spec.js:48` | Interim Transcript Validation › should receive both interim and final transcripts with fake audio | `page.waitForFunction` 20s timeout — transcript element never had content. |

---

## 4. Interrupted tests (5)

Stopped when run was ended early; tests did not complete.

- `deepgram-callback-test.spec.js:145` — onUserStoppedSpeaking callback with existing audio sample
- `deepgram-client-message-timeout.spec.js:61` — CLIENT_MESSAGE_TIMEOUT when function call handler does not respond (warning: timeout not received within 90s)
- `deepgram-manual-vad-workflow.spec.js:26` — Manual VAD › speak → silence → timeout
- `deepgram-text-session-flow.spec.js:56` — Text Session Flow › rapid message exchange within idle timeout
- `deepgram-vad-audio-patterns.spec.js:23` — VAD Audio Patterns › detect VAD events with pre-generated audio samples

---

## 5. Recurring errors in run output

These appeared in browser/proxy logs during the run and correlate with several failures:

- **`Error committing input audio buffer: buffer too small. Expected at least 100ms of audio, but buffer only has 0.00ms of audio`** (agent, `input_audio_buffer_commit_empty`) — Occurs when audio is sent before enough data is buffered or when proxy/upstream commits too early. Can trigger follow-on errors.
- **`Conversation already has an active response in progress: resp_xxx. Wait until the response is finished before creating a new one`** (agent, `conversation_already_has_active_response`) — Indicates duplicate or overlapping response.create / commit from proxy or client.
- **`The server had an error while processing your request`** (OpenAI upstream) — Often after a successful turn; see [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md).
- **`[WebSocketManager:agent] WebSocket closed: code=1005, reason='', wasClean=true`** — Typically after the upstream error; connection closes and playback/state transition (e.g. speaking → idle) follows.

Transcript- and VAD-related failures (e.g. transcript never appears, UserStartedSpeaking null) occur in a context where the app is using the **OpenAI proxy** (`ws://127.0.0.1:8080/openai`). Transcription path and VAD behavior may differ from direct Deepgram (e.g. proxy may not forward transcription or VAD events the same way), or audio may be routed only to the agent, so transcript/VAD UI never updates.

---

## 6. References

- **Next steps:** [NEXT-STEPS.md](./NEXT-STEPS.md)
- **Server error investigation:** [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md)
- **OpenAI playback:** [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md)
- **E2E README:** `test-app/tests/e2e/README.md`
- **Playwright config (test-app):** `test-app/tests/playwright.config.mjs`
