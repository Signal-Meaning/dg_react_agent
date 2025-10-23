# API Reference

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Version**: 0.5.0+

> **Simplified API Design**: Redundant APIs have been removed to reduce confusion and complexity.

## 📋 Table of Contents

1. [Component Props](#component-props)
2. [Component Methods](#component-methods)
3. [Type Definitions](#type-definitions)
4. [Event Callbacks](#event-callbacks)
5. [State Management](#state-management)
6. [Integration Examples](#integration-examples)

---

## Component Props

### `DeepgramVoiceInteractionProps`

```tsx
interface DeepgramVoiceInteractionProps {
  // Required
  apiKey: string;
  
  // Service Configuration
  transcriptionOptions?: TranscriptionOptions;
  agentOptions?: AgentOptions;
  endpointConfig?: EndpointConfig;
  
  // Event Callbacks
  onReady?: (isReady: boolean) => void;
  onConnectionStateChange?: (service: ServiceType, state: ConnectionState) => void;
  onTranscriptUpdate?: (transcriptData: TranscriptResponse) => void;
  onAgentStateChange?: (state: AgentState) => void;
  onAgentUtterance?: (utterance: LLMResponse) => void;
  onUserMessage?: (message: UserMessageResponse) => void;
  onAgentAudioStateChange?: (isPlaying: boolean) => void;
  
  // Deprecated - use onAgentAudioStateChange instead
  /** @deprecated Use onAgentAudioStateChange instead */
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  
  // Voice Activity Detection
  onUserStartedSpeaking?: () => void;
  onUserStoppedSpeaking?: () => void;
  onAgentStartedSpeaking?: () => void;
  onAgentStoppedSpeaking?: () => void;
  onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
  
  // Deprecated - use onAgentStartedSpeaking/onAgentStoppedSpeaking instead
  /** @deprecated Use onAgentStartedSpeaking instead */
  onAgentSpeaking?: () => void;
  /** @deprecated Use onAgentStoppedSpeaking instead */
  onAgentSilent?: () => void;
  
  // Error Handling
  onError?: (error: DeepgramError) => void;
  
  // Sleep Configuration
  sleepOptions?: {
    autoSleep?: boolean;
    timeout?: number;
    wakeWords?: string[];
  };
  
  // Debug
  debug?: boolean;
}
```

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `apiKey` | `string` | Deepgram API key for authentication |

### Service Configuration

| Prop | Type | Description |
|------|------|-------------|
| `transcriptionOptions` | `TranscriptionOptions?` | Configuration for transcription service |
| `agentOptions` | `AgentOptions?` | Configuration for agent service |
| `endpointConfig` | `EndpointConfig?` | Custom endpoint URLs |

### Event Callbacks

#### Connection Events
| Prop | Type | Description |
|------|------|-------------|
| `onReady` | `(isReady: boolean) => void` | Called when component is ready |
| `onConnectionStateChange` | `(service: ServiceType, state: ConnectionState) => void` | Called when connection state changes |

#### Transcription Events
| Prop | Type | Description |
|------|------|-------------|
| `onTranscriptUpdate` | `(transcriptData: TranscriptResponse) => void` | Called when transcript is received |

#### Agent Events
| Prop | Type | Description |
|------|------|-------------|
| `onAgentStateChange` | `(state: AgentState) => void` | Called when agent state changes |
| `onAgentUtterance` | `(utterance: LLMResponse) => void` | Called when agent produces text |
| `onUserMessage` | `(message: UserMessageResponse) => void` | Called when user message is received |
| `onAgentAudioStateChange` | `(isPlaying: boolean) => void` | Called when agent TTS audio state changes |

#### Voice Activity Detection Events
| Prop | Type | Description |
|------|------|-------------|
| `onUserStartedSpeaking` | `() => void` | Called when user starts speaking |
| `onUserStoppedSpeaking` | `() => void` | Called when user stops speaking (triggered by endpointing) |
| `onAgentStartedSpeaking` | `() => void` | Called when agent starts speaking (simplifies `onAgentStateChange` + `onAgentAudioStateChange`) |
| `onAgentStoppedSpeaking` | `() => void` | Called when agent stops speaking (simplifies `onAgentStateChange` + `onAgentAudioStateChange`) |
| `onUtteranceEnd` | `(data: { channel: number[]; lastWordEnd: number }) => void` | Called when utterance ends (word-timing based) |

#### Error Handling
| Prop | Type | Description |
|------|------|-------------|
| `onError` | `(error: DeepgramError) => void` | Called when error occurs |

---

## Component Methods

### `DeepgramVoiceInteractionHandle`

Access methods through a ref:

```tsx
const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

// Access methods
voiceRef.current?.start();
voiceRef.current?.stop();
```

### Control Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `start` | None | `Promise<void>` | Start all configured services (transcription + agent) |
| `stop` | None | `Promise<void>` | Stop all services and connections |

### Agent Control Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `interruptAgent` | None | `void` | Interrupt agent while speaking |
| `sleep` | None | `void` | Put agent to sleep |
| `wake` | None | `void` | Wake agent from sleep |
| `toggleSleep` | None | `void` | Toggle between sleep and wake |
| `updateAgentInstructions` | `UpdateInstructionsPayload` | `void` | Update agent instructions |
| `injectAgentMessage` | `message: string` | `void` | Inject message to agent |
| `injectUserMessage` | `message: string` | `void` | Inject user message to agent |

---

## Deprecated APIs

The following APIs are deprecated and will be removed in a future version. Please update your code to use the recommended alternatives:

### Deprecated Props

| Deprecated Prop | Recommended Alternative | Migration |
|----------------|------------------------|-----------|
| `onPlaybackStateChange` | `onAgentAudioStateChange` | Rename the prop and update any references |
| `onAgentSpeaking` | `onAgentStartedSpeaking` | Rename the prop and update any references |
| `onAgentSilent` | `onAgentStoppedSpeaking` | Rename the prop and update any references |

**Migration Examples:**
```tsx
// Before (deprecated)
<DeepgramVoiceInteraction
  onPlaybackStateChange={(isPlaying) => console.log('Playing:', isPlaying)}
  onAgentSpeaking={() => console.log('Agent speaking')}
  onAgentSilent={() => console.log('Agent silent')}
/>

// After (recommended)
<DeepgramVoiceInteraction
  onAgentAudioStateChange={(isPlaying) => console.log('Agent TTS playing:', isPlaying)}
  onAgentStartedSpeaking={() => console.log('Agent started speaking')}
  onAgentStoppedSpeaking={() => console.log('Agent stopped speaking')}
/>
```

**Why the changes?**
- `onPlaybackStateChange` → `onAgentAudioStateChange`: More specific naming (component only plays agent TTS audio)
- `onAgentSpeaking` → `onAgentStartedSpeaking`: Consistent with `onUserStartedSpeaking` pattern
- `onAgentSilent` → `onAgentStoppedSpeaking`: Consistent with `onUserStoppedSpeaking` pattern
- Better developer experience with more descriptive and consistent naming

---

## TypeScript Integration

### Importing Types

The component exports all necessary TypeScript types for full type safety:

```tsx
import { 
  DeepgramVoiceInteraction,
  DeepgramVoiceInteractionProps,
  DeepgramVoiceInteractionHandle,
  AgentOptions,
  TranscriptionOptions,
  AgentState,
  ConnectionState,
  ServiceType,
  TranscriptResponse,
  LLMResponse,
  UserMessageResponse,
  DeepgramError,
  UpdateInstructionsPayload,
  ConversationMessage
} from '@signal-meaning/deepgram-voice-interaction-react';
```

### Type Usage Examples

```tsx
// Component ref with proper typing
const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

// Props with type safety
const agentOptions: AgentOptions = {
  language: 'en',
  listenModel: 'nova-3',
  thinkProviderType: 'open_ai',
  thinkModel: 'gpt-4o-mini',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful assistant.'
};

// Event handlers with proper types
const handleAgentStateChange = (state: AgentState) => {
  console.log('Agent state:', state);
};

const handleTranscriptUpdate = (transcript: TranscriptResponse) => {
  const text = transcript.channel.alternatives[0].transcript;
  console.log('Transcript:', text);
};

const handleError = (error: DeepgramError) => {
  console.error('Error:', error.message);
};
```

## Type Definitions

### Service Types

```tsx
type ServiceType = 'transcription' | 'agent';
type ConnectionState = 'closed' | 'connecting' | 'open' | 'closing';
type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'entering_sleep' | 'sleeping';
```

### Response Types

```tsx
interface LLMResponse {
  type: 'llm';
  text: string;
  metadata?: unknown;
}

interface UserMessageResponse {
  type: 'user';
  text: string;
  metadata?: unknown;
}

interface TranscriptResponse {
  // Deepgram transcription response format
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
        speaker?: number;
        punctuated_word?: string;
      }>;
    }>;
  };
  is_final: boolean;
}
```

### Configuration Types

```tsx
interface TranscriptionOptions {
  model: string;
  language: string;
  smart_format?: boolean;
  interim_results?: boolean;
  vad_events?: boolean;
  utterance_end_ms?: number;
  diarize?: boolean;
  channels?: number;
}

interface AgentOptions {
  language: string;
  listenModel: string;
  thinkProviderType: string;
  thinkModel: string;
  voice: string;
  instructions: string;
  greeting?: string;
  thinkApiKey?: string;
  thinkEndpointUrl?: string;
}

interface EndpointConfig {
  transcriptionUrl?: string;
  agentUrl?: string;
}
```

### Error Types

```tsx
interface DeepgramError {
  service: ServiceType;
  message: string;
  code?: string;
  details?: unknown;
}
```

---

## Event Callbacks

### Connection Events

```tsx
// Component ready state
onReady={(isReady: boolean) => {
  console.log('Component ready:', isReady);
}}

// Connection state changes
onConnectionStateChange={(service: ServiceType, state: ConnectionState) => {
  console.log(`${service} connection: ${state}`);
}}
```

### Transcription Events

```tsx
// Transcript updates
onTranscriptUpdate={(transcript: TranscriptResponse) => {
  const text = transcript.channel.alternatives[0].transcript;
  console.log('Transcript:', text);
}}

// VAD events
onUserStartedSpeaking={() => {
  console.log('User started speaking');
}}

onUserStoppedSpeaking={() => {
  console.log('User stopped speaking');
}}

onUtteranceEnd={(data) => {
  console.log('Utterance ended:', data.lastWordEnd);
}}
```

### Agent Events

```tsx
// Agent state changes
onAgentStateChange={(state: AgentState) => {
  console.log('Agent state:', state);
}}

// Agent responses
onAgentUtterance={(utterance: LLMResponse) => {
  console.log('Agent said:', utterance.text);
}}

// Agent speaking events
onAgentStartedSpeaking={() => {
  console.log('Agent started speaking');
}}

onAgentStoppedSpeaking={() => {
  console.log('Agent finished speaking');
}}
```

### Audio Events

```tsx
// Agent TTS audio state
onAgentAudioStateChange={(isPlaying: boolean) => {
  console.log('Agent TTS playing:', isPlaying);
}}
```

---

## State Management

### Component State

The component manages internal state that you can monitor through callbacks:

```tsx
interface VoiceInteractionState {
  // Connection states
  connections: Record<ServiceType, ConnectionState>;
  
  // Agent state
  agentState: AgentState;
  
  // Audio states
  isRecording: boolean;
  isPlaying: boolean;
  microphonePermission: 'granted' | 'denied' | 'prompt';
  
  // Overall state
  isReady: boolean;
  error: string | null;
  
  // VAD states
  isUserSpeaking: boolean;
  lastUserSpeechTime: number | null;
  
  // TTS state
  ttsMuted: boolean;
  
  // Conversation context
  conversationHistory: ConversationMessage[];
  sessionId: string | null;
}
```

### State Access

The component manages internal state that you can monitor through callbacks. For debugging, use the `debug={true}` prop to enable detailed logging.

---

## Integration Examples

### Basic Usage

```tsx
import React, { useRef, useMemo } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function BasicApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.'
  }), []);

  return (
    <DeepgramVoiceInteraction
      ref={voiceRef}
      apiKey="your-api-key"
      agentOptions={agentOptions}
      onReady={() => console.log('Ready')}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

### Dual Mode (Transcription + Agent)

```tsx
const transcriptionOptions = useMemo(() => ({
  model: 'nova-3',
  language: 'en-US',
  smart_format: true,
  interim_results: true,
  vad_events: true,
  utterance_end_ms: 1000
}), []);

const agentOptions = useMemo(() => ({
  language: 'en',
  listenModel: 'nova-3',
  thinkProviderType: 'open_ai',
  thinkModel: 'gpt-4o-mini',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful assistant.'
}), []);

<DeepgramVoiceInteraction
  apiKey={apiKey}
  transcriptionOptions={transcriptionOptions}
  agentOptions={agentOptions}
  onTranscriptUpdate={(transcript) => setTranscript(transcript)}
  onAgentUtterance={(utterance) => setAgentResponse(utterance.text)}
/>
```

### Audio Control via interruptAgent

The component provides `interruptAgent()` to stop agent TTS audio. Audio control should be handled by the parent application:

```tsx
function AudioControlApp() {
  const [isAgentMuted, setIsAgentMuted] = useState(false);
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const toggleAgentMute = useCallback(() => {
    if (isAgentMuted) {
      // "Unmute" - restart the agent
      voiceRef.current?.start();
      setIsAgentMuted(false);
    } else {
      // "Mute" - interrupt the agent to stop TTS audio
      voiceRef.current?.interruptAgent();
      setIsAgentMuted(true);
    }
  }, [isAgentMuted]);

  return (
    <div>
      <button onClick={toggleAgentMute}>
        {isAgentMuted ? 'Unmute Agent' : 'Mute Agent'}
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
      />
    </div>
  );
}
```

**Why this approach is better:**
- **`interruptAgent()`** already stops agent TTS audio and clears the audio queue
- **No need for mute state management** in the component
- **Parent controls when agent speaks** through `start()`/`interruptAgent()`
- **Simpler API** - no additional props or methods needed

### Basic Control

The component requires explicit control. You must call `start()` to begin voice interaction:

```tsx
const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

const startInteraction = async () => {
  await voiceRef.current?.start();
};

const stopInteraction = async () => {
  await voiceRef.current?.stop();
};

const interruptAgent = () => {
  voiceRef.current?.interruptAgent();
};

return (
  <div>
    <button onClick={startInteraction}>Start Voice Interaction</button>
    <button onClick={stopInteraction}>Stop Voice Interaction</button>
    <button onClick={interruptAgent}>Interrupt Agent</button>
    
    <DeepgramVoiceInteraction
      ref={voiceRef}
      apiKey={apiKey}
      agentOptions={agentOptions}
      onReady={() => console.log('Ready')}
    />
  </div>
);
```

---

## Related Documentation

- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Complete integration patterns and examples
- **[Technical Setup](./TECHNICAL-SETUP.md)** - Build configuration and technical requirements
- **[Development Guide](./DEVELOPMENT.md)** - Development workflow and testing
- **[Test App](../test-app/)** - Working examples and test scenarios

---

**Last Updated**: January 2025  
**Component Version**: 0.5.0+  
**React Version**: 16.8.0+
