# Issue #540: Settings surface for `session` audio.output (Section 5.6)

**GitHub:** [#540](https://github.com/Signal-Meaning/dg_react_agent/issues/540)

**Epic:** [#542](./README.md) · **TDD bundle:** D (Settings → session)

---

## Problem (Section 5, row 6)

Output-side session audio (`session.audio.output` or current equivalent) should be configurable via a stable `Settings` surface instead of ad hoc or rejected historical fields.

**Report note:** Document (not hide) hardcoded `session.audio.input` fields in the translator today — `turn_detection`, `format`, `transcription` — used for proxy/VAD/commit. Expose on `Settings` if integrators need control, **not** via Section 3 passthrough.

---

## TDD plan

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Unit: Settings drives `session.audio.output` (or current API equivalent); assert merged payload.
- [ ] Unit or doc snapshot: input defaults (`turn_detection`, format, transcription) documented or optionally configurable without breaking #414 / #451.

### GREEN

- [ ] Merge integrator output settings with safe input defaults in `mapSettingsToSessionUpdate`.

### REFACTOR

- [ ] README table: audio input (proxy defaults) vs output (integrator); link `PROTOCOL-AND-MESSAGE-ORDERING.md`.

### Verified

- [ ] Unit tests pass.
- [ ] **Real API / E2E:** TTS/audio path regression check in test-app proxy mode.

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `mapSettingsToSessionUpdate` `session.audio`
- `packages/voice-agent-backend/scripts/openai-proxy/README.md`, `PROTOCOL-AND-MESSAGE-ORDERING.md`
- `tests/openai-proxy.test.ts`
- Possible E2E: `test-app/tests/e2e/` for proxy audio path
