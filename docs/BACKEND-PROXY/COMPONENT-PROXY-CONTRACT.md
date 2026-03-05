# Component–Proxy Contract (Big Picture)

This document describes the **contract between the component and any backend proxy** (Deepgram-native or translation proxy). The same contract applies regardless of which upstream service the proxy talks to. See also [Interface Contract](./INTERFACE-CONTRACT.md) for the Deepgram proxy specification and [Issue #381 API Discontinuities](../issues/ISSUE-381/API-DISCONTINUITIES.md) for OpenAI proxy translation.

## One component protocol, multiple backends

The **component** speaks a single WebSocket protocol (Deepgram Voice Agent message types: `Settings`, `SettingsApplied`, `InjectUserMessage`, `ConversationText`, etc.). It does not distinguish “Deepgram” vs “OpenAI” at the protocol level.

- **Deepgram proxy**: Forwards the component’s messages to Deepgram’s Voice Agent API as-is. Deepgram sends `SettingsApplied` natively.
- **Translation proxy (e.g. OpenAI)**: Translates component messages to the upstream API (e.g. `Settings` → `session.update`, `session.updated` → `SettingsApplied`) and upstream events back to the component protocol.

In both cases, the **component expects the same contract**: connection established, then **Settings applied** (confirmation received), then the session is **ready for the first user message**.

## Readiness contract

**The component considers the session “ready for messages” only after it has received `SettingsApplied` from the proxy.**

- The component sends `Settings` on connection (or when agent options are applied). It will not send the first `InjectUserMessage` until it has either received `SettingsApplied` or has evidence that Settings were sent and confirmed (see `injectUserMessage` and `waitForSettings` in the component).
- **Any proxy** (Deepgram or translation) must:
  1. Accept the connection.
  2. Receive `Settings` from the component.
  3. Send back **`SettingsApplied`** (or the protocol equivalent that the component treats as confirmation) before the component sends the first user message.
  4. Keep the connection open so that the first `InjectUserMessage` can be sent and processed.

If the proxy never sends `SettingsApplied` (e.g. because the upstream closes before sending the equivalent event), the component never enters “ready” state and the first user message cannot be sent successfully. Host apps that wait for “connection + Settings applied” before sending (e.g. via `onSettingsApplied` or a DOM flag like `[data-testid="has-sent-settings"]`) rely on this contract for **both** Deepgram and OpenAI (or any other) backend.

## Function calls (Issue #407)

The component delivers **`FunctionCallRequest`** to the host via `onFunctionCallRequest`. The **proxy** only forwards messages; it does **not** execute function logic. For production, the host should execute function calls on the **app backend** (e.g. HTTP `POST /function-call`), not in the browser: frontend forwards the request to the backend, backend runs common handlers (neither Deepgram- nor OpenAI-specific), frontend sends `FunctionCallResponse` with the result. See [Backend function-call contract](./BACKEND-FUNCTION-CALL-CONTRACT.md).

## Idle timeout and agent completion (AgentAudioDone / text-only path)

The component starts its **idle timeout** (after which it may close the connection) only when the agent is considered **idle** — i.e. not speaking and not playing audio. That transition can happen in two ways:

1. **Audio path:** The proxy sends **`AgentAudioDone`** after the agent has finished sending audio for a turn (e.g. after a response or greeting that included binary audio). The component then transitions to idle and starts the idle timer.
2. **Text-only path:** When the proxy sends **`ConversationText` (role: assistant)** and **no** binary audio follows (e.g. greeting as text only), the component uses an internal path: after a short defer, if the agent is still in “listening” (no `AgentStartedSpeaking` received), it treats agent activity as ended, transitions to idle, and starts the idle timer. So the proxy **does not** need to send `AgentAudioDone` for text-only greeting or text-only turns.

**Proxy guidance:**

- **When your upstream sends both audio and then ConversationText (assistant):** Send `AgentAudioDone` after that ConversationText so the component can transition to idle and the idle timeout can start. Do **not** send `AgentAudioDone` before any audio has been forwarded for that turn, or the component may start the timer and then receive audio and cancel it.
- **When your upstream sends only ConversationText (assistant)** (e.g. greeting as text, no TTS): You may omit `AgentAudioDone`; the component’s text-only path will transition to idle. Our Deepgram proxy follows this: it sends `AgentAudioDone` after the first assistant `ConversationText` only if it has already forwarded at least one binary message in that connection. See `packages/voice-agent-backend/src/attach-upgrade.js` and [E2E-FAILURES-RESOLUTION.md](../issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md) for the rationale and tests.

## Summary

| Aspect | Contract |
|--------|----------|
| **Protocol** | Component speaks one protocol (Deepgram Voice Agent message types). Proxies either forward it (Deepgram) or translate to/from another API (e.g. OpenAI Realtime). |
| **Readiness** | Session is ready for the first user message only after the component has received **SettingsApplied** (or equivalent). Proxies must send it and keep the connection open until the host can send. |
| **First message** | The component will not send `InjectUserMessage` until Settings are confirmed. Proxies must not close the connection before sending `SettingsApplied`. |
| **Idle timeout** | Component starts idle timer only when agent is idle. Send **AgentAudioDone** after response/greeting **audio**; for **text-only** greeting or turns, the component transitions to idle via its text-only path — proxy may omit AgentAudioDone. |
| **Function calls** | Host should execute functions on the app backend (proxies not involved). Frontend forwards `FunctionCallRequest` → backend executes → frontend sends `FunctionCallResponse`. |

Tests that enforce this contract (for either proxy):

- **Jest integration**: `tests/integration/readiness-contract.test.ts`
- **E2E**: `test-app/tests/e2e/readiness-contract-e2e.spec.js` (runs with `E2E_BACKEND=openai` or `E2E_BACKEND=deepgram`)

See [Issue #406](../issues/ISSUE-406/README.md) for context on readiness and conversation-after-refresh with the OpenAI provider.
