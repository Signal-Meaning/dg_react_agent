# Realtime WebSocket `session.update` — field map (proxy)

**Purpose:** Single source of truth for which **component `Settings`** fields map to which **`session.update.session`** fields on the OpenAI Realtime **WebSocket** API, and which Realtime fields we do not set.

**Canonical upstream shape:** Client event `session.update` with `session` of type **`RealtimeSessionCreateRequest`** (`type: "realtime"`). See [Realtime API — session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) and the **`RealtimeSessionCreateRequest`** schema in the API reference (not the legacy session resource tables that still mention top-level fields absent from this object).

**Implementation:** `mapSettingsToSessionUpdate` in `translator.ts`.

---

## Mapped fields (component → OpenAI `session`)

| OpenAI `session` field | Component / Settings source | Notes |
|------------------------|----------------------------|--------|
| `type` | always `"realtime"` | Required discriminator. |
| `model` | `agent.think.provider.model` | Default `gpt-realtime` when omitted. |
| `instructions` | `agent.think.prompt` + serialized `agent.context.messages` + tool hint when `functions` present | `buildInstructionsWithContext`. |
| `audio` | **Input:** GA shape (PCM 24kHz, transcription). Default **`turn_detection: null`** (proxy sends `input_audio_buffer.commit`). If **`agent.useOpenAIServerVad`** is true → **`turn_detection.type: server_vad`** with VAD defaults + **`idle_timeout_ms`** from **`agent.idleTimeoutMs`** (clamped 5s–30s; `-1`/omit → `null`). **Output:** merged from `agent.sessionAudioOutput` when set. | Issue #560 Phase 2b (Server VAD opt-in); #414 / #451 manual path; #540 output. |
| `agent.useOpenAIServerVad` | When `true`, enables row above (`server_vad`); proxy sends **`append` only** for mic (no proxy `commit`). | Issue #560 Phase 2b; default unset/false. |
| `tools` | `agent.think.functions` | OpenAI `{ type: 'function', name, description, parameters }[]`. |
| `tool_choice` | `agent.think.toolChoice` | Issue #535. |
| `output_modalities` | `agent.think.outputModalities` | Filtered to `text` \| `audio` only; omit if empty after filter. **Not both** modalities in one array per API. Issue #536. |
| `max_output_tokens` | `agent.think.maxOutputTokens` | Positive safe integer only; else omitted. Issue #537. |
| `prompt` | `agent.think.managedPrompt` | Normalized ResponsePrompt; Issue #539. |
| `include` | — | Not set by proxy. |
| `tracing` | — | Not set by proxy. |
| `truncation` | — | Not set by proxy. |

---

## Component-only (not forwarded on `session.update`)

| Component field | Reason |
|-----------------|--------|
| `agent.think.provider.temperature` | **Issue #538:** Not part of WebSocket `RealtimeSessionCreateRequest`. Sending `session.temperature` causes `unknown_parameter` from upstream. Value may still appear on **Settings** JSON from `buildSettingsMessage` / `AgentOptions.thinkTemperature` for UI or future API support. |
| `agent.speak.provider.voice` (and top-level `session.voice`) | **Intentionally omitted:** Realtime returns **Unknown parameter: `session.voice`** when set on WebSocket `session.update` in current GA behavior; voice/output is set via `session.audio.output` (Issue #540) instead. |
| `agent.idleTimeoutMs` | **Client idle** (WebSocketManager / idle manager). On **`session.update`:** forwarded only when **`agent.useOpenAIServerVad`** — as **`session.audio.input.turn_detection.idle_timeout_ms`** (clamped). Otherwise **not** a top-level `session` field; with `turn_detection: null` OpenAI has no server idle on that path — [PROTOCOL-AND-MESSAGE-ORDERING.md §3.9](./PROTOCOL-AND-MESSAGE-ORDERING.md#39-idle-timeout-expected-closure-not-an-error). |
| `Settings.audio` (component encoding / sample_rate) | Used for component audio pipeline metadata; **input** shape on `session.audio` is **proxy-owned** (PCM 24kHz, `turn_detection: null`, transcription) — not a direct copy of Settings.audio. |
| `agent.context.messages` | Folded into **`instructions`** only (Issue #489); not sent as separate session fields or as items in `session.update`. |
| `agent.greeting` | Injected after `session.updated` as **`conversation.item.create`** (assistant), not in `session.update`. |

---

## Coverage

- **Unit:** `tests/openai-proxy.test.ts` — `mapSettingsToSessionUpdate` (including session key expectations and non-forwarding of `temperature`).
- **Integration (mock):** `tests/integration/openai-proxy-integration.test.ts` — session shape and protocol behavior.
- **Integration (real API):** `USE_REAL_APIS=1` + `OPENAI_API_KEY` — run `openai-proxy-integration.test.ts` before release or epic closure for proxy/session mapping work. Includes **Issue #537** (`max_output_tokens`), **#538** (no `session.temperature`, among other cases), and related real-API cases. **Issue #539** (`session.prompt`): set **`OPENAI_MANAGED_PROMPT_ID`** to run the live test; unset → skipped. See [TDD-MANAGED-PROMPT-REAL-API.md](../../../../docs/issues/ISSUE-542/TDD-MANAGED-PROMPT-REAL-API.md).

### `output_modalities` — how thorough are we?

| Layer | What runs | `output_modalities` |
|-------|-----------|---------------------|
| **Unit (translator)** | `tests/openai-proxy.test.ts` | **`['text']`**, **`['audio','text']`** order, invalid filtered, all-invalid → field omitted, absent/empty → omitted. |
| **Unit (Settings JSON)** | `tests/buildSettingsMessage.test.ts` | `agent.think.outputModalities` passed through or omitted. |
| **Integration mock** | `openai-proxy-integration.test.ts` | Many protocol tests **do not** set `outputModalities`; they rely on the proxy omitting the field (API default). No mock matrix that asserts different client-visible behavior per modality. |
| **Integration real API** | Same file with `USE_REAL_APIS=1` | **No** dedicated real-API test that only exists to assert `session.output_modalities: ['text']` vs `['audio']` behavior end-to-end. The Issue **#470** real-API function-call test intentionally **omits** `agent.think.outputModalities` so Realtime uses its default for that qualification run (see [ISSUE-536.md](../../../../docs/issues/ISSUE-542/ISSUE-536.md)). |

**Conclusion:** Mapping of `outputModalities` → `session.output_modalities` is **well covered in unit tests**. **Per-modality real-API** behavior (text-only vs audio-default event mix) is **not** exhaustively qualified in this repo; add explicit real-API (or high-fidelity mock) cases if product requires guaranteed behavior for each modality.

**Canonical API:** [session.update — `output_modalities`](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update).

---

## Related docs

- [PROTOCOL-AND-MESSAGE-ORDERING.md](./PROTOCOL-AND-MESSAGE-ORDERING.md) — Settings row and message order.
- [README.md](./README.md) — translator overview.
- [UPSTREAM-EVENT-COMPLETE-MAP.md](./UPSTREAM-EVENT-COMPLETE-MAP.md) — server → client events (separate from this client → server map).
