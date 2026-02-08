# Component / proxy interface: unified transcript and VAD (TDD)

**Purpose:** Improve the component/proxy interface so transcript and VAD work consistently whether the backend is **Deepgram** (multiple stateless async WebSocket sessions) or **OpenAI** (single long-running session that intermixes text and audio). This doc reframes the NEXT-STEPS hypothesis, states the design goal, and proposes a TDD-based implementation plan.

**Where to read the mapping spec:** **§2.1 Mapping spec (OpenAI → client)** below is the spec for how the proxy maps OpenAI server events into the component’s message types and payloads. The rest of the proxy wire protocol (text vs binary, ordering) is in [scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md).

**Ref:** [NEXT-STEPS.md](./NEXT-STEPS.md) §3.5 (Transcript / VAD failures and OpenAI proxy path), lines 160–161.

---

## 1. Assessment of the current hypothesis

**NEXT-STEPS (160–161):** *"With the proxy, the app may be routing only the **agent** stream to OpenAI; the **transcription** stream (and thus transcript and VAD events) might not be forwarded or might be on a different path."*

**Take:** The hypothesis is **partly right but incomplete**. The gap is not only “routing” or “forwarding” — it is **architectural**:

| Backend | Session model | Transcript / VAD |
|--------|----------------|-------------------|
| **Deepgram** | **Multiple stateless async WebSocket sessions:** one (or more) for **transcription** (e.g. `transcriptionUrl`), one for **agent** (e.g. `agentUrl`). Each has its own connection lifecycle. | Transcript and VAD come from the **transcription** session (e.g. `Results`, `UtteranceEnd`, `UserStartedSpeaking` on the agent socket). The component creates separate `WebSocketManager` instances and handles Deepgram-specific message types. |
| **OpenAI (Realtime)** | **Single long-running WebSocket session** that intermixes text (e.g. `InjectUserMessage`, `ConversationText`) and audio (e.g. `input_audio_buffer.append`, `response.output_audio.delta`). | User speech and VAD are **in the same session**: e.g. `input_audio_buffer.speech_started`, `input_audio_buffer.speech_stopped`, and transcript may be exposed in server events. There is no separate “transcription socket.” |

So:

- With **Deepgram**, the component expects **two** streams (transcription + agent) and distinct event types for transcript and VAD.
- With **OpenAI proxy**, we today expose only the **agent** side of the contract (SettingsApplied, ConversationText, TTS binary). We do **not** map OpenAI’s VAD/transcript events into the **same** contract the component uses for transcript/VAD (e.g. `TranscriptResponse`, `UserStartedSpeaking`, `UtteranceEnd`). So the component never receives transcript/VAD when using the OpenAI proxy — not because we “only route the agent stream,” but because we never defined or implemented a **unified interface** that both backends satisfy.

**Conclusion:** We must improve the **component/proxy interface** so that:

1. The component consumes a **single, backend-agnostic contract** for “transcript update,” “user started speaking,” and “user stopped speaking / utterance end.”
2. The **proxy** (for OpenAI) maps OpenAI Realtime events into that contract and sends the same message shapes the component already handles for Deepgram (or we extend the component to accept a small set of normalized events).
3. Tests define and enforce the contract (TDD).

---

## 2. Unified interface (contract)

The component already has a **callback-based** contract:

- `onTranscriptUpdate?(transcriptData: TranscriptResponse)`
- `onUserStartedSpeaking?()`
- `onUtteranceEnd?(data: { channel: number[]; lastWordEnd: number })`
- (and optionally `onUserStoppedSpeaking`)

**Wire contract (messages from backend/proxy to component):** The component’s `WebSocketManager` and message handlers today expect **Deepgram** event types (e.g. `Results`, `UtteranceEnd`, `UserStartedSpeaking`). So the **unified interface** can be defined in one of two ways:

