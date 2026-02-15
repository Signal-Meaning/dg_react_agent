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

Order: **session.created** (ignored for injection) → **session.updated** (context to upstream, SettingsApplied + greeting to client, **flush any queued audio** — see §3).

**Audio readiness (Issue #414):** The proxy does **not** send `input_audio_buffer.append` until after `session.updated` has been received. Binary received before `session.updated` is queued and sent in order when the session is ready. This avoids sending audio before the session is configured for it (which can contribute to upstream "server had an error").

### 2.4 Firm audio connection (single source of truth)

A connection is **ready for audio** (firm audio connection) when the proxy has received **session.updated** from upstream — i.e. after the client’s Settings have been applied and the proxy has sent **SettingsApplied** to the client.

- **Client obligation:** The client **must not** send audio (binary PCM) before it has received **SettingsApplied**. Sending audio before the session is ready can cause upstream errors.
- **Proxy behavior:** The proxy does not send `input_audio_buffer.append` to upstream until after `session.updated`. Binary that arrives from the client before `session.updated` is queued and flushed in order when `session.updated` is received (§3).

This is the single source of truth for when audio may be sent. Integration tests assert this protocol (no append before session.updated; session.update before first append). See [RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md](../../docs/issues/ISSUE-414/RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md).

---

## 3. Client → Proxy: message handling

| Client message (text) | Proxy action |
|------------------------|--------------|
| **Settings** | Map to `session.update`; send to upstream once per connection. Store context and greeting. On duplicate Settings, send `SettingsApplied` only (no second `session.update`). |
| **InjectUserMessage** | Map to `conversation.item.create` (user, `input_text`); send to upstream. Set `pendingItemAddedBeforeResponseCreate = 1`. Send **user echo** (`ConversationText` role `user`) to client. Send `response.create` only after upstream confirms the item (see §4). |
| **FunctionCallResponse** | Map to `conversation.item.create` (function_call_output); send to upstream, then send `response.create` immediately. |
| **Other JSON** | Forward to upstream as-is (text). |
| **Binary** | Treat as PCM; **only after session.updated** send `input_audio_buffer.append` (base64) to upstream (Issue #414: session must be configured for audio first). If binary arrives before session.updated, queue and flush when session.updated is received. Set debounce timer for `input_audio_buffer.commit` + `response.create`. Chunk size and commit timing must respect [OpenAI buffer restrictions](#35-openai-input-audio-buffer-restrictions). |

### 3.5 OpenAI input audio buffer restrictions

The proxy **enforces** these upstream constraints (single source of truth: `scripts/openai-proxy/openai-audio-constants.ts`):

| Constraint | Value | API source |
|------------|--------|------------|
| **Minimum audio before commit** | At least 100ms (4800 bytes at 24kHz 16-bit mono). Sending commit with less causes "buffer too small" error. | [input_audio_buffer.commit](https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/commit) |
| **Maximum bytes per append event** | 15 MiB per `input_audio_buffer.append`. Larger chunks must be split. | [input_audio_buffer.append](https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/append) |

The proxy asserts these before sending (e.g. `assertMinAudioBeforeCommit`, `assertAppendChunkSize`). A 400ms debounce is used before sending commit.

### 3.6 Server VAD and the "buffer too small" / empty-buffer error (API-expected)

Per the OpenAI Realtime API:

- **[input_audio_buffer.commit](https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/commit):** *"This event will produce an error if the input audio buffer is empty. When in Server VAD mode, the client does not need to send this event, **the server will commit the audio buffer automatically**."*
- **[input_audio_buffer.append](https://platform.openai.com/docs/api-reference/realtime-client-events/input-audio-buffer/append):** *"If VAD is enabled the audio buffer is used to detect speech and **the server will decide when to commit**. When Server VAD is disabled, you must commit the audio buffer manually."*

So when **Server VAD is enabled**, the server commits the buffer on its own (e.g. on `speech_stopped` or at idle/silence per [Voice activity detection (VAD)](https://platform.openai.com/docs/guides/realtime-vad)). If the **client** (or our proxy) also sends `input_audio_buffer.commit` after the server has already committed, the buffer is empty. The API explicitly states that commit **will produce an error if the buffer is empty**. Therefore the **"buffer too small" / "0.00ms" / "buffer is empty"** error is **to be expected** when both the server (Server VAD) and the client control commits — i.e. it is the documented behavior for commit-on-empty, not a bug. We avoid it by disabling Server VAD (`turn_detection: null`) and sending commit only from the proxy.

**"Buffer too small … 0.00ms" vs "server had an error":** These are **distinct** errors. The "buffer too small" / empty-buffer error is **expected** when Server VAD is on and the client (proxy) also sends commit: server commits first and empties the buffer; then the proxy sends commit → buffer empty → API returns the documented error. The proxy also sending `response.create` can then yield "conversation already has an active response" (server created a response automatically). **Fix:** Use one strategy only. The proxy disables Server VAD via `session.audio.input.turn_detection: null` (GA path; see [REGRESSION-SERVER-ERROR-INVESTIGATION.md](../../docs/issues/ISSUE-414/REGRESSION-SERVER-ERROR-INVESTIGATION.md) Cycle 2) and sends commit + `response.create` manually. The **5-second "server had an error"** is a different issue; VAD config was ruled out by the REGRESSION doc's 4-cycle investigation; the most promising lead is `idle_timeout_ms` (server VAD idle timeout). See §3.7 for `idle_timeout_ms` and behavior when null.

### 3.7 idle_timeout_ms and behavior when null (OpenAI API citation)

**Source:** [OpenAI Realtime API — Server events: session.created](https://platform.openai.com/docs/api-reference/realtime-server-events/session/created), [session.updated](https://platform.openai.com/docs/api-reference/realtime-server-events/session/updated).

The API reference shows the **effective session** configuration in the example payloads for `session.created` and `session.updated`. In that example, `session.audio.input.turn_detection` includes **`idle_timeout_ms`: null** (e.g. `"turn_detection": {"type":"server_vad","threshold":0.5,"prefix_padding_ms":300,"silence_duration_ms":200,"idle_timeout_ms":null,"create_response":true,"interrupt_response":true}`). So the **documented example** for the effective session has `idle_timeout_ms` set to **null**.

**What the docs do not state:** The API reference does **not** document what the server does when `idle_timeout_ms` is null — for example, whether the server applies an internal default (e.g. a numeric timeout in ms), disables the idle timeout, or uses some other behavior. The [Voice activity detection (VAD)](https://platform.openai.com/docs/guides/realtime-vad) guide lists Server VAD properties (`threshold`, `prefix_padding_ms`, `silence_duration_ms`, `create_response`, `interrupt_response`) but does not mention `idle_timeout_ms` or its default. The server event [input_audio_buffer.timeout_triggered](https://platform.openai.com/docs/api-reference/realtime-server-events/input_audio_buffer/timeout_triggered) indicates that a timeout can be triggered; the API does not explicitly tie that event to `idle_timeout_ms` or to the value null.

**Summary:** From the current OpenAI Realtime API docs, the **documented example** default for `idle_timeout_ms` in the effective session is **null**. The **behavior when null** (e.g. whether an implicit timeout applies) is **not specified** in the public reference or VAD guide. For implications for the 5s "server had an error" hypothesis, see [docs/issues/ISSUE-414/RESOLUTION-PLAN.md](../../docs/issues/ISSUE-414/RESOLUTION-PLAN.md) §4.

### 3.8 Session maximum duration (60 minutes) and expected closure

**Source:** [Developer notes on the Realtime API](https://developers.openai.com/blog/realtime-api): *"Realtime sessions can now last up to **60 minutes**, up from 30 minutes."* The session object in [session.created](https://platform.openai.com/docs/api-reference/realtime-server-events/session/created) includes an `expires_at` field (Unix timestamp). See also [Realtime API Session Timeout (Post GA)](https://community.openai.com/t/realtime-api-session-timeout-post-ga/1357331).

**What the API does:** The server enforces a **maximum session duration of 60 minutes**. When the session reaches that limit, the server sends an **error** (and typically closes the connection). The error message is of the form **"Your session hit the maximum duration of 60 minutes."** This is **expected, natural behavior** — not a bug or misconfiguration. We should **not** treat it as an unexpected failure when a session has been open for ~60 minutes.

**Cannot lower the server limit:** The public API does **not** expose a parameter to set session max duration to a shorter value (e.g. 1 minute). The 60-minute limit is a fixed server policy. To **control for it** (e.g. in tests or to avoid hitting the limit): the **client or proxy** must close the connection before 60 minutes (e.g. close after 1 minute of idle, or after a test completes). Proactively closing from our side avoids hitting the server’s 60-minute closure and the associated error.

**Proxy/client reaction:** When the proxy receives an upstream `error` whose message indicates session maximum duration (e.g. contains "maximum duration" and "60 minutes"), it treats it as an **expected** session-limit closure: log at INFO (not ERROR) and map to component code `session_max_duration` so the client treats it as normal closure (no error surfaced). See implementation in `server.ts` (error handling for `msg.type === 'error'`).

### 3.9 Idle timeout (expected closure, not an error)

**Conclusion (Issue #414):** The upstream sends a generic message *"The server had an error while processing your request"* when the session is closed due to **idle timeout** (no activity for a period). We treat this as a **normal closing event**, not an error.

**Common idle timeout:** The proxy sends **`idle_timeout_ms`** in `session.update` from **Settings.agent.idleTimeoutMs** (the same value the component uses for WebSocketManager and useIdleTimeoutManager). There is no separate env var; the component sends the shared idle timeout in Settings so OpenAI session and client stay in sync. When Settings omit `idleTimeoutMs`, the proxy uses 10000. See `translator.ts` `mapSettingsToSessionUpdate`.

**Proxy/client reaction:** When the proxy receives an upstream `error` with that message, it treats it as **expected idle-timeout closure**: log at INFO (e.g. "expected idle timeout closure"), map to component code **`idle_timeout`**, and send the client an Error-shaped message with that code. The component treats `idle_timeout` and `session_max_duration` as expected closure (log only; do not call onError or surface as error). See `translator.ts` (`isIdleTimeoutClosure`, `mapErrorToComponentError`), `server.ts` (error handling), and component Error handler.

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
| **error** | Map to **Error** (component shape); send as **text**. **Expected closures** (not treated as errors): (1) [Session max duration (60 min)](#38-session-maximum-duration-60-minutes-and-expected-closure) → log INFO, code `session_max_duration`. (2) [Idle timeout](#39-idle-timeout-expected-closure-not-an-error) (message "The server had an error while processing your request") → log INFO, code `idle_timeout`. Client treats both as normal closure (no error surfaced). |
| **input_audio_buffer.speech_started** / **speech_stopped** (and transcript if available) | Map to component transcript/VAD contract (**UserStartedSpeaking**, **UtteranceEnd**, etc.). Full mapping spec: [docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md](../../docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md) §2.1. Implemented in `server.ts`. |
| **Any other upstream event** | Forward to client as **text** (same JSON). |

---

## 6. Summary table: client-facing events (proxy → client)

| Component message type | Frame type | When |
|------------------------|------------|------|
| SettingsApplied | Text | After session.updated |
| ConversationText (user) | Text | After InjectUserMessage (echo) |
| ConversationText (assistant) | Text | From output_text.done, output_audio_transcript.done, function_call_arguments.done, or greeting |
| FunctionCallRequest | Text | From response.function_call_arguments.done |
| Error | Text | From upstream error (expected closures `idle_timeout` / `session_max_duration` sent with that code; client treats as normal closure) |
| (binary PCM) | Binary | From response.output_audio.delta only |
| (other) | Text | Forwarded upstream events (e.g. conversation.item.added) |

---

## 7. References

- **Implementation:** `server.ts` (message handlers), `translator.ts` (mapping functions).
- **Component contract:** [docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md](../../docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) (readiness: SettingsApplied before first user message).
- **Transcript and VAD mapping (OpenAI → component):** [docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md](../../docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md) §2.1 — spec for `speech_started` / `speech_stopped` → UserStartedSpeaking / UtteranceEnd.
- **API discontinuities:** [docs/issues/ISSUE-381/API-DISCONTINUITIES.md](../../docs/issues/ISSUE-381/API-DISCONTINUITIES.md).
- **OpenAI Realtime:** [Client events](https://platform.openai.com/docs/api-reference/realtime-client-events), [Server events](https://platform.openai.com/docs/api-reference/realtime-server-events).
- **Session max duration (60 min):** [Developer notes on the Realtime API](https://developers.openai.com/blog/realtime-api) — "Realtime sessions can now last up to 60 minutes." [Realtime API Session Timeout (Post GA)](https://community.openai.com/t/realtime-api-session-timeout-post-ga/1357331). See §3.8.
