# Release Notes - v0.9.8

**Release Date**: March 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.8 is a **patch** release (Issue #489). It includes:

1. **Issue #487 fix:** The component no longer closes the agent WebSocket on idle timeout while waiting for the next agent message after the app has sent a function result (e.g. chained function calls). The connection stays open until the next agent message is received.
2. **Settings/context refactor (Issue #489, #490):** Internal refactor for how context and Settings are built: `getHistoryForSettings`, `buildSettingsMessage`, and `useSettingsContext` (Phases 1–4). No public API or behavior change; improves testability and clarity.

## E2E (proxy mode)

Full E2E in proxy mode: 223+ passed, 24 skipped. Two tests may still fail depending on environment: **declarative-props-api** (interruptAgent prop / real API) and **openai-proxy-tts-diagnostic** (TTS binary/playback). See `docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md` for details and options (skip in CI, relax assertions, or fix when in scope).

## Upgrade

No code changes required for existing consumers. Install `@signal-meaning/voice-agent-react@0.9.8` when published.

See [CHANGELOG.md](./CHANGELOG.md) for full details.