- **Option A (preferred):** The proxy sends **the same JSON message types** the component already understands for transcript/VAD: e.g. `UserStartedSpeaking`, `UtteranceEnd`, and a message that carries `TranscriptResponse`-like data (e.g. a type the component already maps to `onTranscriptUpdate`). The component does not need to know whether the message came from Deepgram or from the OpenAI proxy.
- **Option B:** Introduce a small “normalized” event set (e.g. `BackendTranscript`, `BackendVADStart`, `BackendVADEnd`) and have the component translate those into the same callbacks. That requires component changes and more branching.

**Recommendation:** **Option A.** Define the contract as: “Any backend (Deepgram or OpenAI proxy) must send the **same** message types the component already handles for transcript and VAD.” Then the proxy’s job is to map **OpenAI** server events into those message types.

**Concrete contract:**

| Component expectation | Deepgram (today) | OpenAI proxy (to implement) |
|----------------------|------------------|-----------------------------|
| User transcript | `Results` (transcription socket) → normalized to `TranscriptResponse`, `onTranscriptUpdate` | Map OpenAI transcript events (e.g. from server when available) → send message component treats as `Results` or equivalent producing `TranscriptResponse`. |
| User started speaking | `UserStartedSpeaking` (agent or transcription) | Map `input_audio_buffer.speech_started` (or equivalent) → send `UserStartedSpeaking`. |
| User stopped speaking / utterance end | `UtteranceEnd` (transcription) | Map `input_audio_buffer.speech_stopped` (or equivalent) → send `UtteranceEnd` (with a defined payload shape the component accepts). |

If OpenAI does not expose **user** transcript in the same session, we document that “transcript” is only supported when the backend provides it (Deepgram today; OpenAI if/when we have an event to map). VAD (start/stop) can still be implemented from `speech_started` / `speech_stopped`.

### 2.1 Mapping spec (OpenAI to client)

This section is the **spec** for how the proxy maps OpenAI Realtime server events to the JSON messages the component expects. Implementations (and tests) must follow this.

