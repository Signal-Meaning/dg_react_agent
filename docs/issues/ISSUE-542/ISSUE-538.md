# Issue #538: Apply `think.provider.temperature` in `session.update` or remove type (Section 5.4)

**GitHub:** [#538](https://github.com/Signal-Meaning/dg_react_agent/issues/538)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session)

---

## Problem (Section 5, row 4)

React/types expose `think.provider.temperature` but `mapSettingsToSessionUpdate` does **not** set Realtime `session` temperature. That is a misleading public surface.

---

## Expected

Either:

- Map temperature into a field OpenAI accepts on `session.update` for the current API, **or**
- Remove the type/prop until supported (breaking change — note in changelog).

---

## Decision

- **Map** `agent.think.provider.temperature` → OpenAI Realtime `session.temperature` on `session.update` ([API reference](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update): optional number, typically [0.6, 1.2] for audio models). Invalid values are left to the API to reject.

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [ ] Verified (real API row below)

### RED

- [x] Unit: `agent.think.provider.temperature` → `session.temperature`; omit when absent (`tests/openai-proxy.test.ts`).

### GREEN

- [x] `mapSettingsToSessionUpdate` sets `session.temperature` when a finite number is present (`translator.ts`).

### REFACTOR

- [x] `buildSettingsMessage` + `thinkTemperature` from `AgentOptions`; `DeepgramVoiceInteraction` passes it through (`tests/buildSettingsMessage.test.ts`).

### Verified

- [x] Unit tests pass.
- [ ] **Real API:** Live Realtime (e.g. default `gpt-realtime` session in integration harness) returned `unknown_parameter` for `session.temperature` on `session.update` (Mar 2026). Do not mark this row until the supported surface is re-checked against [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) or the proxy conditionally omits `temperature` for models that reject it.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `ComponentSettings`, `mapSettingsToSessionUpdate`, `OpenAISessionUpdate.session.temperature`
- `src/utils/buildSettingsMessage.ts` — `thinkTemperature` → `agent.think.provider.temperature`
- `src/components/DeepgramVoiceInteraction/index.tsx` — pass `thinkTemperature`
- `tests/openai-proxy.test.ts`, `tests/buildSettingsMessage.test.ts`
- `src/types/agent.ts` — `AgentOptions.thinkTemperature` (already present)
