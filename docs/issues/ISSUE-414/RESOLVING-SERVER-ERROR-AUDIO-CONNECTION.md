# Issue #414: Resolving the server error — firm audio connection (handoff)

**Purpose:** Handoff document for another agent (or reviewer) to evaluate our approach to resolving the upstream "server had an error" and establishing a **firm audio connection**. Everything needed to critique the approach is included: defect definition, attempts so far, current implementation with code and API citations, tests, and planned next steps.

**Entry point for #414:** [CURRENT-UNDERSTANDING.md](./CURRENT-UNDERSTANDING.md) — two distinct errors, commit strategy, VAD facts, doc index.

---

## 1. Defect and goal

### 1.1 Defect

- **Symptom:** The OpenAI Realtime API sends an **error** event to the client: *"The server had an error while processing your request..."* (and often recommends retry). The connection may close (e.g. code 1000).
- **When:** Observed in two patterns:
  - **Right after sending audio:** Client connects → session.update → session.updated → we send `input_audio_buffer.append` → **next upstream message is an error** → connection closes. No VAD, no response.
  - **~5 seconds after connection / after a successful turn:** A successful text or audio turn completes; then upstream sends the same error (e.g. within 1–2s of "Audio playback finished"). Timing suggests a server-side timeout (~5–6s).
- **Impact:** E2E tests that assert "no agent error" fail when this error occurs. We do not allow any errors in tests (no relaxation); the defect must be understood or worked around upstream.

### 1.2 Goal

Establish a **firm audio connection**: when we follow a defined protocol (session.update → session.updated → *then* send audio), the connection either (a) stays open and accepts audio with no error within a time window, or (b) fails in a documented way so we can distinguish our protocol from upstream/API issues. We want tests that prove the protocol and document real-API behavior.

### 1.3 Two distinct errors (do not conflate)

| Error | Cause (our understanding) | Addressed by |
|-------|---------------------------|--------------|
| **"Error committing input audio buffer: buffer too small … 0.00ms"** | Dual-control race: Server VAD (default) auto-commits and auto-sends `response.create`; our proxy *also* sends commit + `response.create` after 400ms debounce. Server commits first → buffer empty → our commit fails. | Disable Server VAD (`turn_detection: null`) and send commit + `response.create` only from the proxy. |
| **"The server had an error while processing your request"** (~5s or after append) | **Not** caused by session.update audio/VAD config (ruled out by 4 TDD cycles). Most promising lead: **idle_timeout_ms** (server VAD idle timeout ~5–6s) or upstream bug. | **Not resolved.** This handoff is about this defect. |

See [CURRENT-UNDERSTANDING.md](./CURRENT-UNDERSTANDING.md) and [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md).

---

## 2. Our approach (summary)

1. **Protocol:** Define and enforce a strict ordering: no `input_audio_buffer.append` until **after** `session.updated`. Binary that arrives before session.updated is queued and flushed when session.updated is received. Client must not send audio before receiving SettingsApplied.
2. **Session config:** Send `session.audio.input.turn_detection: null` (GA path) to disable Server VAD so only the proxy sends commit + `response.create`; send `session.audio.input.format: { type: 'audio/pcm', rate: 24000 }` so the API knows we send PCM 24 kHz 16-bit.
3. **Session ordering:** Do **not** inject context or greeting on `session.created`; only on `session.updated`. (OpenAI sends session.created before our session.update is applied; injecting on session.created caused errors.)
4. **Tests:** Integration tests prove no append before session.updated, session.update before first append, and (mock + real-API) "no Error from upstream within 5s after sending audio" when the protocol is followed. Real-API firm audio test **passes** when run with `USE_REAL_OPENAI=1`; the 5s error still appears in other flows (E2E) or after the 5s window.

---

## 3. All attempts so far

### 3.1 Session.update configuration (four TDD cycles — REGRESSION doc)

We ran four TDD cycles to test whether any `session.update` audio/turn_detection configuration **eliminates** the 5-second server error. Result: **none of them do.**

