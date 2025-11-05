# New Features - v0.6.0

## 🎤 Echo Cancellation Support

### Overview

v0.6.0 introduces comprehensive echo cancellation support through configurable audio constraints. This feature addresses common issues where agent TTS audio plays back through speakers and is picked up by the microphone, causing feedback loops and unwanted behavior.

### Key Benefits

- **Prevents Feedback Loops**: Agent TTS audio won't trigger the microphone
- **Improved Audio Quality**: Better voice interaction with noise suppression and auto gain control
- **Browser Compatibility**: Automatic detection of browser support with graceful fallbacks
- **Configurable**: Fine-tune audio constraints based on your application needs

### Phase 1: Echo Cancellation Detection

The component automatically detects browser support for echo cancellation and related audio processing features.

**Automatic Detection**:
- Detects if browser supports `echoCancellation`, `autoGainControl`, and `noiseSuppression` constraints
- Verifies if echo cancellation is actually active (not just supported)
- Provides browser information and limitations

**Usage**:
```typescript
import { EchoCancellationDetector } from '@signal-meaning/deepgram-voice-interaction-react';

// Detect echo cancellation support for a MediaStream
const support = await EchoCancellationDetector.detectSupport(stream);
console.log('Echo cancellation supported:', support.supported);
console.log('Echo cancellation active:', support.active);
console.log('Browser:', support.browser);
```

### Phase 2: Configurable Audio Constraints

You can now configure audio constraints directly via component props, giving you fine-grained control over audio processing.

**New Prop**: `audioConstraints`
```typescript
interface AudioConstraints {
  echoCancellation?: boolean;    // Enable/disable echo cancellation
  autoGainControl?: boolean;      // Enable/disable automatic gain control
  noiseSuppression?: boolean;     // Enable/disable noise suppression
  sampleRate?: number;            // Audio sample rate (8000-48000 Hz)
  channelCount?: number;         // Audio channels (1 or 2)
}
```

**Basic Usage**:
```typescript
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  audioConstraints={{
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true
  }}
  // ... other props
/>
```

**Advanced Usage with Validation**:
```typescript
import { AudioConstraintValidator } from '@signal-meaning/deepgram-voice-interaction-react';

// Validate constraints before use
const constraints = {
  echoCancellation: true,
  sampleRate: 48000,
  channelCount: 2
};

const validation = AudioConstraintValidator.validate(constraints);
if (validation.valid) {
  // Use constraints
} else {
  console.error('Validation errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}
```

### Browser Compatibility

The component automatically handles browser compatibility:

- **Chrome/Edge**: Full support for all audio constraints
- **Firefox**: Full support for all audio constraints
- **Safari**: Limited support (varies by version)
- **Fallback**: Component gracefully handles unsupported constraints

### Testing

Comprehensive E2E tests ensure echo cancellation works correctly:

- **Effectiveness Test**: Verifies agent TTS does not trigger the microphone
- **Constraint Validation**: Tests constraint application and browser compatibility
- **Browser Testing**: Tests across different browsers and versions

### Documentation

For detailed implementation information, see:
- [Echo Cancellation Plan](docs/issues/ISSUE-243-ECHO-CANCELLATION-PLAN.md)
- [API Changes](API-CHANGES.md)

### Example: Complete Echo Cancellation Setup

```typescript
import { useRef } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle } from '@signal-meaning/deepgram-voice-interaction-react';

function MyVoiceApp() {
  const ref = useRef<DeepgramVoiceInteractionHandle>(null);

  return (
    <DeepgramVoiceInteraction
      ref={ref}
      apiKey="your-api-key"
      audioConstraints={{
        echoCancellation: true,      // Prevent feedback loops
        autoGainControl: true,        // Automatic volume adjustment
        noiseSuppression: true,       // Reduce background noise
        sampleRate: 16000,            // Standard sample rate
        channelCount: 1               // Mono audio
      }}
      onConnectionStateChange={(state) => {
        console.log('Connection state:', state);
      }}
      onError={(error) => {
        console.error('Error:', error);
      }}
    />
  );
}
```

### Migration from Previous Versions

**No migration required!** Echo cancellation is opt-in and fully backward compatible:

- If you don't provide `audioConstraints`, the component behaves exactly as before
- Existing implementations continue to work without changes
- You can gradually adopt echo cancellation where needed

### Best Practices

1. **Enable Echo Cancellation**: Always enable `echoCancellation: true` when agent TTS audio plays through speakers
2. **Test in Target Browsers**: Verify echo cancellation works in your target browsers
3. **Handle Warnings**: Check validation warnings for unsupported constraints
4. **Monitor Effectiveness**: Use `EchoCancellationDetector` to verify echo cancellation is active

### Related Issues

- [Issue #243](https://github.com/Signal-Meaning/dg_react_agent/issues/243) - Echo cancellation implementation
- [Issue #239](https://github.com/Signal-Meaning/dg_react_agent/issues/239) - Audio track cleanup improvements
- [Issue #246](https://github.com/Signal-Meaning/dg_react_agent/issues/246) - MediaStream track cleanup

