# OpenAI proxy: protocol and message ordering

This document describes the **wire protocol and message ordering** for the OpenAI Realtime proxy: what the proxy accepts from the component (client), what it sends to the OpenAI upstream, what it receives from upstream, and what it sends back to the client. It is the single source of truth for **frame types** (text vs binary) and **ordering rules**.

**See also:** [README.md](./README.md), [docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md](../../docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md), [docs/issues/ISSUE-381/API-DISCONTINUITIES.md](../../docs/issues/ISSUE-381/API-DISCONTINUITIES.md).

---

## 1. Wire contract: text vs binary

### 1.1 Client → Proxy

| Content | Frame type | Description |
|--------|------------|-------------|
| **JSON messages** | **Text** | `Settings`, `InjectUserMessage`, `FunctionCallResponse`, and any other component JSON are sent as **text** (UTF-8 JSON). |
| **Microphone audio** | **Binary** | Raw PCM from the component is sent as **binary** frames. The proxy translates each binary frame to OpenAI `input_audio_buffer.append` (base64 in a JSON event) and sends that as **text** to upstream. |

So: client sends **text** (JSON) and **binary** (PCM). The proxy never forwards client binary to upstream as binary; it always converts to `input_audio_buffer.append` JSON.

### 1.2 Proxy → Client

| Content | Frame type | Description |
|--------|------------|-------------|
| **All JSON messages** | **Text** | Every upstream event that is forwarded or translated (e.g. `SettingsApplied`, `ConversationText`, `Error`, `conversation.item.added`, etc.) is sent to the client as **text** (UTF-8 JSON). |
| **TTS PCM only** | **Binary** | **Only** the decoded payload of upstream `response.output_audio.delta` is sent to the client as **binary** (raw PCM 24 kHz mono 16-bit). No other upstream message is sent as binary. |

**Critical:** Sending any other upstream message (e.g. `conversation.item.added`, `conversation.item.done`, or any JSON) as binary would cause the component to route it into the audio pipeline and corrupt playback. The proxy **must** send only `response.output_audio.delta` (decoded) as binary; everything else as text. See Issue #414 (root cause: JSON forwarded as binary).

---

## 2. Connection and session ordering

### 2.1 Client connects, proxy connects to upstream

1. Client opens WebSocket to proxy (e.g. `ws://host/openai`).
2. Proxy opens WebSocket to OpenAI Realtime upstream.
3. Messages from the client are **queued** until the upstream `open` event fires; then the queue is drained in order.

### 2.2 First message: Settings → session.update

1. Client sends **Settings** (text, JSON).
2. Proxy sends **one** `session.update` to upstream (translated via `mapSettingsToSessionUpdate`). Any duplicate Settings (e.g. on reconnect) do **not** trigger a second `session.update`; the proxy sends `SettingsApplied` immediately so the client does not block.
3. Proxy stores context messages (from `Settings.agent.context.messages`) and optional greeting (`Settings.agent.greeting`) for use **after** `session.updated`.

### 2.3 Upstream: session.created vs session.updated

