# Agent-Done Semantics and Naming

This doc clarifies the distinction between **agent done** (the requirement), **receipt vs playback**, and the wire events **AgentDone** and **AgentAudioDone**. The same terms are defined in code (see **Definitions in code** below) for consistency.

## Concepts

### 1. “Agent done” (requirement)

**Agent done** means: the agent has finished this turn’s output, so the component may transition to idle and start the idle timer.

- **When unmuted:** Agent done = end of audio for the turn. That is either (a) the proxy’s completion signal for that turn, or (b) playback finished, whichever the component uses to transition to idle.
- **When muted:** Agent done = when the assistant’s text is displayed (ConversationText assistant); we do not require any audio or playback.

So “agent done” is the **semantic requirement** for starting the idle timer. The wire event **AgentDone** is aligned with this semantics; the legacy event **AgentAudioDone** is not (it means receipt only).

### 2. Receipt vs playback

- **Receipt complete:** The component (or proxy) has received all output for this turn from upstream (e.g. `response.done`, `response.output_text.done`, `response.output_audio.done`). No more data for this turn will arrive.
- **Playback complete:** The device has finished playing the agent’s audio to the user. This can happen after receipt.

The component needs to know when the **agent is done for the turn** (so idle can start). That can be signaled by the proxy sending **AgentDone** (semantic) or, for backward compatibility, **AgentAudioDone** (receipt-only). For voice-to-voice (v2v) agents, receipt and playback must be separated and the proxy should trap the signal (see below).

### 3. Wire event: `AgentDone` (preferred)

The **wire message type** is `AgentDone`. It is aligned with the semantic requirement: **agent is done for the turn**.

- Proxies should send **AgentDone** when they know the agent has finished this turn’s output (e.g. after emitting the last binary audio for the turn, or when upstream signals completion and the proxy has forwarded everything). When the proxy controls or observes the audio stream, it can derive “agent done” by observing the first and last binary bytes of audio and generating AgentStartedSpeaking / agent stopped speaking, and then **AgentDone** when appropriate (e.g. after last byte sent or after playback completes, depending on who controls playback).
- The component treats **AgentDone** as “agent done for the turn” and transitions to idle when appropriate.

### 4. Wire event: `AgentAudioDone` (legacy)

The **wire message type** is `AgentAudioDone` (kept for API compatibility with the Deepgram Voice Agent API and existing proxies).

**Definition (keep comments clear around this event):**

- **Meaning:** **Agent turn output received complete** — upstream has finished sending all output for this turn. **Receipt only;** it does **not** mean “audio playback has finished” or “agent is done for the turn” in the semantic sense. Playback may still be in progress when the component receives it.
- **Name on the wire:** `AgentAudioDone` (historical; the name is confusing because it suggests “audio done” but it is receipt-complete, not playback-complete). In code and comments, always describe it as “receipt complete” or “turn output received complete,” never as “playback complete” or “agent done” without qualifying that it is receipt-only.
- The component accepts **AgentAudioDone** for backward compatibility and treats it as “transition to idle” when in speaking/listening state, but doneness may not be tracked correctly in all cases (e.g. v2v) if the proxy never sends **AgentDone**.

When there is **no audio** for the turn (text-only, or muted), the proxy typically does **not** send `AgentAudioDone`. The component can infer “agent done” from ConversationText (assistant) and its text-only path (short defer, then transition to idle). That inference works when the **component controls playback** (e.g. browser plays audio). It is **inconsistent and unreliable for v2v agents**, where the remote side may control playback. We need to **trap the signal**: the proxy should separate receipt from playback and emit an explicit agent-done signal (e.g. **AgentDone**) when it can. One way: the proxy observes the first and last binary bytes of audio and generates AgentStartedSpeaking and agent-stopped-speaking (or equivalent) events, and from that (or from upstream completion plus knowledge of the stream) generates **AgentDone** so doneness is not left to component-side inference.

### 5. V2V (voice-to-voice) and trapping the signal

For **voice-to-voice agents**, the component often does not control playback; the remote party (or another device) may be playing the agent’s audio. In that case:

- **Do not rely** on the component’s text-only path (ConversationText + defer) to infer “agent done.” That path is unreliable when playback is elsewhere.
- **Separate receipt from playback** when possible. The proxy should:
  - Emit **AgentStartedSpeaking** when it has observed the start of agent output (e.g. first binary audio byte for the turn).
  - Emit **AgentDone** (or equivalent “agent stopped speaking”) when it has observed the end of agent output — e.g. after the last binary audio byte for the turn, or when upstream sends `response.done` and the proxy has forwarded all output. If the proxy can observe playback completion (e.g. it controls the audio sink), it may send **AgentDone** when playback completes instead of (or in addition to) receipt.
- **Trap the signal at the proxy:** So that doneness is tracked correctly, the proxy must generate the appropriate signal (e.g. **AgentDone**) from the stream. Observing the first and last binary bytes of audio is one way to derive “agent started” and “agent done” and to generate AgentStartedSpeaking and AgentDone. The proxy is in the best position to do this because it sees the full stream from upstream.

## Summary table

| Term | Meaning |
|------|--------|
| **Agent done** | Agent has finished this turn’s output; idle timer may start. Defined per context (unmuted = end of audio for turn; muted = text displayed). |
| **Receipt complete** | All output for this turn has been received from upstream. |
| **Playback complete** | Device has finished playing the agent’s audio. |
| **`AgentDone` (wire)** | Semantic “agent done” for the turn. Prefer when the proxy can trap the signal. |
| **`AgentAudioDone` (wire)** | Legacy. Agent turn output **received** complete (receipt only). **Not** “playback complete” or semantic “agent done.” Name is historical; in comments always use “receipt complete.” |

## Definitions in code

The same terms are defined in code so that types and handlers stay aligned with this doc:

- **Agent done, receipt complete, playback complete** are defined in `src/types/agent.ts` at the top of the file (JSDoc block “Agent-done terms”).
- **AgentDone** and **AgentAudioDone** are defined in `src/types/agent.ts`: `AgentResponseType.AGENT_DONE`, `AgentDoneResponse`, `AgentResponseType.AGENT_AUDIO_DONE`, `AgentAudioDoneResponse` (with JSDoc describing each).
- The component handles both `AgentDone` and `AgentAudioDone` in `src/components/DeepgramVoiceInteraction/index.tsx` (same transition-to-idle logic; comments clarify which is semantic vs legacy).

When adding or changing logic that depends on “agent done,” use these definitions and keep the doc and code in sync.

## For implementers

- **Proxies:** Prefer sending **AgentDone** when you can trap the signal (e.g. after last binary audio for the turn, or when upstream signals completion and you have forwarded everything). Send **AgentAudioDone** when upstream indicates receipt-complete (e.g. `response.done`) for backward compatibility; do not use it to mean “playback finished.” For v2v, separate receipt from playback and emit **AgentDone** so the component does not rely on inference.
- **Component:** Treat **AgentDone** as semantic “agent done”; treat **AgentAudioDone** as legacy receipt-complete and transition to idle when appropriate. For text-only or muted turns when the component controls playback, the text-only path (ConversationText + defer) remains; for v2v, rely on the proxy sending **AgentDone** (or equivalent).
- **Docs and comments:** For **AgentAudioDone**, always say “receipt complete” or “turn output received complete,” never “playback complete” or unqualified “agent done.” For **AgentDone**, use “agent done for the turn” or “semantic agent done.”
