# Release Notes - v0.10.4

**Release Date**: March 2026  
**Type**: Patch release

## Summary

v0.10.4 ships **Issue #527 / PR #528**: fixes for **idle timeout firing during assistant playback** (component) and **proxy `AgentAudioDone` ordering** when TTS PCM arrives before `output_text.done` (OpenAI proxy). Also includes a **lockfile** update so **high-severity `npm audit`** passes in CI. No public API changes.

## Fixes included

- **Component / idle timeout:** Post-commit interaction state and idle scheduling respect playback vs upstream receipt so users are not cut off mid-playback.
- **OpenAI proxy:** Defers `AgentAudioDone` on `output_text.done` when audio deltas were already received; completion follows `response.output_audio.done` for that turn.
- **CI / audit:** `flatted` 3.4.2 via lockfile (GHSA-rf6f-7fwh-wjgh).

## Packages

- **@signal-meaning/voice-agent-react** — 0.10.4
- **@signal-meaning/voice-agent-backend** — 0.2.9 (includes proxy change above)

## Validation

- **CI-equivalent (mock):** `npm run lint`, `npm run test:mock`, `npm audit --audit-level=high`.
- **Proxy / ordering:** `npm test -- tests/integration/openai-proxy-integration.test.ts` (mock); with keys, `USE_REAL_APIS=1` for the same file per [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md).
- **Idle / receipt vs playback:** `npm test -- tests/integration/agent-receipt-vs-playback-idle-timeout.test.tsx` and related unit tests under `tests/` for `IdleTimeoutService` / `useIdleTimeoutManager`.

## See also

- [CHANGELOG.md](./CHANGELOG.md) — Full changelog
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) — Package contents and entry points
- [Issue #529](https://github.com/Signal-Meaning/dg_react_agent/issues/529) — release tracking (checklist in-repo on branch `issue-529` when present)
