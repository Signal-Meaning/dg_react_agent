# Issue #537: Map Settings → `session.max_output_tokens` (Section 5.3)

**GitHub:** [#537](https://github.com/Signal-Meaning/dg_react_agent/issues/537)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session)

---

## Problem (Section 5, row 3)

`max_output_tokens` is not mapped from `Settings` to Realtime `session.update`.

---

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Unit: Settings with `max_output_tokens` → `mapSettingsToSessionUpdate(...).session.max_output_tokens` matches.
- [ ] Unit: when omitted, key absent on serialized `session` (no `undefined` in JSON).

### GREEN

- [ ] Implement mapping; optional range validation per API docs.

### REFACTOR

- [ ] Proxy README note on context limits vs `max_output_tokens`.

### Verified

- [ ] Unit tests pass.
- [ ] Optional **Real API** smoke: small `max_output_tokens` if stable in CI.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts`
- `tests/openai-proxy.test.ts`
