# OpenAI Realtime: client events vs component protocol (Issue #541)

**Purpose:** Matrix of **OpenAI Realtime [client events](https://platform.openai.com/docs/api-reference/realtime-client-events)** (JSON the upstream WebSocket accepts from the client) and how this repo’s **translation proxy** produces them from the **Deepgram Voice Agent–shaped** component protocol.

**Sibling doc (upstream → client):** [UPSTREAM-EVENT-COMPLETE-MAP.md](./UPSTREAM-EVENT-COMPLETE-MAP.md).

---

## Summary

| OpenAI client event | Produced by proxy? | Component / wire source | Notes |
|--------------------|--------------------|-------------------------|--------|
| **session.update** | Yes | First **`Settings`** per connection → `mapSettingsToSessionUpdate` | Duplicate **`Settings`** on same connection: **`SettingsApplied`** only, no second `session.update` (see PROTOCOL §2.2). |
| **conversation.item.create** | Yes | **`InjectUserMessage`**; **`FunctionCallResponse`**; context / greeting after `session.updated` | Order: deferred until item ack where required (Issues #462, #522, #534). |
| **input_audio_buffer.append** | Yes | **Binary PCM** from client | Converted to base64 in JSON to upstream. |
| **input_audio_buffer.commit** | Yes | Internal (debounced after append) | Proxy-managed; not a component message type. |
| **response.create** | Yes | Internal (after commit threshold, after inject item added, after function_call_output completion, etc.) | **Host-visible** only indirectly (turn completion). See PROTOCOL §3–4. |
| **session.update** (again) | Rare | Same as first row | Only when upstream has no active response (Issue #459); otherwise `SettingsApplied` without upstream update. |
| **response.cancel** | No | — | Not mapped; use **`OPENAI_PROXY_CLIENT_JSON_PASSTHROUGH=1`** only if you must send raw events (not recommended). |
| **conversation.item.truncate** | No | — | Same as above. |
| **input_audio_buffer.clear** | No* | — | *WebRTC-oriented in API docs; WebSocket path uses proxy buffer rules. |
| **output_audio_buffer.clear** | No | — | WebRTC/SIP-oriented per OpenAI docs. |

**Strict client JSON (default):** Only **`Settings`**, **`InjectUserMessage`**, **`FunctionCallResponse`**, and **`KeepAlive`** are accepted as typed component messages; others → component **`Error`** (`disallowed_client_message_type`) unless passthrough is enabled (Issue #533).

---

## `response.create` lifecycle (host-visible vs proxy-managed)

- **Proxy-managed:** When to send **`response.create`** after **`input_audio_buffer.commit`**, after **`conversation.item.added`** for an inject, and when clearing **deferred** `response.create` after **`response.output_text.done`** / **`response.done`** / function-call completion (Issues #414, #470, #522).
- **Host-visible:** The component does not send `response.create`; it sends **user turn** as audio binary and/or **`InjectUserMessage`**. Effects appear as **`ConversationText`**, **binary TTS**, **`FunctionCallRequest`**, etc.

---

## `SettingsApplied` idempotence (Section 6)

Multiple upstream **`session.updated`** events may legitimately result in multiple **`SettingsApplied`** messages to the component. The React layer must **not** assume exactly one `SettingsApplied` per connection for one-shot side effects that must run only once (e.g. **drain a queue once**). See **`tests/settings-applied-idempotence-issue541.test.tsx`**.
