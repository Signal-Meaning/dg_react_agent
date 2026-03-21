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

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Unit: `agent.think.provider.temperature: 0.7` → assert mapped field on `session` **or** assert removal path (types/builder reject or omit); fails today (ignored).

### GREEN

- [ ] Implement Realtime `session.update` mapping **or** remove surface + changelog entry.

### REFACTOR

- [ ] Test-app / docs aligned (no dead `temperature` UX if removed).

### Verified

- [ ] Unit tests pass.
- [ ] **Real API:** If mapped, OpenAI accepts `session.update` with temperature.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts`
- `src/` types and settings builder
- `tests/openai-proxy.test.ts`
- Component / test-app references to `temperature`
