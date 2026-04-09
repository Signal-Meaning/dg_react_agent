# API Changes - v0.11.0

## Overview

**No new or removed `DeepgramVoiceInteraction` props** are introduced in v0.11.0. The public **ref handle** continues to expose `startAudioCapture()` and `stopAudioCapture()` as before; **behavior** around capture stop, PCM timing, and proxy-side commit scheduling is improved (Issues [#560](https://github.com/Signal-Meaning/dg_react_agent/issues/560), [#559](https://github.com/Signal-Meaning/dg_react_agent/issues/559)).

This release’s notable surface-area changes are in **@signal-meaning/voice-agent-backend** (OpenAI proxy scripts, logging, scheduler) and in **test-app** (Live mode patterns).

## Component (@signal-meaning/voice-agent-react 0.11.0)

| Area | Change |
|------|--------|
| **Props** | None. |
| **Ref methods** | Same method names; timing and internal audio pipeline behavior may differ in edge cases vs v0.10.6 — qualify with your integration tests. |
| **State / callbacks** | No intentional signature changes. |

## Backend (@signal-meaning/voice-agent-backend 0.2.12)

- Proxy **audio commit scheduling**, **Server VAD** configuration paths, and **logger** implementation updates (see `packages/voice-agent-backend/scripts/openai-proxy/` and package README).
- For environment variables and TLS rules, continue to follow **0.2.11+** documentation (EPIC-546); this release extends behavior rather than replacing the TLS contract.

## Migration

- **No `MIGRATION.md`** is required for this minor if you rely only on the documented component API.
- If you embed the OpenAI proxy or copy env patterns from older docs, re-read `packages/voice-agent-backend/README.md` and OpenAI proxy runbooks under `docs/BACKEND-PROXY/`.

## References

- [API-REFERENCE.md](../../API-REFERENCE.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [NEW-FEATURES.md](./NEW-FEATURES.md)
