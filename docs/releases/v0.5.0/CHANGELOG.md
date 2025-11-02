# Changelog: v0.5.0

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: TBD  
**Previous Version**: v0.4.2

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 🔴 Breaking Changes

### Removed Callback: `onAgentSilent`

**Removed in**: v0.5.0 (Issue #198)

**Reason**: This callback fired on `AgentAudioDone` (TTS generation complete), NOT when playback completed. This was misleading - audio may still be playing for several seconds after TTS generation finishes.

**Migration**: Use `onPlaybackStateChange(false)` to detect when agent playback actually completes.

**Before**:
```tsx
<DeepgramVoiceInteraction
  onAgentSilent={() => {
    console.log('Agent finished speaking');
  }}
/>
```

**After**:
```tsx
<DeepgramVoiceInteraction
  onPlaybackStateChange={(isPlaying) => {
    if (!isPlaying) {
      console.log('Agent finished speaking');
    }
  }}
/>
```

**Note**: `AgentStoppedSpeaking` is not a real Deepgram event (Issue #198). Agent state transitions to `idle` via `onPlaybackStateChange(false)` when playback completes.

### Removed Props

- **`autoConnect`** - Automatic connection removed in favor of explicit control via `start()` method
- **`microphoneEnabled`** - Microphone state is now managed internally by the component
- **`onMicToggle`** - Replaced with `onConnectionStateChange` monitoring
- **`onVADEvent`** - Replaced with specific VAD callbacks (`onUserStartedSpeaking`, `onUserStoppedSpeaking`, `onUtteranceEnd`)
- **`onKeepalive`** - Internal implementation detail, not needed for integration
- **`agentMuted`** - Audio control simplified to `interruptAgent()` method
- **`onAgentMuteChange`** - Replaced with `onPlaybackStateChange(false)` for detecting when agent playback completes

### Removed Methods

- **`toggleMicrophone()`** - Microphone control is not a component responsibility
- **`resumeWithText()` / `resumeWithAudio()`** - Redundant with `start()` method
- **`connectWithContext()` / `connectTextOnly()`** - Redundant with `start()` method (Issue #195)
- **`toggleTtsMute()` / `setTtsMuted()`** - Replaced with `interruptAgent()` method
- **`agentMute()` / `agentUnmute()`** - Replaced with `interruptAgent()` method
- **`isPlaybackActive()`** - Removed (Issue #195), use `onPlaybackStateChange` callback pattern
- **`getConnectionStates()` / `getState()`** - Debug methods removed from public API (Issue #162)

### Changed Methods

- **`injectUserMessage()`** - Now async and returns `Promise<void>`, creates agent manager lazily if needed
- **`injectAgentMessage()`** - Deprecated, remains available but should use `injectMessage('agent', message)` instead

### API Simplification

The v0.5.0 release introduces significant API simplification focused on explicit control and reduced complexity:

- **Lazy Initialization (Issue #206)**: Removed automatic connection patterns. WebSocket managers are created lazily only when `start()` is called or user interacts (via `injectUserMessage()` or `startAudioCapture()`).
- **Unified Audio Control**: Consolidated multiple audio control methods into a single `interruptAgent()` method
- **Simplified Text Input**: Unified text injection patterns
- **Reduced API Surface**: Eliminated redundant props and methods

See [MIGRATION.md](./MIGRATION.md) for complete migration guide.

## ✨ Added

### New Features

- **Lazy Initialization (Issue #206)**: WebSocket managers and AudioManager are created lazily on first use, reducing unnecessary connections
- **Single WebSocket Architecture**: Unified WebSocket connection for both transcription and agent services
- **Enhanced VAD Events**: Specific callbacks for voice activity detection
  - `onUserStartedSpeaking` - Called when user starts speaking
  - `onUserStoppedSpeaking` - Called when user stops speaking
  - `onUtteranceEnd` - Called when utterance ends with word-level timing
  - `onAgentStartedSpeaking` - Called when agent starts speaking
- **`onSettingsApplied` Callback (Issue #162)**: New callback fired when settings are successfully applied to services
- **`allowAgent()` Method (Issue #195)**: New method to re-enable audio after calling `interruptAgent()`, enabling push-button mute scenarios
- **`startAudioCapture()` Method (Issue #206)**: New method for lazy microphone initialization. Triggers browser permission prompt and initializes AudioManager when user explicitly requests microphone access
- **`getAudioContext()` Method**: New method to access AudioContext for debugging/testing and browser autoplay policy compliance
- **`onUserMessage` Callback**: Dedicated callback for user messages received from the server

### New Props

- **`debug`**: Enable/disable debug logging
- **`onUserStartedSpeaking`**: Callback when user starts speaking
- **`onUserStoppedSpeaking`**: Callback when user stops speaking (triggered by endpointing)
- **`onAgentStartedSpeaking`**: Callback when agent starts speaking
- **`onUtteranceEnd`**: Callback when utterance ends with word-level timing data
- **`onUserMessage`**: Callback for user messages from server
- **`onSettingsApplied`**: Callback when settings are applied to services

## 🐛 Fixed

### Issue #190: Missing Agent State Handlers ✅ **RESOLVED**

**Problem**: Agent conversations failed due to missing state transition handlers, causing idle timeout to fire prematurely and close WebSocket connections before agent responses were received.

**Solution**: Implemented all agent state handlers:
- `AgentThinking` → `thinking` state (disables idle timeout)
- `AgentStartedSpeaking` → `speaking` state (disables idle timeout)
- Playback event fallback → ensures `speaking` state even if `AgentStartedSpeaking` message is delayed

**Impact**: Agent state now transitions properly (`idle → speaking → idle` for text input, `idle → listening → [thinking] → speaking → idle` for voice input), and idle timeout is correctly disabled during agent responses.

### Issue #222: Reset Idle Timeout When startAudioCapture() Called ✅ **RESOLVED** (PR #227)

**Problem**: Idle timeout was not reset when `startAudioCapture()` was called, causing premature disconnections.

**Solution**: Idle timeout now properly resets when microphone capture starts.

### Issue #223: Preserve Audio Blocking State ✅ **RESOLVED**

**Problem**: Audio blocking state (set by `interruptAgent()`) was not preserved when `start()` was called on an existing connection.

**Solution**: `allowAgentRef` blocking state is now preserved across connection reinitialization.

### Issue #228: Console Logging Improvements ✅ **RESOLVED**

**Problem**: Audio event logs were flooding console in production.

**Solution**: Audio event logs are now gated behind `debug` prop.

### Issue #217: E2E Test Suite Improvements ✅ **RESOLVED**

**Problem**: E2E tests had low pass rate and high maintenance burden.

**Solution**: 
- Achieved 100% E2E test pass rate
- Refactored tests with comprehensive fixtures
- Reduced test duplication
- Consolidated VAD tests from 13 files to 6 files
- Improved test maintainability and reliability

### Other Bug Fixes

- Fixed idle timeout during agent speech
- Fixed TTS mute state not respected during ongoing agent responses
- Fixed idle timeout synchronization between WebSocket services
- Fixed microphone button reconnection after connection timeout
- Fixed user injected messages not receiving proper responses
- Fixed VAD events re-enabling idle timeout resets inappropriately
- Fixed greeting re-issuance on WebSocket reconnection
- Fixed audio buffer management and memory leaks
- Fixed mute button pushbutton behavior to prevent accidental unmute
- Fixed test expectations and waiting logic
- Improved error handling and test reliability

## 🔄 Changed

### Architecture Changes

- **Single WebSocket Architecture**: Unified connection for transcription and agent services
- **Lazy Initialization**: Managers created on-demand rather than on mount
- **Explicit Control**: All services must be started via `start()` method calls
- **Simplified State Management**: Reduced internal state complexity

### Test Infrastructure

- **E2E Test Consolidation**: Reduced VAD tests from 13 files to 6 files
- **Test Fixtures**: Comprehensive fixture system for consistent test setup
- **Test Refactoring**: Removed waitForTimeout anti-patterns
- **Data-TestID Selectors**: Updated tests to use data-testid instead of fragile selectors (Issue #198)
- **Test App Updates**: Updated test-app to use lazy connection API

### Documentation

- Comprehensive migration guide added
- Complete API reference documentation
- Integration guide with examples
- Audio buffer management guide
- Development guide improvements
- Test utilities documentation

### Internal Improvements

- Reduced WebSocketManager idle timeout log clutter
- Enhanced error messages and logging
- Improved build process and validation
- Better dependency management
- Code cleanup and refactoring

## 📚 Documentation

- **[Migration Guide](./MIGRATION.md)** - Complete migration from v0.4.x
- **[API Reference](./API-REFERENCE.md)** - Full API documentation
- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Integration patterns and examples
- **[Audio Buffer Management](./AUDIO-BUFFER-MANAGEMENT.md)** - TTS audio stream management

## 🔗 Related Issues

- [#190](https://github.com/Signal-Meaning/dg_react_agent/issues/190): Missing Agent State Handlers ✅ **RESOLVED**
- [#195](https://github.com/Signal-Meaning/dg_react_agent/issues/195): Remove isPlaybackActive and connectTextOnly ✅ **COMPLETE**
- [#198](https://github.com/Signal-Meaning/dg_react_agent/issues/198): Remove onAgentSilent Callback ✅ **COMPLETE**
- [#206](https://github.com/Signal-Meaning/dg_react_agent/issues/206): Lazy Initialization ✅ **COMPLETE**
- [#217](https://github.com/Signal-Meaning/dg_react_agent/issues/217): Achieve 100% E2E Test Pass Rate ✅ **COMPLETE**
- [#222](https://github.com/Signal-Meaning/dg_react_agent/issues/222): Reset Idle Timeout on startAudioCapture ✅ **RESOLVED** (PR #227)
- [#223](https://github.com/Signal-Meaning/dg_react_agent/issues/223): Preserve Audio Blocking State ✅ **RESOLVED**
- [#228](https://github.com/Signal-Meaning/dg_react_agent/issues/228): Gate Audio Event Logs Behind Debug Prop ✅ **RESOLVED**
- [#229](https://github.com/Signal-Meaning/dg_react_agent/issues/229): Preserve Audio Blocking State ✅ **RESOLVED**
- [#230](https://github.com/Signal-Meaning/dg_react_agent/issues/230): Achieve 100% E2E Test Pass Rate ✅ **COMPLETE**
- [#162](https://github.com/Signal-Meaning/dg_react_agent/issues/162): Remove Debug Methods from API ✅ **COMPLETE**
- [#158](https://github.com/Signal-Meaning/dg_react_agent/issues/158): Remove Redundant Microphone Control ✅ **COMPLETE**
- [#159](https://github.com/Signal-Meaning/dg_react_agent/issues/159): Remove Redundant Session Management ✅ **COMPLETE**
- [#157](https://github.com/Signal-Meaning/dg_react_agent/issues/157): TTS Methods Removal ✅ **COMPLETE**

---

**Last Updated**: TBD  
**Component Version**: 0.5.0  
**React Version**: 16.8.0+
