# Changelog: v0.5.1

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: December 2024

## 🚨 Breaking Changes

### `start()` Method Behavior Change

**BREAKING**: The `start()` method no longer automatically starts microphone recording.

**What Changed**:
- `start()` now only connects WebSocket(s) and initializes AudioManager
- Recording must be started separately via `startAudioCapture()` or `toggleMic()`

**Why**:
- Separates WebSocket connection from microphone control
- Supports text-only interactions without microphone permissions
- Aligns with Voice Agent API architecture

**Migration**:
```tsx
// Before (v0.5.0)
await voiceRef.current?.start(); // Also started recording

// After (v0.5.1)
await voiceRef.current?.start(); // Connects WebSocket only
await voiceRef.current?.startAudioCapture(); // Starts recording separately
```

See [BREAKING-CHANGES.md](./BREAKING-CHANGES.md) for complete migration guide.

---

## 🐛 Bug Fixes

### Issue #190: Missing Agent State Handlers
- Fixed premature idle timeouts causing WebSocket closures
- Agent state transitions now properly handled:
  - `AgentThinking` → `thinking` state
  - `AgentStartedSpeaking` → `speaking` state
  - `AgentAudioDone` → transitions to idle when audio playback completes
- Added comprehensive logging for debugging agent state transitions

### Issue #157: TTS Methods Removal
- Completed refactoring of TTS mute/unmute methods
- Separated microphone control from TTS audio playback
- TTS audio can play without microphone being active
- Text-input auto-connect properly creates AudioManager lazily for TTS

### Idle Timeout Fixes
- Fixed `InjectUserMessage` not resetting idle timeout
- Added `InjectUserMessage` to meaningful user activity types
- WebSocket now stays connected during active conversations

### Auto-Connect Improvements
- Auto-connect now properly sends settings after connection
- Duplicate settings sending eliminated
- Context preservation verified during reconnection

---

## ✨ New Features

None in this release (focus on bug fixes and breaking change migration).

---

## 🔧 Improvements

### E2E Test Refactoring
- Consolidated text message flow tests into `text-session-flow.spec.js`
- Created unified test helpers for common patterns:
  - `waitForAgentResponse()`
  - `disconnectComponent()`
  - `getAgentState()`
  - `verifyContextPreserved()`
  - `sendMessageAndWaitForResponse()`
  - `connectViaTextAndWaitForGreeting()`
- Audio interruption tests now use text-input auto-connect consistently
- Removed redundant tests and improved test reliability

### Code Quality
- Removed invalid `AgentStoppedSpeaking` handler (not a real Deepgram event)
- Added defensive checks for AudioContext initialization
- Improved error handling and logging throughout component
- Better separation of concerns between WebSocket and audio management

---

## 📚 Documentation

- Created comprehensive breaking changes guide
- Updated API documentation with new `start()` behavior
- Added JSDoc warnings for breaking changes
- Improved inline code comments and explanations

---

## 🔗 Related Issues

- [#190](https://github.com/Signal-Meaning/dg_react_agent/issues/190): Missing Agent State Handlers ✅ **RESOLVED** (was blocking #157)
- [#157](https://github.com/Signal-Meaning/dg_react_agent/issues/157): TTS Methods Removal ✅ **COMPLETE** (blocker resolved)

---

## ⚠️ Known Issues

- Issue #190 regression identified and fixed in this release
- Some E2E tests may be flaky due to LLM response variability
- Context preservation works but may need session ID management for multi-session apps

---

## 📦 Dependencies

No dependency changes.

---

**Full Migration Guide**: See [BREAKING-CHANGES.md](./BREAKING-CHANGES.md)  
**API Reference**: See [../v0.5.0/API-REFERENCE.md](../v0.5.0/API-REFERENCE.md)
