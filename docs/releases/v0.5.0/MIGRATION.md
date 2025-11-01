# Migration Guide: v0.4.x → v0.5.0

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Version**: 0.5.0+

## 🎯 Overview

The v0.5.0 release introduces significant API changes focused on **simplification** and **explicit control**. This migration guide helps you transition from v0.4.x to the new, cleaner API.

### Key Changes Summary

- **Removed Auto-Connect**: No automatic connections on mount
- **Explicit Control**: All services must be started via one of the `start()` methods
- **Simplified Audio Control**: Unified `interruptAgent()` method replaces multiple audio controls
- **Enhanced VAD Events**: More specific callbacks replace generic `onVADEvent`
- **Session Management**: Optional session ID support for multi-session applications

---

## 🚀 Migration Steps

### 1. Control Pattern

**Before (v0.5.0)**:
```tsx
<DeepgramVoiceInteraction
  autoConnect={true}
  microphoneEnabled={true}
  onReady={(ready) => console.log('Ready:', ready)}
/>
```

**After (v0.5.0+)**:
```tsx
const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

const startInteraction = async () => {
  await voiceRef.current?.start();
};

<DeepgramVoiceInteraction
  ref={voiceRef}
  onReady={(ready) => console.log('Ready:', ready)}
/>
<button onClick={startInteraction}>Start Voice Interaction</button>
```

**Key Changes**:
- **No auto-connect**: Component doesn't connect automatically on mount
- **Explicit start**: Call `start()` when you want to begin voice interaction
- **Ref-based control**: Use refs to access component methods
- **User-initiated**: Start when text is sent or microphone button is pressed

### 2. Service Configuration

**Settings are sent to the agent service immediately after connection** - this rule applies to all start methods (`start()`, `startTranscription()`, `startAgent()`). The new methods guarantee this behavior to avoid errors. If you forget to provide the appropriate options props, `start()` can result in errors.

**Before (v0.5.0)**:
```tsx
// Auto-connect with immediate settings
<DeepgramVoiceInteraction
  autoConnect={true}
  agentOptions={agentOptions}
  transcriptionOptions={transcriptionOptions}
/>
```

**After (v0.5.0+)**:
```tsx
// Explicit control with immediate settings on start()
const startAll = async () => {
  await voiceRef.current?.start(); // Sends settings immediately
};

// Or start services individually
const startTranscription = async () => {
  await voiceRef.current?.startTranscription(); // Uses transcriptionOptions prop
};

const startAgent = async () => {
  await voiceRef.current?.startAgent(); // Uses agentOptions prop
};
```

### 3. Audio Control Simplification

**Before (v0.5.0)**:
```tsx
// Multiple audio control methods
<DeepgramVoiceInteraction
  agentMuted={isMuted}
  onAgentMuteChange={(muted) => setIsMuted(muted)}
/>

// Methods
voiceRef.current?.toggleTtsMute();
voiceRef.current?.agentMute();
voiceRef.current?.agentUnmute();
```

**After (v0.5.0+)**:
```tsx
// Unified audio control
const interruptAgent = () => {
  voiceRef.current?.interruptAgent(); // Stops audio and clears buffers
};

<DeepgramVoiceInteraction
  onAgentStartedSpeaking={() => setIsPlaying(true)}
  onPlaybackStateChange={(isPlaying) => {
    setIsPlaying(isPlaying);
    // This fires when playback actually completes - agent has truly stopped speaking
    if (!isPlaying) {
      // Agent playback finished
    }
  }}
/>
```

