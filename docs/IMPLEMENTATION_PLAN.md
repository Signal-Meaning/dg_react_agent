# Implementation Plan: Welcome-First Voice Agent

## Overview

This document provides a detailed implementation plan for adding welcome-first behavior to the `dg_react_agent` package, based on the comprehensive proposal and product specification.

## Implementation Strategy

### Phase 1: Core Component Modifications

#### 1.1 Update DeepgramVoiceInteractionProps Interface

**File**: `src/types/index.ts` or main component file

```typescript
interface DeepgramVoiceInteractionProps {
  // ... existing props ...
  
  /**
   * If true (default), automatically connect and send greeting via Settings.
   * The microphone remains off until toggled explicitly.
   */
  welcomeFirst?: boolean;

  /** Whether mic is enabled (controlled or initial state) */
  microphoneEnabled?: boolean;
  /** Called when mic is toggled on/off */
  onMicToggle?: (enabled: boolean) => void;

  /** Called when server's Welcome event arrives */
  onWelcomeReceived?: () => void;
  /** Called when the greeting TTS begins */
  onGreetingStarted?: () => void;
  /** Called when the greeting TTS completes (AgentAudioDone) */
  onGreetingComplete?: () => void;
}
```

#### 1.2 Add Internal State Management

**File**: `src/components/DeepgramVoiceInteraction/index.tsx`

```typescript
// Add to component state
const [micEnabledInternal, setMicEnabledInternal] = useState<boolean>(false);
const [hasSentSettings, setHasSentSettings] = useState<boolean>(false);
const [welcomeReceived, setWelcomeReceived] = useState<boolean>(false);
const [greetingInProgress, setGreetingInProgress] = useState<boolean>(false);
const [greetingStarted, setGreetingStarted] = useState<boolean>(false);
```

#### 1.3 Modify Initialization Logic

**File**: `src/components/DeepgramVoiceInteraction/index.tsx`

```typescript
useEffect(() => {
  // If welcome-first behavior, auto connect on mount
  if (props.welcomeFirst !== false) {
    agentManagerRef.current?.connect();
  }
}, [/* dependencies */]);
```

#### 1.4 Update Settings Sending Logic

**File**: `src/components/DeepgramVoiceInteraction/index.tsx`

```typescript
// In connection/onOpen callback
if (!hasSentSettings) {
  const settingsPayload = buildSettings(/* existing options */);
  
  // Include greeting for welcome-first mode
  if (props.welcomeFirst !== false && props.agentOptions?.greeting) {
    settingsPayload.agent = settingsPayload.agent || {};
    settingsPayload.agent.greeting = props.agentOptions.greeting;
  }
  
  agentManagerRef.current?.sendSettings(settingsPayload);
  setHasSentSettings(true);
}
```

#### 1.5 Add Microphone Control Logic

**File**: `src/components/DeepgramVoiceInteraction/index.tsx`

```typescript
// Only start audio if mic has been toggled on
if (micEnabledInternal) {
  audioManagerRef.current?.startRecording();
}

// Add effect to respond to prop changes
useEffect(() => {
  if (props.microphoneEnabled !== undefined && props.microphoneEnabled !== micEnabledInternal) {
    toggleMic(props.microphoneEnabled);
  }
}, [props.microphoneEnabled]);

function toggleMic(enable: boolean) {
  if (enable) {
    if (!hasSentSettings) {
      console.warn("[DeepgramVoiceInteraction] Trying to enable mic before settings applied.");
      return;
    }
    audioManagerRef.current?.startRecording();
    setMicEnabledInternal(true);
    props.onMicToggle?.(true);
  } else {
    audioManagerRef.current?.stopRecording();
    setMicEnabledInternal(false);
    props.onMicToggle?.(false);
  }
}
```

### Phase 2: Message Handling Updates

#### 2.1 Update Agent Message Handler

**File**: `src/components/DeepgramVoiceInteraction/index.tsx`

```typescript
switch (msg.type) {
  case "Welcome":
    if (!welcomeReceived) {
      setWelcomeReceived(true);
      props.onWelcomeReceived?.();
      setGreetingInProgress(true);
    }
    break;

  case "AgentStartedSpeaking":
    if (greetingInProgress && !greetingStarted) {
      setGreetingStarted(true);
      props.onGreetingStarted?.();
    }
    // existing code: start playback etc.
    break;

  case "AgentAudioDone":
    if (greetingInProgress) {
      props.onGreetingComplete?.();
      setGreetingInProgress(false);
      setGreetingStarted(false);
    }
    // existing logic
    break;

  case "UserStartedSpeaking":
    // Handle barge-in during greeting
    if (micEnabledInternal && greetingInProgress) {
      audioPlayerRef.current?.abortPlayback();
      props.onGreetingComplete?.();
      setGreetingInProgress(false);
      setGreetingStarted(false);
    }
    // proceed with user capture logic
    break;
}
```

