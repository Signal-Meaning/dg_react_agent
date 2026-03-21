# Issue #536: Map Settings → `session.output_modalities` (Section 5.2)

**GitHub:** [#536](https://github.com/Signal-Meaning/dg_react_agent/issues/536)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session) with [#535](./ISSUE-535.md), [#537](./ISSUE-537.md)–[#540](./ISSUE-540.md)

---

## Problem (Section 5, row 2)

Integrators cannot select text-only vs audio (etc.) via `Settings`; Realtime `session.output_modalities` is not driven from the component protocol.

---

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Unit: Settings payload sets modalities (field path TBD) → `session.output_modalities` matches OpenAI array shape per current schema.
- [ ] Unit: when unset, behavior matches chosen default (document implicit vs explicit default in test name or README).

### GREEN

- [ ] Implement mapping in `translator.ts`; extend `ComponentSettings` / builder.

### REFACTOR

- [ ] Proxy README Section 5 row; optional shared validator with #537 / #538.

### Verified

- [ ] Unit tests pass.
- [ ] **Real API** and/or E2E: modality behavior matches expectation (e.g. text-only vs audio).

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts`
- `tests/openai-proxy.test.ts`
- Component types / `buildSettingsMessage` if surfaced to React

**Canonical API:** OpenAI `session.update` schema for `output_modalities`.
