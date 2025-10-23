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
- **Event Type**: `SpeechStarted` ✅ **REAL DEEPGRAM EVENT**
- **Component Callback**: `onUserStartedSpeaking()` (same as agent)
- **Data**: `{ channel: number[]; timestamp: number }`
- **Purpose**: Real-time voice activity detection from transcription service
- **When Triggered**: When `vad_events=true` is set in transcription options and speech begins
- **Configuration**: Requires `vad_events: true` in `transcriptionOptions`
- **Documentation**: [Deepgram Speech Started Documentation](https://developers.deepgram.com/docs/speech-started)

#### SpeechStopped
- **Event Type**: `SpeechStopped` ❌ **DOES NOT EXIST**
- **Status**: **Fictional Event** - This event is not part of the Deepgram API
- **Note**: Deepgram does not provide a "SpeechStopped" event. Use `UtteranceEnd` for speech end detection.

#### UtteranceEnd
- **Event Type**: `UtteranceEnd` ✅ **REAL DEEPGRAM EVENT**
- **Component Callback**: `onUtteranceEnd(data)`
- **Data**: `{ channel: number[]; lastWordEnd: number }`
- **Purpose**: End-of-speech detection based on word timing analysis
- **When Triggered**: When `utterance_end_ms` parameter is set and sufficient gap between words is detected
- **Configuration**: Requires `utterance_end_ms: number` and `interim_results: true` in `transcriptionOptions`
- **Documentation**: [Deepgram Utterance End Documentation](https://developers.deepgram.com/docs/understanding-end-of-speech-detection#using-utteranceend)

## Testing VAD Events

### Recommended Testing Approach

**Always test with real audio samples first** to ensure VAD events are properly triggered:

```javascript
// ✅ CORRECT: Use real audio samples
const { VADTestUtilities } = require('../utils/vad-test-utilities');
const vadUtils = new VADTestUtilities(page);

// Load and send real audio sample
await vadUtils.loadAndSendAudioSample('hello');

// Wait for real VAD events from Deepgram
const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
  'SpeechStarted',    // Real Deepgram event
  'UtteranceEnd'      // Real Deepgram event
], 5000);
```

### Why Real Audio Testing?

- **Synthetic audio often fails**: `AudioSimulator.simulateSpeech()` may not trigger VAD events
- **Real timing matters**: Pre-generated samples have proper silence padding (300ms + 2000ms)
- **Integration validation**: Tests the complete flow from audio → VAD → timeout management
- **Prevents false positives**: Synthetic tests might pass while real usage fails

### Available Audio Samples

Use these pre-generated samples for testing:

- `hello` - Short phrase (~2.6s total)
- `hello__how_are_you_today_` - Longer phrase (~3.8s total)
- `hello_there` - Medium phrase (~2.9s total)

Each sample includes:
- 300ms onset silence
- Actual speech content
- 2000ms offset silence

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
