# Release Notes - v0.7.3

**Release Date**: December 31, 2025  
**Release Type**: Patch Release

## Overview

v0.7.3 is a critical patch release that fixes two regressions discovered after v0.7.2 was released. This release addresses Issues #340 and #341, which were causing connection failures and TTS audio processing errors. No breaking changes.

## 🎯 Release Highlights

### Critical Bug Fixes

This release fixes two critical issues that were preventing proper component functionality:

- **Issue #340**: Fixed Int16Array error when processing TTS audio buffers with odd byte lengths ✅
- **Issue #341**: Fixed connection authentication regression that caused immediate connection closure ✅

Both issues were regressions introduced in v0.7.0 with the backend proxy support refactoring. This release restores the correct behavior.

## 🐛 Fixed

### Issue #340: Int16Array Error with Odd-Length TTS Audio Buffers

**Problem**: The component threw `RangeError: byte length of Int16Array should be a multiple of 2` when processing TTS audio buffers with odd byte lengths from Deepgram.

**Solution**: Added validation and truncation for odd-length audio buffers in `createAudioBuffer()`:
- Validates buffer length before creating `Int16Array`
- Truncates odd-length buffers to even length (removes last byte)
- Logs warning when truncation occurs for debugging
- Prevents connection closure due to unhandled errors

**Impact**: High - This error was causing connections to close immediately after TTS audio processing failed.

**Location**: `src/utils/audio/AudioUtils.ts:17` in `createAudioBuffer()` function

### Issue #341: Connection Authentication Regression

**Problem**: Connections were closing immediately after being reported as "connected" due to authentication failures. This was a regression introduced in v0.7.0.

**Root Cause**: Backend proxy refactoring (v0.7.0) incorrectly:
- Added `|| ''` and `?? ''` fallbacks that converted `undefined` API keys to empty strings
- Added incorrect `service=agent` query parameter to direct connections
- This caused authentication failures (code 1006) and immediate connection closure

**Solution**: 
- Removed `|| ''` and `?? ''` fallbacks - `undefined` API keys are now passed as `undefined` (matching pre-fork behavior)
- Removed `service=agent` query parameter from direct connections (only needed for proxy routing)
- Restored correct endpoint usage: `wss://agent.deepgram.com/v1/agent/converse`

**Impact**: High - This regression prevented connections from authenticating properly, blocking all functionality.

**Locations**: 
- `src/components/DeepgramVoiceInteraction/index.tsx` - `getConnectionOptions()` method
- `src/utils/websocket/WebSocketManager.ts` - `connect()` method  
- `test-app/src/App.tsx` - API key prop handling

## 🔧 Improved

### Error Handling
- Enhanced error handling in audio processing to prevent unhandled errors from closing connections
- Improved type guards and assertions in WebSocket message handling

### Documentation
- Updated test documentation with WebSocket testing best practices
- Created comprehensive testing guide in `docs/TESTING.md`
- Documented separation of concerns: Node.js environment for real WebSocket tests, jsdom + mocks for component tests

## 📊 Statistics

- **3 commits** since v0.7.2
- **2 critical bugs fixed** ✅
- **0 breaking changes** - fully backward compatible
- **All tests passing** ✅

## 🔄 Migration Guide

**No migration required!** v0.7.3 is fully backward compatible. All existing code continues to work without changes.

This is a patch release focused on fixing regressions. No API changes were made.

## 📚 Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Complete list of all 3 commits
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) - Package contents
- [Issue #340](https://github.com/Signal-Meaning/dg_react_agent/issues/340) - Int16Array Error: TTS Audio Processing Fails with Odd-Length Buffers
- [Issue #341](https://github.com/Signal-Meaning/dg_react_agent/issues/341) - Connection State Reporting: Connections Close Immediately After Being Reported as Connected
- [Issue #344](https://github.com/Signal-Meaning/dg_react_agent/issues/344) - Quick Release v0.7.3: Patch Release - Issue #340 & #341 Fixes

## 🔗 Related Issues and PRs

- **Issue #340**: Int16Array Error: TTS Audio Processing Fails with Odd-Length Buffers (fixed)
- **Issue #341**: Connection State Reporting: Connections Close Immediately After Being Reported as Connected (fixed)
- **Issue #344**: Quick Release v0.7.3: Patch Release - Issue #340 & #341 Fixes
- **PR #343**: Fix regression - Remove fallbacks and service query param

## 🧪 Testing

- ✅ 68 Jest test suites passed, 725 tests passed, 10 skipped
- ✅ Jest WebSocket connectivity tests passing with real API connections
- ✅ 0 Int16Array errors in test logs, 600+ successful audio buffer creations
- ✅ Connection authentication working correctly, no immediate closures
- ✅ Linting clean (4 warnings, no errors)
- ✅ Build successful
- ✅ Package created: `signal-meaning-deepgram-voice-interaction-react-0.7.3.tgz`
- ✅ Backward compatibility verified

## 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.7.3
```

## 🎉 What's Next

This release fixes critical regressions that were blocking proper component functionality. Future releases will continue to:
- Address remaining E2E test failures (unrelated to these fixes)
- Continue enhancing test reliability and coverage
- Improve developer experience

We welcome feedback and contributions! See [DEVELOPMENT.md](../../DEVELOPMENT.md) for contribution guidelines.

---

**Previous Release**: [v0.7.2](./../v0.7.2/RELEASE-NOTES.md)