| Cycle | Configuration | API accepted? | 5s error resolved? |
|-------|----------------|---------------|---------------------|
| 1 | `session.turn_detection: null` (top-level) | **No** — "Unknown parameter: 'session.turn_detection'" | N/A |
| 2 | `session.audio.input.turn_detection: null` | Yes | **No** |
| 3 | `session.audio.input.turn_detection: { type: 'server_vad', create_response: false }` | Yes | **No** |
| 4 | No audio config at all | Yes | **No** (error still occurred) |

**Conclusion:** The 5s "server had an error" is **not** caused by session.update audio/VAD configuration. We kept Cycle 2 + format (turn_detection null + format) to avoid the *other* error (buffer too small / dual-control race). See [REGRESSION-SERVER-ERROR-INVESTIGATION.md](./REGRESSION-SERVER-ERROR-INVESTIGATION.md) for full cycle details and API/community links.

### 3.2 Other attempts

- **Greeting as text-only:** We send greeting to the client only (ConversationText), not as `conversation.item.create` to upstream, because the API rejects client-created assistant items. This did not remove the 5s error.
- **session.created vs session.updated:** We used to treat both the same (inject context/greeting on session.created). That caused errors because session.created is sent *before* our session.update is applied. We now **ignore** session.created for injection; only session.updated triggers context, SettingsApplied, greeting to client, and flush of queued audio.
- **Audio gate:** We only send `input_audio_buffer.append` after session.updated; binary before that is queued. This is required for protocol correctness; it did not by itself remove the 5s error.
- **Format in session.update:** We send `session.audio.input.format: { type: 'audio/pcm', rate: 24000 }` so the API knows we send PCM 24 kHz 16-bit. Aligns with [session.updated schema](https://platform.openai.com/docs/api-reference/realtime-server-events/session/updated); did not remove the 5s error.

---

## 4. Current implementation (code)

### 4.1 Session config (translator)

We send **GA path** audio config: `turn_detection: null` and `format` under `session.audio.input`. Top-level `session.turn_detection` is rejected by the API.

**File:** `scripts/openai-proxy/translator.ts`

```ts
export function mapSettingsToSessionUpdate(settings: ComponentSettings): OpenAISessionUpdate {
  const session: OpenAISessionUpdate['session'] = {
    type: 'realtime',
    model: settings.agent?.think?.provider?.model ?? 'gpt-realtime',
    instructions: settings.agent?.think?.prompt ?? '',
    // GA API: turn_detection is under session.audio.input (REGRESSION-SERVER-ERROR-INVESTIGATION.md Cycle 2).
    // Disable Server VAD so only the proxy sends commit + response.create.
    audio: {
      input: {
        turn_detection: null,
        format: { type: 'audio/pcm', rate: 24000 },
      },
    },
  };
  // ... tools if present
  return { type: 'session.update', session };
}
```

**OpenAI API:** [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) — "To clear a field like turn_detection, pass null." Session schema in [session.updated](https://platform.openai.com/docs/api-reference/realtime-server-events/session/updated) shows `audio.input.format: { type: "audio/pcm", rate: 24000 }`.

### 4.2 Audio gate: no append before session.updated (server)

Binary from the client is **queued** until we have sent SettingsApplied (i.e. we have received session.updated). When we receive **session.updated**, we flush the queue and send each chunk as `input_audio_buffer.append`.

**File:** `scripts/openai-proxy/server.ts`

- **State:** `const pendingAudioQueue: Buffer[] = [];` (per connection).
- **When client sends binary and we have *not* yet sent SettingsApplied:** push to queue and return (do not send append).
- **When we receive `session.updated`:** send context items, SettingsApplied, greeting to client only, then call `flushPendingAudio()` which sends each queued chunk as `input_audio_buffer.append` and schedules the commit debounce.

Relevant snippet (binary handling in `forwardClientMessage`):

```ts
if (!hasSentSettingsApplied) {
  // Session not ready for audio yet; queue and send after session.updated (Issue #414).
  pendingAudioQueue.push(raw);
  // ... debug log ...
  return;
}
// ... assertAppendChunkSize, send append, scheduleAudioCommit ...
```

And on `session.updated`:

```ts
} else if (msg.type === 'session.updated') {
  hasSentSettingsApplied = true;
  for (const itemJson of pendingContextItems) upstream.send(itemJson);
  pendingContextItems.length = 0;
  clientWs.send(JSON.stringify(mapSessionUpdatedToSettingsApplied(msg)));
  // ... greeting to client only ...
  flushPendingAudio();
}
```

**OpenAI API:** [input_audio_buffer.append](https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/append) — "This must be in the format specified by the input_audio_format field in the session configuration." So append only after session is configured.

### 4.3 Commit and response.create (server)

We send `input_audio_buffer.commit` and `response.create` only after (a) we have at least 100ms of audio (4800 bytes at 24 kHz 16-bit), and (b) 400ms debounce after the *last* binary chunk. This avoids "buffer too small" and avoids double response (we disabled Server VAD).

**File:** `scripts/openai-proxy/server.ts` — `scheduleAudioCommit` uses `INPUT_AUDIO_COMMIT_DEBOUNCE_MS = 400` and `assertMinAudioBeforeCommit(pendingAudioBytes)` before sending commit. Constants: `scripts/openai-proxy/openai-audio-constants.ts` — `OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT = 4800`, `OPENAI_MIN_AUDIO_MS_FOR_COMMIT = 100`.

**OpenAI API:** [input_audio_buffer.commit](https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/commit) — "This event will produce an error if the input audio buffer is empty." [Realtime guide](https://platform.openai.com/docs/guides/realtime-conversations) and buffer constraints imply sufficient audio before commit.

### 4.4 session.created: no injection

We do **not** send context items or greeting to upstream on `session.created`. We only log (in debug) and wait for `session.updated`. Injecting on session.created sent conversation.item.create to an unconfigured session and caused upstream errors.

**File:** `scripts/openai-proxy/server.ts` — on `session.created` we only log "session.created received (waiting for session.updated before injecting context/greeting)" and do not call any send for context/greeting or SettingsApplied.

---

## 5. Protocol (single source of truth)

**File:** [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md)

- **§2.4 Firm audio connection:** Connection is ready for audio when the proxy has received **session.updated**. Client must not send audio before SettingsApplied. Proxy does not send append until after session.updated; binary before that is queued and flushed on session.updated.
- **§3.5 Buffer restrictions:** Minimum 100ms (4800 bytes) before commit; 400ms debounce; only TTS sent as binary to client, all other upstream messages as text.

---

## 6. Tests

### 6.1 Integration tests (mock and real-API)

**File:** `tests/integration/openai-proxy-integration.test.ts`

| Test name | What it proves |
|-----------|----------------|
| `Issue #414: no input_audio_buffer.append before session.updated (audio gated, queued then flushed)` | Proxy does not send append until after session.updated; binary is queued and flushed then. Mock enforces: if append is received before session.updated, protocol error is recorded. |
| `Issue #414: session.update before input_audio_buffer.append in upstream order` | Upstream receives session.update before any append. |
| `Issue #414: firm audio connection — no Error from upstream within 5s after sending audio (mock)` | With mock upstream, no Error within 5s after we send audio. |
| `Issue #414 real-API: firm audio connection — no Error from upstream within 5s after sending audio (USE_REAL_OPENAI=1)` | With **real** OpenAI (run when `USE_REAL_OPENAI=1` and `OPENAI_API_KEY` set), no Error from upstream within 5s after sending audio. **As of last run this test passes** — i.e. we get no error within the 5s window in that scenario. The 5s error may still occur in E2E or after the 5s window. |

Run real-API firm audio test:

```bash
USE_REAL_OPENAI=1 npm test -- tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #414 real-API: firm audio"
```

### 6.2 E2E

E2E tests call `assertNoRecoverableAgentErrors(page)` (0 errors). When the upstream sends "server had an error" within the assertion window, those tests **fail**. We do not allow any errors; no relaxation. So E2E can still fail on real-API runs when the defect appears (e.g. Basic audio, 5b, greeting-playback).

---

## 7. OpenAI API references (citations)

- **session.update (client):** https://platform.openai.com/docs/api-reference/realtime-client-events/session/update — "To clear a field like turn_detection, pass null."
- **session.updated (server):** https://platform.openai.com/docs/api-reference/realtime-server-events/session/updated — Example session includes `audio.input.format`, `audio.input.turn_detection`.
- **input_audio_buffer.append:** https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/append — Audio must match session configuration; max 15 MiB per event.
- **input_audio_buffer.commit:** https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/commit — Errors if buffer empty.
- **Realtime VAD:** https://platform.openai.com/docs/guides/realtime-vad — `turn_detection`, `idle_timeout_ms`, `create_response`, etc.
- **Realtime conversations:** https://platform.openai.com/docs/guides/realtime-conversations — Session format, audio encoding.
- **GA session format (blog):** https://developers.openai.com/blog/realtime-api/ — `session.audio.input.turn_detection` nesting.

### Community / known issues

- **Server error reports:** https://community.openai.com/t/openai-realtime-api-the-server-had-an-error-while-processing-your-request/978856
- **turn_detection null / manual control:** https://community.openai.com/t/turn-detection-null-breaks-manual-audio-control-in-realtime-api-web-rtc/1146451
- **Idle timeout behavior:** https://community.openai.com/t/websocket-cant-distinguish-idle-timeout-from-regular-speech-stopped-is-this-expected/1371509 — ~5–6s default mentioned.

---

## 8. What we had planned next

1. **idle_timeout_ms:** The Realtime VAD docs mention `idle_timeout_ms`. Hypothesis: the default is ~5–6s and when no (or insufficient) audio is provided after session establishment, the server sends the error. We have **not** yet tried setting `idle_timeout_ms` in session.update (e.g. to a very high value or null) to see if the 5s error stops. This was the next concrete experiment.
2. **Message ordering / protocol:** Double-check that our WebSocket frame ordering and content types (text vs binary) match the API’s expectations. Protocol doc and proxy code are aligned; no known violation found.
3. **Upstream bug / support:** Treat as possible upstream bug; gather more evidence from community or support if the above does not help.
4. **Phase B (VAD / session config):** Deferred until the server error is resolved or understood. If we later enable Server VAD for VAD events, we would need to avoid the dual-control race (e.g. not send our own commit/response.create when Server VAD is on).

---

## 9. Local references

- **CURRENT-UNDERSTANDING.md** — Entry point; two errors; commit strategy; doc index.
- **REGRESSION-SERVER-ERROR-INVESTIGATION.md** — Full 4-cycle session.update investigation; API and community URLs.
- **PROTOCOL-AND-MESSAGE-ORDERING.md** (scripts/openai-proxy/) — Wire protocol, §2.4 firm audio, §3.5 buffer rules.
- **NEXT-STEPS.md** — Plan and priorities; E2E relaxations and test status.
- **scripts/openai-proxy/translator.ts** — `mapSettingsToSessionUpdate`, session.audio.input.
- **scripts/openai-proxy/server.ts** — `pendingAudioQueue`, `flushPendingAudio`, session.created/session.updated handling, `scheduleAudioCommit`.
- **scripts/openai-proxy/openai-audio-constants.ts** — `OPENAI_MIN_AUDIO_BYTES_FOR_COMMIT`, `assertMinAudioBeforeCommit`, `assertAppendChunkSize`.

---

## 10. Summary for reviewer

- **Defect:** Upstream sends "server had an error" (and sometimes closes) — either right after we send append or ~5s after connection / after a successful turn.
- **Approach:** Strict protocol (no append before session.updated; queue + flush), GA session config (turn_detection null + format), no injection on session.created. Four TDD cycles showed the 5s error is **not** caused by session.update audio/VAD config.
- **Current state:** Real-API integration test "firm audio connection" **passes** (no error within 5s in that test). E2E still fail when the error occurs in their window; we require 0 errors.
- **Planned next:** Try `idle_timeout_ms` in session config; then message ordering / upstream bug if needed.
