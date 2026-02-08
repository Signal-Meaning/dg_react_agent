# Issue #414: VAD failures and resolution plan

This document focuses on **VAD (Voice Activity Detection) failures** when using the OpenAI proxy: what fails, where, which tests exist, what tests are still needed, and a plan to get existing tests passing.

**Related:** [NEXT-STEPS.md](./NEXT-STEPS.md) §3.5, [COMPONENT-PROXY-INTERFACE-TDD.md](./COMPONENT-PROXY-INTERFACE-TDD.md).

---

## Integration tests: real API first

**Integration tests are written for and validated against real APIs first.** They don’t really cut mustard if they only pass with mocks. When we add or change integration tests (e.g. proxy VAD mapping, session config), we run them against the real upstream (e.g. `USE_REAL_OPENAI=1` and `OPENAI_API_KEY` set) and ensure they pass there; mocks are for CI or when keys aren’t available. See [TEST-STRATEGY.md](../../docs/development/TEST-STRATEGY.md): “Real APIs first, then mocks.”

---

## 1. What fails (VAD-specific)

| Where | What fails | Condition |
|-------|------------|-----------|
| **E2E test 5b** (`openai-proxy-e2e.spec.js`) | Assertion: at least one VAD event (UserStartedSpeaking or UtteranceEnd) should appear in the UI within 15s. **Received: 0.** | Running against live OpenAI proxy + real API; test sends 24 kHz audio (resampled from hello fixture) via `loadAndSendAudioSampleAt24k`. Connection and audio send succeed; no VAD UI updates. **Re-run after audio-gate fix:** Same outcome (0 VAD events); see §6 Progress. |
| **Other E2E** that depend on VAD when using OpenAI proxy | Any spec that waits for `[data-testid="user-started-speaking"]` or `[data-testid="utterance-end"]` to change from "Not detected" will time out if the proxy never receives or forwards VAD. | Same root cause as 5b. |

**Not failing:** Proxy integration tests (mock upstream sends `speech_started` / `speech_stopped` → client receives UserStartedSpeaking / UtteranceEnd). Component behavior tests (mock WebSocket emits those types → `onUserStartedSpeaking` / `onUtteranceEnd` called with correct shape). So the **contract** (proxy mapping, component handling) is tested and green. The gap is **upstream not emitting** VAD in the real run, or a configuration/timing issue before the proxy receives it.

**Audio setup (prerequisite):** We were not setting up correctly for audio before sending it: the proxy was sending `input_audio_buffer.append` as soon as upstream was open, without waiting for `session.updated`. The API expects append only after the session is configured. **Fix applied:** Proxy now gates binary → append until **after** `session.updated`; binary received before that is queued and flushed when `session.updated` is received. See [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) and NEXT-STEPS “Audio setup fix.” Re-running test 5b and Phase A with this fix may reduce or eliminate the server error so the connection stays healthy long enough for VAD.

---

## 2. Current test coverage (VAD)

| Test | Location | What it proves |
|------|----------|----------------|
| **Proxy: upstream → client** | `tests/integration/openai-proxy-integration.test.ts` (itMockOnly) | When mock upstream sends `input_audio_buffer.speech_started`, client receives `UserStartedSpeaking`. When mock sends `input_audio_buffer.speech_stopped`, client receives `UtteranceEnd` with `channel` and `last_word_end`. |
| **Component: message → callbacks** | `tests/component-vad-callbacks.test.tsx` | When component receives `UserStartedSpeaking` / `UtteranceEnd` (wire shape), it calls `onUserStartedSpeaking` and `onUtteranceEnd` with the expected arguments. |
| **E2E: full flow** | `test-app/tests/e2e/openai-proxy-e2e.spec.js` (test 5b) | **Intended:** Send audio via proxy → OpenAI emits VAD → proxy maps → component callbacks → UI updates. **Currently:** Fails because no VAD events reach the UI (0 in 15s). |
| **Proxy: audio only after session.updated** | `tests/integration/openai-proxy-integration.test.ts` (itMockOnly) | No `input_audio_buffer.append` before `session.updated` (audio gated, queued then flushed); `session.update` before first append in upstream order; mock records protocol error if append arrives before session.updated. |

So we have **proxy mapping**, **component behavior**, and **audio-gate protocol** (append only after session.updated) covered by integration/unit tests. We do **not** have automated coverage for: (a) OpenAI actually sending `speech_started` / `speech_stopped`, or (b) session config (e.g. `turn_detection`) required for the API to emit them.

