# Changelog - v0.8.3

**Release Date**: February 2026  
**Release Type**: Patch Release

## Fixed

- **Issue #433:** Enforce no send until channel ready — `injectUserMessage` is queued when the channel has not yet reported ready (SettingsApplied or session.created) and is sent when the readiness event is received. Prevents user messages from reaching the wire before the channel is ready.

## Added

- **Log level reporting:** Backend package (`@signal-meaning/voice-agent-backend`) and component report `LOG_LEVEL` when set (module load and proxy attach; component logger reports resolved level on first use).

## Backward Compatibility

✅ **Fully backward compatible** — Behavioral fix (queue) and additive logging. Patch release.

## References

- Issue #433: No send until channel ready
- Issue #435: Quick Release v0.8.3
