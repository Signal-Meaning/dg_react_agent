# Release Notes - v0.3.2

## 🎉 VAD Timeout Fix Release

**Release Date**: January 15, 2025  
**Version**: 0.3.2  
**Type**: Patch Release (Critical Bug Fix)

---

## 🐛 Critical Bug Fix

### VAD Timeout Issue Resolution

We've fixed a critical bug that was causing voice connections to timeout during active speech. This issue was affecting user experience and required external patching by the voice-commerce team.

**What was fixed:**
- VAD event handlers were missing crucial calls to `disableIdleTimeoutResets()`
- This caused WebSocket connections to timeout even while users were speaking
- Only the UtteranceEnd handler was working correctly

**What's now working:**
- ✅ UserStoppedSpeaking handler properly disables idle timeout resets
- ✅ VADEvent handler properly disables idle timeout resets  
- ✅ UtteranceEnd handler continues to work correctly
- ✅ All VAD events now prevent connection timeouts during speech

---

## 📝 Technical Details

### Changes Made

**File Modified**: `src/components/DeepgramVoiceInteraction/index.tsx`

**UserStoppedSpeaking Handler**:
```typescript
// Disable idle timeout resets to prevent connection timeout during speech
console.log('🎤 [VAD] UserStoppedSpeaking detected - disabling idle timeout resets to prevent connection timeout');

// Disable idle timeout resets for both services
if (agentManagerRef.current) {
  agentManagerRef.current.disableIdleTimeoutResets();
}
if (transcriptionManagerRef.current) {
  transcriptionManagerRef.current.disableIdleTimeoutResets();
}
```

**VADEvent Handler**:
```typescript
// Disable idle timeout resets to prevent connection timeout during speech
console.log('🎯 [VAD] VADEvent detected - disabling idle timeout resets to prevent connection timeout');

// Disable idle timeout resets for both services
if (agentManagerRef.current) {
  agentManagerRef.current.disableIdleTimeoutResets();
}
if (transcriptionManagerRef.current) {
  transcriptionManagerRef.current.disableIdleTimeoutResets();
}
```

### Testing

- Added comprehensive test coverage for VAD timeout behavior
- All regression tests pass
- No breaking changes introduced

---

## 🎯 Impact

### For Users
- **Improved Reliability**: Voice interactions no longer timeout during active speech
- **Better Experience**: Smoother voice conversations without unexpected disconnections
- **No Action Required**: This is a patch release with no breaking changes

### For Teams
- **No More Patching**: Voice-commerce team no longer needs to patch this issue
- **Reduced Support**: Fewer timeout-related support tickets
- **Improved Stability**: More reliable voice interaction components

---

## 🚀 Getting Started

### Installation

```bash
npm install deepgram-voice-interaction-react@0.3.2
```

### No Migration Required

This is a patch release with no breaking changes. Your existing code will continue to work without any modifications.

### Verification

To verify the fix is working, check your browser console for these log messages:
- `🎤 [VAD] UserStoppedSpeaking detected - disabling idle timeout resets to prevent connection timeout`
- `🎯 [VAD] VADEvent detected - disabling idle timeout resets to prevent connection timeout`

---

## 🔗 Related Information

- **GitHub Issue**: [#71](https://github.com/Signal-Meaning/dg_react_agent/issues/71)
- **Pull Request**: [#72](https://github.com/Signal-Meaning/dg_react_agent/pull/72)
- **Previous Version**: [v0.3.1](../v0.3.1/CHANGELOG.md)

---

## 📞 Support

If you encounter any issues with this release, please:

1. Check the [documentation](../../README.md)
2. Review the [migration guide](../v0.3.1/MIGRATION.md) if upgrading from an earlier version
3. Open an issue on [GitHub](https://github.com/Signal-Meaning/dg_react_agent/issues)

---

**Thank you for using Deepgram Voice Interaction React!** 🎤✨