---

## 3. Tests that are needed

### 3.1 Already in place (no change)

- Proxy integration: upstream VAD event types → client message shape (mock upstream).
- Component: wire message → callbacks (mock WebSocket).
- E2E 5b: full flow assertion (currently red because upstream does not emit VAD in our run).

### 3.2 Additional tests we can add (integration)

Any new integration test must **pass against the real API first** (e.g. `USE_REAL_OPENAI=1`); mock-only passing is not sufficient.

| Test | Purpose | Where |
|------|---------|--------|
| **Session.update with turn_detection** | If we add `audio.input.turn_detection` to session.update to request server VAD, add a test that (1) runs against real OpenAI when keys are set, (2) sends session.update with that config, (3) asserts no upstream error and that we get session.updated. Run with real API first; keep a mock variant for CI. | `tests/integration/openai-proxy-integration.test.ts` or a small dedicated session-config test. |
| **Proxy logs upstream event types (diagnostic)** | Not a test per se; when debug is on, proxy already logs `msg.type` for each upstream message. A test that with a mock upstream sends `speech_started` then `speech_stopped` and asserts client receives both is already covered; any new “real API” integration test for VAD would be: connect to real OpenAI, send audio, assert we receive at least one of these event types from upstream (then proxy mapping is exercised with real data). | Real-API integration test for “upstream sends VAD” would live in the same integration suite, run when `USE_REAL_OPENAI=1`. |

We **cannot** fully integration-test “OpenAI sends VAD for this clip” without the real API; that’s why such a test must be run against real OpenAI first when we add it.

### 3.3 E2E (when backend cooperates)

- **Test 5b** remains the single E2E that asserts VAD UI when using the OpenAI proxy. No new E2E needed; we need 5b to pass by fixing the cause (upstream emission or config).
- Optional: **E2E with mock proxy** that sends UserStartedSpeaking + UtteranceEnd after a short delay when the test sends audio. That would prove “if the proxy sends VAD, the test-app UI updates” without depending on OpenAI. That’s a larger harness (mock proxy or playback of a recorded proxy response). Lower priority than getting 5b green with real proxy.

---

## 4. Plan to resolve existing tests (get 5b passing)

### Phase A: Confirm whether OpenAI sends VAD (diagnostic)

1. **Ensure audio setup fix is in place:** Proxy must send `input_audio_buffer.append` only **after** `session.updated` (gate + queue + flush). See NEXT-STEPS “Audio setup fix” and PROTOCOL-AND-MESSAGE-ORDERING.
2. **Run proxy with debug logging** so every upstream event `type` is visible (e.g. `OPENAI_PROXY_DEBUG=1`).
3. **Run E2E test 5b** against the live proxy and real OpenAI.
4. **Inspect logs:** Do we see `input_audio_buffer.speech_started` and/or `input_audio_buffer.speech_stopped` from upstream?
   - **If yes** → Problem is downstream (proxy→client delivery, component, or test-app state). Go to Phase C.
   - **If no** → Problem is upstream (API not emitting VAD, or connection still errors before VAD). Go to Phase B or address server error first.

**Integration testability:** None. This step is manual/diagnostic with real API. The **audio-gate** (append only after session.updated) is integration-tested; see §2 and §6.

---

### Phase B: Get OpenAI to emit VAD (session / config)