### Phase 3: Audio Management Updates

#### 3.1 Add Playback Abort Functionality

**File**: `src/utils/audio/AudioManager.ts` (or similar)

```typescript
class AudioManager {
  // existing fields...

  abortPlayback() {
    // stop current source(s)
    if (this.currentSource) {
      this.currentSource.stop();
    }
    // clear any queued buffers
    this.queue = [];
  }
}
```

#### 3.2 Modify Microphone Control

**File**: `src/utils/audio/AudioManager.ts`

```typescript
// Separate initialization from capturing
initialize() {
  // setup audio context, permissions, etc.
  // but don't start capturing yet
}

startCapturing() {
  // only called when mic is enabled
  this.requestMicPermission();
  this.captureStream = getUserMedia(...);
  this.processor = ...
  this.sendAudioLoop();
}
```

### Phase 4: Test App Updates

#### 4.1 Update Demo/Test App

**File**: `src/test-app/App.tsx` (or similar)

```typescript
<DeepgramVoiceInteraction
  apiKey={...}
  transcriptionOptions={...}
  agentOptions={{
    greeting: "Hello! How can I help you today?",
    instructions: "...",
    voice: "...",
  }}
  welcomeFirst={true}
  onWelcomeReceived={() => console.log("Welcome received")}
  onGreetingStarted={() => console.log("Greeting started")}
  onGreetingComplete={() => console.log("Greeting complete")}
  onMicToggle={(enabled) => console.log("Mic toggled:", enabled)}
  // other existing callbacks...
/>
<button onClick={() => toggle mic via props or ref}>Toggle Mic</button>
```

### Phase 5: Testing Strategy

#### 5.1 Unit Tests

**File**: `tests/welcome-first.test.js`

```javascript
describe('Welcome-First Behavior', () => {
  test('should auto-connect when welcomeFirst is true', () => {
    // Test auto-connection logic
  });
  
  test('should send greeting automatically', () => {
    // Test greeting flow
  });
  
  test('should handle microphone toggle', () => {
    // Test mic control
  });
  
  test('should support barge-in during greeting', () => {
    // Test interruption logic
  });
});
```

#### 5.2 Integration Tests

**File**: `tests/integration.test.js`

```javascript
describe('Welcome-First Integration', () => {
  test('should complete full welcome flow', async () => {
    // Test complete flow from mount to greeting
  });
  
  test('should handle text input without microphone', () => {
    // Test text-only mode
  });
});
```

## Implementation Timeline

### Week 1: Core Modifications
- [ ] Update props interface and types
- [ ] Add internal state management
- [ ] Modify initialization logic
- [ ] Update settings sending

### Week 2: Message Handling
- [ ] Update agent message handler
- [ ] Add greeting state management
- [ ] Implement barge-in logic
- [ ] Add callback support

### Week 3: Audio Management
- [ ] Add playback abort functionality
- [ ] Modify microphone control
- [ ] Separate initialization from capturing
- [ ] Test audio state management

### Week 4: Testing & Integration
- [ ] Update test app
- [ ] Add comprehensive unit tests
- [ ] Add integration tests
- [ ] End-to-end testing

## Success Criteria

- ✅ Agent greets user automatically on mount
- ✅ Microphone disabled by default
- ✅ User can toggle microphone on/off
- ✅ Text input works without microphone
- ✅ User can interrupt agent speech
- ✅ All existing functionality preserved
- ✅ Comprehensive test coverage
- ✅ Backward compatibility maintained

## Risk Mitigation

1. **Backward Compatibility**: Keep existing behavior as default
2. **Gradual Implementation**: Implement features incrementally
3. **Comprehensive Testing**: Test all edge cases and race conditions
4. **Fallback Behavior**: Graceful degradation if auto-start fails
5. **State Management**: Careful handling of state transitions

## Notes

- This implementation follows the detailed proposal in `docs/proposal`
- All changes target the `dg_react_agent` module only
- The implementation preserves existing API compatibility
- Focus on robust state management and error handling

