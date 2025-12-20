# API Reference

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Version**: 0.6.5+

## 🎯 Document Audience

This document serves **two audiences**:

1. **Developers** integrating with the component
2. **Deepgram corporate team** for upstream package proposal

## 🎯 API Design Summary

The `DeepgramVoiceInteraction` component provides a **headless, imperative API** for real-time voice interactions with Deepgram's transcription and AI agent services. The API is designed around three core principles:

### **1. Explicit Control**
- **No automatic connections** - You must explicitly call `start()`, `startTranscription()`, or `startAgent()`
- **Configuration required** - You must provide `transcriptionOptions` and/or `agentOptions` for the services you want to start
- **Service-specific control** - Start/stop transcription and agent services independently
- **Imperative methods** - Control behavior through method calls rather than prop changes

### **2. Event-Driven Architecture**
- **Comprehensive callbacks** - Monitor all aspects of voice interaction through dedicated event handlers
- **Real-time feedback** - Get immediate updates on connection state, audio playback, and voice activity
- **Error handling** - Built-in error reporting with service-specific error information

### **3. Flexible Service Configuration**
- **Dual Mode** - Use both transcription and agent services together
- **Transcription-Only** - Real-time speech-to-text without AI responses
- **Agent-Only** - AI conversation without real-time transcription
- **Dynamic switching** - Change service configuration without restarting the component

### **Key Features**
- **Voice Activity Detection** - Precise start/stop detection with word-level timing
- **Audio Buffer Management** - Proper cleanup and memory management for TTS audio
- **Context Injection** - Provide conversation context via `injectMessage()` method
- **TypeScript Support** - Full type safety with comprehensive type definitions
- **React Integration** - Optimized for React with proper memoization patterns

## 📋 Table of Contents

