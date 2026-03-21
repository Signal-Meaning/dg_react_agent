# Issue #539: Map managed session prompt id/variables from Settings (Section 5.5)

**GitHub:** [#539](https://github.com/Signal-Meaning/dg_react_agent/issues/539)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session)

---

## Problem (Section 5, row 5)

Realtime API supports managed **prompt** identifiers and variables distinct from raw `instructions`. Voice Agent `Settings` does not yet map that surface, so integrators cannot use managed prompts without passthrough.

---

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Docs spike: lock OpenAI Realtime `session.update` field names for managed prompt id/variables (no guessing).
- [ ] Unit: agreed `Settings` shape → `mapSettingsToSessionUpdate` emits correct `session` subtree; fails until implemented.

### GREEN

- [ ] Types + mapping; precedence vs `buildInstructionsWithContext` documented in code + README.

### REFACTOR

- [ ] Single source of truth documented if managed prompt supersedes inline instructions.

### Verified

- [ ] Unit tests with fixture payloads.
- [ ] **Real API** before ship: session update with prompt reference accepted (account flags as needed).

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts`
- Component Settings types and builder
- `tests/openai-proxy.test.ts`
- `docs/` or proxy README — mapping rules vs inline prompt
