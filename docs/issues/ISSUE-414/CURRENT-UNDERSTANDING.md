# Issue #414: Current understanding (single source of truth)

This doc is the **entry point** for what we know and how the other ISSUE-414 docs relate. It reduces overlap and contradiction by pointing to the authoritative sources.

---

## 1. Buffer-too-small vs idle-timeout closure (do not conflate)

| Upstream event | Meaning | How we treat it |
|----------------|--------|------------------|
| **"Error committing input audio buffer: buffer too small … 0.00ms"** | Upstream rejects commit (buffer has no audio). | **Error.** Caused by dual-control race when Server VAD is on and proxy also sends commit. Resolved by disabling Server VAD (`turn_detection: null`) and proxy-only commit. |
| **"The server had an error while processing your request"** (~5s when no activity) | Upstream closes session due to **idle timeout**. | **Expected closure (not an error).** Proxy logs INFO "expected idle timeout closure", sends code `idle_timeout`; component treats as normal closure (no onError). Idle timeout is **Settings.agent.idleTimeoutMs** (shared; default 10s). See PROTOCOL-AND-MESSAGE-ORDERING.md §3.9. |

---

## 2. Commit strategy: one controller only

- **Pick one:** Either rely on Server VAD (no manual commit/response.create for audio turns) **or** disable Server VAD and commit manually — not both.
- **Current proxy choice:** Disable Server VAD via **GA path** `session.audio.input.turn_detection: null` (top-level `session.turn_detection` is rejected by the API with "Unknown parameter"). The proxy then sends `input_audio_buffer.commit` and `response.create` after its debounce when it has ≥100ms audio. See REGRESSION-SERVER-ERROR-INVESTIGATION.md Cycle 2 (API accepts the nested path).
- **Audio format:** Proxy sends `session.audio.input.format: { type: 'audio/pcm', rate: 24000 }` so the API knows we send PCM 24kHz 16-bit mono (avoids format mismatch as a cause of generic server error). This matches the **session.updated** schema in the [OpenAI Realtime server events](https://platform.openai.com/docs/api-reference/realtime-server-events/session/updated) docs (`audio.input.format` with `type: "audio/pcm"`, `rate: 24000`). (There is a [known API bug](https://community.openai.com/t/realtime-api-session-update-doesnt-change-input-audio-format/967077) where session.update sometimes does not change input format; if the server ignores our format, default may still accept our PCM 24kHz append.)

---

## 2.1 Real-API verification (firm audio test)

- **Server VAD disabled:** We send `session.audio.input.turn_detection: null`. The [client events doc](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) states: "To clear a field like turn_detection, pass null." So we are following the documented way to disable Server VAD. The proxy is the only controller for commit + response.create.
- **Audio format:** We send the correct shape per the official session schema: `session.audio.input.format: { type: 'audio/pcm', rate: 24000 }` (see session.updated example in API reference).
- **Test result:** Firm audio 5/5; greeting flow passes with default Settings (idleTimeoutMs 10s). Idle timeout is shared via Settings.agent.idleTimeoutMs. See [RESOLUTION-PLAN.md](./RESOLUTION-PLAN.md) §10.

---

## 3. VAD behavior (do not misattribute)

- Server VAD listens for **speech transitions**: emits `speech_started` when it detects speech, `speech_stopped` when silence follows. On **speech_stopped**, the server auto-commits the buffer and (if `create_response: true`) auto-creates a response. It does **not** periodically commit on a timer or commit empty buffers right after `session.updated`. VAD needs audio to detect transitions. (OpenAI Realtime VAD docs.)

---

## 4. Authoritative investigation: REGRESSION-SERVER-ERROR-INVESTIGATION.md

- **Four TDD cycles** (session.turn_detection top-level; session.audio.input.turn_detection: null; server_vad create_response: false; no audio config) proved the **5-second "server had an error"** is **not** caused by session.update audio/VAD configuration. Cycle 2 confirms the **GA API uses `session.audio.input.turn_detection`** (nested), not top-level.
- Remaining hypotheses: **idle_timeout_ms** (default ~5–6s), message ordering, or upstream bug. See that doc for references and next steps.

---

## 5. Doc index (16 docs)

| Doc | Purpose |
|-----|--------|
| **CURRENT-UNDERSTANDING.md** (this file) | Entry point; two errors; commit strategy; VAD facts; doc index. |
| **REFACTOR-PHASE.md** | Refactor-phase review: scope, correctness, completeness, coverage, DRYness, clarity; recommendations. |
| **REGRESSION-SERVER-ERROR-INVESTIGATION.md** | Authoritative 4-cycle session.update investigation; 5s error hypotheses; idle_timeout_ms lead. |
| **NEXT-STEPS.md** | Plan and priorities (greeting TTS, basic audio, server error, etc.); §3.1/§3.2 buffer/response. |
| **RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md** | Firm audio connection protocol and tests; plan steps; references. |
| **RESOLUTION-PLAN.md** | Actionable resolution plan for 5s server error; 12s firm audio; idle_timeout Path B; 10s idle experiment (greeting passes); progress log. |
| **PASSING-VS-FAILING-TESTS-THEORY.md** | Compares passing (firm audio) vs failing (greeting, E2E) flows; idle-timeout theory; 10s experiment result and other tests. |
| **PROTOCOL-AND-MESSAGE-ORDERING.md** (in scripts/openai-proxy/) | Wire protocol, message order, buffer restrictions, dual-control race. |
| **COMPONENT-PROXY-INTERFACE-TDD.md** | Component ↔ proxy contract; VAD mapping (UserStartedSpeaking, UtteranceEnd). |
| **VAD-FAILURES-AND-RESOLUTION-PLAN.md** | VAD E2E failures and resolution plan. |
| **E2E-RUN-RESULTS.md** | E2E run outcomes and failure summary. |
| **E2E-FAILURE-REVIEW.md** | Review of E2E failures. |
| **OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md** | Greeting/playback path and TTS investigation. |
| **OPENAI-REALTIME-AUDIO-TESTING.md** | Audio testing approach. |
| **OPENAI-SESSION-STATE-AND-TESTS.md** | Session state and tests. |
| **PROTOCOL-TEST-GAPS.md** | Gaps in protocol tests. |
| **README.md** | Issue summary and pointers. |
| **E2E-RELAXATIONS-EXPLAINED.md** | What changed in E2E (allow 1 error, Repro 9/10, connect-only greeting) and how to undo each. |
| **MULTI-TURN-E2E-CONVERSATION-HISTORY.md** | Multi-turn E2E and conversation history. |
| **REPRO-RELOAD-STALE-RESPONSE.md** | Repro for reload/stale response. |

When in doubt, treat **REGRESSION-SERVER-ERROR-INVESTIGATION.md** and this file as the source for "buffer too small" vs "server had an error," commit strategy, and GA path.
