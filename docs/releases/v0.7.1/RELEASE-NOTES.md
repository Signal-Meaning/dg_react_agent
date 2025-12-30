# Release Notes - v0.7.1

**Release Date**: December 29, 2025  
**Release Type**: Patch Release

## Overview

v0.7.1 is a patch release that significantly improves E2E test coverage for backend proxy mode and stability improvements. This release focuses on fixing 18 of 22 E2E tests that were failing in proxy mode, with no breaking changes.

## 🎯 Release Highlights

### Proxy Mode Test Coverage (Issue #329)

This release dramatically improves test reliability and coverage for the backend proxy mode feature introduced in v0.7.0:

- **18 of 22 E2E tests now passing in proxy mode** (up from 0)
- Added comprehensive proxy server transcription support
- Fixed WebSocket timing issues for Settings messages
- Improved message queuing between Deepgram and client connections
- Added robust UtteranceEnd callback handling

See [Issue #329 Tracking Document](../../issues/ISSUE-329-PROXY-MODE-TEST-FIXES.md) for detailed fix documentation.

## 🔧 Fixes

### Proxy Server Transcription Support
- Added service type detection and routing for both agent and transcription services
- Proxy server now supports both agent (`wss://agent.deepgram.com/v1/agent/converse`) and transcription (`wss://api.deepgram.com/v1/listen`) service connections
- Forward all query parameters (except `service` and `token`) to Deepgram

### KeepAlive Message Ordering
- Defer keepalive start for agent service until Settings is sent
- Prevents protocol errors from keepalive messages sent before Settings

### Message Queuing
- Buffer messages from Deepgram until client WebSocket is ready
- Added automatic requeuing and retry mechanism for failed message forwarding
- Prevents critical messages like SettingsApplied from being lost

### WebSocket Timing
- Added WebSocket state checking before sending Settings messages
- Wait for WebSocket readyState to be OPEN (1) before attempting to send
- Added retry logic with timeout to handle CONNECTING state
- Prevents `sendJSON` returning false and messages being lost

### UtteranceEnd Callback
- Always call `onUtteranceEnd` callback even after `speech_final=true` received
- Fixes issue where callback wasn't called when UtteranceEnd arrived after speech_final
- Callback provides useful data (channel, lastWordEnd) even when speech_final already received

### Settings Double-Send in React StrictMode
- Set flags immediately when Settings is successfully sent (not wait for SettingsApplied)
- Prevents React StrictMode from sending Settings twice when component remounts
- Eliminates "SETTINGS_ALREADY_APPLIED" errors

### Idle Timeout Restart
- Fixed idle timeout not restarting after USER_STOPPED_SPEAKING when agent is idle
- Added polling mechanism with state getter to ensure timeout starts after all state updates
- Fixed race condition where timeout wasn't starting when agent becomes idle and playback stops

## 📝 Changes

### Changed
- Converted proxy server to ES modules for better compatibility
- Improved backend proxy mode test robustness
- Enhanced test helpers with proxy mode support

### Documentation
- Added Issue #329 tracking document for proxy mode test fixes
- Updated v0.7.0 release docs to reference API-REFERENCE.md update (Issue #327)
- Added API-REFERENCE.md update to CHANGELOG.md

## 📊 Statistics

- **11 commits** since v0.7.0
- **18 of 22 E2E tests passing in proxy mode** (up from 0)
- **All 23 Issue #329 tests passing individually** in proxy mode
- **160 passed, 7 failed, 11 skipped** in full test run
- **0 breaking changes** - fully backward compatible

## 🔄 Migration Guide

**No migration required!** v0.7.1 is fully backward compatible. All existing code continues to work without changes.

This is a patch release focused on stability improvements and test coverage for proxy mode. No API changes were made.

## 📚 Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Complete list of all 11 commits
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) - Package contents
- [Issue #329 Tracking Document](../../issues/ISSUE-329-PROXY-MODE-TEST-FIXES.md) - Comprehensive fix documentation

## 🔗 Related Issues and PRs

- **Issue #329**: E2E Test Failures in Proxy Mode (primary focus of this release)
- **Issue #327**: v0.7.0 Release Documentation Updates
- **Issue #242**: Backend Proxy Support (original feature, v0.7.0)

## 🧪 Testing

- ✅ All 23 Issue #329 tests passing individually in proxy mode
- ✅ 18 of 22 E2E tests passing in proxy mode (up from 0)
- ✅ 160 passed, 7 failed, 11 skipped in full test run
- ✅ Linting clean (4 warnings, no errors)
- ✅ Build successful
- ✅ Backward compatibility verified

## 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.7.1
```

## 🎉 What's Next

This release significantly improves proxy mode stability and test coverage. Future releases will continue to:
- Improve test isolation for remaining E2E test failures
- Address Jest test failures tracked in Issue #331
- Continue enhancing developer experience

We welcome feedback and contributions! See [DEVELOPMENT.md](../../DEVELOPMENT.md) for contribution guidelines.

---

**Previous Release**: [v0.7.0](./../v0.7.0/RELEASE-NOTES.md)

