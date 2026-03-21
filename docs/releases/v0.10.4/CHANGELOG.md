# Changelog - v0.10.4

**Release Date**: March 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #527 / PR #528 (customer idle timeout):** Idle disconnect no longer fires while the user can still hear assistant TTS. The headless component aligns **receipt** of assistant output (wire complete) with **playback** so the idle timer does not start early when the proxy defers `AgentAudioDone` until audio has finished streaming. Touches `DeepgramVoiceInteraction`, `IdleTimeoutService`, and `useIdleTimeoutManager` (see `docs/issues/ISSUE-489/` for semantics).

- **Issue #527 / PR #528 (OpenAI proxy, voice-commerce #1118-style ordering):** When the upstream sends PCM via `response.output_audio.delta` before `response.output_text.done`, the proxy no longer sends `AgentAudioDone` on `output_text.done` alone; it defers that signal until `response.output_audio.done` so client idle timeout does not start while playback is still in progress.

## Security

- **Development dependencies:** Bumped transitive `flatted` to **3.4.2** (addresses [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh)); `package-lock.json` updated so `npm audit --audit-level=high` passes for CI.

## Backward Compatibility

✅ **Fully backward compatible** — No breaking changes to the public component API.

## References

- Issue [#527](https://github.com/Signal-Meaning/dg_react_agent/issues/527) — customer idle timeout vs playback / receipt
- Issue [#529](https://github.com/Signal-Meaning/dg_react_agent/issues/529) — release patch train for #528
- PR [#528](https://github.com/Signal-Meaning/dg_react_agent/pull/528) — fix: customer idle timeout vs playback + proxy AgentAudioDone ordering
