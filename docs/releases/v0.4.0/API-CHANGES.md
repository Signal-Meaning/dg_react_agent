# API Changes - v0.4.0

## Overview

This release adds **new features** while maintaining **full backward compatibility**. All existing APIs remain unchanged and functional.

## Component Props

### New Props Added
```typescript
interface DeepgramVoiceInteractionProps {
  // ... existing props remain unchanged
  
  // NEW: TTS Mute functionality
  ttsMuted?: boolean;                    // TTS mute state
  onTtsMuteToggle?: (isMuted: boolean) => void;  // Mute state change callback
  
  // NEW: VoiceAgent event hooks
  onAgentSpeaking?: () => void;          // Agent starts speaking
  onAgentSilent?: () => void;            // Agent finishes speaking
  onUserStoppedSpeaking?: () => void;    // User stops speaking
  onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
  onSpeechStarted?: (data: { channel: number[]; timestamp: number }) => void;
  onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
}
```

## Callback Functions

### New Callbacks Added
- **`onTtsMuteToggle`**: Called when TTS mute state changes
- **`onAgentSpeaking`**: Called when agent starts speaking (TTS begins)
- **`onAgentSilent`**: Called when agent finishes speaking (AgentAudioDone)
- **`onUserStoppedSpeaking`**: Called when user stops speaking (VAD/endpointing)
- **`onUtteranceEnd`**: Called when UtteranceEnd is detected from Deepgram's end-of-speech detection
- **`onSpeechStarted`**: Called when SpeechStarted is detected from Deepgram Transcription API
- **`onVADEvent`**: Called when VAD events are received from transcription service

### Existing Callbacks
- ✅ All existing callbacks remain unchanged
- ✅ No existing callbacks removed or deprecated

## State Interface

### New State Properties
```typescript
interface VoiceInteractionState {
  // ... existing state properties remain unchanged
  
  // NEW: TTS mute state
  ttsMuted: boolean;  // Current TTS mute state
}
```

### Existing State Properties
- ✅ All existing state properties remain unchanged
- ✅ No existing state properties removed or deprecated

## Methods

### New Methods Added
```typescript
interface DeepgramVoiceInteractionHandle {
  // ... existing methods remain unchanged
  
  // NEW: TTS mute control methods
  toggleTtsMute(): void;                    // Toggle TTS mute state
  setTtsMuted(muted: boolean): void;        // Set TTS mute state explicitly
}
```

### Existing Methods
- ✅ All existing methods remain unchanged
- ✅ No existing methods removed or deprecated

## Types

### New Types Added
```typescript
// TTS mute callback type
type TtsMuteToggleCallback = (isMuted: boolean) => void;

// VAD event data types
interface UtteranceEndData {
  channel: number[];
  lastWordEnd: number;
}

interface SpeechStartedData {
  channel: number[];
  timestamp: number;
}

interface VADEventData {
  speechDetected: boolean;
  confidence?: number;
  timestamp?: number;
}
```

### Existing Types
- ✅ All existing TypeScript types remain unchanged
- ✅ No existing types removed or deprecated

## Internal Changes

### Test Infrastructure
- **AudioManager Mock**: Added `setTtsMuted` method to test mocks
- **Mock Consistency**: Standardized mock implementations across test files
- **Test Coverage**: Enhanced test coverage for AudioManager functionality

### Build Process
- **Dependencies**: Updated 12 packages to latest versions
- **Validation**: Enhanced package validation process
- **Build Pipeline**: Improved build and packaging process

### Documentation
- **Release Process**: Added comprehensive release checklist
- **Documentation Standards**: Established documentation structure
- **Issue Templates**: Added GitHub issue template for releases

## Migration Guide

### No Migration Required
Since there are no breaking changes, no migration is required:

```typescript
// ✅ Existing code continues to work unchanged
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

const MyComponent = () => {
  return (
    <DeepgramVoiceInteraction
      apiKey="your-api-key"
      agentOptions={{
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
      }}
      onReady={() => console.log('Ready')}
      onError={(error) => console.error('Error:', error)}
    />
  );
};
```

### What's New
- Enhanced release process documentation
- Improved test coverage and reliability
- Better development workflow tools
- Comprehensive documentation standards

## Compatibility

### React Versions
- **React 16.8.0+**: Fully supported
- **React 17.x**: Fully supported
- **React 18.x**: Fully supported

### TypeScript
- **TypeScript 4.7+**: Fully supported
- **TypeScript 5.x**: Fully supported

### Node.js
- **Node.js 16+**: Fully supported
- **Node.js 18+**: Fully supported
- **Node.js 20+**: Fully supported

## Testing

### Test Coverage
- **Unit Tests**: Enhanced AudioManager mock coverage
- **Integration Tests**: Improved test reliability
- **E2E Tests**: All existing tests continue to pass

### Mock Updates
```typescript
// Updated AudioManager mock includes setTtsMuted method
AudioManager.mockImplementation(() => ({
  initialize: jest.fn().mockResolvedValue(),
  startRecording: jest.fn().mockResolvedValue(),
  stopRecording: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(mockUnsubscribe),
  dispose: jest.fn(),
  setTtsMuted: jest.fn() // ✅ Added in v0.4.0
}));
```

## Support

For questions about API changes:

- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check the [release documentation](./README.md)
- **Migration Guide**: See [migration documentation](../../migration/README.md)

---

**Next Steps**: See [EXAMPLES.md](./EXAMPLES.md) for usage examples and [MIGRATION.md](./MIGRATION.md) for migration guidance.