**Key Changes**:
- **Unified control**: `interruptAgent()` replaces all audio control methods
- **Buffer management**: Automatically clears Web Audio API buffers
- **Audio state management**: Use `onAgentStartedSpeaking` for TTS start and `onPlaybackStateChange(false)` for actual playback completion (when agent has stopped speaking). Note: `onAgentSilent` was removed (misleading - fired on TTS generation, not playback). `onAgentStoppedSpeaking` was never implemented - `AgentStoppedSpeaking` is not a real Deepgram event (Issue #198).

### 4. Context Preservation

**The component preserves conversation context across reconnections** - but only if session IDs are managed properly. Session IDs need to be an optional input for the start method calls.

**Before (v0.5.0)**:
```tsx
// Context was managed automatically
<DeepgramVoiceInteraction
  autoConnect={true}
  // Context preserved automatically
/>
```

**After (v0.5.0+)**:
```tsx
// Context preservation requires session management
const [sessionId, setSessionId] = useState<string | null>(null);

const startWithContext = async () => {
  const currentSessionId = sessionId || generateSessionId();
  setSessionId(currentSessionId);
  await voiceRef.current?.start();
  // Context is preserved using the session ID
};

// For multi-session applications
const switchSession = async (newSessionId: string) => {
  setSessionId(newSessionId);
  await voiceRef.current?.stop();
  await voiceRef.current?.start();
};
```

### 5. Simplified Session Management

**Session ID Support**: Session IDs can be provided to start method calls for applications with multiple sessions that can be switched.

**Implementation**:
```tsx
// Single session (automatic ID generation)
const startSingleSession = async () => {
  await voiceRef.current?.start(); // Generates session ID automatically
};

// Multi-session with explicit ID management
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

const startWithSession = async (sessionId?: string) => {
  const id = sessionId || generateSessionId();
  setCurrentSessionId(id);
  await voiceRef.current?.start();
  // Component uses the session ID for context preservation
};

const switchToSession = async (newSessionId: string) => {
  await voiceRef.current?.stop();
  setCurrentSessionId(newSessionId);
  await voiceRef.current?.start();
};
```

---

## 🔄 API Changes

### Removed Props

| Removed Prop | Replacement | Migration |
|--------------|-------------|-----------|
| `autoConnect` | Explicit `start()` calls | Call `start()` when needed |
| `microphoneEnabled` | Internal state management | Component manages microphone state |
| `onMicToggle` | `onConnectionStateChange` | Monitor connection state changes |
| `onVADEvent` | Specific VAD callbacks | Use `onUserStartedSpeaking`, `onUserStoppedSpeaking`, `onUtteranceEnd` |
| `onKeepalive` | Internal implementation | Not needed for integration |
| `agentMuted` | `interruptAgent()` method | Use `interruptAgent()` for audio control |
| `onAgentMuteChange` | `onPlaybackStateChange(false)` | Use `onPlaybackStateChange(false)` to detect when agent playback completes. Note: `onAgentSilent` was removed (misleading). `onAgentStoppedSpeaking` was never implemented - `AgentStoppedSpeaking` is not a real Deepgram event (Issue #198). |

### Removed Methods

| Removed Method | Replacement | Migration |
|----------------|-------------|-----------|
| `toggleMicrophone()` | Internal management | Component handles microphone state |
| `resumeWithText()` | `start()` + `injectMessage()` | Start service, then inject message |
| `resumeWithAudio()` | `start()` | Use `start()` method |
| `connectWithContext()` | `start()` with session ID | Pass session ID to `start()` |
| `connectTextOnly()` | `start()` | Use `start()` method |
| `toggleTtsMute()` | `interruptAgent()` | Use `interruptAgent()` for audio control |
| `setTtsMuted()` | `interruptAgent()` | Use `interruptAgent()` for audio control |
| `agentMute()` | `interruptAgent()` | Use `interruptAgent()` for audio control |
| `agentUnmute()` | `interruptAgent()` | Use `interruptAgent()` for audio control |
| `getConnectionStates()` | Internal debugging | Not available in public API |
| `getState()` | Internal debugging | Not available in public API |

### Renamed Methods

| Old Method | New Method | Migration |
|------------|------------|-----------|
| `injectAgentMessage(message)` | `injectMessage('agent', message)` | Update method calls |
| `injectUserMessage(message)` | `injectMessage('user', message)` | Update method calls |

---

## 📝 Complete Migration Example

### Before (v0.5.0)
```tsx
function VoiceApp() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  return (
    <DeepgramVoiceInteraction
      autoConnect={true}
      microphoneEnabled={true}
      agentMuted={isMuted}
      onMicToggle={(enabled) => setIsConnected(enabled)}
      onVADEvent={(event) => console.log('VAD:', event)}
      onAgentMuteChange={(muted) => setIsMuted(muted)}
    />
  );
}
```

### After (v0.5.0+)
```tsx
function VoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const startInteraction = async () => {
    await voiceRef.current?.start();
    setIsConnected(true);
  };

  const stopInteraction = async () => {
    await voiceRef.current?.stop();
    setIsConnected(false);
  };

  const interruptAgent = () => {
    voiceRef.current?.interruptAgent();
    setIsPlaying(false);
  };

  return (
    <div>
      <button onClick={startInteraction} disabled={isConnected}>
        Start Voice Interaction
      </button>
      <button onClick={stopInteraction} disabled={!isConnected}>
        Stop Voice Interaction
      </button>
      <button onClick={interruptAgent} disabled={!isPlaying}>
        Interrupt Agent
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        onConnectionStateChange={(service, state) => {
          if (service === 'agent') {
            setIsConnected(state === 'open');
          }
        }}
        onUserStartedSpeaking={() => console.log('User started speaking')}
        onUserStoppedSpeaking={() => console.log('User stopped speaking')}
        onAgentStartedSpeaking={() => setIsPlaying(true)}
        onPlaybackStateChange={(isPlaying) => setIsPlaying(isPlaying)}
        onUtteranceEnd={(data) => console.log('Utterance ended:', data.lastWordEnd)}
      />
    </div>
  );
}
```

---

## ⚠️ Breaking Changes Impact

### High Impact
- **Auto-connect removal**: Applications using auto-connect will need to implement explicit control
- **Audio control changes**: All audio control patterns need to be updated to use `interruptAgent()`

### Medium Impact
- **VAD event handling**: Update to use specific callbacks instead of generic `onVADEvent`
- **Method renames**: Update `injectAgentMessage` and `injectUserMessage` calls

### Low Impact
- **Session management**: Only affects multi-session applications
- **Debug methods**: Only affects debugging code

---

## 🧪 Testing Your Migration

1. **Remove auto-connect**: Ensure no automatic connections on mount
2. **Add explicit start**: Implement `start()` calls for voice interaction
3. **Update audio control**: Replace mute controls with `interruptAgent()`
4. **Test VAD events**: Verify new VAD callbacks work correctly
5. **Test session switching**: If using multiple sessions, test context preservation

---

## 📚 Related Documentation

- **[API Reference](./API-REFERENCE.md)** - Complete v0.5.0 API documentation
- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Integration patterns and examples
- **[Audio Buffer Management](./AUDIO-BUFFER-MANAGEMENT.md)** - TTS audio stream management

---

**Last Updated**: October 2025  
**Component Version**: 0.5.0+  
**React Version**: 16.8.0+
