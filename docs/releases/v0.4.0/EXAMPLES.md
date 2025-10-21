# Usage Examples - v0.4.0

## Basic Usage

### Simple Voice Interaction
```typescript
import React from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

const MyVoiceApp = () => {
  return (
    <DeepgramVoiceInteraction
      apiKey="your-deepgram-api-key"
      agentOptions={{
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
      }}
      onReady={() => console.log('Voice interaction ready')}
      onError={(error) => console.error('Error:', error)}
    />
  );
};

export default MyVoiceApp;
```

### With Custom Configuration
```typescript
import React from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

const AdvancedVoiceApp = () => {
  const handleReady = () => {
    console.log('Voice interaction is ready');
  };

  const handleError = (error) => {
    console.error('Voice interaction error:', error);
  };

  const handleAgentStartedSpeaking = () => {
    console.log('Agent started speaking');
  };

  const handleAgentStoppedSpeaking = () => {
    console.log('Agent stopped speaking');
  };

  return (
    <DeepgramVoiceInteraction
      apiKey="your-deepgram-api-key"
      agentOptions={{
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.',
        greeting: 'Hello! How can I help you today?'
      }}
      autoConnect={true}
      microphoneEnabled={true}
      onReady={handleReady}
      onError={handleError}
      onAgentStartedSpeaking={handleAgentStartedSpeaking}
      onAgentStoppedSpeaking={handleAgentStoppedSpeaking}
    />
  );
};

export default AdvancedVoiceApp;
```

## Advanced Usage

### With State Management
```typescript
import React, { useState, useRef } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

const StatefulVoiceApp = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const voiceRef = useRef(null);

  const handleReady = () => {
    setIsConnected(true);
    console.log('Voice interaction ready');
  };

  const handleError = (error) => {
    console.error('Error:', error);
    setIsConnected(false);
  };

  const handleAgentStartedSpeaking = () => {
    setIsSpeaking(true);
  };

  const handleAgentStoppedSpeaking = () => {
    setIsSpeaking(false);
  };

  const handleTranscript = (transcript) => {
    setTranscript(transcript);
  };

  const toggleMute = () => {
    if (voiceRef.current) {
      voiceRef.current.toggleTtsMute();
    }
  };

  return (
    <div>
      <h1>Voice Interaction App</h1>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Speaking: {isSpeaking ? 'Yes' : 'No'}</p>
      <p>Transcript: {transcript}</p>
      <button onClick={toggleMute}>Toggle Mute</button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey="your-deepgram-api-key"
        agentOptions={{
          language: 'en',
          listenModel: 'nova-2',
          thinkProviderType: 'open_ai',
          thinkModel: 'gpt-4o-mini',
          voice: 'aura-asteria-en',
          instructions: 'You are a helpful assistant.'
        }}
        onReady={handleReady}
        onError={handleError}
        onAgentStartedSpeaking={handleAgentStartedSpeaking}
        onAgentStoppedSpeaking={handleAgentStoppedSpeaking}
        onTranscript={handleTranscript}
      />
    </div>
  );
};

export default StatefulVoiceApp;
```

### With Custom Styling
```typescript
import React from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';
import './VoiceApp.css';

const StyledVoiceApp = () => {
  return (
    <div className="voice-app">
      <h1>My Voice App</h1>
      <div className="voice-container">
        <DeepgramVoiceInteraction
          apiKey="your-deepgram-api-key"
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
      </div>
    </div>
  );
};

export default StyledVoiceApp;
```

## Migration Examples

