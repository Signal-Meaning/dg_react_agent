# API Reference

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Version**: 0.5.0+

## 🎯 Document Audience

This document serves **two audiences**:

1. **Voice-commerce developers** integrating with v0.5.0 release
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
- **Context Preservation** - Maintain conversation history across reconnections
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
  
  // Voice Activity Detection
  onUserStartedSpeaking?: () => void;
  onUserStoppedSpeaking?: () => void;
  onAgentStartedSpeaking?: () => void;
  onAgentStoppedSpeaking?: () => void;
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
| `onPlaybackStateChange` | `(isPlaying: boolean) => void` | Called when audio playback state changes |

#### Voice Activity Detection Events
| Prop | Type | Description |
|------|------|-------------|
| `onUserStartedSpeaking` | `() => void` | Called when user starts speaking |
| `onUserStoppedSpeaking` | `() => void` | Called when user stops speaking (triggered by endpointing) |
| `onAgentStartedSpeaking` | `() => void` | Called when agent starts speaking (simplifies `onAgentStateChange` + `onPlaybackStateChange`) |
| `onAgentStoppedSpeaking` | `() => void` | Called when agent stops speaking (simplifies `onAgentStateChange` + `onPlaybackStateChange`) |
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
| `start` | None | `Promise<void>` | Start all configured services (requires `transcriptionOptions` and/or `agentOptions`) |
| `stop` | None | `Promise<void>` | Stop all services and connections |
| `startTranscription` | None | `Promise<void>` | Start only transcription service (requires `transcriptionOptions`) |
| `stopTranscription` | None | `Promise<void>` | Stop transcription service |
| `startAgent` | None | `Promise<void>` | Start only agent service (requires `agentOptions`) |
| `stopAgent` | None | `Promise<void>` | Stop agent service |

### Agent Control Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `interruptAgent` | None | `void` | Interrupt agent while speaking |
| `sleep` | None | `void` | Put agent to sleep |
| `wake` | None | `void` | Wake agent from sleep |
| `toggleSleep` | None | `void` | Toggle between sleep and wake |
| `updateAgentInstructions` | `UpdateInstructionsPayload` | `void` | Update agent instructions |
| `injectMessage` | `role: 'agent' \| 'user', message: string` | `void` | Inject message as agent or user |

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

  const handlePlaybackStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  return (
    <div>
      <button onClick={stopAgent} disabled={!isPlaying}>
        Stop Agent Audio
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

**Why this approach is essential:**
- **`interruptAgent()`** immediately stops audio and clears Web Audio API buffers
- **Prevents memory leaks** from accumulated audio buffers
- **Avoids connection timeouts** caused by audio queue buildup
- **Parent controls audio** through `start()`/`interruptAgent()` pattern

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

- **`onAgentStartedSpeaking` / `onAgentStoppedSpeaking`** - Agent speaking event callbacks
  - *Why added*: Provides simplified, dedicated callbacks for agent audio state changes, reducing the need to monitor both `onAgentStateChange` and `onPlaybackStateChange` for basic agent speaking detection.

- **`onUserStartedSpeaking` / `onUserStoppedSpeaking`** - User speaking event callbacks  
  - *Why added*: Enables applications to provide real-time visual feedback during user speech and implement proper idle timeout management based on actual voice activity rather than microphone state.

- **`onUtteranceEnd`** - End-of-speech detection with word timing
  - *Why added*: Leverages Deepgram's built-in endpointing to provide precise end-of-speech detection with word-level timing data, enabling more accurate conversation flow control and idle timeout management.

- **`onUserMessage`** - User message handling callback
  - *Why added*: Provides a dedicated callback for user messages received from the server, enabling applications to track and display the complete conversation history including user inputs.

### Methods Added Since Fork

- **`injectMessage(role: 'agent' | 'user', message: string)`** - Unified text input support
  - *Why added*: Consolidates text input functionality into a single, flexible method that can inject messages as either agent or user, replacing the separate `injectAgentMessage` and `injectUserMessage` methods for better API consistency and reduced complexity.

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

1. **Manual Control Over Auto-Connect**: Removed automatic connection patterns in favor of explicit control, giving developers full control over when voice services are active.

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
- `onAgentMuteChange` - Replaced with `onAgentStoppedSpeaking` callback

#### **Removed Methods**
- `toggleMicrophone()` - Microphone control is not a component responsibility
- `resumeWithText()` / `resumeWithAudio()` - Redundant with `start()` method
- `connectWithContext()` / `connectTextOnly()` - Redundant with `start()` method
- `toggleTtsMute()` / `setTtsMuted()` - Replaced with `interruptAgent()` method
- `agentMute()` / `agentUnmute()` - Replaced with `interruptAgent()` method
- `getConnectionStates()` / `getState()` - Debug methods removed from public API

#### **Renamed Methods**
- `injectAgentMessage()` → `injectMessage('agent', message)` (deprecated, will be removed in v1.0.0)

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
  onAgentStoppedSpeaking={() => console.log('Agent stopped')}
/>

// Methods
voiceRef.current?.start(); // Explicit control
voiceRef.current?.interruptAgent(); // Unified audio control
voiceRef.current?.injectMessage('agent', "Hello"); // Unified text input
```

#### **Impact Assessment**
- **High Impact**: Applications using auto-connect will need to implement explicit control
- **Medium Impact**: Audio control patterns need to be updated to use `interruptAgent()`
- **Low Impact**: VAD event handling can be updated incrementally
- **Minimal Impact**: Text injection changes are straightforward

---

## Related Documentation

- **[Integration Guide](./INTEGRATION-GUIDE.md)** - Complete integration patterns and examples
- **[Audio Buffer Management](./AUDIO-BUFFER-MANAGEMENT.md)** - Comprehensive TTS audio stream management
- **[Technical Setup](./TECHNICAL-SETUP.md)** - Build configuration and technical requirements
- **[Development Guide](./DEVELOPMENT.md)** - Development workflow and testing
- **[Test App](../test-app/)** - Working examples and test scenarios

---

**Last Updated**: October 2025  
**Component Version**: 0.5.0+  
**React Version**: 16.8.0+
