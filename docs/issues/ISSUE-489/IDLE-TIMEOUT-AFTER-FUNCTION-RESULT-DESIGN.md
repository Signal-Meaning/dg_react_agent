# Idle Timeout After Function Result: Design

## Purpose

After the app sends a **function result** (FunctionCallResponse), the agent may take time to process and reply. We must not start the **idle timer** until we know the agent has reacted (or we'd risk closing the connection before the reply). So we introduce a short-lived "waiting" state that is cleared when the agent **becomes active** (or by a max-wait fallback).

## When the idle timer is allowed to start

**Requirement: idle is enabled when the agent is done for the turn.** That is the only requirement; we do not require any particular message type (e.g. AgentAudioDone). See [Agent-done semantics and naming](./AGENT-DONE-SEMANTICS-AND-NAMING.md) for receipt vs playback and the meaning of the AgentAudioDone wire event.

- **When unmuted:** "Agent done" = end of audio for the turn (playback done or the proxy's completion signal for that turn).
- **When muted:** "Agent done" = when the assistant's text is displayed (ConversationText assistant); we must not insist on audio.

The idle timer must **not** start until the agent has finished the full turn (thinking → text → speaking done when unmuted, or thinking → text when muted). We don't care how the agent became active again; we only need a signal that it has, so we can stop "waiting" and then let the normal state machine govern when the timer can start. The timer can start only when the agent is **idle** again (and other conditions).

So "waiting" is only about the gap between "we sent the function result" and "we've seen the agent become active." Once the agent is active (thinking/speaking), we clear "waiting." The timer still won't start until the agent is idle again (handled by existing `canStartTimeout` / `shouldDisableTimeoutResets`).

## Clearing "waiting for agent after function result"

We clear when **the agent became active** (not "any state change"):

1. **AGENT_STATE_CHANGED to `thinking` or `speaking`** — Agent became active. This is the primary signal. IdleTimeoutService clears the flag so we don't depend on a follow-up message.
2. **AGENT_MESSAGE_RECEIVED** — Clear on **delivery**: invoked only by WebSocketManager when it emits a message (single path; see below). Signals "at least one agent message was delivered" regardless of message type or whether we've updated agent state. We don't care which message type; we only need to know the agent has reacted.
3. **Max-wait fallback** — If the backend never sends a signal, we clear after at most one idle-timeout period so the connection can still close.

Points 1 and 2 are redundant in purpose (both mean "agent has reacted"); (1) is the main signal ("agent became active"); (2) is triggered at the single source (manager) so no code path can deliver agent messages without notifying.

**Why keep both (1) and (2)?** They answer different questions:

- **AGENT_STATE_CHANGED (thinking/speaking)** — "We have *interpreted* that the agent is active." Semantic signal; the state machine has updated.
- **AGENT_MESSAGE_RECEIVED** — "At least one agent message was *delivered* on the single pipeline." Delivery signal; the manager has emitted.

Keeping both is helpful rather than confusing because they have distinct roles:

1. **Timing:** AGENT_MESSAGE_RECEIVED fires at **delivery time** (when the manager emits). AGENT_STATE_CHANGED fires when the component's state update propagates (reducer → hook → IdleTimeoutService), which can be later or reordered by React batching. Clearing on delivery avoids depending on that propagation order.

2. **Message-type agnostic:** Some agent messages might not (or not yet) trigger a transition to thinking/speaking—e.g. an `Error`, or a future message type we don't map to state. AGENT_MESSAGE_RECEIVED still clears "waiting" so we don't hang if the backend sends only that. So we clear as soon as we know *any* agent message was delivered, without relying on the state machine to interpret it.

3. **Robustness:** If we add a new message type and forget to transition state, or there's a bug in the transition path, AGENT_MESSAGE_RECEIVED ensures we still clear. So it's not "backup" in the sense of redundant logic—it's the **delivery guarantee** ("something from the agent arrived") alongside the **interpretation guarantee** ("we've marked the agent as active"). Both are useful.

So AGENT_MESSAGE_RECEIVED has a clear purpose: **clear on delivery**, independent of whether we've updated agent state. That makes the design more robust and avoids subtle ordering or coverage bugs.

## Single path: no new paths can skip the contract

To prevent new code paths from delivering agent messages without notifying the idle-timeout layer:

- **WebSocketManager** accepts an optional `onAgentMessageReceived` callback and calls it **whenever it emits** a `message` event (agent service only). The component passes `notifyAgentMessageReceived` when creating the manager.
- So **every** agent message that reaches the component has already triggered that callback. There is no second place (e.g. `handleAgentMessage`) that must "remember" to notify; the manager is the single choke point.

The component does **not** call `notifyAgentMessageReceived` inside `handleAgentMessage`. It is only invoked by the manager when it emits. Any future path that delivers agent messages must go through the manager (or duplicate the contract); the manager cannot be bypassed for in-bound messages.

## Ensuring "agent became active" for every reaction

So that clearing can rely on **AGENT_STATE_CHANGED** (agent became active):

- **AgentThinking** → component already transitions to `thinking`.
- **AgentStartedSpeaking** → component already transitions to `speaking`.
- **ConversationText (assistant)** when state is **idle or listening** (e.g. backend sent only text after function result, no AgentThinking) → component now transitions to `thinking` so that AGENT_STATE_CHANGED fires and the flag is cleared. Then the existing "text-only agent done" path can transition back to idle when no audio follows.

We don't care *how* the agent became active (message type); we only need the component to reflect that in state (thinking/speaking) so IdleTimeoutService can clear on AGENT_STATE_CHANGED.

## How the OpenAI proxy accomplishes this

So that the component can reach **idle** after a function-call turn (agent done; idle timer can start):

1. **After FunctionCallResponse:** Proxy sends **AgentThinking** immediately (Issue #487) so the component transitions to thinking and clears "waiting after function result."
2. **During the turn:** Proxy forwards upstream events to the client (e.g. ConversationText, AgentStartedSpeaking, binary audio).
3. **When the response is complete:** The component needs to know the agent is **done** for the turn. When unmuted, that is at end of audio (proxy may send AgentAudioDone on `response.output_text.done` / `response.done`; the component uses that to transition to idle). When muted, "done" is when text is displayed (ConversationText assistant with no following audio); the component's text-only path transitions to idle without requiring any audio-completion signal.

So: **AgentThinking** (after function result) plus **agent-done for the turn** (end of audio when unmuted, or text displayed when muted) gives the component a clear path to idle. AgentAudioDone is one way to signal "turn complete" when there is audio; it is not the requirement—the requirement is "agent done."

Deepgram proxy was already behaving in a way that sends agent activity and completion signals; it has not been specifically tested in recent releases. The same contract (agent becomes active, then completes the turn so the component can go idle) applies to both proxies.

## Proxy logging and diagnosing proxy bugs

**Upstream events are logged on receipt.** The OpenAI proxy logs every upstream **JSON** message at INFO with `body: 'upstream → client'` and attribute `message_type: msg.type` (see `server.ts` upstream `on('message')` handler). So for any JSON message from the API, the proxy logs the event type when it is received. Binary messages (e.g. audio deltas) are not logged as structured events (they are forwarded without a type log).

**How to see proxy logs during E2E:** Run the backend in a separate terminal with `LOG_LEVEL=info` (e.g. `cd test-app && LOG_LEVEL=info npm run backend`), then run the E2E spec (e.g. `USE_PROXY_MODE=true npm run test:e2e -- test-app/tests/e2e/issue-373-idle-timeout-during-function-calls.spec.js`). In the backend terminal output, look for `message_type: response.done` or `message_type: response.output_text.done` after the function call completes. If neither appears, the real API is not sending those events for that turn (or there is a proxy bug before we log).

**Integration test gap:** We do **not** currently have an integration test that runs against the **real** API and asserts that the proxy receives `response.done` or `response.output_text.done` (or equivalent) after the client sends a function result. The openai-proxy integration tests that touch function-call flow either use the mock upstream (Issue #487 protocol contract) or assert client-side behavior with real API (e.g. function-call flow completes without error). Adding a real-API integration test that captures upstream event types received by the proxy after FunctionCallResponse would help distinguish "API never sends completion" from "proxy bug (e.g. not handling an event we do receive)."

## Summary

- **Requirement:** Idle is enabled when the **agent is done** for the turn. When unmuted that is at end of audio for the turn; when muted it is when text is displayed. We do not require AgentAudioDone specifically.
- **"Waiting" state:** From "app sent function result" until "agent became active" (or max-wait). Cleared by AGENT_STATE_CHANGED to thinking/speaking (primary) or AGENT_MESSAGE_RECEIVED (from WebSocketManager only) or max-wait.
- **Idle timer starts only after agent done:** Muted → after assistant text is displayed (text-only path to idle). Not muted → after end of audio for the turn (playback done or proxy completion signal).
- **Single path:** WebSocketManager calls `onAgentMessageReceived` when it emits a message; no new path can deliver agent messages without that.
- **OpenAI proxy:** Sends AgentThinking after FunctionCallResponse; when response is complete may send a completion signal so the component can transition to idle (when unmuted). When muted, ConversationText (assistant) plus the component's text-only path is sufficient.
- **Logging:** Proxy logs every upstream JSON message type at INFO. Run backend with LOG_LEVEL=info and E2E in another terminal to see what the API sent. No real-API integration test yet that asserts proxy receives completion events after function call.
