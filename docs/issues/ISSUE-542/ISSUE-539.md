# Issue #539: Map managed session prompt id/variables from Settings (Section 5.5)

**GitHub:** [#539](https://github.com/Signal-Meaning/dg_react_agent/issues/539)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session)

---

## Problem (Section 5, row 5)

Realtime API supports managed **prompt** identifiers and variables distinct from raw `instructions`. Voice Agent `Settings` did not map that surface, so integrators could not use managed prompts without passthrough.

---

## Decision (field names — OpenAI Realtime)

Per [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update), the session object includes **`prompt`**: a **ResponsePrompt** with:

- **`id`** (string, required in API; we require non-empty after trim)
- **`variables`** (optional map; values may be strings or structured input types per OpenAI — we accept a JSON object and forward it)
- **`version`** (optional string; empty after trim is omitted)

Component Settings path: **`agent.think.managedPrompt`** → **`session.prompt`**.

**Precedence:** We **continue** to send **`instructions`** from `buildInstructionsWithContext` (`think.prompt` + serialized context + function hint). **`session.prompt`** is added **in addition** when `managedPrompt` is valid. Upstream defines how template and instructions combine; use minimal `think.prompt` / `instructions` if the managed template should dominate (see proxy README).

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [ ] Verified (real API row below)

### RED

- [x] Unit: fixture `managedPrompt` → `session.prompt` shape; absent / invalid id → `prompt` omitted; invalid `variables` shape → omitted, id retained.

### GREEN

- [x] `normalizeManagedPromptForSession`, `ComponentSettings` / `OpenAISessionUpdate`, `mapSettingsToSessionUpdate`, types, `buildSettingsMessage`, component.

### REFACTOR

- [x] Proxy README: `instructions` vs managed `prompt`.

### Verified

- [x] Unit tests pass.
- [ ] **Real API:** session update with a valid prompt id accepted (account / feature flags as required).

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `OpenAIRealtimeSessionPrompt`, mapping
- `src/types/agent.ts` — `ThinkManagedPrompt`, `AgentSettingsMessage`, `AgentOptions`
- `src/utils/buildSettingsMessage.ts`, `src/components/DeepgramVoiceInteraction/index.tsx`
- `tests/openai-proxy.test.ts`, `tests/buildSettingsMessage.test.ts`
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`, `PROTOCOL-AND-MESSAGE-ORDERING.md`

**Canonical API:** [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) `prompt` (ResponsePrompt).
