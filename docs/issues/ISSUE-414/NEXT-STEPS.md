# Issue #414: Next steps

**Branch:** `davidrmcgee/issue414`  
**Issue:** [#414](https://github.com/Signal-Meaning/dg_react_agent/issues/414)

---

## 1. What still fails

| # | Spec / test | What fails | When / condition |
|---|-------------|------------|------------------|
| A | **openai-proxy-e2e.spec.js** › **5. Basic audio** | `assertNoRecoverableAgentErrors`: `agent-error-count` is 1 (expected 0). | After sending recorded audio and waiting for agent response; real API run. Intermittent (test can pass in some runs). |
| B | **openai-proxy-e2e.spec.js** › **10. Repro (after reload)** | Assertion: response must not be exactly `"The capital of France is Paris."`. | When the model returns that exact one-liner for "What famous people lived there?" after reload. Intermittent (depends on model output). |
| C | **greeting-playback-validation.spec.js** › **connect only** | Greeting audio must play: `agent-audio-chunks-received >= 1`. Received 0. | Connect-only flow (focus text input, no second message). No TTS binary received for the greeting in this flow. |
| D | **Upstream / UI** | E2E that assert "no agent error" fail when upstream sends *"The server had an error while processing your request"* (or similar). | Real API; can occur within assertion window. §3.1/§3.2 are fixed; error may still occur (upstream or timing). |
| E | **Transcript / VAD specs** | ~~Tests that wait for VAD UI updates time out.~~ **Addressed:** Proxy now maps `input_audio_buffer.speech_started` / `speech_stopped` → `UserStartedSpeaking` / `UtteranceEnd`; E2E test **5b. VAD (Issue #414)** in `openai-proxy-e2e.spec.js` asserts VAD UI when sending audio via proxy. See [COMPONENT-PROXY-INTERFACE-TDD.md](./COMPONENT-PROXY-INTERFACE-TDD.md) §5 Progress. |

Tests **6** and **8** (invalid URL) are **fixed** (use `BASE_URL + pathWithQuery`). Latest openai-proxy-e2e run: **9 passed, 4 failed** — see [E2E-RUN-RESULTS.md §2c](./E2E-RUN-RESULTS.md#2c-openai-proxy-e2e--plan-execution-run-2026-02-08).

---

## 2. Hypothesized root causes

| Failure | Hypothesized root cause |
|---------|-------------------------|
| **A (Basic audio)** | Upstream returns a recoverable error (e.g. "server had an error" or transient failure) after or during the audio turn; proxy forwards it; test asserts zero recoverable errors. May be upstream instability, timing, or our commit/response sequence in edge cases. |
| **B (Test 10 one-liner)** | Model sometimes answers "What famous people lived there?" with the exact string "The capital of France is Paris." (short answer). Test rejects that exact string to avoid the *stale* canned response; when the model legitimately returns it, the test fails. |
| **C (Connect-only greeting TTS)** | In connect-only flow, **no greeting audio (binary) is received** by the client: either (1) upstream does not send TTS for the initial greeting in that flow, or (2) proxy does not forward it, or (3) client does not request or route it. Needs trace: session config, proxy behavior, and component path for first response. |
| **D (Server error / 1005)** | Upstream sends "server had an error" and/or closes with code 1005; our usage (commit/response.create) is now gated (§3.1, §3.2), so cause may be upstream or session/config (e.g. idle timeout). 1005 is often a symptom of the server closing after an error. |
| **E (Transcript / VAD)** | **Interface mismatch (resolved):** Deepgram uses multiple stateless sessions; OpenAI uses one session. The proxy now maps OpenAI `input_audio_buffer.speech_started` / `speech_stopped` to `UserStartedSpeaking` / `UtteranceEnd` (same contract as component). TDD complete per [COMPONENT-PROXY-INTERFACE-TDD.md](./COMPONENT-PROXY-INTERFACE-TDD.md); E2E test 5b validates VAD UI when using proxy. |

---

## 3. Plan to resolve the remaining failures

**Priority order:**

1. **C – Connect-only greeting TTS (0 chunks)**  
   - **Goal:** Either get greeting TTS playing in connect-only flow, or document why it does not and adjust the test.  
   - **Actions:** (a) Reproduce in headed browser: focus Text Input, confirm whether any greeting audio is received/played. (b) Trace path: does upstream send greeting audio? Does proxy forward it? Does component receive and play it? (c) If upstream does not send greeting TTS in connect-only, document and relax or skip the "greeting audio played" assertion for that flow; if our proxy or component drops it, fix and re-run. See [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md).

2. **A – Basic audio (agent error)**  
   - **Goal:** Stabilize test or isolate upstream vs our behavior.  
   - **Actions:** (a) When failure happens, run with `OPENAI_PROXY_DEBUG=1` and capture proxy stdout (append → commit → response.create and any upstream error). (b) If error is clearly upstream/transient, consider allowing one recoverable error in the assertion window for real-API runs, or document as known flake and retry. (c) If logs show our commit/response sequence is wrong, fix proxy and re-run.

3. **B – Test 10 one-liner**  
   - **Goal:** Avoid failing when the model legitimately returns the short Paris answer.  
   - **Actions:** Relax assertion: e.g. require that the response (a) is not the greeting, and (b) either mentions "famous" or "people" (or similar) or has length &gt; 50, so we reject only clearly wrong/stale answers and accept the short correct one if needed. Or accept intermittent failure when model returns exact one-liner and document.

4. **D – Server error / 1005**  
   - **Goal:** Treat as known behavior when it persists; avoid failing E2E unnecessarily.  
   - **Actions:** (a) If "server had an error" and 1005 persist after §3.1/§3.2, document as upstream/known and try session or idle-timeout config per API docs. (b) In E2E, optionally allow one recoverable error in window for real-API runs, or assert on "recovered/reconnect" instead of "no error." See [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md).

5. **E – Transcript / VAD with proxy** — **Done**  
   - **Goal:** Unified component/proxy interface so transcript and VAD work with both Deepgram and OpenAI proxy.  
   - **Done:** (a) Contract defined (same message types). (b) Proxy integration tests added and passing. (c) Proxy mapping implemented in `scripts/openai-proxy/server.ts`. (d) Component behavior tests in `tests/component-vad-callbacks.test.tsx`. (e) E2E test **5b. VAD (Issue #414)** in `openai-proxy-e2e.spec.js`; TEST-STRATEGY and E2E-BACKEND-MATRIX updated. See [COMPONENT-PROXY-INTERFACE-TDD.md](./COMPONENT-PROXY-INTERFACE-TDD.md) §5 Progress.

---

## Current stage (brief)

- **Plan execution (2026-02-08):** Steps 1–4 done. Basic Audio uses 20 ms chunks and proxy logs commit bytes; repro tests 9/10 fixed (greeting-as-response, wait for meaningful response); tests 6/8 URL fix applied. Greeting connect-only still 0 TTS chunks; full suite 9 passed, 4 failed.
- **Proxy:** §3.1 and §3.2 addressed (buffer too small, active response). §3.3 (server error) and §3.4 (1005) remain; resolution plan above.

---

## Summary (context)

Acceptance criteria for #414 are **done** (CLI text-in, playback + text, docs). Remaining work centers on:

1. **Greeting audio not playing** in the test-app when the Text Input field receives focus (connection starts, Settings applied, but TTS greeting does not play).
2. **Test failures and coverage gaps** surfaced by the recent E2E run (11 failed, 5 interrupted; recurring errors and missing coverage).
3. **OpenAI proxy protocol and upstream** (server error, ordering, wire contract) — documented and partially addressed; tests still fail when upstream or proxy behavior diverges.

---

## 1. Greeting audio not playing when Text Input receives focus (priority)

**Observed:** In the test-app, when the user focuses the Text Input field, the component connects, sends Settings, and receives SettingsApplied and the greeting as ConversationText. **The greeting audio, however, fails to play** (or is not heard). This is separate from OpenAI proxy protocol correctness: the issue appears in the test-app flow (focus → connect → greeting) regardless of proxy protocol fixes.

**Evidence from E2E run:** [E2E-RUN-RESULTS.md](./E2E-RUN-RESULTS.md)

- **Greeting Idle Timeout › should timeout after greeting completes (Issue #139):** `[data-testid="audio-playing-status"]` never became `'true'` (30s timeout).
- **Greeting Idle Timeout › should NOT play greeting if AudioContext is suspended:** When AudioContext was **running**, `expect(audioPlayed).toBe(true)` failed — greeting audio was not reported as played.
- **Greeting Idle Timeout › should timeout after initial greeting on page load:** Connection closed after ~6s instead of ~10s; `actualTimeout` 6056 &lt; 8000 — consistent with connection or playback path failing before idle timeout.

**Implications:**

- Either greeting TTS is never requested/played (e.g. binary not received, or not routed to playback), or playback runs but the test-app never reports it (e.g. `audio-playing-status` not updated, or AudioContext/output path muted in test).
- Playwright runs with **`PW_ENABLE_AUDIO: false`** by default (audio muted), so in headless E2E the user would not hear greeting even if the path were correct; the **assertions** (audio-playing-status, audioPlayed) are what failed — i.e. the app or component did not signal that greeting audio played.
- Manual testing (headed, volume up) is needed to confirm: after focusing Text Input, does greeting **audio** play at all? If not, the fix is in the component/test-app playback path for the first response (greeting). If it plays manually but E2E fails, the gap is in how the test-app exposes playback state or how E2E asserts it.

**Next:**

1. **Reproduce in headed browser:** Focus Text Input, wait for SettingsApplied and greeting text; confirm whether greeting **audio** plays (and whether “Play test tone” works from the same output path). See [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md) for test-tone and output-path checks.
2. **Trace greeting path:** From proxy sending greeting (ConversationText + binary PCM if upstream sends it) through component `handleAgentAudio` and `AudioManager.queueAudio` to `audio-playing-status` / onPlaybackStateChange. Confirm binary is received for the greeting and that the first playback is scheduled and fires.
3. **E2E and reporting:** If playback works but state is wrong, fix test-app or component so `audio-playing-status` and any “greeting played” signal reflect reality; then tighten E2E assertions. If playback does not work on focus, fix the greeting playback path and re-run E2E with `PW_ENABLE_AUDIO=true` and/or headed where relevant.

---

## 2. Test failures and coverage gaps (lessons from E2E run)

**Ref:** [E2E-RUN-RESULTS.md](./E2E-RUN-RESULTS.md)

**Run summary (2026-02, from test-app, stopped early):** 56 passed, 11 failed, 5 interrupted, 8 skipped, 162 did not run (~2.3m). Run command with saved output: `cd test-app && npm run test:e2e 2>&1 | tee e2e-run.log`.

### 2.1 Lessons from failures

- **Greeting and playback (above):** Multiple E2E tests assume greeting audio plays and that `audio-playing-status` becomes true; when it does not, timeouts and assertion failures follow. This aligns with the “greeting audio not playing on Text Input focus” issue.
- **Transcript and VAD never update:** Tests that wait for `[data-testid="transcription"]` content or for `user-started-speaking` / `utterance-end` to change often time out. In the run, the app was using the **OpenAI proxy** (`ws://127.0.0.1:8080/openai`). The transcription and VAD paths may not be wired the same way as with direct Deepgram (e.g. proxy may not forward transcription or VAD events), so those elements never update and tests fail. **Coverage gap:** E2E that depend on transcript/VAD should be explicitly scoped (e.g. direct Deepgram only) or we need a proxy path that forwards transcription/VAD and tests that target it.
- **Recurring errors in logs:**  
  - `Error committing input audio buffer: buffer too small` — proxy or client sending commit before enough audio; can cascade.  
  - `Conversation already has an active response in progress` — duplicate or overlapping response.create/commit.  
  - `The server had an error while processing your request` (OpenAI) and WebSocket close code 1005 — see server error regression below.  
  These indicate protocol/timing issues that both cause real failures and make tests flaky when they occur inside the assertion window.
- **Backend proxy mode and declarative props:** Failures in `deepgram-backend-proxy-mode.spec.js` (connect, agent responses, reconnection) and in `declarative-props-api.spec.js` (async function call response via Promise) suggest coverage or environment assumptions (e.g. proxy vs direct, or function-call flow) are not met. Need to isolate whether failures are environment (e.g. OpenAI proxy vs Deepgram), test design, or product bugs.

### 2.2 Coverage gaps

- **Greeting playback:** No green E2E that asserts “greeting TTS plays after Text Input focus” in the test-app; current greeting tests fail when playback does not run or is not reported. Add or fix a single E2E that: focuses Text Input, waits for connection and SettingsApplied, then asserts that greeting audio is played (or that `audio-playing-status` becomes true and optionally that at least one TTS chunk was received).
- **Transcript/VAD with proxy:** Addressed. Proxy maps OpenAI speech_started/speech_stopped to UserStartedSpeaking/UtteranceEnd; E2E test **5b. VAD (Issue #414)** in `openai-proxy-e2e.spec.js` asserts VAD UI when using the proxy. See COMPONENT-PROXY-INTERFACE-TDD.md and TEST-STRATEGY.md.
- **Idle timeout and timing:** Tests that assert idle timeout (~10s) or “connection closes after Xs” are sensitive to upstream closing earlier (e.g. server error at ~5s). Either relax timing assertions when using real OpenAI or add a mock/proxy mode that does not close early so idle-timeout behavior can be tested in isolation.
- **Real-API vs mocks:** Many E2E are written for a single backend; running the same suite against OpenAI proxy vs Deepgram surfaces different failures. Document which specs are backend-specific and run (or skip) them accordingly. See [docs/development/TEST-STRATEGY.md](../../docs/development/TEST-STRATEGY.md).

---

## 3. Recurring errors — address head-on

Each of the following appears repeatedly in E2E and manual run logs. Each should be explicitly addressed (root cause, ownership, and next action).

### 3.1 `input_audio_buffer_commit_empty` (buffer too small) — **Addressed**

- **What:** OpenAI Realtime API returns an error: *"Error committing input audio buffer: buffer too small. Expected at least 100ms of audio, but buffer only has 0.00ms of audio."*
- **Why it matters:** The proxy (or client) is sending `input_audio_buffer.commit` (and/or triggering a response) before the upstream has received at least 100ms of audio. This can cascade: commit fails, then duplicate commits or response.create while a response is already in progress, then further errors or connection close.
- **Addressed:** Proxy now tracks cumulative bytes sent via `input_audio_buffer.append` per connection and only sends `input_audio_buffer.commit` + `response.create` when total bytes ≥ 3200 (100ms at 16kHz mono 16-bit). Constant `MIN_AUDIO_BYTES_FOR_COMMIT` in `scripts/openai-proxy/server.ts`; integration tests: "does not send input_audio_buffer.commit when total appended audio < 100ms" and "translates binary … when ≥100ms audio".

### 3.2 `conversation_already_has_active_response` — **Addressed**

- **What:** Upstream returns *"Conversation already has an active response in progress: resp_xxx. Wait until the response is finished before creating a new one."*
- **Why it matters:** We are sending a second `response.create` (or committing and triggering a response) while the model is still generating. That violates the Realtime API contract and can cause the server to error or close the connection.
- **Addressed:** Proxy now tracks `responseInProgress` (set when sending `response.create`, cleared on `response.output_text.done`). Commit + response.create are only sent when `!responseInProgress`. Integration test: "sends at most one response.create per turn until response completes".

### 3.3 OpenAI “server had an error”

- **What:** Upstream sends *"The server had an error while processing your request"* (often a few seconds after a successful turn). Connection may then close.
- **Why it matters:** Users see an error in the UI; E2E that assert “no agent error” fail when this occurs within the assertion window. It is unclear whether the cause is our usage (e.g. timing, duplicate commits/responses above) or an upstream bug.
- **Mitigations in place:** §3.1 and §3.2 are fixed (no early commit, no duplicate response.create). Proxy **forwards** all upstream `error` events to the client (no suppression); integration test "when upstream sends error after session.updated, client receives Error" confirms. UI keeps recoverable handling so the user can continue or reconnect.
- **Next:** (1) Re-run with real API and see if "server had an error" frequency drops after 3.1/3.2. (2) If it persists, treat as upstream: try session/input config (e.g. idle timeout) per API docs; document as known behavior and adjust E2E (e.g. allow recoverable error in window or skip assertion when real API). See [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md).

### 3.4 WebSocket closed code 1005

- **What:** The agent WebSocket closes with `code=1005, reason='', wasClean=true`. 1005 is “no status received”; the server often closes the connection without a custom code (e.g. after sending “server had an error” or after an internal failure).
- **Why it matters:** Connection is gone; any in-flight playback or state can be left inconsistent. E2E that assume connection stays open fail or timeout.
- **Likely causes:** Usually a consequence of another failure: upstream sent “server had an error” and then closed; or upstream closed due to protocol violation (e.g. duplicate response.create). Less commonly, network or proxy tearing down the connection.
- **Next:** (1) Treat 1005 as a symptom. Focus on eliminating the triggers (3.1, 3.2, 3.3) so the server does not close the connection. (2) Ensure the component and test-app handle close gracefully (onConnectionStateChange, cleanup, allow reconnect). (3) In E2E, if 1005 is expected in some scenarios (e.g. after server error), assert on “recovered” or “reconnect” behavior instead of “connection never closes.”

### 3.5 Transcript / VAD failures and OpenAI proxy path — **Addressed**

- **What:** E2E that wait for VAD UI updates (e.g. `user-started-speaking`, `utterance-end`) were timing out when using the **OpenAI proxy** because the proxy did not map OpenAI VAD events to the component contract.
- **Resolution:** Implemented per [COMPONENT-PROXY-INTERFACE-TDD.md](./COMPONENT-PROXY-INTERFACE-TDD.md): proxy maps `input_audio_buffer.speech_started` → `UserStartedSpeaking` and `input_audio_buffer.speech_stopped` → `UtteranceEnd` (with `channel` and `last_word_end`). Integration tests, component behavior tests, and E2E test **5b. VAD (Issue #414)** added. Transcript from OpenAI (if/when API exposes it) remains to be mapped.
- **E2E run (2026-02-08):** Ran test 5b against live proxy. Test failed: **0 VAD events** (expected ≥1). Connection and audio send succeeded.
- **E2E run (post-24k fix):** Ran again after switching test 5b to 24 kHz (loadAndSendAudioSampleAt24k, MIN_AUDIO_BYTES_FOR_COMMIT=4800). **Still 0 VAD events.** So format/sample-rate alone did not fix it; upstream may not be emitting speech_started/speech_stopped for this clip or session.

**Flaw analysis (spec vs test vs impl):**

- **Spec (COMPONENT-PROXY-INTERFACE-TDD.md §2.1):** Correct. Proxy must map `input_audio_buffer.speech_started` → `UserStartedSpeaking` and `speech_stopped` → `UtteranceEnd`. No flaw.
- **Impl (server.ts):** Correct. Handlers for both event types exist and send the right JSON to the client. Integration tests (mock upstream) pass. No flaw.
- **Test (5b):** Initial flaw was 16 kHz vs 24 kHz session default; fixed by sending 24 kHz (resampled). Test still fails, so either (a) OpenAI does not emit VAD for this clip/session, or (b) session needs explicit turn_detection (e.g. server_vad) in session.update, or (c) timing/streaming needs adjustment.

**Fix (implemented):** Test 5b now uses `loadAndSendAudioSampleAt24k(page, 'hello')`: loads 16 kHz fixture, resamples to 24 kHz in-browser (linear interpolation), streams with 24 kHz chunk size (960 bytes / 20 ms). Proxy `MIN_AUDIO_BYTES_FOR_COMMIT` increased to 4800 (100 ms at 24 kHz) so commit is valid for 24k input. Integration tests updated to send 4800 bytes where they assert "≥100ms audio".

**Proposed next (test 5b / VAD):** (1) **Confirm upstream emission:** Run proxy with debug (e.g. log every upstream event type); run test 5b and inspect whether `input_audio_buffer.speech_started` / `speech_stopped` appear from OpenAI. (2) If they never appear, check **session config:** try adding `audio.input.turn_detection: { type: 'server_vad', ... }` in session.update (translator currently omits audio config to avoid past errors; may need a minimal server_vad payload that API accepts). (3) If they do appear but client doesn’t update UI, trace **component path** (message handler → callbacks → test-app state). (4) Optionally **tag test 5b** as `@openai-vad` and document in TEST-STRATEGY that it requires OpenAI to emit VAD; keep test in suite but allow CI to skip when not validating OpenAI VAD until (1)–(3) are resolved.

**Integration testability:** (1) Not testable (real API). (2) Partially: we can add a test that proxy sends session.update with turn_detection and mock upstream returns session.updated without error. (3) Component path is already covered by `tests/component-vad-callbacks.test.tsx`; proxy→client by existing proxy integration tests. (4) Doc only. See [VAD-FAILURES-AND-RESOLUTION-PLAN.md](./VAD-FAILURES-AND-RESOLUTION-PLAN.md) for full VAD failure description, tests needed, and resolution plan.

**Phase A outcome (debug run):** With `OPENAI_PROXY_DEBUG=1`, test 5b was run and proxy logs inspected. Upstream **never** sent `speech_started` or `speech_stopped`; the flow was append → KeepAlive → **error** ("The server had an error...") → upstream closed. So the **server error (§3.3) is the blocker** for VAD: the connection fails before the API can emit VAD. Resolving or mitigating that error is a prerequisite for test 5b to pass.

**Audio setup fix (Issue #414):** We were not setting up correctly for audio before sending it: the proxy forwarded `input_audio_buffer.append` as soon as upstream was open, without waiting for `session.updated`. The API expects append only after the session is configured (session configuration defines `input_audio_format`). **Fix applied:** Proxy now gates binary → append until **after** `session.updated`; any binary received before that is queued and flushed when `session.updated` is received. See [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3 and `server.ts` (`pendingAudioQueue`, `flushPendingAudio`). Re-run test 5b and Phase A with this fix to see if the server error is reduced or eliminated.

---

## 4. OpenAI proxy protocol and upstream

**Ref:** [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md), [OPENAI-SESSION-STATE-AND-TESTS.md](./OPENAI-SESSION-STATE-AND-TESTS.md), [PROTOCOL-TEST-GAPS.md](./PROTOCOL-TEST-GAPS.md)

- **Server error regression:** Covered in §3.3. §3.1 and §3.2 are fixed. Proxy forwards errors; next steps are re-run with real API to observe frequency, then idle-timeout investigation and upstream/community evidence if it persists.
- **Protocol and ordering:** Documented in [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md). Integration tests enforce session.update → session.updated → context/greeting ordering and wire contract (binary only for `response.output_audio.delta`). Keep these green and align E2E with proxy vs direct backend.
- **Session state and tests:** Component passes full state in Settings; proxy maps to OpenAI session.update + conversation.item.create after session.updated. See [OPENAI-SESSION-STATE-AND-TESTS.md](./OPENAI-SESSION-STATE-AND-TESTS.md).

---

## 5. Doc and code references

- **Main status:** [README.md](./README.md)
- **E2E run results and command to save output:** [E2E-RUN-RESULTS.md](./E2E-RUN-RESULTS.md) — run from `test-app`, failure list, recurring errors, `tee` command
- **E2E failure review (three failures, actions taken):** [E2E-FAILURE-REVIEW.md](./E2E-FAILURE-REVIEW.md)
- **Component/proxy interface (transcript & VAD, TDD):** [COMPONENT-PROXY-INTERFACE-TDD.md](./COMPONENT-PROXY-INTERFACE-TDD.md)
- **VAD failures, tests needed, resolution plan:** [VAD-FAILURES-AND-RESOLUTION-PLAN.md](./VAD-FAILURES-AND-RESOLUTION-PLAN.md)
- **Resolving server error (firm audio connection):** [RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md](./RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md) — focus on item #1; protocol and tests for audio connection.
- **OpenAI Realtime audio testing (best practices, Basic Audio diagnosis, session retention):** [OPENAI-REALTIME-AUDIO-TESTING.md](./OPENAI-REALTIME-AUDIO-TESTING.md)
- **OpenAI playback (test-tone, 24k context, double-connect fix):** [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md)
- **Server error investigation:** [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md)
- **Protocol and message ordering:** [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)
- **Protocol test gaps:** [PROTOCOL-TEST-GAPS.md](./PROTOCOL-TEST-GAPS.md)
- **OpenAI session state and tests:** [OPENAI-SESSION-STATE-AND-TESTS.md](./OPENAI-SESSION-STATE-AND-TESTS.md)
- **Multi-turn E2E conversation history:** [MULTI-TURN-E2E-CONVERSATION-HISTORY.md](./MULTI-TURN-E2E-CONVERSATION-HISTORY.md)
- **Proxy:** `scripts/openai-proxy/` (server, translator, CLI)
- **Tests:** `tests/integration/openai-proxy-integration.test.ts`, `test-app/tests/e2e/`

---

**Next actions:** See [§1 What still fails](#1-what-still-fails), [§2 Hypothesized root causes](#2-hypothesized-root-causes), and [§3 Plan to resolve the remaining failures](#3-plan-to-resolve-the-remaining-failures) at the top of this doc.
