# Issue #482: Cause investigation — idle timeout despite agent or user active

**Objective:** Identify why the voice-commerce team sees the component disconnect (via idle timeout) even when the agent or user is active.

---

## 1. Two facets of the reported behavior

| Facet | Description |
|-------|-------------|
| **A) Assistant bubble never appears** | Agent speaks or completes a function call, but the UI never shows the assistant message; console shows `idle_timeout` and WebSocket close. |
| **B) Disconnect despite activity** | Connection closes (idle timeout) while the agent is responding or the user was just active. |

Both can share the same root causes: **who** decides “idle” (server vs client), **when** the timeout fires relative to in-flight messages, and **what** counts as “activity.”

---

## 2. Two sources of “idle timeout” disconnect

### 2.1 Server (OpenAI) idle timeout

- **What:** The proxy sends `idle_timeout_ms` in `session.update` from `Settings.agent.idleTimeoutMs` (same value the component uses). When the **OpenAI server** decides the session is idle, it sends an `error` (e.g. “The server had an error while processing your request”) and typically closes the connection.
- **Where:** `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` (`mapSettingsToSessionUpdate`), `PROTOCOL-AND-MESSAGE-ORDERING.md` §3.7, §3.9.
- **Critical unknown:** The API does **not** clearly document what “idle” means. It may be:
  - “No **user** input (e.g. no audio in the input buffer) for N ms,” and/or
  - “No activity on the session” (and whether “server is currently sending `response.output_audio` / `response.output_text`” counts as activity is unspecified).
- **Implication:** The server may fire idle_timeout **while the agent is still sending the response** (e.g. after user sent a message, model is generating TTS/text). So from the app’s point of view the “agent or user is active,” but the server’s timer is not (or not always) extended by “response in progress.”

### 2.2 Client (component) idle timeout

- **What:** `IdleTimeoutService` + `useIdleTimeoutManager`. When the **client** timer fires, it calls `agentManagerRef.current?.close()` and the component closes the connection.
- **Where:** `src/utils/IdleTimeoutService.ts`, `src/hooks/useIdleTimeoutManager.ts`. State is driven by `state.agentState`, `state.isPlaying`, `state.isUserSpeaking`, and events (e.g. `AGENT_STATE_CHANGED`, `PLAYBACK_STATE_CHANGED`, `MEANINGFUL_USER_ACTIVITY`, `FUNCTION_CALL_STARTED` / `FUNCTION_CALL_COMPLETED`).
- **When timeout is suppressed:** User speaking, agent “thinking,” agent “speaking,” playback active, or a function call in progress. So the client must **know** that the agent or user is active. That knowledge comes from:
  - **Agent state** (`agentState`: thinking / speaking / idle) and **playback** (`isPlaying`).
  - **Meaningful activity** (e.g. `InjectUserMessage`, or app calling `handleMeaningfulActivity`).
  - **Function calls** (`handleFunctionCallStarted` / `handleFunctionCallCompleted`).

---

## 3. Root causes: why “active” might not be seen

### 3.1 Proxy does not send agent-activity messages (OpenAI path)

- **Contract:** The component expects **AgentThinking**, **AgentStartedSpeaking**, and **AgentAudioDone** from the backend to drive agent state and (via `WebSocketManager.isMeaningfulUserActivity`) to reset the idle timeout.
- **Deepgram:** Sends these messages; component and IdleTimeoutService see “agent is active.”
- **OpenAI proxy:** The proxy **does not** send AgentThinking, AgentStartedSpeaking, or AgentAudioDone. It only maps:
  - `input_audio_buffer.speech_started` → `UserStartedSpeaking`
  - `input_audio_buffer.speech_stopped` → `UtteranceEnd`
  - Plus ConversationText, FunctionCallRequest, binary PCM, Error, etc.
- **Reference:** `docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md` §2.1 defines UserStartedSpeaking / UtteranceEnd; there is **no** mapping specified for AgentThinking / AgentStartedSpeaking / AgentAudioDone.
- **Effect:** On the OpenAI proxy path, the component never receives “agent started speaking” or “agent audio done” from the wire. The **only** way `agentState` becomes `'speaking'` is when **playback starts** (audio chunk begins playing). So:
  - **Text-only responses** (or responses where TTS hasn’t started yet): `agentState` can remain `'idle'`. The client IdleTimeoutService may then allow the timeout to run and close the connection even though the backend has sent or is sending a response.
  - **Delay before first audio chunk:** Between “user message sent” and “first TTS chunk plays,” there is a window where the agent is “working” but the component still has `agentState === 'idle'`. The client timeout could fire in that window.

### 3.2 Function calls: component already avoids idle timeout (Issue #373)

