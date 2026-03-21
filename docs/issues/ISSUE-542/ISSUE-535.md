# Issue #535: Map Settings → `session.tool_choice` (Section 5.1)

**GitHub:** [#535](https://github.com/Signal-Meaning/dg_react_agent/issues/535)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session) with [#536](./ISSUE-536.md)–[#540](./ISSUE-540.md)

---

## Problem (Section 5, row 1)

Integrators cannot set OpenAI Realtime `session.tool_choice` via `Settings` without Section 3 passthrough. Need a typed field on `agent.think` (or agreed shape) → `mapSettingsToSessionUpdate` → `session.update.session.tool_choice`.

GitHub checklist references optional strict env coverage (e.g. `ISSUE_1110_STRICT_TOOL_ROUNDTRIP=1` style) after mapping — add if still required by parent ticket Section 7.

---

## Decision

- **`agent.think.toolChoice`** (Settings JSON) maps to **`session.tool_choice`** on `session.update`.
- Supported values align with [Realtime session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update): string modes **`auto`**, **`none`**, **`required`**, or force a function with **`{ type: 'function', name: string }`**. MCP-shaped tool choice is not modeled here (use escape hatch or a follow-up issue if needed).
- **`AgentOptions.thinkToolChoice`** and **`buildSettingsMessage`** pass the value through; component forwards from options.

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [ ] Verified (real API row below)

### RED

- [x] Unit (`tests/openai-proxy.test.ts`): `toolChoice: 'required'` and object form → `session.tool_choice`; omitted → property absent.

### GREEN

- [x] Extend `ComponentSettings` / `OpenAISessionUpdate`, `mapSettingsToSessionUpdate`, `ThinkToolChoice` / `thinkToolChoice` / `buildSettingsMessage`, `DeepgramVoiceInteraction`.

### REFACTOR

- [x] Proxy README + PROTOCOL Settings row for `tool_choice`.

### Verified

- [x] Unit tests pass.
- [ ] **Real API:** `USE_REAL_APIS=1` — valid `tools` + `tool_choice` pair accepted by OpenAI.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `OpenAIRealtimeSessionToolChoice`, `mapSettingsToSessionUpdate`, session type
- `src/types/agent.ts` — `ThinkToolChoice`, `AgentSettingsMessage`, `AgentOptions`
- `src/utils/buildSettingsMessage.ts`, `src/components/DeepgramVoiceInteraction/index.tsx`
- `tests/openai-proxy.test.ts`, `tests/buildSettingsMessage.test.ts`
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`, `PROTOCOL-AND-MESSAGE-ORDERING.md`

**Canonical API:** [session.update](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update) `tool_choice`.
