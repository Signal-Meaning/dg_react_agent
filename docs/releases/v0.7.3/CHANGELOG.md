# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.3] - 2025-12-31

### Fixed

#### Issue #340: Int16Array Error with Odd-Length TTS Audio Buffers
- **Audio Buffer Validation**: Added validation and truncation for odd-length audio buffers in `createAudioBuffer()`
  - Prevents `RangeError: byte length of Int16Array should be a multiple of 2`
  - Gracefully handles audio buffers with odd byte lengths from Deepgram WebSocket
  - Truncates odd-length buffers to even length before creating `Int16Array`
  - Logs warning when truncation occurs for debugging purposes
- **Root Cause**: PCM16 audio format requires 2 bytes per sample, but Deepgram occasionally sends buffers with odd byte lengths
- **Impact**: High - This error was causing connections to close immediately after TTS audio processing failed
- **Location**: `src/utils/audio/AudioUtils.ts:17` in `createAudioBuffer()` function

#### Issue #341: Connection State Reporting Regression (v0.7.0+)
- **API Key Handling**: Fixed regression introduced in v0.7.0 with backend proxy support
  - Removed `|| ''` and `?? ''` fallbacks that converted `undefined` API keys to empty strings
  - Restored pre-fork behavior: `undefined` API keys are passed as `undefined` (not empty strings)
  - Fixed authentication failures that caused immediate connection closure (code 1006)
- **Query Parameter Fix**: Removed incorrect `service=agent` query parameter from direct connections
  - This parameter was only needed for proxy routing, not direct connections
  - Direct connections now use correct endpoint: `wss://agent.deepgram.com/v1/agent/converse`
- **Root Cause**: Backend proxy refactoring (v0.7.0) incorrectly added fallbacks and query parameters that broke direct connections
- **Impact**: High - This regression prevented connections from authenticating properly, causing immediate closure
- **Location**: 
  - `src/components/DeepgramVoiceInteraction/index.tsx` - `getConnectionOptions()` method
  - `src/utils/websocket/WebSocketManager.ts` - `connect()` method
  - `test-app/src/App.tsx` - API key prop handling

### Improved

- **Error Handling**: Enhanced error handling in audio processing to prevent unhandled errors from closing connections
- **Type Safety**: Improved type guards and assertions in WebSocket message handling

### Documentation

- **Testing Best Practices**: Updated test documentation with WebSocket testing strategies
  - Documented separation of concerns: Node.js environment for real WebSocket tests, jsdom + mocks for component tests
  - Added comprehensive testing guide in `docs/TESTING.md`
- **Issue Documentation**: Created comprehensive documentation for Issues #340 and #341
  - Root cause analysis
  - Fix implementation details
  - Test evidence and verification

**Test Results**:
- **Jest Tests**: 68 test suites passed, 725 tests passed, 10 skipped ✅
- **E2E Tests**: Tests passing with real API connections (Jest WebSocket connectivity tests) ✅
- **Defect Resolution**: 
  - ✅ Issue #340: 0 Int16Array errors in test logs, 600+ successful audio buffer creations
  - ✅ Issue #341: Connection authentication working correctly, no immediate closures

### Complete Commit List

All commits since v0.7.2:

1. `a36c6f7` - Merge pull request #343 from Signal-Meaning/fix/issue341-issue340-regression-fixes
2. `3660054` - Issue #341: Fix regression - Remove fallbacks and service query param
3. `16fd069` - docs: update release tracking - release branch merged to main

### Related Issues

- **Issue #340**: Int16Array Error: TTS Audio Processing Fails with Odd-Length Buffers (fixed)
- **Issue #341**: Connection State Reporting: Connections Close Immediately After Being Reported as Connected (fixed)
- **Issue #344**: Quick Release v0.7.3: Patch Release - Issue #340 & #341 Fixes

---

[0.7.2]: https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.2

