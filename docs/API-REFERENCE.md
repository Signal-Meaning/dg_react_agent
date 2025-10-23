# API Reference

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Version**: 0.4.0+

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
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onUserStartedSpeaking?: () => void;
  onUserStoppedSpeaking?: () => void;
  onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
  onSpeechStarted?: (data: { channel: number[]; timestamp: number }) => void;
  onVADEvent?: (data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void;
  onKeepalive?: (service: ServiceType) => void;
  onError?: (error: DeepgramError) => void;
  
  // Auto-Connect Configuration
  autoConnect?: boolean;
  microphoneEnabled?: boolean;
  onMicToggle?: (enabled: boolean) => void;
  onConnectionReady?: () => void;
  onAgentSpeaking?: () => void;
  onAgentSilent?: () => void;
  
  // TTS Configuration
  ttsMuted?: boolean;
  onTtsMuteToggle?: (isMuted: boolean) => void;
  
  // Sleep Configuration
  sleepOptions?: {
    autoSleep?: boolean;
    timeout?: number;
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

| Prop | Type | Description |
|------|------|-------------|
| `onReady` | `(isReady: boolean) => void` | Called when component is ready |
| `onConnectionStateChange` | `(service: ServiceType, state: ConnectionState) => void` | Called when connection state changes |
| `onTranscriptUpdate` | `(transcriptData: TranscriptResponse) => void` | Called when transcript is received |
| `onAgentStateChange` | `(state: AgentState) => void` | Called when agent state changes |
| `onAgentUtterance` | `(utterance: LLMResponse) => void` | Called when agent produces text |
| `onUserMessage` | `(message: UserMessageResponse) => void` | Called when user message is received |
| `onPlaybackStateChange` | `(isPlaying: boolean) => void` | Called when audio playback state changes |
| `onUserStartedSpeaking` | `() => void` | Called when user starts speaking |
| `onUserStoppedSpeaking` | `() => void` | Called when user stops speaking |
| `onUtteranceEnd` | `(data: { channel: number[]; lastWordEnd: number }) => void` | Called when utterance ends |
| `onSpeechStarted` | `(data: { channel: number[]; timestamp: number }) => void` | Called when speech starts |
| `onVADEvent` | `(data: { speechDetected: boolean; confidence?: number; timestamp?: number }) => void` | Called on VAD events |
| `onKeepalive` | `(service: ServiceType) => void` | Called when keepalive is sent |
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
| `start` | None | `Promise<void>` | Start voice interaction |
| `stop` | None | `Promise<void>` | Stop voice interaction |
| `interruptAgent` | None | `void` | Interrupt agent while speaking |
| `sleep` | None | `void` | Put agent to sleep |
| `wake` | None | `void` | Wake agent from sleep |
| `toggleSleep` | None | `void` | Toggle between sleep and wake |

### Agent Control

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `updateAgentInstructions` | `UpdateInstructionsPayload` | `void` | Update agent instructions |
| `injectAgentMessage` | `message: string` | `void` | Inject message to agent |
| `injectUserMessage` | `message: string` | `void` | Inject user message to agent |

### Microphone Control

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `toggleMicrophone` | `enabled: boolean` | `Promise<void>` | Toggle microphone on/off |

### Reconnection Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `resumeWithText` | `text: string` | `Promise<void>` | Resume with text input |
| `resumeWithAudio` | None | `Promise<void>` | Resume with audio input |
| `connectWithContext` | `sessionId: string, history: ConversationMessage[], options: AgentOptions` | `Promise<void>` | Connect with conversation context |
| `connectTextOnly` | None | `Promise<void>` | Connect for text-only mode |

### TTS Control

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `toggleTtsMute` | None | `void` | Toggle TTS mute state |
| `setTtsMuted` | `muted: boolean` | `void` | Set TTS mute state |

### Debug Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `getConnectionStates` | None | `{ transcription: string; agent: string; transcriptionConnected: boolean; agentConnected: boolean }` | Get connection states |
| `getState` | None | `any` | Get current component state |

---

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
onAgentSpeaking={() => {
  console.log('Agent started speaking');
}}

onAgentSilent={() => {
  console.log('Agent finished speaking');
}}
```

### Audio Events

```tsx
// Playback state
onPlaybackStateChange={(isPlaying: boolean) => {
  console.log('Audio playing:', isPlaying);
}}

// TTS mute state
onTtsMuteToggle={(isMuted: boolean) => {
  console.log('TTS muted:', isMuted);
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

```tsx
// Get current state
const currentState = voiceRef.current?.getState();

// Get connection states
const connectionStates = voiceRef.current?.getConnectionStates();
```

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

### Auto-Connect Mode

```tsx
<DeepgramVoiceInteraction
  apiKey={apiKey}
  agentOptions={agentOptions}
  autoConnect={true}
  microphoneEnabled={false}
  onConnectionReady={() => console.log('Ready for interaction')}
  onMicToggle={(enabled) => setMicEnabled(enabled)}
/>
```

### Manual Control

```tsx
const startInteraction = async () => {
  await voiceRef.current?.start();
};

const stopInteraction = async () => {
  await voiceRef.current?.stop();
};

const interruptAgent = () => {
  voiceRef.current?.interruptAgent();
};
```

---

## Related Documentation

- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Complete integration patterns and examples
- **[Technical Setup](./TECHNICAL-SETUP.md)** - Build configuration and technical requirements
- **[Development Guide](./DEVELOPMENT.md)** - Development workflow and testing
- **[Test App](../test-app/)** - Working examples and test scenarios

---

**Last Updated**: December 2024  
**Component Version**: 0.4.0+  
**React Version**: 16.8.0+
