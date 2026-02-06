# Issue #381: API Discontinuities (Component vs OpenAI Realtime)

This document compares the **dg_react_agent component’s expectations** for the backend proxy (Deepgram Voice Agent protocol) with the **OpenAI Realtime API**. Discontinuities must be resolved in the proxy (translation layer) or in the component before the OpenAI proxy can be implemented correctly.

**References:**
- Component types: `src/types/agent.ts`, `src/types/connection.ts`
- Component message handling: `src/components/DeepgramVoiceInteraction/index.tsx` (e.g. `data.type === 'SettingsApplied'`, `InjectUserMessage`, etc.)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Realtime WebSocket](https://platform.openai.com/docs/guides/realtime-websocket)
- [OpenAI Realtime client events](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update)
- [OpenAI Realtime server events](https://platform.openai.com/docs/api-reference/realtime-server-events/error)

---

## 1. Component expectations (proxy contract)

The component speaks **Deepgram Voice Agent protocol** over a single WebSocket. It does not distinguish “Deepgram” vs “OpenAI” at the protocol level; it sends and expects fixed message types.

### 1.1 Outgoing (component → proxy)

| Component sends | Shape (summary) | When |
|-----------------|------------------|------|
| **Settings** | `{ type: 'Settings', audio: { input, output }, agent: { language, listen?, think: { provider, model, prompt, functions? }, speak: { provider }, greeting?, context? } }` | On connection / when agent starts |
| **InjectUserMessage** | `{ type: 'InjectUserMessage', content: string }` | User text submitted (e.g. text input) |
| **UpdatePrompt** | `{ type: 'UpdatePrompt', prompt: string }` | Instructions update |
| **UpdateSpeak** | `{ type: 'UpdateSpeak', speak: { provider } }` | TTS config update |
| **InjectAgentMessage** | `{ type: 'InjectAgentMessage', content: string }` | Injected agent message |
| **FunctionCallResponse** | `{ type: 'FunctionCallResponse', id, name, content }` | Function call result |
| **KeepAlive** | `{ type: 'KeepAlive' }` | Keep connection alive |
| **CloseStream** | `{ type: 'CloseStream' }` | End stream |

**Critical:** The component **requires** that **Settings** is sent and confirmed (**SettingsApplied** received) before it will send **InjectUserMessage**. The proxy must honor this ordering. This is the **readiness contract** that applies to all proxies (Deepgram and translation proxies); see [Component–Proxy Contract](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md).

### 1.2 Incoming (proxy → component)

The component branches on `data.type` and expects these shapes:

| Component expects | Shape (summary) | Used for |
|-------------------|------------------|----------|
| **Welcome** | `{ type: 'Welcome', request_id }` | Optional; connection established |
| **SettingsApplied** | `{ type: 'SettingsApplied' }` | Confirmation that settings are active; enables InjectUserMessage |
| **ConversationText** | `{ type: 'ConversationText', role: 'user' \| 'assistant', content: string }` | User echo and assistant text; drives UI and callbacks |
| **UserStartedSpeaking** | `{ type: 'UserStartedSpeaking' }` | VAD / UX |
| **UserStoppedSpeaking** | `{ type: 'UserStoppedSpeaking', timestamp? }` | VAD |
| **UtteranceEnd** | `{ type: 'UtteranceEnd', channel, last_word_end }` | End of speech |
| **AgentThinking** | `{ type: 'AgentThinking', content? }` | Agent state “thinking” |
| **AgentStartedSpeaking** | `{ type: 'AgentStartedSpeaking' }` | Agent state “speaking” |
| **AgentAudioDone** | `{ type: 'AgentAudioDone' }` | TTS chunk done |
| **FunctionCallRequest** | `{ type: 'FunctionCallRequest', functions: [{ id, name, arguments, client_side }] }` | Function calling |
| **FunctionCallResponse** | (from server) | Function result from server |
| **Error** | `{ type: 'Error', description, code }` | Errors |
| **Warning** | `{ type: 'Warning', description, code }` | Warnings |

The component also sends and receives **binary audio** (e.g. via the same WebSocket or a separate path depending on implementation). The Deepgram proxy expects linear16; the component’s audio pipeline is built around that expectation.

---

## 2. OpenAI Realtime API (summary)

### 2.1 Client events (app → OpenAI)

| OpenAI client event | Purpose |
|---------------------|---------|
| **session.update** | Set session config: `{ type: 'realtime', instructions, tools, voice, ... }` (no direct “listen”/“think”/“speak” like Deepgram) |
| **conversation.item.create** | Add item: e.g. `{ item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }` |
| **response.create** | Trigger model response (optional params; can be empty to use conversation) |
| **input_audio_buffer.append** | Append base64 audio |
| **input_audio_buffer.commit** | Commit user audio → new user message |
| **response.cancel** | Cancel in‑progress response |

### 2.2 Server events (OpenAI → app)

| OpenAI server event | Purpose |
|---------------------|---------|
| **session.created** | Initial session config (first event after connect) |
| **session.updated** | After session.update |
| **conversation.item.added** | Item added (user or assistant message, etc.) |
| **conversation.item.done** | Item finalized |
| **response.created** | Response started |
| **response.done** | Response finished (status: completed \| cancelled \| failed \| incomplete) |
| **response.output_text.delta** / **response.output_text.done** | Text output |
| **response.output_audio.delta** / **response.output_audio.done** | Audio output (base64) |
| **response.output_audio_transcript.delta** / **.done** | Transcript of model’s audio |
| **input_audio_buffer.speech_started** / **speech_stopped** | VAD (server VAD) |
| **error** | Error with `error: { type, code, message, ... }` |

---

## 3. Discontinuities

### 3.1 Naming and lifecycle

| Aspect | Component (Deepgram protocol) | OpenAI Realtime | Discontinuity |
|--------|------------------------------|-----------------|---------------|
| **Session bootstrap** | Send **Settings** once; expect **SettingsApplied** | Send **session.update**; receive **session.updated** or **session.created** | Different event names and payloads. Proxy must: on first **Settings** from component → send **session.update** (mapping from Settings shape); on **session.updated** / **session.created** → send **SettingsApplied** to component. |
| **Welcome** | Optional **Welcome** `{ request_id }` | **session.created** (no “Welcome” name) | Proxy can synthesize **Welcome** from **session.created** (e.g. use session id as request_id) or omit if component does not require it. |
| **User text input** | **InjectUserMessage** `{ type, content }` | **conversation.item.create** `{ item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }` + optionally **response.create** | Shape and naming differ. Proxy must map InjectUserMessage → conversation.item.create (+ response.create if OpenAI does not auto-trigger from new user message). |

### 3.2 Settings vs session config

| Aspect | Component (Settings) | OpenAI (session.update) | Discontinuity |
|--------|-----------------------|-------------------------|---------------|
| **Structure** | Nested: `audio`, `agent.language`, `agent.listen`, `agent.think` (provider, model, prompt, functions), `agent.speak`, `agent.greeting`, `agent.context` | Flat session: `instructions`, `tools`, `voice`, `model`, `audio.input` / `audio.output` (format, rate), turn_detection, etc. | No 1:1 mapping. Proxy must map: instructions ← think.prompt / agent options; tools ← think.functions (with schema conversion); voice ← speak; audio format/sample rate ← audio; context → conversation history (see below). |
| **Confirmation** | **SettingsApplied** (no payload) | **session.updated** (full session object) | Proxy sends **SettingsApplied** to component when it receives **session.updated** (or **session.created** after first session.update). |
| **Context / session history** | **Settings.agent.context.messages** (array of `{ type?, role, content }`) sent with Settings on reconnect | **Not** in session.update. OpenAI Realtime uses **conversation.item.create** to add items (messages, function_call_output). See [Conversation state](https://platform.openai.com/docs/guides/conversation-state), [conversation.item.create](https://platform.openai.com/docs/api-reference/realtime-client-events/conversation/item/create). | Proxy: after sending **session.update** for a Settings message that includes **agent.context.messages**, send one **conversation.item.create** per context message (type: 'message', role: user/assistant, content: input_text) so the OpenAI conversation has the history. Component/proxy must manage this difference for session maintenance. |

**Language / locale:** The proxy maps `Settings.agent.think.prompt` → `session.update.instructions` only. OpenAI does not receive a separate "language" field from the component. If the app expects **English** (or a specific locale), the **instructions** (prompt) must say so explicitly, e.g. "You are a helpful assistant. Always respond in English." Otherwise the model may respond in another language (e.g. Korean) depending on training and context. The test-app or proxy does not inject a default language; add it to the agent prompt when using the OpenAI proxy.

### 3.3 Conversation text and assistant output

| Aspect | Component | OpenAI | Discontinuity |
|--------|-----------|--------|---------------|
| **Assistant text** | **ConversationText** `{ type: 'ConversationText', role: 'assistant', content: string }` | **response.output_text.done** `{ text }` or **conversation.item.done** with item content `output_text` / transcript | Proxy must emit **ConversationText** from response.output_text.done (or from conversation.item.done when item is assistant message with text). |
| **User echo** | **ConversationText** `role: 'user'` | **conversation.item.added** / **.done** for user message with `input_text` | Proxy can emit **ConversationText** (user) when conversation.item.added/done for user message (e.g. after InjectUserMessage). |
| **Streaming** | Component typically consumes full **ConversationText** (single message) | OpenAI sends **response.output_text.delta** then **.done** | Proxy can buffer deltas and emit one **ConversationText** on **response.output_text.done**, or document if component supports incremental text. |

### 3.4 Agent state and audio

| Aspect | Component | OpenAI | Discontinuity |
|--------|-----------|--------|---------------|
| **Thinking** | **AgentThinking** | **response.created** (response in progress) | Proxy can send **AgentThinking** when **response.created** is received. |
| **Speaking start** | **AgentStartedSpeaking** | **response.content_part.added** (audio) or **response.output_audio.delta** | Proxy can send **AgentStartedSpeaking** on first audio delta or content part for assistant. |
| **Speaking done** | **AgentAudioDone** | **response.output_audio.done** or **response.done** | Proxy can send **AgentAudioDone** on **response.output_audio.done** (or when response.done for audio response). |
| **Audio format** | Component expects linear16 (e.g. 24000 Hz) and may send binary or base64 depending on path | OpenAI: **response.output_audio.delta** (base64), format in session (e.g. audio/pcm, rate) | Proxy must ensure sample rate/format match what the component and its playback pipeline expect; may need to re-sample or pass through and document format. |
| **Input audio** | Component sends microphone audio (e.g. binary) | OpenAI: **input_audio_buffer.append** (base64) then **commit** | If component sends raw audio to proxy, proxy must convert to base64 and use append/commit; if component expects to send binary frames, proxy must frame and encode. |

### 3.5 VAD and utterance end

| Aspect | Component | OpenAI | Discontinuity |
|--------|-----------|--------|---------------|
| **User started** | **UserStartedSpeaking** | **input_audio_buffer.speech_started** | Same idea; proxy maps speech_started → **UserStartedSpeaking**. |
| **User stopped** | **UserStoppedSpeaking** | **input_audio_buffer.speech_stopped** | Proxy maps speech_stopped → **UserStoppedSpeaking**. |
| **Utterance end** | **UtteranceEnd** `{ channel, last_word_end }` | **input_audio_buffer.speech_stopped** (audio_end_ms) or similar | Proxy can synthesize **UtteranceEnd** from speech_stopped (map audio_end_ms to last_word_end if needed). |

### 3.6 Function calling

| Aspect | Component | OpenAI | Discontinuity |
|--------|-----------|--------|---------------|
| **Tool definitions** | **Settings.agent.think.functions** (name, description, parameters, endpoint?) | **session.update** `tools: [{ type: 'function', name, description, parameters }]` | Schema differs (e.g. parameters shape, no endpoint in OpenAI tools). Proxy must map think.functions → tools and filter/transform as needed. |
| **Request** | **FunctionCallRequest** `{ functions: [{ id, name, arguments, client_side }] }` | OpenAI uses function_call item in conversation (e.g. **response.function_call_arguments.done** with call_id, arguments) | Different structure. Proxy must map OpenAI function call events → **FunctionCallRequest** (id, name, arguments; client_side may be inferred or default). |
| **Response** | **FunctionCallResponse** `{ id, name, content }` | **conversation.item.create** with item type function_call_output (or equivalent) | Proxy must map component **FunctionCallResponse** → OpenAI’s function call output item format. |

### 3.7 Errors and warnings

| Aspect | Component | OpenAI | Discontinuity |
|--------|-----------|--------|---------------|
| **Error** | **Error** `{ type: 'Error', description, code }` | **error** `{ type: 'error', error: { type, code, message, param, event_id } }` | Field names differ (description vs message). Proxy maps error → **Error** (description ← message, code ← code). |
| **Warning** | **Warning** `{ description, code }` | No direct “Warning” event; sometimes in error or other events | Proxy may map certain OpenAI conditions to **Warning** or omit if not critical. |

### 3.8 Connection and authentication

| Aspect | Component | OpenAI | Discontinuity |
|--------|-----------|--------|---------------|
| **Auth** | Component connects to proxy with optional authToken; no API key in client for proxy mode | OpenAI expects Bearer token (or ephemeral key) on WebSocket connection | Proxy holds OpenAI API key; client never sees it. Component’s proxy URL and authToken are unchanged. |
| **Close** | Component handles **state: 'closed'** (e.g. on WebSocket close) | OpenAI may send close frame (e.g. 1000) | Proxy must forward close to client so component sees **closed**; issue #380 (upstream close after first message) is an example. |

---

## 4. Summary table (component event ↔ OpenAI event)

| Component expects (in) | OpenAI server event (source) | Action in proxy |
|------------------------|-----------------------------|------------------|
| Welcome | session.created | Synthesize Welcome or omit |
| SettingsApplied | session.updated / session.created | Send SettingsApplied after session.updated (or after first session.update ack) |
| ConversationText (user) | conversation.item.added/done (user message) | Map item content to ConversationText(role: user) |
| ConversationText (assistant) | response.output_text.done or conversation.item.done (assistant) | Map text/transcript to ConversationText(role: assistant) |
| AgentThinking | response.created | Send AgentThinking |
| AgentStartedSpeaking | response.output_audio.delta (first) or content_part.added | Send AgentStartedSpeaking |
| AgentAudioDone | response.output_audio.done / response.done | Send AgentAudioDone |
| UserStartedSpeaking | input_audio_buffer.speech_started | Map to UserStartedSpeaking |
| UserStoppedSpeaking | input_audio_buffer.speech_stopped | Map to UserStoppedSpeaking |
| UtteranceEnd | input_audio_buffer.speech_stopped (with timing) | Synthesize UtteranceEnd |
| FunctionCallRequest | response.function_call_arguments.* / conversation item | Map to FunctionCallRequest shape |
| Error | error | Map error to Error(description, code) |
| Warning | (none direct) | Optional mapping or omit |

| Component sends (out) | OpenAI client event (target) | Action in proxy |
|-----------------------|-----------------------------|------------------|
| Settings | session.update | Map Settings → session config (instructions, tools, voice, audio, etc.) |
| InjectUserMessage | conversation.item.create + response.create? | Map to conversation.item.create (input_text) and optionally response.create |
| FunctionCallResponse | conversation.item.create (function call output) | Map to OpenAI function call output item |
| KeepAlive | (no direct equivalent; connection stays open) | No-op or optional ping |
| (binary audio) | input_audio_buffer.append / commit | Encode and forward; commit on appropriate boundary |

---

## 5. Recommended approach (before implementation)

**Coverage in tests and code**: The following bullets are reflected as follows.  
- (1) **Document in code**: Implemented in `src/types/connection.ts` and `src/types/agent.ts` (Proxy contract comment + link to this doc).  
- (2)–(4) **Translation, ordering, audio**: Unit tests (`tests/openai-proxy.test.ts`) cover Settings → session.update, InjectUserMessage → conversation.item.create, session.updated → SettingsApplied, response.output_text.done → ConversationText. Integration tests (`tests/integration/openai-proxy-integration.test.ts`) cover server lifecycle, Settings round-trip, and InjectUserMessage → ConversationText. E2E tests (`test-app/tests/e2e/openai-proxy-e2e.spec.js`) cover connection, single message, multi-turn, reconnection, basic audio, function calling, and error handling.  
- (5) **Function calling**: Unit tests cover think.functions → tools; E2E covers function-calling flow.  
- (6) **Tests**: Unit, integration, and E2E plans and implementations are in the repo; see [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md).

1. **Document in code**  
   Add a short “Proxy contract” section (or link to this doc) in the component or types so implementers know what the proxy must send and accept.

2. **Implement translation in the proxy only**  
   Keep the component unchanged; the OpenAI proxy:
   - Accepts Deepgram-format messages from the component.
   - Translates them to OpenAI Realtime client events.
   - Receives OpenAI server events and translates them to Deepgram-format messages expected by the component.
   - Handles ordering (e.g. Settings → SettingsApplied before InjectUserMessage).

3. **Address ordering and lifecycle**  
   - On first **Settings**: send **session.update**; when **session.updated** (or **session.created** after update) is received, send **SettingsApplied** to the component.
   - On **InjectUserMessage**: send **conversation.item.create**; then send **response.create** if OpenAI does not auto-trigger a response from the new user message (verify with Realtime API docs).

4. **Audio path**  
   - Decide whether the component will send audio to the OpenAI proxy (and in what form). If yes, proxy must implement input_audio_buffer.append/commit and map formats (linear16, sample rate) to OpenAI’s session config and encoding.
   - Map **response.output_audio.delta**/.done to the component’s expected audio stream and **AgentStartedSpeaking** / **AgentAudioDone**.

5. **Function calling**  
   - Map **Settings.agent.think.functions** to **session.update** `tools`.
   - Map OpenAI function call items / response.function_call_arguments.* to **FunctionCallRequest**.
   - Map **FunctionCallResponse** from component to OpenAI’s function call output item.

6. **Tests**  
   - Unit tests: proxy translation (Settings → session.update, InjectUserMessage → conversation.item.create, server events → ConversationText / SettingsApplied / etc.).
   - Integration tests: component ↔ proxy with mocked OpenAI upstream.
   - E2E: real OpenAI backend; assert ConversationText, SettingsApplied, and no regressions (issue #380).

---

## 6. Open questions (resolved)

Decisions documented so the proxy implementation can proceed without ambiguity.

| Question | Resolution |
|----------|-------------|
| **Auto-response** | OpenAI Realtime does **not** auto-trigger a response after **conversation.item.create**. The proxy **must** send **response.create** after adding a user message (e.g. after mapping **InjectUserMessage** → **conversation.item.create**). See [OpenAI Realtime client events](https://platform.openai.com/docs/api-reference/realtime-client-events/response/create). |
| **Binary vs base64** | The component sends **binary** WebSocket frames (ArrayBuffer) for audio. See `WebSocketManager.sendBinary()`, `DeepgramVoiceInteraction` sending to `agentManagerRef.current.sendBinary(data)`. The proxy must receive binary frames, convert to base64, and call **input_audio_buffer.append** (and **commit** on appropriate boundaries). |
| **Greeting** | The component is provided a greeting (e.g. in agent options) and sends it in **Settings** (e.g. `agent.greeting`). The proxy must **use** that greeting: after **session.updated** (and after sending **SettingsApplied** to the component), inject the component-provided greeting as an initial assistant message via **conversation.item.create** so the component receives it (e.g. as **ConversationText** or via the normal greeting flow). Document this behavior in the proxy. |
`| **Context/history** | Component sends **agent.context** (message history). The proxy must send **conversation.item.create** for each history message (user and assistant) **after** **session.updated** and before the first user interaction, so OpenAI's conversation state matches the component's context. Order: session.update → session.updated → (optional) conversation.item.create for each context message → then accept InjectUserMessage. |

Resolving these and implementing the translation layer in the proxy (with tests) will address the discontinuities before or as part of the TDD implementation in ISSUE-381.
