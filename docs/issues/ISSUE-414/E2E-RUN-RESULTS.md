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

## 2b. OpenAI proxy E2E with real APIs (2026-02-08, after §3.1/§3.2 fixes)

**Command:**

```bash
cd test-app && USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e openai-inject-connection-stability greeting-playback-validation openai-proxy-tts-diagnostic readiness-contract-e2e 2>&1 | tee e2e-openai-real-api.log
```

- **Result:** 15 passed, 3 failed. Time ~3.2m.
- **Failures:**
  1. **greeting-playback-validation.spec.js** — "connect only (no second message): greeting in conversation, no error, greeting audio played" — `assertNoRecoverableAgentErrors`: `agent-error-count` was 1 (recoverable agent error received, likely "server had an error").
  2. **openai-proxy-e2e.spec.js** — "5. Basic audio – send recorded audio; assert agent response appears" — same: `agent-error-count` was 1 after 3s wait.
  3. **openai-proxy-e2e.spec.js** — "9. Repro – after reload and connection close, new message must not get stale response" — got greeting "Hello! How can I assist you today?" as response to "What famous people lived there?" (stale response after reload).

**Implication for §3.3:** The upstream "server had an error" (or another agent error) still occurred in at least 2 of 18 OpenAI proxy tests after the §3.1/§3.2 proxy fixes. Next: treat as upstream / session config per NEXT-STEPS §3.3; document; optionally relax E2E assertion for recoverable error when using real API.

---

## 2c. OpenAI proxy E2E – plan execution run (2026-02-08)

**Command:** `cd test-app && VITE_OPENAI_PROXY_ENDPOINT=ws://127.0.0.1:8080/openai npx playwright test tests/e2e/openai-proxy-e2e.spec.js`

- **Result:** 9 passed, 4 failed. Time ~2.1m.
- **Failures:**
  1. **Test 5 (Basic audio):** `assertNoRecoverableAgentErrors` — agent-error-count 1 (upstream/recoverable error; can be flaky with real API).
  2. **Test 6 (Function calling):** `page.goto` invalid URL — `pathWithQuery(params)` returns relative path `"/?..."`; test needs base URL (e.g. from playwright baseURL).
  3. **Test 8 (Error handling):** Same invalid URL for `page.goto` with wrong proxy URL.
  4. **Test 10 (Repro after reload):** Response was exact string "The capital of France is Paris." — assertion rejects that one-liner for "What famous people lived there?"; model sometimes returns it (test can be flaky).

**Done this run:** Step 1 (Basic Audio 20 ms chunks, proxy commit logging), Step 2 (test 9/10 fixes: greeting-as-response fix in test-app, test 10 wait for meaningful response), Step 3 (greeting-playback spec run: connect-only still 0 TTS chunks), Step 4 (this full suite run).

---

## 2d. OpenAI proxy integration tests (mock + real-API) — current

**Command (mock only):** `npm test -- tests/integration/openai-proxy-integration.test.ts`

- **Result (mock):** 37 passed, **1 failed**, 2 skipped. Time ~18s.
- **Failing test:** `sends at most one response.create per turn until response completes (Issue #414 conversation_already_has_active_response)` — expected `responseCreateCount === 1`, received 0. **Cause:** Test asserts at 550ms; proxy sends commit + response.create after 400ms debounce from *last* append; second chunk is at 250ms so debounce fires at 650ms. Assertion runs 100ms too early. See [NEXT-STEPS.md §1](./NEXT-STEPS.md#1-what-still-fails) (row I) and §3 item 0 for fix.

**Real-API (when USE_REAL_OPENAI=1):** The test "Issue #414 real-API: firm audio connection — no Error from upstream within 5s after sending audio" **passes** — no Error from upstream within 5s after sending audio. See [CURRENT-UNDERSTANDING.md §2.1](./CURRENT-UNDERSTANDING.md#21-real-api-verification-firm-audio-test).

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