The component **does** avoid idle timeout while function calls are being handled. On **FunctionCallRequest** it calls `handleFunctionCallStarted(functionCall.id)` → IdleTimeoutService receives `FUNCTION_CALL_STARTED` → **disables resets** and adds the call to `activeFunctionCalls`. When the app sends the response (or returns a value, or the handler errors), the component calls `handleFunctionCallCompleted(functionCall.id)` → IdleTimeoutService receives `FUNCTION_CALL_COMPLETED` → removes the call and re-enables timeout behavior. So the client idle timeout does **not** fire during the function-call round-trip. The proxy now also sends **AgentStartedSpeaking** before **FunctionCallRequest** (Issue #482) so the “agent output” contract is consistent with other response types.

### 3.3 ConversationText and FunctionCallRequest do not reset client timeout (by design)

- **WebSocketManager:** Resets idle timeout only for `InjectUserMessage`, `AgentThinking`, `AgentStartedSpeaking`, and `AgentAudioDone`. It **does not** treat `ConversationText` or `FunctionCallRequest` as activity (by design: ConversationText is treated as transcript, not as the activity signal).
- **Component:** When handling `ConversationText` (assistant), it does **not** dispatch `AGENT_STATE_CHANGE` to `'speaking'` and does **not** call `handleMeaningfulActivity`. So receiving an assistant message does not, by itself, reset the client idle timeout or set agent state to speaking.
- **FunctionCallRequest:** The component does call `handleFunctionCallStarted` / `handleFunctionCallCompleted`, which disables/re-enables the IdleTimeoutService around the call. So function-call activity **is** considered and the timeout does **not** fire during the function round-trip; the gap is for **non–function-call** assistant activity (e.g. plain ConversationText or pre-playback phase).
- **Effect:** If the only “activity” after the user’s message is the server sending ConversationText (and no AgentStartedSpeaking, no playback yet), the client does not treat that as “agent active” and may timeout.

### 3.3 Server idle timeout may not consider “response in progress”

- **Observation:** The OpenAI Realtime API’s `idle_timeout_ms` is not fully specified (see PROTOCOL-AND-MESSAGE-ORDERING.md §3.7). If the server’s definition of “idle” is “no user input for N ms,” then:
  - User sends a message → server starts generating.
  - During generation (and possibly after `response.output_text.done` / before connection close), the server might still fire idle_timeout because there was “no new user input.”
- **Effect:** The server can close the connection (and send `error` with idle_timeout) **before** or **right after** sending the final assistant content. That matches “assistant bubble never appears” and “disconnect despite agent having spoken.”

### 3.4 Message ordering (Facet A)

- If the server sends `error` (idle_timeout) **before** `response.output_text.done`, the proxy forwards in order, so the client gets Error before ConversationText. The UI may then close or reset before the assistant message is rendered.
- Our integration test (Issue #482) asserts that the client receives ConversationText (assistant) **before** Error (idle_timeout); the test fails with the current proxy (no reordering), which matches this ordering as a cause for the missing bubble.

---

## 4. Summary of causes

| Cause | Layer | Explanation |
|-------|--------|-------------|
| **Proxy does not send AgentThinking / AgentStartedSpeaking / AgentAudioDone** | Proxy | Component only learns “agent is speaking” from playback. Text-only or pre-playback phase looks “idle” to the client, so client timeout can fire. |
| **ConversationText (assistant) does not reset client timeout or set speaking** | Component | Assistant text is not treated as “activity” for idle timeout; agentState only goes to speaking when playback starts. |
| **Server idle_timeout may not extend for “response in progress”** | Server (OpenAI) | Server may close after “no user input” for N ms even while (or right after) sending the response. |
| **Error before ConversationText** | Proxy / server | If server sends error before output_text.done, client gets Error first and may close before showing the assistant bubble. |

---

## 5. Recommended directions (for fix design)

1. **Proxy:** Map OpenAI “response started” / “response done” (or equivalent) into **AgentStartedSpeaking** and **AgentAudioDone** (or a single “agent responding” signal) so the component and IdleTimeoutService see agent activity even before playback starts. Optionally treat **ConversationText (assistant)** as a signal to send a synthetic “agent output” event so the client can reset or suppress timeout.
2. **Component:** Consider treating **ConversationText (assistant)** as meaningful activity for idle timeout (e.g. call `handleMeaningfulActivity` or temporarily suppress timeout when assistant content is received), so that text-only or pre-playback responses don’t allow the client timeout to fire.
3. **Proxy:** When both **Error (idle_timeout)** and **ConversationText (assistant)** are available (e.g. from ordering or buffering), send **ConversationText before Error** so the UI can render the assistant bubble before the connection closes (already covered by Issue #482 test).
4. **Server behavior:** If possible, confirm with API docs or provider whether `idle_timeout_ms` is purely “no user input” or can be extended by “response in progress.” If it’s input-only, document that and consider a longer client-side timeout or more aggressive “activity” signals so the client doesn’t close before the server when the server is still responding.

---

## 6. References

- Voice-commerce #956; Issue #482 README.
- `src/utils/IdleTimeoutService.ts` (handleEvent, isAgentIdle, updateTimeoutBehavior).
- `src/utils/websocket/WebSocketManager.ts` (isMeaningfulUserActivity — agent activity messages).
- `src/components/DeepgramVoiceInteraction/index.tsx` (handleAgentMessage: AgentStartedSpeaking, ConversationText; playback → AGENT_STATE_CHANGE speaking).
- `src/hooks/useIdleTimeoutManager.ts` (AGENT_STATE_CHANGED, PLAYBACK_STATE_CHANGED from state).
- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` (no Agent* messages sent).
- `docs/issues/ISSUE-414/COMPONENT-PROXY-INTERFACE-TDD.md` §2.1 (UserStartedSpeaking, UtteranceEnd only).
- `packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` §3.7, §3.9.
