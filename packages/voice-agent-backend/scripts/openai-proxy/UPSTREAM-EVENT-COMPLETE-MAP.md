# OpenAI proxy: complete upstream → proxy → client event map

**Purpose:** Single reference for every upstream (OpenAI Realtime server) event type and what the proxy does. Unmapped events are not forwarded; the proxy sends **Error** (code `unmapped_upstream_event`) to the client — **treat these as warnings**; the goal is to map all events and eliminate unmapped cases. Gaps and planned work: [Epic #493](../../../../docs/issues/OPENAI-PROXY-EVENT-MAP-GAPS/EPIC.md) and [issues #494–#500](https://github.com/Signal-Meaning/dg_react_agent/issues/493).

---

## Explicitly handled upstream events (server.ts)

Every `msg.type` that has its own branch in the proxy. **Mapped** = we send one or more component-shaped messages (or no message). **Not mapped** = we do not send a component message for that event.

| Upstream event | Upstream payload (key fields) | Proxy action (proxy → client) | Mapped? |
|----------------|-------------------------------|-------------------------------|---------|
| **session.created** | `type`, `session` (full session config). Proxy does not read payload. | No message. Log only. Do not inject context or greeting. | No (control only) |
| **session.updated** | `type`, `session?` (full effective config). Proxy currently does not read `session` for mapping; only sends **SettingsApplied**. Consider reading `session` for validation or future use (see [Epic #493](../../../../docs/issues/OPENAI-PROXY-EVENT-MAP-GAPS/EPIC.md)). | Send **SettingsApplied**. Optionally send greeting as **ConversationText**. Flush queued audio. | Yes |
| **response.output_text.done** | `type`; API may include output/text in payload. Proxy does **not** use it for **ConversationText** (assistant text only from conversation.item.added). Rationale: [DOC-output-text-done-rationale](../../../../docs/issues/OPENAI-PROXY-EVENT-MAP-GAPS/DOC-output-text-done-rationale.md), Issue #498. | Clear responseInProgress; maybe send deferred response.create. Send **AgentStartedSpeaking** if not yet sent, **AgentAudioDone**, flush buffered Error. | Yes |
| **response.output_audio_transcript.done** | `type`, `transcript?` (model speech transcript). Proxy does not map to ConversationText (Phase 2). | Log only. No client message. | No (control only) |
| **response.function_call_arguments.done** | `type`, `name?`, `arguments?`, `call_id?`. Mapped to FunctionCallRequest `id`←call_id, `name`, `arguments`. | Send **FunctionCallRequest** (text). | Yes |
| **error** | `type`, `error?: { message?, code? }`. Proxy uses `error.code` (e.g. `idle_timeout`, `session_max_duration`) and `error.message`. | Map to **Error** (description, code). Buffer if idle_timeout and response in progress; else send immediately. | Yes |
| **input_audio_buffer.speech_started** | `type`. No payload fields read. | Send **UserStartedSpeaking** (text). | Yes |
| **input_audio_buffer.speech_stopped** | `type` (API may send `channel`, word timings). Proxy sends fixed `UtteranceEnd` with `channel: [0,1]`, `last_word_end: 0`. | Send **UtteranceEnd** (text). | Yes |
| **conversation.item.input_audio_transcription.completed** | `type`, `item_id?`, `content_index?`, `transcript?`. Proxy uses `transcript` for **Transcript**. | Map to **Transcript** (transcript, is_final: true). | Yes |
| **conversation.item.input_audio_transcription.delta** | `type`, `item_id?`, `content_index?`, `delta?`. Proxy uses `delta` for interim **Transcript**. | Map to **Transcript** (interim, is_final: false). | Yes |
| **response.output_audio.delta** | `type`, `delta` (base64 PCM). Proxy decodes to buffer and sends **binary** to client. | If first output, send **AgentStartedSpeaking**. Decode base64 → PCM; send **binary**. | Yes |
| **response.output_audio.done** | `type` (no payload read). | Send **AgentAudioDone**. Do not clear responseInProgress. | Yes |
| **response.done** | `type`, `response?` (API may include response object). Proxy does not read payload. | Send **AgentAudioDone** if needed. Clear responseInProgress; maybe send deferred response.create. | Yes |
| **conversation.item.created** / **.added** / **.done** | `type`, `item?: { id?, type?, role?, content? }`. Proxy uses `item.id` for pending-item counter and dedupe; `item.role`, `item.content` for **ConversationText** (assistant). Only text-bearing content parts (output_text, transcript, etc.) are used; **function_call**-only parts yield no ConversationText (parity with Deepgram: Issue #499). Raw event forward is a bug; send only mapped **ConversationText** (Issue #500). | Decrement counter; if 0 send response.create. If assistant, send **ConversationText** (from content). Do not forward raw event. | Yes |

---

## Event payload examples (key fields only)

Representative upstream JSON shapes the proxy reads. Full schemas: [OpenAI Realtime server events](https://platform.openai.com/docs/api-reference/realtime-server-events).

**session.updated**
```json
{ "type": "session.updated", "session": { "type": "realtime", "model": "...", "audio": { ... } } }
```
Proxy only needs `type`; it sends SettingsApplied and optionally greeting.

**response.function_call_arguments.done**
```json
{ "type": "response.function_call_arguments.done", "call_id": "call_abc", "name": "get_current_time", "arguments": "{}" }
```
Proxy maps to **FunctionCallRequest**: `id` ← `call_id`, `name`, `arguments`.

**error**
```json
{ "type": "error", "error": { "message": "Session expired", "code": "idle_timeout" } }
```
Proxy maps to **Error** with `description` ← `error.message`, `code` ← `error.code` (e.g. `idle_timeout`, `session_max_duration`).

**conversation.item.input_audio_transcription.completed**
```json
{ "type": "conversation.item.input_audio_transcription.completed", "item_id": "item_1", "transcript": "Hello, how can I help?" }
```
Proxy maps `transcript` to **Transcript** (is_final: true).

**conversation.item.added** (assistant message)
```json
{ "type": "conversation.item.added", "item": { "id": "item_2", "type": "message", "role": "assistant", "content": [ { "type": "output_text", "text": "The time is 12:00." } ] } }
```
Proxy extracts text from `item.content` (supports `text`, `output_text.text`, or array of parts) and sends **ConversationText** (assistant). function_call-only parts do not produce ConversationText (Issue #499). Raw event forward removed (Issue #500).

**response.output_audio.delta**
```json
{ "type": "response.output_audio.delta", "delta": "<base64-encoded PCM>" }
```
Proxy decodes `delta` to binary and sends raw PCM to client; no JSON to client for this event.

---

## Unmapped upstream events (warnings; goal: eliminate)

Any upstream event whose `msg.type` is **not** in the explicitly handled list hits the `else` in server.ts. The proxy **does not** forward it as text. It sends **Error** to the client with `code: 'unmapped_upstream_event'` and a description that includes the event type — **treat as a warning**: the goal is to map all events and eliminate these over time (see [Epic #493](../../../../docs/issues/OPENAI-PROXY-EVENT-MAP-GAPS/EPIC.md)).

Examples of event types that currently trigger this (from OpenAI Realtime server events): **response.created**, **conversation.created**, **response.output_text.added**, **response.content_part.added** / **.done**, **input_audio_buffer.committed** / **.cleared** / **.timeout_triggered**, **conversation.item.input_audio_transcription.failed** / **.segment**, **conversation.item.deleted** / **.truncated**, **rate_limits.updated**, MCP-related events, and any future API event types.

Integration test: **"Protocol: unmapped upstream event (e.g. response.created) yields Error (unmapped_upstream_event)"** — mock sends `response.created`, client must receive Error with code `unmapped_upstream_event`.

---

## References

- **Implementation:** `server.ts` (upstream `on('message')` handler).
- **Spec:** tests/integration/PROTOCOL-SPECIFICATION.md §1, PROTOCOL-AND-MESSAGE-ORDERING.md §5.
- **OpenAI server events:** https://platform.openai.com/docs/api-reference/realtime-server-events
- **Epic and gaps:** [docs/issues/OPENAI-PROXY-EVENT-MAP-GAPS/EPIC.md](../../../../docs/issues/OPENAI-PROXY-EVENT-MAP-GAPS/EPIC.md) — Epic #493, sub-issues #494–#500.
