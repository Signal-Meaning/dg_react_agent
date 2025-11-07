# API Changes: v0.6.0 to v0.6.1

## Overview

This is a **patch release** with **no API changes**. All existing APIs remain unchanged and fully backward compatible.

## No Breaking Changes

### Component Props
- ✅ All existing props remain unchanged
- ✅ All callback functions maintain the same signatures
- ✅ All state properties maintain the same structure

### Methods
- ✅ All public methods maintain the same signatures
- ✅ All return types remain unchanged
- ✅ All parameter types remain unchanged

### Types
- ✅ All TypeScript types remain unchanged
- ✅ All interfaces maintain the same structure
- ✅ All enums remain the same

## What's Improved (Internal)

### Transcript Handling
- **Internal**: Fixed interim transcripts not being reported via `onTranscriptUpdate` callback
- **Internal**: Improved real-time streaming approach for reliable interim transcript generation
- **Internal**: Consolidated audio helpers for better maintainability

### Test Infrastructure
- **Internal**: Removed window globals in favor of DOM-based test data
- **Internal**: Improved test-app microphone control logic
- **Internal**: Enhanced audio helper centralization and validation

### Documentation
- **Internal**: Updated interim transcript documentation
- **Internal**: Improved test documentation and audio sample guides

## Verification

### Component Usage
```tsx
// This code works exactly the same in v0.6.1
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function MyComponent() {
  return (
    <DeepgramVoiceInteraction
      apiKey="your-api-key"
      agentOptions={{
        language: 'en',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
      }}
      onTranscriptUpdate={(transcript) => {
        // Interim transcripts now properly reported
        console.log('Transcript:', transcript);
      }}
      onConnectionStateChange={(service, state) => {
        console.log(`${service}: ${state}`);
      }}
    />
  );
}
```

### Method Calls
```tsx
// All methods work exactly the same
const ref = useRef<DeepgramVoiceInteractionRef>(null);

// Connection methods
ref.current?.start({ agent: true, transcription: true });
ref.current?.stop();

// Audio methods
ref.current?.startAudioCapture();
ref.current?.stopRecording();
```

## Backward Compatibility

### Version Compatibility
- ✅ Compatible with v0.6.0
- ✅ Compatible with v0.5.x
- ✅ Compatible with v0.4.x
- ✅ Compatible with v0.3.x

### Migration Path
- **From v0.6.0**: No migration needed, direct update
- **From earlier versions**: No migration needed, direct update

## Support

For questions about API compatibility:

- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check the [release documentation](../README.md)
- **Changelog**: See [CHANGELOG.md](./CHANGELOG.md)

---

**Previous Version**: [v0.6.0 API Changes](../v0.6.0/API-CHANGES.md)  
**Full Documentation**: [docs/releases/v0.6.1/](./)  
**GitHub Repository**: [Signal-Meaning/dg_react_agent](https://github.com/Signal-Meaning/dg_react_agent)

