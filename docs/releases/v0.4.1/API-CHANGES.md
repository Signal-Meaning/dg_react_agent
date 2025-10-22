# API Changes: v0.4.0 to v0.4.1

## Overview

This is a **patch release** with no API changes. All existing APIs remain unchanged and backward compatible.

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

### Idle Timeout Management
- **Internal**: Improved idle timeout logic and race condition handling
- **Internal**: Better integration with Deepgram's end-of-speech detection
- **Internal**: Consolidated useEffect hooks for better maintainability

### Debug Logging
- **Internal**: VAD and keepalive logs now respect debug mode setting
- **Internal**: Reduced log noise in production environments

### Authentication
- **Internal**: Improved GitHub Package Registry authentication
- **Internal**: Enhanced debugging tools for authentication issues

### Test Infrastructure
- **Internal**: Improved test reliability and error handling
- **Internal**: Enhanced test coverage and stability

## Verification

### Component Usage
```tsx
// This code works exactly the same in v0.4.1
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
      onTtsMuteToggle={(muted) => console.log('TTS muted:', muted)}
      onAgentSpeaking={() => console.log('Agent speaking')}
      onAgentSilent={() => console.log('Agent silent')}
    />
  );
}
```

### Method Calls
```tsx
// All methods work exactly the same
const ref = useRef<DeepgramVoiceInteractionRef>(null);

// TTS mute methods
ref.current?.toggleTtsMute();
ref.current?.setTtsMuted(true);

// Audio control methods
ref.current?.interruptAgent();
ref.current?.resumeWithAudio();

// Connection methods
ref.current?.connectWithContext();
ref.current?.disconnect();
```

### State Access
```tsx
// All state properties remain the same
const [state, setState] = useState<VoiceInteractionState>();

// Access state properties
console.log(state.isReady);
console.log(state.isConnected);
console.log(state.ttsMuted);
console.log(state.agentState);
```

## TypeScript Support

### Type Definitions
- ✅ All existing types remain unchanged
- ✅ All interfaces maintain the same structure
- ✅ All enums remain the same
- ✅ No new types introduced
- ✅ No deprecated types

### Import Statements
```typescript
// These imports work exactly the same
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';
import type { 
  DeepgramVoiceInteractionRef,
  VoiceInteractionState,
  AgentOptions,
  TranscriptionOptions
} from '@signal-meaning/deepgram-voice-interaction-react';
```

## Backward Compatibility

### Version Compatibility
- ✅ Compatible with v0.4.0
- ✅ Compatible with v0.3.x
- ✅ Compatible with v0.2.x
- ✅ Compatible with v0.1.x

### Migration Path
- **From v0.4.0**: No migration needed, direct update
- **From v0.3.x**: No migration needed, direct update
- **From v0.2.x**: No migration needed, direct update
- **From v0.1.x**: No migration needed, direct update

## Support

For questions about API compatibility:

- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check the [release documentation](../README.md)
- **Migration Guide**: See [migration documentation](./MIGRATION.md)

---

**Previous Version**: [v0.4.0 API Changes](../v0.4.0/API-CHANGES.md)  
**Next Version**: TBD  
**Full Documentation**: [docs/releases/v0.4.1/](./)  
**GitHub Repository**: [Signal-Meaning/dg_react_agent](https://github.com/Signal-Meaning/dg_react_agent)
