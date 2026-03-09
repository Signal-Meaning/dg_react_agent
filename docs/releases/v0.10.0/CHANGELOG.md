# Changelog - v0.10.0

**Release Date**: March 2026  
**Release Type**: Minor Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Added

- **Epic #493 (OpenAI proxy event mapping):** Transcription and agent event mapping improvements for proxy mode: `input_audio_transcription.delta` accumulator (Issue #497), `transcription.completed`/`transcription.delta` with start/duration/channel/alternatives (Issue #496), `speech_stopped` channel and `last_word_end` mapped to UtteranceEnd (Issue #494), function_call content parts as ConversationText for Deepgram parity (Issue #499), documentation for transcription events when VAD disabled (Issue #495). Unmapped events logged as warnings; raw `conversation.item` no longer forwarded (Issue #500); conversation history and finalized message handling documented (Issue #498).
- **Issue #490 (component-owned agent context):** Refactor and tests for component-owned agent context; `getHistoryForSettings`, `buildSettingsMessage`, `useSettingsContext` (from v0.9.8) extended with TDD and E2E coverage.
- **Issue #379:** Settings structure verification tests and shared validation; test suite improvements.
- **Release process:** Process-order note in release and quick-release issue templates: complete Pre-Release Preparation before Version Management or publishing; release checklist body reordered so Pre-Release is visible first.

## Changed

- **Idle timeout (Issue #489 / #487):** IdleTimeoutService does not stop an active timeout when agent transitions to thinking/speaking (Issue #489 design) to avoid stopping on stale state; unit tests updated to match. E2E idle timeout after agent speech and greeting flows verified in proxy mode.
- **Tests:** Relaxed reconnection callback assertions in `onSettingsApplied` and `onContextWarning` tests (allow ≥ N calls when component emits extra events during reconnection).
- **E2E:** 191 passed, 60 skipped in proxy mode (full run). Real-API and mock strategies documented; USE_REAL_APIS and USE_PROXY_MODE usage clarified in test-app.

## Fixed

- **Issue #489:** Context on reconnect, idle timeout after function call, proxy fixes, backend integration tests, CORS/diagnostics; E2E and TDD docs updated.
- **Issue #346 / #333:** E2E direct-mode control, test script `test:e2e:direct`; settings remount behavior (TDD); some items deferred to Issue #503.
- **Unit tests:** agent-state-handling, on-settings-applied-callback, on-context-warning-callback aligned with current IdleTimeoutService and reconnection behavior.

## Backward Compatibility

✅ **Fully backward compatible** — No breaking changes to the public component API.

## References

- Epic #493: OpenAI proxy event map; Issues #494–#500, #497, #498.
- Issue #489: Release checklist, idle timeout, context on reconnect, E2E resolution.
- Issue #490: Component-owned context; Issue #379: Test suite / settings structure; Issue #346/#333: Idle timeout E2E and remount.
- Release issue: [#504](https://github.com/Signal-Meaning/dg_react_agent/issues/504).
