# Changelog - v0.8.2

**Release Date**: February 2026  
**Release Type**: Patch Release

## Added

- **Issue #429:** Expose `getAgentManager` on ref handle for idle-timeout parity (Deepgram + OpenAI proxy).

## Fixed

- **#428:** Invoke `onSettingsApplied` when `session.created` is received.

## Changed

- **CI:** Remove publish-only workflow; use test-and-publish only.

## Backward Compatibility

✅ **Fully backward compatible** — Additive ref API and callback timing fix. Patch release.

## References

- Issue #429: getAgentManager on ref
- Issue #428: onSettingsApplied on session.created
