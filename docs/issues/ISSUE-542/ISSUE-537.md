# Issue #537: Map Settings → `session.max_output_tokens` (Section 5.3)

**GitHub:** [#537](https://github.com/Signal-Meaning/dg_react_agent/issues/537)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session)

---

## Problem (Section 5, row 3)

`max_output_tokens` is not mapped from `Settings` to Realtime `session.update`.

---

## Decision

- **`agent.think.maxOutputTokens`** (Settings JSON) maps to **`session.max_output_tokens`** when the value is a **positive safe integer**. Non-finite, non-integer, ≤ 0, or unsafe integers are **omitted** so the API default applies and JSON never carries `undefined`.
- **`AgentOptions.thinkMaxOutputTokens`** and **`buildSettingsMessage`** use the same validation before including the field.
- **Semantics:** caps model **output** length; separate from context window / instruction size (see proxy README note).

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [ ] Verified (optional real API below)

### RED

- [x] Unit (`tests/openai-proxy.test.ts`): valid integer → `session.max_output_tokens`; omitted → property absent after `JSON.parse(JSON.stringify(session))`; invalid / unsafe integer → omit.

### GREEN

- [x] `toSessionMaxOutputTokens` in `translator.ts`, `ComponentSettings` / `OpenAISessionUpdate`, `mapSettingsToSessionUpdate`, `AgentOptions` / `AgentSettingsMessage`, `buildSettingsMessage`, `DeepgramVoiceInteraction`.

### REFACTOR

- [x] Proxy README note (context vs `max_output_tokens`); PROTOCOL Settings row.

### Verified

- [x] Unit tests pass.
- [ ] **Real API (optional):** `USE_REAL_APIS=1` smoke with a small `max_output_tokens` if stable.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts`
- `src/types/agent.ts`
- `src/utils/buildSettingsMessage.ts`
- `src/components/DeepgramVoiceInteraction/index.tsx`
- `tests/openai-proxy.test.ts`, `tests/buildSettingsMessage.test.ts`
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`, `PROTOCOL-AND-MESSAGE-ORDERING.md`

**Canonical API:** [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) `max_output_tokens`.