**Source of truth for OpenAI server events:** [OpenAI Realtime API](https://platform.openai.com/docs/api-reference/realtime-client-events) (server-sent events for `input_audio_buffer.speech_started`, `input_audio_buffer.speech_stopped`, and any transcript-related events). The proxy receives these on the upstream WebSocket and sends **text** (JSON) to the client.

| OpenAI upstream event (server to proxy) | Proxy to client (JSON text) | Client message shape (component contract) |
|----------------------------------------|-----------------------------|------------------------------------------|
| `input_audio_buffer.speech_started`    | Send one message.           | `{ "type": "UserStartedSpeaking" }`      |
| `input_audio_buffer.speech_stopped`    | Send one message.           | `{ "type": "UtteranceEnd", "channel": [0, 1], "last_word_end": 0 }` — component expects `UtteranceEndResponse` (`channel: number[]`, `last_word_end: number`). If upstream does not provide these, proxy uses defaults (e.g. `channel: [0, 1]`, `last_word_end: 0`). |
| User transcript (if/when API exposes)  | Send one message.           | Message that the component maps to `TranscriptResponse` and `onTranscriptUpdate` (e.g. same shape as Deepgram `Results` after normalization). *To be specified when an OpenAI transcript event is available.* |

**Rules:**

- All of these proxy-to-client messages are sent as **text** (UTF-8 JSON), not binary. Binary from proxy to client remains reserved for TTS PCM only (see PROTOCOL-AND-MESSAGE-ORDERING.md).
- Ordering: proxy sends the mapped message as soon as it receives the corresponding upstream event; no reordering.
- The component already handles `UserStartedSpeaking` and `UtteranceEnd` from the agent socket (see `src/types/agent.ts`: `UserStartedSpeakingResponse`, `UtteranceEndResponse`). The proxy must send the exact `type` and payload fields the component expects.
- **Input audio format:** OpenAI Realtime session default input is **24 kHz** PCM. For server VAD (`speech_started` / `speech_stopped`) to be emitted, client audio sent to the proxy (and thus to upstream via `input_audio_buffer.append`) should match the session’s input format. E2E that assert VAD when using the OpenAI proxy must use 24 kHz audio (or a session that explicitly configures 16 kHz input if supported).

---

## 3. TDD proposal

**Rule:** Tests define the contract and come first; implementation satisfies the tests.

### Phase 1: Contract tests (proxy → client messages)

**Location:** e.g. `tests/integration/openai-proxy-transcript-vad.test.ts` or extend `tests/integration/openai-proxy-integration.test.ts`.

1. **RED:** Write tests that describe the desired proxy behavior:
   - When the **upstream** (mock) sends `input_audio_buffer.speech_started`, the proxy sends to the client a message that the component treats as **UserStartedSpeaking** (same type and shape the component already handles from Deepgram).
   - When the **upstream** sends `input_audio_buffer.speech_stopped`, the proxy sends to the client a message that the component treats as **UtteranceEnd** (same type and optional payload shape).
   - If we add transcript: when the upstream sends a transcript event (e.g. server event containing user transcript), the proxy sends a message that the component treats as a transcript update (e.g. producing `TranscriptResponse`).
2. Run tests → they fail (proxy does not yet map these events).
3. **GREEN:** Implement in the proxy:
   - In the upstream message handler, handle `input_audio_buffer.speech_started` and `input_audio_buffer.speech_stopped` (and transcript event if applicable).
   - Send the corresponding JSON messages to the client in the **exact shape** the component expects (e.g. `{ type: 'UserStartedSpeaking' }`, `{ type: 'UtteranceEnd', ... }`).
4. **REFACTOR:** Keep proxy code clear; avoid duplication.

### Phase 2: Component behavior tests (optional but recommended)

**Location:** `tests/` (unit or integration).

1. **RED:** Tests that, given a **mock** WebSocket that emits only the unified messages (e.g. `UserStartedSpeaking`, `UtteranceEnd`, and a transcript message), the component:
   - Calls `onUserStartedSpeaking` when it receives the start event.
   - Calls `onUtteranceEnd` when it receives the end event.
   - Calls `onTranscriptUpdate` with a valid `TranscriptResponse` when it receives the transcript message.
2. These may already be covered by existing Deepgram-path tests; if not, add them so that “any backend that sends these messages” is enough for the component to behave correctly.
3. **GREEN:** Ensure component handles the message shapes the proxy will send (e.g. `UtteranceEnd` payload may need to be optional or have a default shape for proxy-origin events).

### Phase 3: E2E (when backend supports transcript/VAD)

**Location:** `test-app/tests/e2e/`.

1. **RED:** E2E that, when running against the **OpenAI proxy** with transcript/VAD enabled:
   - Connects and sends audio (or triggers speech).
   - Asserts that transcript and/or VAD UI elements update (e.g. `[data-testid="transcription"]` or equivalent).
2. **GREEN:** Enable only when the proxy (and OpenAI) actually provide the events; skip or tag (e.g. `@openai-transcript-vad`) when the backend does not support it yet.
3. Document in [TEST-STRATEGY.md](../../docs/development/TEST-STRATEGY.md) which specs require transcript/VAD and for which backend.

### Phase 4: Document and narrow NEXT-STEPS

- Update [NEXT-STEPS.md](./NEXT-STEPS.md) §3.5 (and §2 “Hypothesized root causes” for item E) to state that the root cause is **interface mismatch**: single-session OpenAI does not currently emit the same transcript/VAD contract as multi-session Deepgram; the plan is to normalize via proxy mapping and contract tests (this doc).
- After implementation, mark transcript/VAD with OpenAI as “supported when proxy maps events” or “partial (VAD only)” if transcript is not available from OpenAI in the same way.

---

## 4. Implementation checklist (summary)

| Step | Owner | Action | Done |
|------|--------|--------|------|
| 1 | Tests | Add proxy integration tests: upstream `speech_started` → client receives UserStartedSpeaking; upstream `speech_stopped` → client receives UtteranceEnd. (RED.) | ✅ |
| 2 | Proxy | Implement mapping in OpenAI proxy upstream handler. (GREEN.) | ✅ |
| 3 | Component | If needed, allow UtteranceEnd (and transcript) from agent socket with same shape as from transcription socket; add or reuse unit tests. | ✅ (no change needed; Phase 2 tests added) |
| 4 | E2E | Add or enable E2E that assert transcript/VAD UI when using OpenAI proxy; tag or skip when backend does not support. | ✅ (test 5b in openai-proxy-e2e.spec.js) |
| 5 | Docs | Update NEXT-STEPS and TEST-STRATEGY; link to this doc. | ✅ (NEXT-STEPS updated; see §5 Progress) |

---

## 5. Progress (TDD execution log)

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1 RED** | ✅ Done | Two proxy integration tests added in `tests/integration/openai-proxy-integration.test.ts` (itMockOnly): (1) upstream `input_audio_buffer.speech_started` → client receives `UserStartedSpeaking`; (2) upstream `input_audio_buffer.speech_stopped` → client receives `UtteranceEnd` with `channel` and `last_word_end`. |
| **Phase 1 GREEN** | ✅ Done | Proxy mapping implemented in `scripts/openai-proxy/server.ts`: upstream message handler sends `{ type: 'UserStartedSpeaking' }` on `input_audio_buffer.speech_started`, and `{ type: 'UtteranceEnd', channel: [0, 1], last_word_end: 0 }` on `input_audio_buffer.speech_stopped`. Both integration tests pass. |
| **Phase 1 REFACTOR** | ✅ Done | No extra abstraction; two short branches in upstream handler with comments referencing this doc. |
| **Phase 2 (optional)** | ✅ Done | Component behavior tests added in `tests/component-vad-callbacks.test.tsx`: (1) mock WebSocket emits `UserStartedSpeaking` → `onUserStartedSpeaking` called once; (2) mock emits `UtteranceEnd` with `channel` and `last_word_end` → `onUtteranceEnd` called with `{ channel, lastWordEnd }`; (3) `UtteranceEnd` without payload → component applies defaults `[0, 1]` and `0`. All three tests pass; no component code changes required (component already accepts wire shape). |
| **Phase 3 E2E** | ✅ Done | E2E test **5b. VAD (Issue #414)** added in `test-app/tests/e2e/openai-proxy-e2e.spec.js`: sends audio via proxy, asserts at least one VAD event (UserStartedSpeaking or UtteranceEnd) in UI within 15s. Depends on OpenAI sending speech_started/speech_stopped for the sample. |
| **Phase 4 Docs** | ✅ Done | NEXT-STEPS §3.5 and root-cause (item E) updated; TEST-STRATEGY.md has "Transcript / VAD and backends" and link to this doc; E2E-BACKEND-MATRIX.md updated for test 5b and deepgram-callback-test note. |

---

## 6. References

- **OpenAI Realtime:** e.g. [Realtime client events](https://platform.openai.com/docs/api-reference/realtime-client-events) (input_audio_buffer, speech_started, speech_stopped, transcript).
- **Component:** `src/components/DeepgramVoiceInteraction/index.tsx` (transcription vs agent managers; handling of `UserStartedSpeaking`, `UtteranceEnd`, `Results`).
- **Proxy:** `scripts/openai-proxy/server.ts` (upstream message handler); [PROTOCOL-AND-MESSAGE-ORDERING.md](../../scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md).
- **Types:** `src/types/agent.ts` (e.g. `UserStartedSpeaking`, `UtteranceEnd`); `src/types/transcription.ts` (`TranscriptResponse`).
