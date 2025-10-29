# Breaking Changes: v0.5.0 → v0.5.1

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Version**: 0.5.1

## 🚨 Critical: `start()` Method Behavior Change

### What Changed

The `start()` method behavior was changed to separate WebSocket connection from microphone recording.

**Before (v0.5.0)**:
- `start()` would:
  - Connect WebSocket(s)
  - Initialize AudioManager
  - **Start microphone recording** ✗ (automatic)

**After (v0.5.1)**:
- `start()` will:
  - Connect WebSocket(s)
  - Initialize AudioManager
  - **Does NOT start microphone recording** ✓ (must be done separately)

### Why the Change?

This change was made to:
1. **Separate concerns**: WebSocket connection is independent of microphone access
2. **Support text-only mode**: Allow text interactions without microphone permissions
3. **Align with Voice Agent API**: Connection and recording are separate operations
4. **Improve UX**: Users can connect without triggering browser mic permissions immediately

### Migration Required

If your code calls `start()` and expects it to start recording, you MUST update your code:

**Before (v0.5.0)**:
```tsx
const startInteraction = async () => {
  await voiceRef.current?.start();
  // Microphone automatically started
  console.log('Recording started'); // ✅ This worked
};
```

**After (v0.5.1)**:
```tsx
const startInteraction = async () => {
  await voiceRef.current?.start(); // Connects WebSocket only
  await voiceRef.current?.startAudioCapture(); // Must explicitly start recording
  console.log('Recording started'); // ✅ Now this works
};
```

### Alternative: Use `toggleMic()` for UI-driven Recording

If you're controlling recording through a UI toggle:

```tsx
const handleStart = async () => {
  await voiceRef.current?.start(); // Connect WebSocket
  // User clicks mic button, which calls toggleMic() internally
  // This triggers startAudioCapture() automatically
};

const handleMicToggle = async (enabled: boolean) => {
  // toggleMic is exposed via component state
  // When enabled=true, it automatically calls startAudioCapture()
  setMicEnabled(enabled);
};
```

### Impact Assessment

| Scenario | Impact | Migration Required |
|----------|--------|-------------------|
| **Text-only interactions** (no mic) | ✅ **Benefit** | No change needed |
| **Voice interactions** with explicit mic control | ✅ **Improved** | Add `startAudioCapture()` call |
| **Voice interactions** with UI toggle | ✅ **Improved** | No change (toggle handles it) |
| **Code expecting automatic recording** | ❌ **Breaking** | Must add `startAudioCapture()` |

### Detection

To detect if you're affected by this change, look for code patterns like:

```tsx
// ❌ This will break:
await voiceRef.current?.start();
// Expects microphone to start automatically

// ✅ This is correct:
await voiceRef.current?.start();
await voiceRef.current?.startAudioCapture(); // Explicit mic start
```

### Related Methods

- **`start()`**: Connects WebSockets, initializes AudioManager
- **`startAudioCapture()`**: Starts microphone recording (requires user permission)
- **`toggleMic(enabled)`**: UI-driven microphone control (calls `startAudioCapture()` internally)

### Additional Context

This change was introduced in Issue #157 as part of separating TTS methods from microphone control methods. See:
- `docs/issues/ISSUE-157-TTS-METHODS-REMOVAL.md`
- `src/types/index.ts` (lines 237-251) for updated JSDoc

### Compatibility

- **v0.5.0 → v0.5.1**: ⚠️ Breaking change (requires code update)
- **Upstream compatibility**: This is a **post-fork** change and does not affect upstream behavior
- **Future versions**: This new behavior will be maintained going forward

---

**Last Updated**: December 2024  
**Introduced in**: v0.5.1 (Issue #157)  
**Migration Priority**: **HIGH** (affects all voice interaction use cases)