1. **Check API docs** for Realtime session: how to enable server VAD (e.g. `turn_detection.type: 'server_vad'`), and whether we must send it in `session.update` because we currently omit audio config.
2. **Try minimal session.update change:** In `scripts/openai-proxy/translator.ts`, add a minimal `audio.input.turn_detection` (e.g. `{ type: 'server_vad' }` or the shape the docs require) and ensure we don’t send invalid fields that previously caused errors (see Issue #414 comments in translator).
3. **Re-run test 5b.** If upstream still doesn’t send VAD, try (e.g.) different threshold, or confirm with API support/docs that the Realtime model emits these events for appended + committed audio.
4. **Integration test (optional):** Add a test that sends `session.update` including `audio.input.turn_detection` and asserts no upstream error and that we get `session.updated`. **Run against real OpenAI first** when keys are set; use mock for CI. Protects against regressions when we add or change this config.

**Integration testability:** Partial. We can add a test that “proxy sends session.update with turn_detection; upstream accepts it” — and that test must pass against the real API first. We cannot integration-test “OpenAI then sends VAD” without the real API.

---

### Phase C: If upstream sends VAD but UI doesn’t update (downstream)

1. **Confirm proxy→client:** In the same debug run where we saw `speech_started`/`speech_stopped`, confirm the proxy sends the corresponding JSON to the client (we already have code for this; verify it’s hit).
2. **Confirm component receives:** In test-app, add temporary logging in `onUserStartedSpeaking` / `onUtteranceEnd` or in the component’s message handler for these types; run 5b and see if callbacks fire.
3. **Confirm test-app state:** Ensure the test-app updates the state that drives `[data-testid="user-started-speaking"]` and `[data-testid="utterance-end"]` from those callbacks. If callbacks fire but UI doesn’t change, fix the test-app binding.
4. **Timing:** If events arrive after the test has already asserted (e.g. after 15s), consider increasing timeout or sending audio earlier/longer so VAD arrives within the wait window.

**Integration testability:** Component path is already covered by `tests/component-vad-callbacks.test.tsx`. Proxy→client is covered by proxy integration tests. So the only remaining gap is “real E2E: real proxy, real browser, test-app state.” No new unit/integration test is strictly required for Phase C; fixing the test-app or timing should make 5b pass once upstream sends VAD.

---

### Phase D: Optional — make 5b robust when OpenAI doesn’t send VAD

- **Tag test 5b** (e.g. `@openai-vad`) and document in [TEST-STRATEGY.md](../../docs/development/TEST-STRATEGY.md) that this test requires OpenAI to emit VAD; in CI, skip or run only when validating OpenAI VAD so the suite doesn’t fail when the API doesn’t send events.
- Keep the test in the suite and **do not** relax the assertion (no “allow 0 VAD”). When run in a context where OpenAI is expected to send VAD, the test should pass; when skipped, it’s explicit that we’re not asserting VAD for that run.

---

## 5. Summary: what we can integration-test

Integration tests are validated **against real APIs first**; mocks are for CI. So “integration-testable” below means: we can add a test that runs against real OpenAI when keys are set and passes there.

| Proposed next step (from NEXT-STEPS) | Integration-testable? | Notes |
|--------------------------------------|------------------------|--------|
| **(0) Audio gate (append only after session.updated)** | **Yes** | **Done.** Proxy gates append until session.updated; queue + flush. Integration tests: no append before session.updated, session.update before append, mock protocol enforcement. Re-run 5b to see if server error is reduced. |
| (1) Confirm upstream emission (debug log) | No | Real API only; manual inspection. |
| (2) Session config (turn_detection in session.update) | Partially | Yes: add a test that proxy sends session.update with turn_detection and **run it against real OpenAI**; assert no error and session.updated. Must pass vs real API first; mock variant for CI. No: “OpenAI then sends VAD” still requires real API. |
| (3) Trace component path (message → callbacks → UI) | Already covered | Component tests: wire message → callbacks. Proxy tests: upstream event → client message. Remaining gap is E2E (real browser + test-app state). |
| (4) Tag test 5b and document | N/A | Documentation only. |

So: **most of the “resolution” work is diagnostic and real-API/E2E.** Any new integration test we add (e.g. session.update with turn_detection) must pass against the real API first; mock-only passing doesn’t cut mustard.

---

## 6. Progress (updates as we go)

| When | What was done |
|------|----------------|
| Initial | Doc created; Phase A–D plan; real-API-first principle; summary of integration-testability. |
| After commit/push | Commit pushed: VAD doc, NEXT-STEPS updates, 24k E2E fix, component/proxy tests, MIN_AUDIO_BYTES_FOR_COMMIT=4800. |
| Phase A support | Proxy now logs explicitly when it receives and maps VAD: with `debug` on, logs `[proxy connId] upstream→client: input_audio_buffer.speech_started → UserStartedSpeaking` and same for `speech_stopped → UtteranceEnd`. So for Phase A: run proxy with debug (e.g. `OPENAI_PROXY_DEBUG=1` or backend started with debug), run E2E test 5b, then inspect proxy stdout for those lines. If they appear, upstream is sending VAD and the issue is downstream (Phase C). If they never appear, upstream is not sending VAD (Phase B). |
| **Phase A result (run with OPENAI_PROXY_DEBUG=1)** | Ran test 5b with backend in debug. Proxy logs (upstream→client) show: **no** `input_audio_buffer.speech_started` or `speech_stopped`. Observed flow per connection: Settings → session.created → session.updated → greeting → input_audio_buffer.append (client→upstream) → KeepAlive → **error** ("The server had an error while processing your request...") → upstream closed. So **OpenAI never sent VAD**; the connection hits an upstream error and closes before any VAD could be emitted. **Conclusion:** The blocker for test 5b is the **server error** (NEXT-STEPS §3.3), not VAD config. Fixing or working around that error is a prerequisite for VAD E2E. Phase B (session config for VAD) still applies once the connection stays healthy long enough for the API to process audio and potentially emit speech_started/speech_stopped. |
| **Audio setup fix** | Proxy was sending `input_audio_buffer.append` as soon as upstream was open, without waiting for `session.updated`. **Fix:** Gate binary → append until after `session.updated`; queue binary and flush when session.updated is received (`pendingAudioQueue`, `flushPendingAudio` in `server.ts`). See PROTOCOL-AND-MESSAGE-ORDERING.md §2.3 and §3. **Next:** Re-run test 5b and Phase A with this fix to see if the server error is reduced or eliminated. |
| **Audio-gate integration tests** | Added in `tests/integration/openai-proxy-integration.test.ts`: (1) "Issue #414: no input_audio_buffer.append before session.updated (audio gated, queued then flushed)" — delayed session.updated, client sends Settings + binary immediately; assert no append at 30ms, then session.update before append and `protocolErrors.length === 0`. (2) "Issue #414: session.update before input_audio_buffer.append in upstream order" — client sends binary after SettingsApplied; assert order and no protocol errors. Mock enforces protocol: if upstream receives `input_audio_buffer.append` before it has sent `session.updated`, a protocol error is recorded. |
| **Phase A re-run (after audio-gate fix)** | Re-ran E2E test 5b with proxy using the audio-gate fix (append only after session.updated). **Result:** Test still **failed** — 0 VAD events in 15s (`vadCount >= 1` assertion). So either (1) the server error still occurs and the connection closes before the API can emit VAD, or (2) the API does not send VAD for this session/audio. **Next:** With backend running with `OPENAI_PROXY_DEBUG=1`, inspect proxy stdout from a 5b run to see whether the flow is still append → error → close, or if we get further (e.g. append accepted, then error later). If the error persists, continue with server-error mitigation (NEXT-STEPS §3.3) and/or Phase B (session config for VAD). |
| **Phase A: proxy stdout from 5b run (backend not restarted)** | Inspected proxy debug output from terminal (multiple 5b runs; 4 connections c1–c4). **Per connection:** client connected → upstream open → Settings → session.created → session.updated → greeting sent to client only → **input_audio_buffer.append** (client→upstream) → KeepAlive → **error** ("The server had an error while processing your request...") → upstream closed (code 1000). **No** `speech_started` or `speech_stopped` from upstream in the log. **Conclusion:** Flow is still append → KeepAlive → error → close. The server error persists after the audio-gate fix; the API never reaches the point of sending VAD. **Next:** Proceed with server-error mitigation (NEXT-STEPS §3.3) and/or Phase B (session config, e.g. turn_detection); consider OpenAI support or API docs for "server had an error" when sending append after session.updated. |

---

## 7. References

- **NEXT-STEPS.md** §3.5 — Transcript / VAD and proposed next steps; "Audio setup fix" for append-after-session.updated.
- **PROTOCOL-AND-MESSAGE-ORDERING.md** — [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §2.3 (audio readiness), §3 (binary only after session.updated).
- **COMPONENT-PROXY-INTERFACE-TDD.md** — Contract and mapping spec (§2.1); Phase 1–2 tests.
- **Proxy integration tests:** `tests/integration/openai-proxy-integration.test.ts` — speech_started/speech_stopped → client; audio gate (no append before session.updated, order, protocol enforcement).
- **Component VAD tests:** `tests/component-vad-callbacks.test.tsx`.
- **E2E test 5b:** `test-app/tests/e2e/openai-proxy-e2e.spec.js` — “5b. VAD (Issue #414)”.
- **Proxy debug:** Start backend with debug so upstream message types are logged; VAD mapping logs `speech_started → UserStartedSpeaking` and `speech_stopped → UtteranceEnd` when hit (see §6 Progress).