- **session.created** – Sent by OpenAI **immediately** after the WebSocket connects, **before** the client’s `session.update` is processed. The proxy **does not** send `SettingsApplied`, inject context, or inject greeting on `session.created`. Doing so would send `conversation.item.create` to an unconfigured session and cause upstream errors (Issue #414).
- **session.updated** – Sent by OpenAI **after** our `session.update` has been applied. Only this event triggers:
  1. Sending **context items** (`conversation.item.create` for each context message) to upstream.
  2. Sending **SettingsApplied** to the client.
  3. Sending **greeting** to the client only (as `ConversationText`); the proxy does **not** send the greeting as `conversation.item.create` to upstream (OpenAI Realtime rejects client-created assistant items). Greeting is shown in the UI; the model may see it in instructions.

Order: **session.created** (ignored for injection) → **session.updated** (context to upstream, SettingsApplied + greeting to client).

---

## 3. Client → Proxy: message handling

| Client message (text) | Proxy action |
|------------------------|--------------|
| **Settings** | Map to `session.update`; send to upstream once per connection. Store context and greeting. On duplicate Settings, send `SettingsApplied` only (no second `session.update`). |
| **InjectUserMessage** | Map to `conversation.item.create` (user, `input_text`); send to upstream. Set `pendingItemAddedBeforeResponseCreate = 1`. Send **user echo** (`ConversationText` role `user`) to client. Send `response.create` only after upstream confirms the item (see §4). |
| **FunctionCallResponse** | Map to `conversation.item.create` (function_call_output); send to upstream, then send `response.create` immediately. |
| **Other JSON** | Forward to upstream as-is (text). |
| **Binary** | Treat as PCM; send `input_audio_buffer.append` (base64) to upstream; set debounce timer for `input_audio_buffer.commit` + `response.create`. |

---

## 4. Upstream → Proxy: response.create ordering

The proxy must **not** send `response.create` until the upstream has confirmed the items we just sent (e.g. user message or greeting + context). Otherwise the model may respond before the conversation state includes the new item.

- **InjectUserMessage:** Proxy sends `conversation.item.create` (user), then waits for **one** `conversation.item.added` (or `.created` / `.done`) for that item. When the counter `pendingItemAddedBeforeResponseCreate` reaches 0, the proxy sends `response.create`.
- **Context + greeting (session.updated):** Greeting is **not** sent to upstream as an item; only context items are. So for “context only” there is no pending item and no `response.create` from that path. (If in the future we inject an assistant greeting as an item, we would set the counter to N+1 for N context items + 1 greeting and send `response.create` when all are confirmed.)
- **FunctionCallResponse:** No wait; proxy sends `conversation.item.create` (function_call_output) then `response.create` immediately.

Item confirmation is tracked by upstream event types `conversation.item.created`, `conversation.item.added`, `conversation.item.done`; each **unique item id** is counted once (see `pendingItemAckedIds` in `server.ts`).

---

## 5. Upstream → Proxy: event handling and proxy → client

| Upstream event | Proxy → client |
|----------------|----------------|
| **session.created** | No message to client. Log only. Do not inject context or greeting. |
| **session.updated** | Send context items to upstream (if any); send **SettingsApplied** (text); send greeting as **ConversationText** (text) if configured; no greeting to upstream. |
| **conversation.item.created** / **.added** / **.done** | Decrement pending-item counter; when 0, send `response.create` to upstream. Forward event to client as **text**. |
| **response.output_text.done** | Map to **ConversationText** (assistant); send as **text**. |
| **response.output_audio_transcript.done** | Map to **ConversationText** (assistant); send as **text**. |
| **response.function_call_arguments.done** | Map to **FunctionCallRequest** and **ConversationText** (assistant); send both as **text**. |
| **response.output_audio.delta** | Decode base64 to PCM; send **binary** (raw PCM) to client only. Do not send as JSON. |
| **response.output_audio.done** | No message to client (playback is driven by chunks). Optional: boundary debug logging. |
| **error** | Map to **Error** (component shape); send as **text**. |
| **Any other upstream event** | Forward to client as **text** (same JSON). |

---

## 6. Summary table: client-facing events (proxy → client)

| Component message type | Frame type | When |
|------------------------|------------|------|
| SettingsApplied | Text | After session.updated |
| ConversationText (user) | Text | After InjectUserMessage (echo) |
| ConversationText (assistant) | Text | From output_text.done, output_audio_transcript.done, function_call_arguments.done, or greeting |
| FunctionCallRequest | Text | From response.function_call_arguments.done |
| Error | Text | From upstream error |
| (binary PCM) | Binary | From response.output_audio.delta only |
| (other) | Text | Forwarded upstream events (e.g. conversation.item.added) |

---

## 7. References

- **Implementation:** `server.ts` (message handlers), `translator.ts` (mapping functions).
- **Component contract:** [docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md](../../docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) (readiness: SettingsApplied before first user message).
- **API discontinuities:** [docs/issues/ISSUE-381/API-DISCONTINUITIES.md](../../docs/issues/ISSUE-381/API-DISCONTINUITIES.md).
- **OpenAI Realtime:** [Client events](https://platform.openai.com/docs/api-reference/realtime-client-events), [Server events](https://platform.openai.com/docs/api-reference/realtime-server-events).
