# Issue #535: Map Settings → `session.tool_choice` (Section 5.1)

**GitHub:** [#535](https://github.com/Signal-Meaning/dg_react_agent/issues/535)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session) with [#536](./ISSUE-536.md)–[#540](./ISSUE-540.md)

---

## Problem (Section 5, row 1)

Integrators cannot set OpenAI Realtime `session.tool_choice` via `Settings` without Section 3 passthrough. Need a typed field on `agent.think` (or agreed shape) → `mapSettingsToSessionUpdate` → `session.update.session.tool_choice`.

GitHub checklist references optional strict env coverage (e.g. `ISSUE_1110_STRICT_TOOL_ROUNDTRIP=1` style) after mapping — add if still required by parent ticket Section 7.

---

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Unit (`tests/openai-proxy.test.ts`): `Settings` with new field → `mapSettingsToSessionUpdate(settings).session.tool_choice` equals expected (per current Realtime docs).
- [ ] Unit: when field omitted, `tool_choice` absent or default per documented rule (test encodes decision).

### GREEN

- [ ] Extend `ComponentSettings` / `think` types and `mapSettingsToSessionUpdate`.
- [ ] Wire React `buildSettingsMessage` / props if exposed; component tests updated.

### REFACTOR

- [ ] Proxy README: Section 5 mapping row for `tool_choice`.
- [ ] Optional: env-gated strict tool round-trip test if parent Section 7 still requires it.

### Verified

- [ ] Unit tests pass.
- [ ] **Real API:** `USE_REAL_APIS=1` — valid `tools` + `tool_choice` pair accepted by OpenAI.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `mapSettingsToSessionUpdate`, `ComponentSettings` types
- `src/` — settings message builder and types if exposed to apps
- `tests/openai-proxy.test.ts`
- `tests/integration/openai-proxy-integration.test.ts` (optional real API)

**Canonical API:** Verify field names against current OpenAI Realtime `session.update` documentation before locking types.
