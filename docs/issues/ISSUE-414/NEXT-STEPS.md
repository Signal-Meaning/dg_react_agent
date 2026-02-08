# Issue #414: Next steps

**Branch:** `davidrmcgee/issue414`  
**Issue:** [#414](https://github.com/Signal-Meaning/dg_react_agent/issues/414)

---

## Summary

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
- **Transcript/VAD with proxy:** Either document that transcript/VAD E2E are “Deepgram only” and skip when using OpenAI proxy, or implement and test a proxy path that delivers transcription/VAD and add E2E for it.
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

### 3.5 Transcript / VAD failures and OpenAI proxy path

- **What:** E2E that wait for transcript content or for VAD UI updates (e.g. `user-started-speaking`, `utterance-end`) time out. The test-app was using the **OpenAI proxy** (`ws://127.0.0.1:8080/openai`); transcription and VAD behavior may differ from direct Deepgram.
- **Why it matters:** With the proxy, the app may be routing only the **agent** stream to OpenAI; the **transcription** stream (and thus transcript and VAD events) might not be forwarded or might be on a different path. So the UI never updates and tests that assume transcript/VAD updates fail.
- **Likely causes:** (1) Proxy or backend does not implement a transcription path (Deepgram or otherwise) when in “OpenAI proxy” mode; or (2) the test-app uses a single WebSocket to the proxy for “agent” and transcription is not multiplexed or not supported; or (3) VAD/transcript events are agent-side only and not surfaced the same way as with Deepgram.
- **Next:** (1) Decide product behavior: when using the OpenAI proxy, do we support transcription and VAD in the test-app at all? If yes, implement and document the path (e.g. proxy forwards transcription or a separate Deepgram transcription connection). If no, document that transcript/VAD E2E are **Deepgram-only** and skip them when `USE_PROXY_MODE=true` or when backend is OpenAI. (2) Add a clear E2E tag or condition (e.g. `@deepgram-only` or `process.env.E2E_BACKEND === 'deepgram'`) so transcript/VAD tests only run when the backend provides those events. (3) Optionally add a proxy path that does forward transcription/VAD and an E2E that targets it.

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
- **OpenAI playback (test-tone, 24k context, double-connect fix):** [OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md](./OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md)
- **Server error investigation:** [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md)
- **Protocol and message ordering:** [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)
- **Protocol test gaps:** [PROTOCOL-TEST-GAPS.md](./PROTOCOL-TEST-GAPS.md)
- **OpenAI session state and tests:** [OPENAI-SESSION-STATE-AND-TESTS.md](./OPENAI-SESSION-STATE-AND-TESTS.md)
- **Multi-turn E2E conversation history:** [MULTI-TURN-E2E-CONVERSATION-HISTORY.md](./MULTI-TURN-E2E-CONVERSATION-HISTORY.md)
- **Proxy:** `scripts/openai-proxy/` (server, translator, CLI)
- **Tests:** `tests/integration/openai-proxy-integration.test.ts`, `test-app/tests/e2e/`
