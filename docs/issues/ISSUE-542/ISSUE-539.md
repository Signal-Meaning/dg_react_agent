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

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [x] Verified (unit + mapper + env-gated real API — see below)

### RED

- [x] Unit: fixture `managedPrompt` → `session.prompt` shape; absent / invalid id → `prompt` omitted; invalid `variables` shape → omitted, id retained.

### GREEN

- [x] `normalizeManagedPromptForSession`, `ComponentSettings` / `OpenAISessionUpdate`, `mapSettingsToSessionUpdate`, types, `buildSettingsMessage`, component.

### REFACTOR

- [x] Proxy README: `instructions` vs managed `prompt`.

### Verified

- [x] Unit tests pass (`tests/openai-proxy.test.ts`, `tests/buildSettingsMessage.test.ts`, `tests/managed-prompt-env.test.ts`).
- [x] **Real API (`session.prompt`):** Set **`OPENAI_MANAGED_PROMPT_ID`** (dashboard prompt id for your API key). Optional: **`OPENAI_MANAGED_PROMPT_VERSION`**, **`OPENAI_MANAGED_PROMPT_VARIABLES`** (JSON object string). Then:
  `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #539 real-API"`.
  **Unset id** → test **skipped** (not a failure). **Invalid `VARIABLES` JSON** → throws with a clear error (fix env). TDD: [TDD-MANAGED-PROMPT-REAL-API.md](./TDD-MANAGED-PROMPT-REAL-API.md).

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `OpenAIRealtimeSessionPrompt`, mapping
- `src/types/agent.ts` — `ThinkManagedPrompt`, `AgentSettingsMessage`, `AgentOptions`
- `src/utils/buildSettingsMessage.ts`, `src/components/DeepgramVoiceInteraction/index.tsx`
- `tests/openai-proxy.test.ts`, `tests/buildSettingsMessage.test.ts`, `tests/managed-prompt-env.test.ts`
- `tests/integration/helpers/managed-prompt-env.ts`, `tests/integration/helpers/real-api-json-ws-session.ts`, `tests/integration/openai-proxy-integration.test.ts`
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`, `PROTOCOL-AND-MESSAGE-ORDERING.md`

**Canonical API:** [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) `prompt` (ResponsePrompt).
