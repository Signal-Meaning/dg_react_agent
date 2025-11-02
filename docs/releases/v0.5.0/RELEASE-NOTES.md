## 🚀 Release v0.5.0: API Simplification and Major Improvements

**Version**: v0.5.0  
**Date**: TBD  
**Status**: Ready for Release  
**Previous Version**: v0.4.2

### ✅ Release Summary

v0.5.0 introduces significant API simplifications, architectural improvements, and comprehensive bug fixes. This release focuses on explicit control, reduced complexity, and better developer experience.

### 🚨 Breaking Changes

This release includes **significant breaking changes**. Please review the [Migration Guide](./MIGRATION.md) before upgrading.

**Key Breaking Changes**:
- **Removed `autoConnect` prop**: Component no longer connects automatically on mount
- **Removed `onAgentSilent` callback**: Use `onPlaybackStateChange(false)` instead (Issue #198)
- **Removed multiple audio control methods**: Unified into `interruptAgent()` method
- **Removed debug methods**: `getConnectionStates()` and `getState()` removed from public API (Issue #162)
- **Removed `connectTextOnly()` and `isPlaybackActive()`**: Replaced with `start()` and callbacks (Issue #195)
- **Removed microphone control props/methods**: Microphone state now managed internally

### ✨ Key Features

#### API Simplification
- **Lazy Initialization (Issue #206)**: WebSocket managers created on-demand, reducing unnecessary connections
- **Single WebSocket Architecture**: Unified connection for transcription and agent services
- **Explicit Control**: All services must be started via `start()` method calls
- **Unified Audio Control**: Single `interruptAgent()` method replaces multiple audio control methods

#### Enhanced Voice Activity Detection
- **Specific VAD Callbacks**: `onUserStartedSpeaking`, `onUserStoppedSpeaking`, `onUtteranceEnd`
- **Agent Speaking Callback**: `onAgentStartedSpeaking` for when agent starts speaking
- **Word-Level Timing**: `onUtteranceEnd` provides precise end-of-speech detection

#### New Audio Control Methods
- **`allowAgent()`**: Re-enable audio after `interruptAgent()` for push-button mute scenarios
- **`startAudioCapture()`**: Explicit microphone control with lazy initialization
- **`getAudioContext()`**: Access AudioContext for debugging and browser autoplay policy compliance

#### New Callbacks
- **`onSettingsApplied`**: Fired when settings are successfully applied (Issue #162)
- **`onUserMessage`**: Dedicated callback for user messages from server
- **`onAgentStartedSpeaking`**: Simplified callback for agent speaking events

#### Test Infrastructure
- **100% E2E Test Pass Rate (Issue #217)**: Comprehensive test suite improvements
- **Test Fixtures**: Reusable fixture system for consistent test setup
- **VAD Test Consolidation**: Reduced from 13 files to 6 files

### 🐛 Major Bug Fixes

- **Issue #190**: Fixed missing agent state handlers causing idle timeout failures ✅
- **Issue #222**: Fixed idle timeout reset when `startAudioCapture()` called (PR #227) ✅
- **Issue #223**: Fixed audio blocking state persistence across connection reinitialization ✅
- **Issue #228**: Gated audio event logs behind debug prop to reduce console noise ✅

### 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.5.0 --registry https://npm.pkg.github.com
```

### 📚 Documentation

- **[Changelog](./CHANGELOG.md)** - Complete list of all changes since v0.4.2
- **[Migration Guide](./MIGRATION.md)** - Step-by-step migration from v0.4.x
- **[API Reference](./API-REFERENCE.md)** - Complete API documentation
- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Integration patterns and examples
- **[Audio Buffer Management](./AUDIO-BUFFER-MANAGEMENT.md)** - TTS audio stream management guide

### 🔗 Related Issues

- Closes #190: Missing Agent State Handlers ✅ **RESOLVED**
- Closes #195: Remove isPlaybackActive and connectTextOnly ✅ **COMPLETE**
- Closes #198: Remove onAgentSilent Callback ✅ **COMPLETE**
- Closes #206: Lazy Initialization ✅ **COMPLETE**
- Closes #217: Achieve 100% E2E Test Pass Rate ✅ **COMPLETE**
- Closes #222: Reset Idle Timeout on startAudioCapture (PR #227) ✅ **RESOLVED**
- Closes #223: Preserve Audio Blocking State ✅ **RESOLVED**
- Closes #228: Gate Audio Event Logs Behind Debug Prop ✅ **RESOLVED**
- Closes #229: Preserve Audio Blocking State ✅ **RESOLVED**
- Closes #230: Achieve 100% E2E Test Pass Rate ✅ **COMPLETE**
- Closes #162: Remove Debug Methods from API ✅ **COMPLETE**
- Closes #158: Remove Redundant Microphone Control ✅ **COMPLETE**
- Closes #159: Remove Redundant Session Management ✅ **COMPLETE**
- Closes #157: TTS Methods Removal ✅ **COMPLETE**

### ⚠️ Migration Required

**This is a breaking release**. All users must review and update their code:

1. **Read the [Migration Guide](./MIGRATION.md)** before upgrading
2. **Replace `autoConnect`** with explicit `start()` calls
3. **Replace audio control methods** with `interruptAgent()`
4. **Update VAD event handling** to use specific callbacks
5. **Remove debug method calls** if used

### 🎯 What's Next

Future releases will continue to focus on:
- API stability and clarity
- Performance optimizations
- Enhanced developer experience
- Comprehensive test coverage

---

**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Registry**: GitHub Package Registry (`https://npm.pkg.github.com`)  
**Created**: TBD  
**Status**: Ready for GitHub Release Creation

