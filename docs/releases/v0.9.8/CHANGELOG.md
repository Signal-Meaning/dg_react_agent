# Changelog - v0.9.8

**Release Date**: March 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #487 (voice-commerce #1058):** Idle timeout no longer fires while the component is waiting for the next agent message after the app has sent a function result. The connection stays open until the next agent message (e.g. next function call or final response) is received, then idle timeout may start as usual. Fixes mandate flow and other chained function-call scenarios where the model had not yet sent the next message.

## Added

- **Issue #487:** New idle-timeout event `AGENT_MESSAGE_RECEIVED` to clear the "waiting for next agent message after function result" state; `handleNextAgentMessageReceived()` on the idle timeout manager (internal).
- **Tests:** Idle timeout must not fire after function result until next agent message is received (repro for voice-commerce #1058).
- **Tests:** Closure and idle timeout with a few functions in parallel (STARTED/COMPLETED and `AGENT_MESSAGE_RECEIVED` behavior).
- **Issue #489 / #490 (settings/context refactor):** Extracted, test-driven helpers and hook for Settings and context resolution (no API change):
  - **Phase 1:** `getHistoryForSettings()` — single pipeline for history used when building `agent.context` (in-memory → persisted → storage). Unit tests: `tests/getHistoryForSettings.test.ts`.
  - **Phase 2:** `buildSettingsMessage()` — pure function to build the Settings payload. Unit tests: `tests/buildSettingsMessage.test.ts`.
  - **Phase 3:** Single "latest history" ref — removed `latestConversationHistoryRef` and ref sync at start of `sendAgentSettings`; hook uses `conversationHistoryRef` (updated by effect + ConversationText handler) only.
  - **Phase 4:** `useSettingsContext` hook — `getContextForSend()` returns `effectiveContext` and `baseAgentOptions` (fromHistory → fromApp → fromRestored; `baseAgentOptions = getAgentOptions?.() ?? agentOptionsRef.current`). Unit tests: `tests/useSettingsContext.test.tsx`. Integration: `reconnect-settings-context-isolation.test.tsx`, `component-owned-context-490.test.tsx`.

## Changed

- **Internal:** Context resolution and Settings message construction now use `getHistoryForSettings`, `buildSettingsMessage`, and `useSettingsContext`; behavior and public API unchanged.

## E2E status (proxy mode)

- **Latest full run:** 223+ passed, 24 skipped, **2 failed** (run-dependent; real API / proxy mode).
- **Two remaining failures** (see `docs/issues/ISSUE-489/E2E-FAILURES-RESOLUTION.md`):
  1. **declarative-props-api.spec.js** — `interruptAgent prop › should interrupt TTS when interruptAgent prop is true` (requires real API; timing/implementation of interruptAgent prop).
  2. **openai-proxy-tts-diagnostic.spec.js** — `diagnose TTS path: binary received and playback status` (OpenAI proxy TTS diagnostic; binary/playback assertions can fail depending on env/backend).

## Backward Compatibility

✅ **Fully backward compatible** — No breaking changes. No public API changes.

## References

- Issue #487: [Idle timeout fires while agent is still busy](https://github.com/Signal-Meaning/dg_react_agent/issues/487)
- Voice-commerce #1058 (AP2 mandate flow)
- Issue #489: [Release checklist](https://github.com/Signal-Meaning/dg_react_agent/issues/489); docs/issues/ISSUE-489/
- Issue #490: Component-owned context; docs/issues/ISSUE-490/REFACTOR-CONTEXT-OWNERSHIP.md
- Refactor plan: docs/REFACTORING-PLAN-release-v0.9.8.md
