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

## Codes over message text

**Any proxy** should prefer **structured codes and fields** over **message text** for control flow and mapping:

- **Codes from the API:** When the upstream (e.g. OpenAI Realtime API) sends events or errors, the proxy must map them using the API's **structured payload** (e.g. `error.code`, event types, defined fields), not by parsing or matching text strings in messages. Use the codes the API emits for all error and event mapping (e.g. `idle_timeout`, `session_max_duration`, and any others).
- **Codes from the proxy:** When the proxy sends messages to the component (e.g. `Error` with `code`), it must use **protocol-defined codes** (e.g. `idle_timeout`, `session_max_duration`), not free-form or human-readable text for the code field.
- **Avoid message text if at all possible:** The proxy should avoid using text strings from messages (from the API or from the client) for control flow, branching, or mapping. Prefer event types, codes, and other structured fields so behavior is stable if wording or locale changes.

See [PROTOCOL-AND-MESSAGE-ORDERING.md](../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) §3.9 and [PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md](../issues/ISSUE-470/PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md) requirement 9.

## Idle timeout and agent completion (AgentDone / AgentAudioDone / text-only path)

The component starts its **idle timeout** (after which it may close the connection) only when the agent is **done** for the turn — i.e. not speaking and not playing audio. That transition can happen in two ways:

1. **Audio path:** The proxy sends **`AgentDone`** (semantic "agent done"; preferred) and/or **`AgentAudioDone`** (legacy: **receipt complete only**, not playback complete). The component accepts both and transitions to idle. See [Agent-done semantics and naming](../issues/ISSUE-489/AGENT-DONE-SEMANTICS-AND-NAMING.md). For v2v agents, the proxy should trap the signal (e.g. observe first/last binary audio) and send **AgentDone** so doneness is not left to inference.
2. **Text-only path:** When the proxy sends **`ConversationText` (role: assistant)** and **no** binary audio follows (e.g. greeting as text only), the component uses an internal path: after a short defer, if the agent is still in “listening” (no `AgentStartedSpeaking` received), it treats agent activity as ended, transitions to idle, and starts the idle timer. This is unreliable for v2v; prefer sending **AgentDone** when the proxy can.

**Proxy guidance:**

- **When your upstream sends both audio and then ConversationText (assistant):** Send **AgentDone** when you know the agent is done for the turn (e.g. when upstream signals completion and you have forwarded everything). Also send **AgentAudioDone** for backward compatibility; in comments always describe it as "receipt complete," never "playback complete." Do **not** send either before any audio has been forwarded for that turn, or the component may start the timer and then receive audio and cancel it.
- **When your upstream sends only ConversationText (assistant)** (e.g. greeting as text, no TTS): You may omit `AgentAudioDone`; the component’s text-only path will transition to idle. Our Deepgram proxy follows this: it sends `AgentAudioDone` after the first assistant `ConversationText` only if it has already forwarded at least one binary message in that connection. For v2v, send **AgentDone** when you can trap the signal (see [Agent-done semantics](../issues/ISSUE-489/AGENT-DONE-SEMANTICS-AND-NAMING.md)). See also `packages/voice-agent-backend/src/attach-upgrade.js` and [E2E-FAILURES-RESOLUTION.md](../issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md) for the rationale and tests.

## Summary

| Aspect | Contract |
|--------|----------|
| **Protocol** | Component speaks one protocol (Deepgram Voice Agent message types). Proxies either forward it (Deepgram) or translate to/from another API (e.g. OpenAI Realtime). |
| **Readiness** | Session is ready for the first user message only after the component has received **SettingsApplied** (or equivalent). Proxies must send it and keep the connection open until the host can send. |
| **First message** | The component will not send `InjectUserMessage` until Settings are confirmed. Proxies must not close the connection before sending `SettingsApplied`. |
| **Codes over message text** | Use structured codes from API and protocol-defined codes from proxy; avoid using message text for control flow or mapping. See "Codes over message text" above. |
| **Idle timeout** | Component starts idle timer only when agent is done for the turn. Send **AgentDone** (semantic) when the proxy can trap the signal; **AgentAudioDone** (receipt only, legacy) for compatibility. For **text-only** or v2v see [Agent-done semantics](../issues/ISSUE-489/AGENT-DONE-SEMANTICS-AND-NAMING.md). |
| **Function calls** | Host should execute functions on the app backend (proxies not involved). Frontend forwards `FunctionCallRequest` → backend executes → frontend sends `FunctionCallResponse`. |
| **Message sources (translation proxy)** | UtteranceEnd, ConversationText (assistant), and Transcript come from mapped upstream events only; proxy does not forward raw upstream events. See "Proxy → component: message sources (Epic #493)" above. |

Tests that enforce this contract (for either proxy):

- **Jest integration**: `tests/integration/readiness-contract.test.ts`
- **E2E**: `test-app/tests/e2e/readiness-contract-e2e.spec.js` (runs with `E2E_BACKEND=openai` or `E2E_BACKEND=deepgram`)

See [Issue #406](../issues/ISSUE-406/README.md) for context on readiness and conversation-after-refresh with the OpenAI provider.

## Proxy → component: message sources (Epic #493)

When using a **translation proxy** (e.g. OpenAI Realtime), the component receives the same protocol messages; the proxy maps upstream events to that protocol. The following describes where each relevant message type comes from so component and app developers know what to expect. See [OPENAI-PROXY-EVENT-MAP-GAPS](../issues/OPENAI-PROXY-EVENT-MAP-GAPS/EPIC.md) (Epic #493) and [PROTOCOL-SPECIFICATION](../../tests/integration/PROTOCOL-SPECIFICATION.md).

| Message / behavior | Source (translation proxy) |
|--------------------|----------------------------|
| **UtteranceEnd** | Mapped from upstream VAD/speech_stopped. The proxy sends `channel` and `last_word_end` from upstream when present (Issue #494); uses defaults when the API omits them. |
| **ConversationText (assistant)** | **Only** from **conversation.item** (created/added/done) or greeting. Assistant text is **not** sent from control events such as `response.output_text.done` (upstream requirement; Issue #498, #500). Content includes text parts and **function_call** parts formatted as `"Function call: name(args)"` for parity with Deepgram (Issue #499). |
| **Transcript** (user) | From **conversation.item.input_audio_transcription.completed** (final) and **.delta** (interim). The proxy accumulates deltas per item_id and sends interim Transcript with accumulated text (Issue #497). When the upstream sends them, `start`, `duration`, `channel`, `channel_index`, and `alternatives` are passed through (Issue #496). These events are emitted when transcription is enabled and audio is committed, including when server VAD is disabled (`turn_detection: null`) (Issue #495). |
| **Raw upstream events** | The proxy **does not** forward raw upstream JSON (e.g. raw `conversation.item.added`) to the client. Only mapped component messages (ConversationText, Transcript, UtteranceEnd, etc.) and control messages (SettingsApplied, AgentAudioDone, Error) are sent (Issue #500). |
| **Unmapped upstream events** | If the upstream sends an event type the proxy does not map, the proxy sends **Error** to the client with `code: 'unmapped_upstream_event'` (treated as a warning; goal is to map all events). It does not forward the raw event as text. |

Tests that cover these behaviors: see [PROTOCOL-SPECIFICATION](../../tests/integration/PROTOCOL-SPECIFICATION.md) §1 and §3 and the integration test file `openai-proxy-integration.test.ts`.
