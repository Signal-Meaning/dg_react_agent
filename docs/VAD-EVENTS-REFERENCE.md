# VAD Events Reference

This document provides a comprehensive reference for Voice Activity Detection (VAD) events in the DeepgramVoiceInteraction component, including the actual Deepgram API events and how they map to component callbacks.

## Deepgram API Events

The component receives VAD events from two Deepgram WebSocket services:

### Agent Service (wss://agent.deepgram.com/v1/agent/converse)

#### UserStartedSpeaking
- **Event Type**: `UserStartedSpeaking`
- **Component Callback**: `onUserStartedSpeaking()`
- **Data**: None
- **Purpose**: Indicates user has started speaking from agent perspective
- **When Triggered**: When the agent detects speech activity

#### UserStoppedSpeaking
- **Event Type**: `UserStoppedSpeaking`
- **Component Callback**: `onUserStoppedSpeaking(data)`
- **Data**: `{ timestamp?: number }`
- **Purpose**: Indicates user has stopped speaking from agent perspective
- **When Triggered**: When the agent detects speech has ended

### Transcription Service (wss://api.deepgram.com/v1/listen)

#### SpeechStarted
- **Event Type**: `SpeechStarted`
- **Component Callback**: `onUserStartedSpeaking()` (same as agent)
- **Data**: `{ channel: number[]; timestamp: number }`
- **Purpose**: Real-time voice activity detection from transcription service
- **When Triggered**: When `vad_events=true` is set in transcription options and speech begins
- **Configuration**: Requires `vad_events: true` in `transcriptionOptions`

#### SpeechStopped
- **Event Type**: `SpeechStopped`
- **Component Callback**: `onUserStoppedSpeaking(data)` (same as agent)
- **Data**: `{ channel: number[]; timestamp: number }`
- **Purpose**: Real-time voice activity detection from transcription service
- **When Triggered**: When `vad_events=true` is set in transcription options and speech ends
- **Configuration**: Requires `vad_events: true` in `transcriptionOptions`

#### UtteranceEnd
- **Event Type**: `UtteranceEnd`
- **Component Callback**: `onUtteranceEnd(data)`
- **Data**: `{ channel: number[]; lastWordEnd: number }`
- **Purpose**: End-of-speech detection based on word timing analysis
- **When Triggered**: When `utterance_end_ms` parameter is set and sufficient gap between words is detected
- **Configuration**: Requires `utterance_end_ms: number` in `transcriptionOptions`

## Component Configuration

### Enabling VAD Events

To receive VAD events from the transcription service, configure your component:

```typescript
<DeepgramVoiceInteraction
  transcriptionOptions={{
    vad_events: true,           // Enable SpeechStarted/SpeechStopped events
    utterance_end_ms: 1000,     // Enable UtteranceEnd events (1 second)
    // ... other options
  }}
  onUserStartedSpeaking={() => console.log('User started speaking')}
  onUserStoppedSpeaking={(data) => console.log('User stopped speaking:', data)}
  onUtteranceEnd={(data) => console.log('Utterance ended:', data)}
/>
```

### Event Redundancy

When both agent and transcription services are connected, you may receive multiple events for the same speech activity:

1. **Agent Service**: `UserStartedSpeaking` / `UserStoppedSpeaking`
2. **Transcription Service**: `SpeechStarted` / `SpeechStopped` (if `vad_events=true`)
3. **Transcription Service**: `UtteranceEnd` (if `utterance_end_ms` is set)

All events trigger the same callbacks (`onUserStartedSpeaking` / `onUserStoppedSpeaking`), so your application will receive multiple notifications for the same speech activity.

## Best Practices

### 1. Choose Primary Signal
For critical business logic, choose one primary signal:

```typescript
// Option 1: Use UtteranceEnd (most reliable)
<DeepgramVoiceInteraction
  onUtteranceEnd={handlePrimaryVAD}
  onUserStoppedSpeaking={handleSecondaryVAD} // For validation only
/>

// Option 2: Use Agent events (simplest)
<DeepgramVoiceInteraction
  onUserStartedSpeaking={handleUserStarted}
  onUserStoppedSpeaking={handleUserStopped}
/>
```

### 2. Handle Redundancy
If you need to handle multiple signals, implement deduplication:

```typescript
const [lastVADTime, setLastVADTime] = useState(0);

const handleUserStoppedSpeaking = useCallback((data) => {
  const now = Date.now();
  if (now - lastVADTime > 500) { // 500ms debounce
    setLastVADTime(now);
    // Handle the event
    console.log('User stopped speaking');
  }
}, [lastVADTime]);
```

### 3. Configuration Recommendations

For most applications, we recommend:

```typescript
const transcriptionOptions = {
  vad_events: true,           // Enable real-time VAD
  utterance_end_ms: 1000,     // Enable reliable end detection
  interim_results: true,      // Required for UtteranceEnd
  // ... other options
};
```

## Troubleshooting

### VAD Events Not Triggering

1. **Check Configuration**: Ensure `vad_events: true` is set in `transcriptionOptions`
2. **Check Connection**: Verify both agent and transcription services are connected
3. **Check Audio**: Ensure microphone is enabled and audio is being captured
4. **Check Logs**: Enable `debug={true}` to see WebSocket messages

### False Positives

- **SpeechStarted**: May be triggered by background noise
- **SpeechStopped**: May be triggered by brief pauses in speech
- **UtteranceEnd**: Most reliable, based on word timing analysis

### Performance Considerations

- Multiple VAD events can cause redundant processing
- Consider debouncing or throttling event handlers
- Use `UtteranceEnd` for critical timing-sensitive operations
