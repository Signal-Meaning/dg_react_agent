# Issue #536: Map Settings → `session.output_modalities` (Section 5.2)

**GitHub:** [#536](https://github.com/Signal-Meaning/dg_react_agent/issues/536)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session) with [#535](./ISSUE-535.md), [#537](./ISSUE-537.md)–[#540](./ISSUE-540.md)

---

## Problem (Section 5, row 2)

Integrators cannot select text-only vs audio via `Settings`; Realtime `session.output_modalities` is not driven from the component protocol.

---

## Decision

- **`agent.think.outputModalities`** (Settings JSON) maps to **`session.output_modalities`** on `session.update` when the array is non-empty **after** validation.
- Supported entries align with [Realtime session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update): **`text`** and **`audio`** only. Unknown strings are filtered; if none remain, **`output_modalities` is omitted** so the API keeps its implicit default.
- **`AgentOptions.thinkOutputModalities`** and **`buildSettingsMessage`** pass the value through; component forwards from options.

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [x] Verified (real API row below)

### RED

- [x] Unit (`tests/openai-proxy.test.ts`): `['text']`, `['audio','text']`, filter invalid, all-invalid → omit, absent/empty → omit.
- [x] Unit (`tests/buildSettingsMessage.test.ts`): non-empty → `agent.think.outputModalities`; undefined/empty → property omitted.

### GREEN

- [x] `mapSettingsToSessionUpdate`, `ComponentSettings` / `OpenAISessionUpdate`, `ThinkOutputModality` / `thinkOutputModalities` / `buildSettingsMessage`, `DeepgramVoiceInteraction`.

### REFACTOR

- [x] Proxy README + PROTOCOL Settings row for `output_modalities`.

### Verified

- [x] Unit tests pass.
- [x] **Real API:** `Issue #470 real-API: function-call flow completes` runs **without** setting `agent.think.outputModalities` (Realtime default modality for that session). The test asserts the function-call path using an **`e2eVerify` token** in the HTTP tool JSON and assistant `ConversationText`, not text-only modality. Explicit `['text']` / `['audio']` mapping is covered in **unit** tests; per-modality real-API matrices are documented as a gap in [REALTIME-SESSION-UPDATE-FIELD-MAP.md](../../../packages/voice-agent-backend/scripts/openai-proxy/REALTIME-SESSION-UPDATE-FIELD-MAP.md) § `output_modalities` — how thorough are we?

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `OpenAIRealtimeOutputModality`, `mapSettingsToSessionUpdate`, session type
- `src/types/agent.ts` — `ThinkOutputModality`, `AgentSettingsMessage`, `AgentOptions`
- `src/utils/buildSettingsMessage.ts`, `src/components/DeepgramVoiceInteraction/index.tsx`
- `tests/openai-proxy.test.ts`, `tests/buildSettingsMessage.test.ts`
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`, `PROTOCOL-AND-MESSAGE-ORDERING.md`

**Canonical API:** [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) `output_modalities`.
