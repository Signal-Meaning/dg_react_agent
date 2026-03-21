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
| `audio` | **Input:** fixed GA shape (`turn_detection: null`, PCM 24kHz, transcription). **Output:** merged from `agent.sessionAudioOutput` when set. | Input is proxy-owned for Issues #414 / #451; output is Issue #540. |
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
| `agent.idleTimeoutMs` | **Client-side only** in the component (WebSocketManager / idle manager). `mapSettingsToSessionUpdate` does **not** put it on `session`. With `turn_detection: null`, OpenAI has no server `idle_timeout_ms` on this path; see [PROTOCOL-AND-MESSAGE-ORDERING.md §3.9](./PROTOCOL-AND-MESSAGE-ORDERING.md#39-idle-timeout-expected-closure-not-an-error). |
| `Settings.audio` (component encoding / sample_rate) | Used for component audio pipeline metadata; **input** shape on `session.audio` is **proxy-owned** (PCM 24kHz, `turn_detection: null`, transcription) — not a direct copy of Settings.audio. |
| `agent.context.messages` | Folded into **`instructions`** only (Issue #489); not sent as separate session fields or as items in `session.update`. |
| `agent.greeting` | Injected after `session.updated` as **`conversation.item.create`** (assistant), not in `session.update`. |

---

## Coverage

- **Unit:** `tests/openai-proxy.test.ts` — `mapSettingsToSessionUpdate` (including session key expectations and non-forwarding of `temperature`).
- **Integration (mock):** `tests/integration/openai-proxy-integration.test.ts` — session shape and protocol behavior.
- **Integration (real API):** `USE_REAL_APIS=1` on `openai-proxy-integration.test.ts` when qualifying upstream.

---

## Related docs

- [PROTOCOL-AND-MESSAGE-ORDERING.md](./PROTOCOL-AND-MESSAGE-ORDERING.md) — Settings row and message order.
- [README.md](./README.md) — translator overview.
- [UPSTREAM-EVENT-COMPLETE-MAP.md](./UPSTREAM-EVENT-COMPLETE-MAP.md) — server → client events (separate from this client → server map).