1. [Component Props](#component-props)
2. [Component Methods](#component-methods)
3. [Type Definitions](#type-definitions)
4. [Event Callbacks](#event-callbacks)
5. [State Management](#state-management)
6. [Integration Examples](#integration-examples)
7. [API Evolution Since Fork](#api-evolution-since-fork)

---

## Component Props

### `DeepgramVoiceInteractionProps`

```tsx
interface DeepgramVoiceInteractionProps {
  // Connection Configuration
  // Option 1: Direct connection (requires apiKey)
  apiKey?: string;
  
  // Option 2: Backend proxy mode (requires proxyEndpoint, apiKey not needed)
  /**
   * Backend proxy endpoint URL (for proxy mode)
   * When provided, component connects through backend proxy instead of directly to Deepgram
   * Format: ws:// or wss:// URL (e.g., "wss://api.example.com/deepgram-proxy")
   * 
   * @see Issue #242 for backend proxy implementation details
   */
  proxyEndpoint?: string;
  
  /**
   * Authentication token for backend proxy (optional)
   * Used for JWT or session token authentication with backend proxy
   * Only used when proxyEndpoint is provided
   */
  proxyAuthToken?: string;
  
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
  onSettingsApplied?: () => void;
  onFunctionCallRequest?: (
    functionCall: FunctionCallRequest,
    sendResponse: (response: FunctionCallResponse) => void
  ) => void;
  
  // Voice Activity Detection
  onUserStartedSpeaking?: () => void;
  onUserStoppedSpeaking?: () => void;
  onAgentStartedSpeaking?: () => void;
  onUtteranceEnd?: (data: { channel: number[]; lastWordEnd: number }) => void;
  
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

### Connection Configuration Props

The component supports two connection modes: **Direct** (using `apiKey`) or **Proxy** (using `proxyEndpoint`). You must provide either `apiKey` OR `proxyEndpoint`, but not both.

| Prop | Type | Description |
|------|------|-------------|
| `apiKey` | `string?` | Deepgram API key for direct connection mode. Required if `proxyEndpoint` is not provided. |
| `proxyEndpoint` | `string?` | Backend proxy endpoint URL for proxy mode. Format: `ws://` or `wss://` URL (e.g., `"wss://api.example.com/deepgram-proxy"`). Required if `apiKey` is not provided. |
| `proxyAuthToken` | `string?` | Authentication token for backend proxy (optional). Used for JWT or session token authentication. Only used when `proxyEndpoint` is provided. |

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
| `onPlaybackStateChange` | `(isPlaying: boolean) => void` | Called when audio playback state changes |
| `onSettingsApplied` | `() => void` | Called when agent settings have been successfully applied and the connection is ready for audio data processing. This is fired when the `SettingsApplied` event is received from Deepgram, indicating that the settings sent to the agent service have been confirmed and are now active. |
| `onFunctionCallRequest` | `(functionCall: FunctionCallRequest, sendResponse: (response: FunctionCallResponse) => void) => void` | Called when a FunctionCallRequest is received from Deepgram. This indicates the agent wants to execute a client-side function. The application should execute the function and call `sendResponse()` with the result. The `sendResponse` callback eliminates the need for component refs. |

#### Voice Activity Detection Events
| Prop | Type | Description |
|------|------|-------------|
| `onUserStartedSpeaking` | `() => void` | Called when user starts speaking |
| `onUserStoppedSpeaking` | `() => void` | Called when user stops speaking (triggered by endpointing) |
| `onAgentStartedSpeaking` | `() => void` | Called when agent starts speaking (simplifies `onAgentStateChange` + `onPlaybackStateChange`) |
| `onUtteranceEnd` | `(data: { channel: number[]; lastWordEnd: number }) => void` | Called when utterance ends (word-timing based) |
| `onPlaybackStateChange` | `(isPlaying: boolean) => void` | Called when audio playback state changes. Use `isPlaying === false` to detect when agent playback completes (agent has stopped speaking). |

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
| `start` | `options?: { agent?: boolean, transcription?: boolean }` | `Promise<void>` | Start WebSocket connections for specified services. Creates managers lazily if needed. If no options provided, starts services based on configured props. |
| `stop` | None | `Promise<void>` | Stop all services and connections. Clears manager refs to allow lazy recreation. |

### Agent Control Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `interruptAgent` | None | `void` | Interrupt agent while speaking. Stops audio playback and clears Web Audio API buffers. Blocks future audio until `allowAgent()` is called. |
| `allowAgent` | None | `void` | Allow agent audio to play (clears block state set by `interruptAgent()`). Counterpart to `interruptAgent()` for push-button mute control. Enables hold-to-mute interactions. |
| `sleep` | None | `void` | Put agent to sleep |
| `wake` | None | `void` | Wake agent from sleep |
| `toggleSleep` | None | `void` | Toggle between sleep and wake |
| `updateAgentInstructions` | `UpdateInstructionsPayload` | `void` | Update agent instructions |
| `injectUserMessage` | `message: string` | `Promise<void>` | Inject user message to agent. Creates agent manager lazily if needed. |
| `injectAgentMessage` | `message: string` | `void` | Inject message as agent (deprecated, use `injectUserMessage` for user messages) |

### Function Calling Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `sendFunctionCallResponse` | `id: string, name: string, content: string` | `void` | Send a FunctionCallResponse back to Deepgram after executing a client-side function. The `id` should match the function call ID from the `FunctionCallRequest`, `name` is the function name, and `content` is the function result as a JSON string. |

### Audio Control Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `startAudioCapture` | None | `Promise<void>` | Start audio capture (lazy initialization). Triggers browser's microphone permission prompt and initializes AudioManager for voice interactions. Should only be called when user explicitly requests microphone access. |
| `getAudioContext` | None | `AudioContext \| undefined` | Get the AudioContext instance for debugging and testing. Returns undefined if AudioManager not initialized. Used for browser autoplay policy compliance (e.g., resuming suspended AudioContext). |

---

## TypeScript Integration

### Importing Types

The component exports all necessary TypeScript types for full type safety:

```tsx
import { 
  // Core component and types (pre-fork)
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
  DeepgramError,
  UpdateInstructionsPayload,
  ConversationMessage,
  
  // New since fork (v0.5.0+)
  UserMessageResponse, // Added for user message handling
  AgentFunction, // Added for function calling support
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
  functions?: AgentFunction[];
  context?: {
    messages: Array<{
      type: 'History';
      role: 'user' | 'assistant';
      content: string;
    }>;
  };
}

interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;  // JSON Schema object
  endpoint?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
  };
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

// Use onPlaybackStateChange(false) to detect when agent playback completes
onPlaybackStateChange={(isPlaying) => {
  if (!isPlaying) {
    console.log('Agent playback completed - agent has stopped speaking');
  } else {
    console.log('Agent playback started');
  }
}}

// Function calling
onFunctionCallRequest={(functionCall, sendResponse) => {
  console.log('Function call requested:', functionCall.name);
  // Execute the function and send response using sendResponse callback
  const result = executeFunction(functionCall.name, JSON.parse(functionCall.arguments));
  sendResponse({
    id: functionCall.id,
    result: result
  });
}}
```

### Audio Events

```tsx
// Audio playback state
onPlaybackStateChange={(isPlaying: boolean) => {
  console.log('Audio playing:', isPlaying);
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
  
  
}
```

### State Access

The component manages internal state that you can monitor through callbacks. For debugging, use the `debug={true}` prop to enable detailed logging.

---

## Integration Examples

### Basic Usage - Direct Connection Mode

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

### Basic Usage - Backend Proxy Mode

```tsx
import React, { useRef, useMemo } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function BasicAppWithProxy() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.'
  }), []);

  // Backend proxy mode - API key stays server-side
  return (
    <DeepgramVoiceInteraction
      ref={voiceRef}
      proxyEndpoint="wss://api.example.com/deepgram-proxy"
      proxyAuthToken={userJwtToken} // Optional: JWT or session token
      agentOptions={agentOptions}
      onReady={() => console.log('Ready')}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

**Connection Mode Selection:**
- **Direct Mode**: Provide `apiKey` prop → Component connects directly to Deepgram
- **Proxy Mode**: Provide `proxyEndpoint` prop → Component connects through your backend proxy
- **Authentication**: Optionally provide `proxyAuthToken` when using proxy mode for JWT/session authentication

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

**Purpose**: This section demonstrates how to properly control agent audio playback and manage audio buffers to prevent memory leaks and connection issues.

**Context**: The `interruptAgent()` method is the primary way to stop agent TTS audio. Unlike simple mute controls, it immediately stops audio playback AND clears Web Audio API buffers, preventing memory leaks and connection timeouts that can occur with accumulated audio buffers.

**Approach**: The example shows proper audio state management by monitoring playback state and providing immediate audio interruption capabilities.

```tsx
function AudioControlApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stopAgent = useCallback(() => {
    // This immediately stops audio AND clears audio buffers
    voiceRef.current?.interruptAgent();
    setIsPlaying(false);
  }, []);

  const allowAgent = useCallback(() => {
    // Re-enable audio after interruptAgent()
    voiceRef.current?.allowAgent();
  }, []);

  const handlePlaybackStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  return (
    <div>
      <button onClick={stopAgent} disabled={!isPlaying}>
        Stop Agent Audio
      </button>
      <button onClick={allowAgent}>
        Allow Agent Audio
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onPlaybackStateChange={handlePlaybackStateChange}
      />
    </div>
  );
}
```

**Push-Button Mute Example:**
```tsx
function PushButtonMuteApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const handleMouseDown = useCallback(() => {
    // Block audio while button is pressed
    voiceRef.current?.interruptAgent();
  }, []);

  const handleMouseUp = useCallback(() => {
    // Allow audio when button is released
    voiceRef.current?.allowAgent();
  }, []);

  return (
    <div>
      <button 
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        Hold to Mute
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

**Why this approach is essential:**
- **`interruptAgent()`** immediately stops audio and clears Web Audio API buffers, blocks future audio
- **`allowAgent()`** re-enables audio after `interruptAgent()`, enabling push-button mute patterns
- **Prevents memory leaks** from accumulated audio buffers
- **Avoids connection timeouts** caused by audio queue buildup
- **Parent controls audio** through `interruptAgent()`/`allowAgent()` pattern

> **⚠️ Important**: See [Audio Buffer Management Guide](./AUDIO-BUFFER-MANAGEMENT.md) for comprehensive guidance on managing TTS audio streams and preventing common audio-related issues.

### Basic Control

**Purpose**: This section demonstrates the fundamental control patterns for the component - both unified and service-specific control options.

**Context**: The component provides both unified control (`start()`/`stop()`) and service-specific control (`startTranscription()`/`startAgent()`). **Important**: You must provide the appropriate options (`transcriptionOptions` and/or `agentOptions`) for the services you want to start.

**Approach**: The examples show both patterns - unified control for simple cases and service-specific control for advanced scenarios.

```tsx
function BasicControlApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isReady, setIsReady] = useState(false);

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.'
  }), []);

  const startInteraction = async () => {
    try {
      await voiceRef.current?.start();
      console.log('Voice interaction started');
    } catch (error) {
      console.error('Failed to start:', error);
    }
  };

  const stopInteraction = async () => {
    try {
      await voiceRef.current?.stop();
      console.log('Voice interaction stopped');
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const interruptAgent = () => {
    voiceRef.current?.interruptAgent();
  };

  return (
    <div>
      <button onClick={startInteraction} disabled={!isReady}>
        Start Voice Interaction
      </button>
      <button onClick={stopInteraction} disabled={!isReady}>
        Stop Voice Interaction
      </button>
      <button onClick={interruptAgent} disabled={!isReady}>
        Interrupt Agent
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onReady={setIsReady}
        onError={(error) => console.error('Error:', error)}
      />
    </div>
  );
}
```

> **⚠️ Important**: Calling `start()` without providing `transcriptionOptions` or `agentOptions` will result in no services being started. Always ensure you provide the appropriate options for the services you want to use.

### Microphone Control with startAudioCapture

**Purpose**: Demonstrates explicit microphone control using `startAudioCapture()` for lazy initialization.

**Context**: The `start()` method connects WebSocket(s) but does NOT start audio recording. You must call `startAudioCapture()` separately when the user explicitly requests microphone access. This enables better user experience and compliance with browser autoplay policies.

```tsx
function MicrophoneControlApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startInteraction = async () => {
    try {
      // Connect WebSocket first
      await voiceRef.current?.start();
      
      // Then request microphone permission and start capture
      await voiceRef.current?.startAudioCapture();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start:', error);
    }
  };

  const stopInteraction = async () => {
    try {
      await voiceRef.current?.stop();
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  // Handle AudioContext autoplay policy
  const handleAudioContext = useCallback(() => {
    const audioContext = voiceRef.current?.getAudioContext();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }, []);

  return (
    <div>
      <button onClick={startInteraction} disabled={isRecording}>
        Start Voice Interaction
      </button>
      <button onClick={stopInteraction} disabled={!isRecording}>
        Stop Voice Interaction
      </button>
      <button onClick={handleAudioContext}>
        Resume Audio Context
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onConnectionStateChange={(service, state) => {
          if (service === 'agent' && state === 'open') {
            console.log('Connection established');
          }
        }}
      />
    </div>
  );
}
```

**Key Points:**
- **`start()`** connects WebSocket but does NOT start microphone
- **`startAudioCapture()`** triggers browser permission prompt and initializes AudioManager
- **`getAudioContext()`** can be used to resume suspended AudioContext (autoplay policy)
- **Separation of concerns**: Connection vs. microphone access are independent operations

### Service-Specific Control

**Purpose**: Demonstrates how to control individual services (transcription or agent) independently for advanced use cases.

**Context**: Some applications need fine-grained control over which services are active. For example, you might want to start with transcription-only mode and add agent capabilities later, or switch between different service configurations dynamically.

**Use Cases**: Progressive enhancement, dynamic service switching, testing individual services, resource optimization.

```tsx
function ServiceSpecificControlApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [transcriptionActive, setTranscriptionActive] = useState(false);
  const [agentActive, setAgentActive] = useState(false);

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

  const startTranscriptionOnly = async () => {
    try {
      await voiceRef.current?.startTranscription();
      setTranscriptionActive(true);
      console.log('Transcription started');
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  };

  const startAgentOnly = async () => {
    try {
      await voiceRef.current?.startAgent();
      setAgentActive(true);
      console.log('Agent started');
    } catch (error) {
      console.error('Failed to start agent:', error);
    }
  };

  const stopTranscription = async () => {
    try {
      await voiceRef.current?.stopTranscription();
      setTranscriptionActive(false);
      console.log('Transcription stopped');
    } catch (error) {
      console.error('Failed to stop transcription:', error);
    }
  };

  const stopAgent = async () => {
    try {
      await voiceRef.current?.stopAgent();
      setAgentActive(false);
      console.log('Agent stopped');
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  };

  return (
    <div>
      <div>
        <button 
          onClick={startTranscriptionOnly} 
          disabled={transcriptionActive}
        >
          Start Transcription Only
        </button>
        <button 
          onClick={stopTranscription} 
          disabled={!transcriptionActive}
        >
          Stop Transcription
        </button>
        <span>Transcription: {transcriptionActive ? 'Active' : 'Inactive'}</span>
      </div>
      
      <div>
        <button 
          onClick={startAgentOnly} 
          disabled={agentActive}
        >
          Start Agent Only
        </button>
        <button 
          onClick={stopAgent} 
          disabled={!agentActive}
        >
          Stop Agent
        </button>
        <span>Agent: {agentActive ? 'Active' : 'Inactive'}</span>
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        transcriptionOptions={transcriptionOptions}
        agentOptions={agentOptions}
        onConnectionStateChange={(service, state) => {
          if (service === 'transcription') {
            setTranscriptionActive(state === 'open');
          } else if (service === 'agent') {
            setAgentActive(state === 'open');
          }
        }}
        onError={(error) => console.error('Error:', error)}
      />
    </div>
  );
}
```

---

## API Evolution Since Fork

This section documents changes made to the API since the original fork (commit `7191eb4a062f35344896e873f02eba69c9c46a2d`).

### Props Added Since Fork

- **`onAgentStartedSpeaking`** - Agent speaking callback
  - *Why added*: Provides callback when agent starts speaking. Note: `onAgentSilent` was removed - use `onPlaybackStateChange(false)` + `onAgentStateChange('idle')` for detecting when agent playback completes. `onAgentStoppedSpeaking` was never implemented - `AgentStoppedSpeaking` is not a real Deepgram event (Issue #198).

- **`onUserStartedSpeaking` / `onUserStoppedSpeaking`** - User speaking event callbacks  
  - *Why added*: Enables applications to provide real-time visual feedback during user speech and implement proper idle timeout management based on actual voice activity rather than microphone state.

- **`onUtteranceEnd`** - End-of-speech detection with word timing
  - *Why added*: Leverages Deepgram's built-in endpointing to provide precise end-of-speech detection with word-level timing data, enabling more accurate conversation flow control and idle timeout management.

- **`onUserMessage`** - User message handling callback
  - *Why added*: Provides a dedicated callback for user messages received from the server, enabling applications to track and display the complete conversation history including user inputs.

- **`onFunctionCallRequest`** - Function calling callback
  - *Why added*: Enables the agent to execute client-side functions during conversations. When the agent wants to call a function, it sends a `FunctionCallRequest` which triggers this callback. The callback receives both the `functionCall` request and a `sendResponse` callback, eliminating the need for component refs. The application executes the function and sends the result back via `sendResponse()`. The ref-based `sendFunctionCallResponse()` method is still available for backward compatibility.

### Methods Added Since Fork

- **`injectMessage(role: 'agent' | 'user', message: string)`** - Unified text input support
  - *Why added*: Consolidates text input functionality into a single, flexible method that can inject messages as either agent or user, replacing the separate `injectAgentMessage` and `injectUserMessage` methods for better API consistency and reduced complexity.

- **`sendFunctionCallResponse(id: string, name: string, content: string)`** - Function calling response method
  - *Why added*: Sends the result of a client-side function execution back to Deepgram. Called after executing a function in response to a `FunctionCallRequest`. The `id` must match the function call ID from the request, `name` is the function name, and `content` is the result as a JSON string.

### Deprecation Strategy

#### **`injectAgentMessage` Deprecation**
- **Current state**: `injectAgentMessage(message: string)` remains available
- **Deprecation approach**: Method will be marked with `@deprecated` JSDoc annotation
- **Migration path**: `injectAgentMessage(message)` → `injectMessage('agent', message)`
- **Timeline**: Deprecated in v0.5.0, removal planned for v1.0.0
- **Developer warnings**: TypeScript will show deprecation warnings, build tools will flag usage

#### **Migration Example**
```tsx
// Before (deprecated)
voiceRef.current?.injectAgentMessage("Hello from agent");

// After (recommended)
voiceRef.current?.injectMessage('agent', "Hello from agent");
```

### Design Philosophy Changes

**Simplified API Design**: The v0.5.0 release focuses on a simplified, more intuitive API that reduces complexity and eliminates redundant patterns.

**Key Philosophy Shifts**:

1. **Lazy Initialization (Issue #206)**: Removed automatic connection patterns. WebSocket managers are created lazily only when `start()` is called or user interacts (via `injectUserMessage()` or `startAudioCapture()`).

2. **Unified Audio Control**: Consolidated multiple audio control methods into a single `interruptAgent()` method that handles both stopping audio and clearing buffers.

3. **Dedicated Event Callbacks**: Added specific callbacks for common use cases (e.g., `onAgentStartedSpeaking`) to reduce the need for complex state monitoring.

4. **Simplified Text Input**: Unified text injection through a single `injectMessage()` method instead of separate agent/user methods.

5. **Reduced API Surface**: Eliminated redundant props and methods that provided overlapping functionality, focusing on essential features.

**Benefits**:
- **Easier Integration**: Fewer concepts to learn and fewer ways to make mistakes
- **Better Performance**: Reduced API surface means less overhead and fewer potential issues
- **Clearer Intent**: Each method and prop has a single, clear purpose
- **Maintainability**: Simpler API is easier to maintain and extend

### Breaking Changes

**v0.5.0 introduces several breaking changes** to simplify the API and improve developer experience:

#### **Removed Props**
- `autoConnect` - Automatic connection removed in favor of explicit control
- `microphoneEnabled` - Microphone state is now managed internally by the component
- `onMicToggle` - Replaced with `onConnectionStateChange` monitoring
- `onVADEvent` - Replaced with specific VAD callbacks (`onUserStartedSpeaking`, etc.)
- `onKeepalive` - Internal implementation detail, not needed for integration
- `agentMuted` - Audio control simplified to `interruptAgent()` method
- `onAgentMuteChange` - Replaced with `onPlaybackStateChange(false)` for detecting when agent playback completes. Note: `onAgentSilent` was removed (misleading - fired on TTS generation, not playback). `onAgentStoppedSpeaking` was never implemented - `AgentStoppedSpeaking` is not a real Deepgram event (Issue #198).

#### **Removed Methods**
- `toggleMicrophone()` - Microphone control is not a component responsibility
- `resumeWithText()` / `resumeWithAudio()` - Redundant with `start()` method
- `connectWithContext()` / `connectTextOnly()` - Redundant with `start()` method (Issue #195)
- `isPlaybackActive()` - Removed (Issue #195), use `onPlaybackStateChange` callback pattern
- `toggleTtsMute()` / `setTtsMuted()` - Replaced with `interruptAgent()` method
- `agentMute()` / `agentUnmute()` - Replaced with `interruptAgent()` method
- `getConnectionStates()` / `getState()` - Debug methods removed from public API (Issue #162)

#### **Changed Methods**
- `injectUserMessage()` is now async and returns `Promise<void>` - creates agent manager lazily if needed
- `injectAgentMessage()` remains available but deprecated (no lazy initialization)

#### **Migration Guide**

**Before (v0.4.x)**:
```tsx
<DeepgramVoiceInteraction
  autoConnect={true}
  microphoneEnabled={true}
  agentMuted={false}
  onMicToggle={(enabled) => console.log('Mic:', enabled)}
  onVADEvent={(event) => console.log('VAD:', event)}
  onAgentMuteChange={(muted) => console.log('Muted:', muted)}
/>

// Methods
voiceRef.current?.toggleMicrophone();
voiceRef.current?.isPlaybackActive(); // ❌ Removed
voiceRef.current?.connectTextOnly(); // ❌ Removed
voiceRef.current?.agentMute();
voiceRef.current?.injectAgentMessage("Hello");
```

**After (v0.5.0+)**:
```tsx
<DeepgramVoiceInteraction
  onConnectionStateChange={(service, state) => {
    if (service === 'transcription') {
      console.log('Mic:', state === 'open');
    }
  }}
  onUserStartedSpeaking={() => console.log('User speaking')}
  onPlaybackStateChange={(isPlaying) => {
    if (!isPlaying) console.log('Agent playback completed');
  }}
/>

// Methods
await voiceRef.current?.start({ agent: true }); // Explicit control with service flags
// ❌ isPlaybackActive() removed - use onPlaybackStateChange callback to track state
voiceRef.current?.interruptAgent(); // Unified audio control
await voiceRef.current?.injectUserMessage("Hello"); // Lazy initialization for text input
```

#### **Impact Assessment**
- **High Impact**: Applications using auto-connect will need to implement explicit control
- **Medium Impact**: Audio control patterns need to be updated to use `interruptAgent()`
- **Low Impact**: VAD event handling can be updated incrementally
- **Minimal Impact**: Text injection changes are straightforward

---

## Session Management

### Application-Layer Session Management

The component does **not** manage conversation history or session state internally. This is an application-layer concern that should be handled by your application code.

### Recommended Pattern

Manage conversation history in your application state and pass it through `agentOptions.context`:

```tsx
function VoiceApp() {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  // Track agent messages
  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    setConversationHistory(prev => [...prev, {
      role: 'assistant',
      content: utterance.text,
      timestamp: Date.now()
    }]);
  }, []);

  // Track user messages
  const handleUserMessage = useCallback((message: UserMessageResponse) => {
    setConversationHistory(prev => [...prev, {
      role: 'user',
      content: message.text,
      timestamp: Date.now()
    }]);
  }, []);

  // Create agentOptions with context
  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful voice assistant.',
    greeting: 'Hello! How can I assist you today?',
    // Pass conversation history as context in Deepgram API format
    context: conversationHistory.length > 0 ? {
      messages: conversationHistory.map(message => ({
        type: "History",
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))
    } : undefined
  }), [conversationHistory]);

  return (
    <DeepgramVoiceInteraction
      ref={voiceRef}
      apiKey={apiKey}
      agentOptions={agentOptions}
      onAgentUtterance={handleAgentUtterance}
      onUserMessage={handleUserMessage}
    />
  );
}
```

### Why This Approach?

- **Single WebSocket = Single Session**: Each WebSocket connection is a complete session
- **No Server-Side Persistence**: Deepgram servers don't maintain session state
- **Client-Provided Context**: All conversation context must be provided by the client
- **Single `start()` Method**: One WebSocket and single `start()` is sufficient for both voice and text interactions

**For detailed session management patterns and examples, see [test-app documentation](../test-app/docs/SESSION-MANAGEMENT.md).**

### Function Calling

**Purpose**: This section demonstrates how to use function calling to enable the agent to execute client-side functions during conversations.

**Context**: Function calling allows the agent to trigger custom functions in your application. Functions are defined in `agentOptions.functions` and sent to Deepgram in the Settings message. When the agent wants to call a function, it sends a `FunctionCallRequest` which triggers the `onFunctionCallRequest` callback with both the `functionCall` request and a `sendResponse` callback. Your application executes the function and sends the result back via `sendResponse()`. The ref-based `sendFunctionCallResponse()` method is still available for backward compatibility.

**Example**:
```tsx
function FunctionCallingApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  // Define functions that the agent can call
  const functions: AgentFunction[] = [
    {
      name: 'get_current_time',
      description: 'Get the current time in a specific timezone. Use this when users ask about the time, what time it is, or current time.',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London"). Defaults to UTC if not specified.'
          }
        },
        required: []
      }
      // No endpoint = client-side function
    }
  ];

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant that can tell the time.',
    functions: functions  // Include functions in agent options
  }), []);

  // Handle function call requests (using sendResponse callback - recommended)
  const handleFunctionCall = useCallback((
    functionCall: FunctionCallRequest,
    sendResponse: (response: FunctionCallResponse) => void
  ) => {
    console.log('Function call requested:', functionCall.name);
    
    if (functionCall.name === 'get_current_time') {
      try {
        const args = JSON.parse(functionCall.arguments);
        const timezone = args.timezone || 'UTC';
        const now = new Date();
        const timeString = now.toLocaleString('en-US', { 
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        
        const result = {
          success: true,
          time: timeString,
          timezone: timezone,
          timestamp: now.toISOString()
        };
        
        // Send the result back using sendResponse callback (no ref needed!)
        sendResponse({
          id: functionCall.id,
          result: result
        });
      } catch (error) {
        console.error('Error executing function:', error);
        // Send error response
        sendResponse({
          id: functionCall.id,
          error: 'Failed to get time'
        });
      }
    }
  }, []);

  return (
    <DeepgramVoiceInteraction
      ref={voiceRef}
      apiKey={apiKey}
      agentOptions={agentOptions}
      onFunctionCallRequest={handleFunctionCall}
    />
  );
}
```

**Key Points**:
- **Function Definition**: Functions are defined in `agentOptions.functions` as an array of `AgentFunction` objects
- **Client-Side Functions**: Functions without an `endpoint` property are executed client-side
- **Server-Side Functions**: Functions with an `endpoint` property are executed server-side (not handled by the component)
- **Important**: Do NOT include `client_side` property in function definitions. This property only appears in `FunctionCallRequest` responses from Deepgram, not in Settings messages. The component automatically filters it out if included.
- **Function Call Flow**: 
  1. Agent decides to call a function based on user input
  2. Deepgram sends `FunctionCallRequest` via WebSocket
  3. Component invokes `onFunctionCallRequest` callback with `functionCall` and `sendResponse` parameters
  4. Application executes the function
  5. Application calls `sendResponse()` with the result (or error)
  6. Agent receives the result and continues the conversation
- **sendResponse Callback** (Recommended): The `sendResponse` callback is provided as the second parameter to `onFunctionCallRequest`. It accepts a `FunctionCallResponse` object with `id`, `result?`, and `error?` properties. This eliminates the need for component refs and null checks.
- **Backward Compatibility**: The ref-based `sendFunctionCallResponse(id, name, content)` method is still available for existing code, but the `sendResponse` callback is preferred for new code.
- **Parameters**: Function parameters use JSON Schema format with `type: 'object'`, `properties`, and optional `required` array
- **Response Format**: Function results can be sent as objects via `sendResponse({ id, result })` or as JSON strings via the ref-based method

**For more information on function calling, see [Deepgram's Function Calling Documentation](https://developers.deepgram.com/docs/voice-agents-function-calling).**

---

## Related Documentation

- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Complete integration patterns and examples
- **[Audio Buffer Management](./AUDIO-BUFFER-MANAGEMENT.md)** - Comprehensive TTS audio stream management
- **[Technical Setup](./TECHNICAL-SETUP.md)** - Build configuration and technical requirements
- **[Development Guide](./DEVELOPMENT.md)** - Development workflow and testing
- **[Test App](../test-app/)** - Working examples and test scenarios
  - **[Session Management Guide](../test-app/docs/SESSION-MANAGEMENT.md)** - Detailed session management patterns
  - **[Context Handling Guide](../test-app/docs/CONTEXT-HANDLING.md)** - Conversation context management
  - **[Integration Examples](../test-app/docs/INTEGRATION-EXAMPLES.md)** - Real-world integration patterns

---

**Last Updated**: January 2025  
**Component Version**: 0.6.5+  
**React Version**: 16.8.0+
