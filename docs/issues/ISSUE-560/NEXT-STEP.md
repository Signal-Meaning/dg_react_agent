# Issue #560 — next step

**Last updated:** 2026-04-05 (after isolation trace + start-options tests)

**GitHub:** [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560)

> After each meaningful slice, update **this file** and **[CURRENT-STATUS.md](./CURRENT-STATUS.md)**.

---

## Immediate next step (do this first)

Isolation **round 1** is documented in [CURRENT-STATUS.md](./CURRENT-STATUS.md) (call chain + package vs app boundary). **`getVoiceAgentStartOptions`** + unit tests encode the **OpenAI proxy vs Deepgram** `start()` contract for mic/Live.

| # | Item | Human-only? |
|---|------|-------------|
| 1 | **Partner parity:** Compare voice-commerce (or other reporter) integration to **`startServicesAndMicrophone`** semantics: same `start()` flags as `getVoiceAgentStartOptions(proxyEndpoint)`, then **`startAudioCapture()`** after `start` resolves. | **Partial** |
| 2 | If parity holds and bug remains → **narrow symptom** (no uplink vs disconnect vs wrong WS) and trace inside **`DeepgramVoiceInteraction`** (`startAudioCapture`, audio manager, binary send). Add **root `tests/`** case if a **public API** contract is violated. | **No** |
| 3 | **Text-input focus** path in `App.tsx` still calls `start({ agent: true, transcription: false, ... })` **without** `getVoiceAgentStartOptions` — intentional for proxy-first focus UX; revisit **only** if direct-Deepgram + text focus is a reported gap. | **No** |

---

## When you finish a step

1. Check boxes in [TDD-PLAN.md](./TDD-PLAN.md) and rows in [TRACKING.md](./TRACKING.md).
2. Refresh [CURRENT-STATUS.md](./CURRENT-STATUS.md).
3. Replace the **Immediate next step** table above.
