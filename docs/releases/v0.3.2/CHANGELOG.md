# Changelog - v0.3.2

## [0.3.2] - 2025-01-15

### 🐛 Critical Bug Fixes

#### VAD Timeout Issue Resolution
- **Fixed VAD timeout issue #71**: Added missing `disableIdleTimeoutResets()` calls to VAD event handlers
- **Prevents connection timeouts during active speech**: UserStoppedSpeaking and VADEvent handlers now properly disable idle timeout resets
- **Resolves voice-commerce team patch requirement**: No longer need external patching

### 📝 Changes

#### VAD Event Handler Improvements
- Added `disableIdleTimeoutResets()` calls to UserStoppedSpeaking handler
- Added `disableIdleTimeoutResets()` calls to VADEvent handler
- UtteranceEnd handler was already working correctly
- Added comprehensive test coverage for VAD timeout behavior

#### Testing Enhancements
- Added `vad-timeout-issue-71.spec.js` - Test demonstrating the bug
- Added `vad-timeout-issue-71-real.spec.js` - Comprehensive analysis tests
- Added `vad-timeout-issue-71-fixed.spec.js` - Fix verification tests

### 🧪 Testing

- ✅ All VAD events now properly call `disableIdleTimeoutResets()`
- ✅ Regression tests pass
- ✅ No breaking changes
- ✅ Voice interaction reliability improved

### 🎯 Impact

- **Severity**: Critical bug fix
- **Breaking Changes**: None
- **User Impact**: Improved voice interaction reliability
- **Team Impact**: Eliminates need for voice-commerce team patching

### 📦 Files Modified

- `src/components/DeepgramVoiceInteraction/index.tsx` - Core fix (22 lines added)
- `tests/e2e/vad-timeout-issue-71*.spec.js` - Test files for verification

### 🔗 Related Issues

- Resolves #71: Critical VAD timeout issue
- Merged via PR #72: Fix VAD timeout issue #71

### 🚀 Migration

No migration required - this is a patch release with no breaking changes.

### 📋 Release Notes

This patch release fixes a critical bug where VAD (Voice Activity Detection) event handlers were not properly calling `disableIdleTimeoutResets()` on WebSocketManager instances. This caused connections to timeout even while users were actively speaking, leading to poor user experience.

The fix ensures that all VAD events (UserStoppedSpeaking, VADEvent, and UtteranceEnd) properly disable idle timeout resets, preventing unexpected disconnections during voice interactions.

**Key Benefits:**
- Improved voice interaction reliability
- Eliminates connection timeouts during active speech
- No breaking changes
- Resolves external patching requirements
