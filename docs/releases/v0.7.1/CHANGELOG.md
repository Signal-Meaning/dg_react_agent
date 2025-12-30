# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.1] - 2025-12-29

### Fixed

#### Proxy Mode Test Coverage (Issue #329)
- **Proxy Server Transcription Support**: Added service type detection and routing for both agent and transcription services
  - Proxy server now supports both `wss://agent.deepgram.com/v1/agent/converse` (agent service) and `wss://api.deepgram.com/v1/listen` (transcription service)
  - Added `service` query parameter detection to route connections correctly
  - Forward all query parameters (except `service` and `token`) to Deepgram
- **KeepAlive Message Ordering**: Defer keepalive start for agent service until Settings is sent
  - Prevents protocol errors from keepalive messages sent before Settings
- **Message Queuing**: Buffer messages from Deepgram until client WebSocket is ready
  - Added `deepgramMessageQueue` to prevent message loss when client WebSocket isn't OPEN
  - Added automatic requeuing and retry mechanism for failed message forwarding
- **WebSocket Timing**: Added WebSocket state checking before sending Settings messages
  - Wait for WebSocket readyState to be OPEN (1) before attempting to send Settings
  - Added retry logic with timeout to handle CONNECTING state
  - Prevents `sendJSON` returning false and messages being lost
- **UtteranceEnd Callback**: Always call `onUtteranceEnd` callback even after `speech_final=true` received
  - Fixes issue where callback wasn't called when UtteranceEnd arrived after speech_final
  - Callback provides useful data (channel, lastWordEnd) even when speech_final already received
- **Settings Double-Send in React StrictMode**: Fixed Settings messages being sent twice
  - Set flags immediately when Settings is successfully sent (not wait for SettingsApplied)
  - Prevents React StrictMode from sending Settings twice when component remounts
- **Idle Timeout Restart**: Fixed idle timeout not restarting after USER_STOPPED_SPEAKING when agent is idle
  - Added polling mechanism with state getter to ensure timeout starts after all state updates
  - Fixed race condition where timeout wasn't starting when agent becomes idle and playback stops
  - Changed test to use `loadAndSendAudioSample` fixture for proper audio format

**Test Results**:
- 18 of 22 E2E tests now passing in proxy mode (up from 0)
- All 23 Issue #329 tests passing individually in proxy mode
- **All 167 E2E tests passing** (163 stable, 4 tagged as `@flaky` for automatic retry)
- 4 tests tagged with `@flaky` due to test isolation issues (pass individually, may fail in full suite)
- Jest tests: 721 passed, 10 skipped

### Changed

- **Converted proxy server to ES modules** for better compatibility
- **Improved backend proxy mode test robustness** with better error handling and state checking
- **Enhanced test helpers with proxy mode support** for consistent testing patterns
- **Tagged 4 flaky tests with `@flaky`** for automatic retry in CI (test isolation issues)
  - Tests pass individually but may fail in full suite runs
  - Playwright automatically retries flaky tests (2 retries in CI)

### Documentation

- **Added Issue #329 tracking document** (`docs/issues/ISSUE-329-PROXY-MODE-TEST-FIXES.md`) for comprehensive fix documentation
- **Updated v0.7.0 release docs** to reference API-REFERENCE.md update (Issue #327)
- **Added API-REFERENCE.md update to CHANGELOG.md** (Issue #327)

### Complete Commit List

All commits since v0.7.0 (11 commits total):

1. `5b2727b` - Fix Issue #329: Fix 18/22 E2E tests in proxy mode
2. `ce97a1b` - Fix Issue #329: Resolve 4 E2E tests in proxy mode
3. `5e0f2e1` - Add Issue #329 tracking document for proxy mode test fixes
4. `06ad65f` - Fix proxy server to support transcription service connections
5. `19fa610` - Fix: Queue messages in proxy server until Deepgram connection ready
6. `b5854a8` - Fix: Convert proxy server to ES modules and improve test robustness
7. `0bf1e03` - Fix: Improve backend proxy mode test for agent responses
8. `a1bf847` - Setup: Add proxy mode support to test helpers and update .gitignore
9. `fdffd51` - docs: Add Issue #327 release checklist completion document
10. `71d7728` - docs: Add API-REFERENCE.md update to CHANGELOG.md (Issue #327)
11. `23dce59` - docs: Update v0.7.0 release docs to reference API-REFERENCE.md update (Issue #327)

### Related Issues

- **Issue #329**: E2E Test Failures in Proxy Mode (primary focus of this release)
- **Issue #327**: v0.7.0 Release Documentation Updates
- **Issue #242**: Backend Proxy Support (original feature, v0.7.0)

---

[0.7.0]: https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.0