### From v0.3.x to v0.4.0
```typescript
// ✅ No changes required - existing code works unchanged
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

// This code works in both v0.3.x and v0.4.0
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

## Best Practices

### Error Handling
```typescript
const handleError = (error) => {
  console.error('Voice interaction error:', error);
  
  // Handle specific error types
  if (error.type === 'AUTHENTICATION_ERROR') {
    // Handle authentication errors
    console.error('Authentication failed. Please check your API key.');
  } else if (error.type === 'NETWORK_ERROR') {
    // Handle network errors
    console.error('Network error. Please check your connection.');
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
};
```

### State Management
```typescript
const [voiceState, setVoiceState] = useState({
  isReady: false,
  isConnected: false,
  isSpeaking: false,
  isListening: false,
  transcript: '',
  error: null
});

const handleReady = () => {
  setVoiceState(prev => ({ ...prev, isReady: true }));
};

const handleError = (error) => {
  setVoiceState(prev => ({ ...prev, error, isReady: false }));
};
```

### Cleanup
```typescript
useEffect(() => {
  return () => {
    // Cleanup when component unmounts
    if (voiceRef.current) {
      voiceRef.current.disconnect();
    }
  };
}, []);
```

## Common Patterns

### Toggle Microphone
```typescript
const toggleMicrophone = () => {
  if (voiceRef.current) {
    voiceRef.current.toggleMicrophone();
  }
};
```

### TTS Mute Control
```typescript
// Toggle TTS mute
const toggleTtsMute = () => {
  if (voiceRef.current) {
    voiceRef.current.toggleTtsMute();
  }
};

// Set TTS mute state explicitly
const setTtsMuted = (muted: boolean) => {
  if (voiceRef.current) {
    voiceRef.current.setTtsMuted(muted);
  }
};

// React to mute state changes
const handleTtsMuteToggle = (isMuted: boolean) => {
  console.log('TTS muted:', isMuted);
  setMuteButtonText(isMuted ? '🔇 MUTED' : '🔊 ENABLED');
};
```

### VoiceAgent Event Hooks
```typescript
// Agent speaking events
const handleAgentSpeaking = () => {
  console.log('Agent started speaking');
  setAgentStatus('Speaking...');
};

const handleAgentSilent = () => {
  console.log('Agent finished speaking');
  setAgentStatus('Listening...');
};

// User speech events
const handleUserStoppedSpeaking = () => {
  console.log('User stopped speaking');
  setUserStatus('Processing...');
};

// VAD events with data
const handleUtteranceEnd = (data) => {
  console.log('Utterance ended:', data);
  // data: { channel: number[]; lastWordEnd: number }
};

const handleSpeechStarted = (data) => {
  console.log('Speech started:', data);
  // data: { channel: number[]; timestamp: number }
};

const handleVADEvent = (data) => {
  console.log('VAD event:', data);
  // data: { speechDetected: boolean; confidence?: number; timestamp?: number }
};
```

### Get Connection Status
```typescript
const getConnectionStatus = () => {
  if (voiceRef.current) {
    const status = voiceRef.current.getConnectionStatus();
    console.log('Connection status:', status);
  }
};
```

## Testing Examples

### Unit Testing
```typescript
import { render, screen } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

// Mock the AudioManager
jest.mock('@signal-meaning/deepgram-voice-interaction-react', () => ({
  AudioManager: jest.fn(() => ({
    initialize: jest.fn().mockResolvedValue(),
    setTtsMuted: jest.fn(),
    addEventListener: jest.fn(() => () => {}),
    dispose: jest.fn()
  }))
}));

test('renders voice interaction component', () => {
  render(
    <DeepgramVoiceInteraction
      apiKey="test-api-key"
      agentOptions={{
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
      }}
    />
  );
  
  // Your test assertions here
});
```

## Troubleshooting

### Common Issues
1. **API Key Issues**: Ensure your Deepgram API key is valid
2. **Network Issues**: Check your internet connection
3. **Browser Compatibility**: Ensure you're using a supported browser
4. **Microphone Permissions**: Ensure microphone access is granted

### Debug Mode
```typescript
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
  debug={true} // Enable debug mode
  onReady={() => console.log('Ready')}
  onError={(error) => console.error('Error:', error)}
/>
```

---

**Next Steps**: See [API-CHANGES.md](./API-CHANGES.md) for detailed API changes and [MIGRATION.md](./MIGRATION.md) for migration guidance.
