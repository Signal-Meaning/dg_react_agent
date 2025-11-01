# Deepgram Voice Interaction - Integration Guide

**Version**: 0.4.0+  
**Target Audience**: Voice-commerce teams, frontend developers, integration teams  
**Last Updated**: October 2025

## 🎯 Overview

This comprehensive integration guide provides everything you need to successfully integrate the `DeepgramVoiceInteraction` component into your React applications. The component is a **headless** React component that provides real-time transcription and/or AI agent interaction using Deepgram's WebSocket APIs.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Component Modes](#component-modes)
3. [State Management](#state-management)
4. [Integration Patterns](#integration-patterns)
5. [Asynchronous Behaviors](#asynchronous-behaviors)
6. [Error Handling](#error-handling)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## 🚀 Quick Start

### Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react
```

> **Note**: For technical setup requirements (webpack configuration, React externalization, etc.), see [TECHNICAL-SETUP.md](./TECHNICAL-SETUP.md)

### Basic Integration

```tsx
import React, { useRef, useMemo } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function MyVoiceApp() {
  const voiceRef = useRef(null);

  // CRITICAL: Memoize options to prevent infinite re-initialization
  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful voice assistant.',
    greeting: 'Hello! How can I help you today?'
  }), []);

  return (
    <DeepgramVoiceInteraction
      ref={voiceRef}
      apiKey="your-deepgram-api-key"
      agentOptions={agentOptions}
      onReady={() => console.log('Voice interaction ready')}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

---

## 🎛️ Component Modes

The component operates in **three distinct modes** depending on the options provided:

### 1. Dual Mode (Transcription + Agent)

**Use Case**: Applications that need both live transcription display and AI agent interaction.

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

### 2. Transcription-Only Mode

**Use Case**: Applications that only need speech-to-text capabilities.

```tsx
const transcriptionOptions = useMemo(() => ({
  model: 'nova-3',
  language: 'en-US',
  smart_format: true,
  interim_results: true
}), []);

<DeepgramVoiceInteraction
  apiKey={apiKey}
  transcriptionOptions={transcriptionOptions}
  // NO agentOptions prop - completely omit it
  onTranscriptUpdate={(transcript) => setTranscript(transcript)}
/>
```

### 3. Agent-Only Mode

**Use Case**: Voice assistant applications that don't need separate transcription results.

```tsx
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
  // NO transcriptionOptions prop - completely omit it
  agentOptions={agentOptions}
  onAgentUtterance={(utterance) => setAgentResponse(utterance.text)}
/>
```

### ⚠️ Critical Mode Selection Rules

1. **Never pass empty objects** (`{}`) for options you don't want to use
2. **Completely omit** the prop instead of passing `undefined` or `null`
3. **Always memoize** options objects with `useMemo` to prevent infinite re-initialization

---

## 🔄 State Management

### Component State Overview

The component manages complex internal state that you can monitor through callbacks:

```tsx
interface VoiceInteractionState {
  // Connection states
  connections: {
    transcription: 'closed' | 'connecting' | 'open' | 'closing';
    agent: 'closed' | 'connecting' | 'open' | 'closing';
  };
  
  // Agent states
  agentState: 'idle' | 'listening' | 'thinking' | 'speaking' | 'entering_sleep' | 'sleeping';
  
  // Audio states
  isRecording: boolean;
  isPlaying: boolean;
  microphonePermission: 'granted' | 'denied' | 'prompt';
  
  // Overall state
  isReady: boolean;
  error: string | null;
  
  // VAD (Voice Activity Detection) states
  isUserSpeaking: boolean;
  lastUserSpeechTime: number | null;
  
}
```

### State Management Patterns

#### 1. Basic State Tracking

```tsx
function VoiceApp() {
  const [isReady, setIsReady] = useState(false);
  const [agentState, setAgentState] = useState('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleReady = useCallback((ready: boolean) => {
    setIsReady(ready);
  }, []);

  const handleAgentStateChange = useCallback((state: AgentState) => {
    setAgentState(state);
  }, []);

  const handleConnectionStateChange = useCallback((service: ServiceType, state: ConnectionState) => {
    if (service === 'agent') {
      setIsConnected(state === 'open');
    }
  }, []);

  const handleAgentStartedSpeaking = useCallback(() => {
    setIsSpeaking(true);
  }, []);

  const handlePlaybackStateChange = useCallback((isPlaying: boolean) => {
    setIsSpeaking(isPlaying);
    // This fires when playback actually completes - agent has truly stopped speaking
    if (!isPlaying) {
      // Agent playback finished
    }
  }, []);

  return (
    <DeepgramVoiceInteraction
      // ... other props
      onReady={handleReady}
      onAgentStateChange={handleAgentStateChange}
      onConnectionStateChange={handleConnectionStateChange}
      onAgentStartedSpeaking={handleAgentStartedSpeaking}
      onPlaybackStateChange={handlePlaybackStateChange}
    />
  );
}
```

#### 2. Advanced State Management with Reducer

```tsx
interface VoiceAppState {
  isReady: boolean;
  agentState: AgentState;
  connectionStates: Record<ServiceType, ConnectionState>;
  isUserSpeaking: boolean;
  isAgentSpeaking: boolean;
  transcript: string;
  agentResponse: string;
  error: string | null;
}

function voiceAppReducer(state: VoiceAppState, action: any): VoiceAppState {
  switch (action.type) {
    case 'SET_READY':
      return { ...state, isReady: action.payload };
    case 'SET_AGENT_STATE':
      return { ...state, agentState: action.payload };
    case 'SET_CONNECTION_STATE':
      return { 
        ...state, 
        connectionStates: { 
          ...state.connectionStates, 
          [action.payload.service]: action.payload.state 
        } 
      };
    case 'SET_USER_SPEAKING':
      return { ...state, isUserSpeaking: action.payload };
    case 'SET_AGENT_SPEAKING':
      return { ...state, isAgentSpeaking: action.payload };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload };
    case 'SET_AGENT_RESPONSE':
      return { ...state, agentResponse: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

function AdvancedVoiceApp() {
  const [state, dispatch] = useReducer(voiceAppReducer, {
    isReady: false,
    agentState: 'idle',
    connectionStates: { transcription: 'closed', agent: 'closed' },
    isUserSpeaking: false,
    isAgentSpeaking: false,
    transcript: '',
    agentResponse: '',
    error: null
  });

  const handleReady = useCallback((ready: boolean) => {
    dispatch({ type: 'SET_READY', payload: ready });
  }, []);

  const handleAgentStateChange = useCallback((agentState: AgentState) => {
    dispatch({ type: 'SET_AGENT_STATE', payload: agentState });
  }, []);

  // ... other handlers

  return (
    <div>
      <div>Status: {state.isReady ? 'Ready' : 'Not Ready'}</div>
      <div>Agent: {state.agentState}</div>
      <div>User Speaking: {state.isUserSpeaking ? 'Yes' : 'No'}</div>
      <div>Agent Speaking: {state.isAgentSpeaking ? 'Yes' : 'No'}</div>
      
      <DeepgramVoiceInteraction
        // ... props with handlers
      />
    </div>
  );
}
```

---

## 🔧 Integration Patterns

### 1. Auto-Connect Dual Mode

**Use Case**: Applications that want immediate voice interaction readiness.

```tsx
function AutoConnectApp() {
  const [micEnabled, setMicEnabled] = useState(false);
  const [connectionReady, setConnectionReady] = useState(false);

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful voice assistant.',
    greeting: 'Hello! I\'m ready to help. Click the microphone to start speaking.'
  }), []);

  const handleConnectionReady = useCallback(() => {
    setConnectionReady(true);
    console.log('Dual mode connection established and settings sent');
  }, []);

  const handleMicToggle = useCallback((enabled: boolean) => {
    setMicEnabled(enabled);
  }, []);

  return (
    <div>
      {connectionReady && (
        <div className="status-indicator">
          {micEnabled ? '🎤 Ready to speak' : '🔇 Microphone disabled'}
        </div>
      )}
      
      <DeepgramVoiceInteraction
        apiKey={apiKey}
        agentOptions={agentOptions}
        autoConnect={true}
        microphoneEnabled={micEnabled}
        onConnectionReady={handleConnectionReady}
        onMicToggle={handleMicToggle}
        onAgentStartedSpeaking={() => console.log('Agent speaking')}
        onPlaybackStateChange={(isPlaying) => {
          if (!isPlaying) console.log('Agent playback completed');
        }}
      />
    </div>
  );
}
```

### 2. Basic Control Pattern

**Use Case**: Applications that need full control over when voice interaction starts/stops.

```tsx
function BasicControlApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isConnected, setIsConnected] = useState(false);

  const startInteraction = useCallback(async () => {
    try {
      await voiceRef.current?.start();
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to start:', error);
    }
  }, []);

  const stopInteraction = useCallback(async () => {
    try {
      await voiceRef.current?.stop();
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  }, []);

  const interruptAgent = useCallback(() => {
    voiceRef.current?.interruptAgent();
  }, []);

  return (
    <div>
      <button onClick={startInteraction} disabled={isConnected}>
        Start Voice Interaction
      </button>
      <button onClick={stopInteraction} disabled={!isConnected}>
        Stop Voice Interaction
      </button>
      <button onClick={interruptAgent} disabled={!isConnected}>
        Interrupt Agent
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onReady={() => console.log('Ready')}
      />
    </div>
  );
}
```

### 3. Text-Only Mode

**Use Case**: Applications that want to support both voice and text input.

```tsx
function TextAndVoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [textInput, setTextInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;
    
    try {
      // Inject text message to agent
      voiceRef.current?.injectUserMessage(textInput);
      setTextInput('');
    } catch (error) {
      console.error('Failed to send text:', error);
    }
  }, [textInput]);

  const toggleConnection = useCallback(async () => {
    if (isConnected) {
      await voiceRef.current?.stop();
      setIsConnected(false);
    } else {
      await voiceRef.current?.start();
      setIsConnected(true);
    }
  }, [isConnected]);

  return (
    <div>
      <div>
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
          placeholder="Type your message..."
        />
        <button onClick={handleTextSubmit}>Send</button>
      </div>
      
      <button onClick={toggleConnection}>
        {isConnected ? 'Disconnect' : 'Connect'}
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onReady={() => console.log('Ready')}
      />
    </div>
  );
}
```

### 4. Dynamic Context Switching Pattern

**Use Case**: Applications that need to change agent behavior based on user context or page state.

```tsx
function DynamicContextApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [currentMode, setCurrentMode] = useState('general');

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.',
    greeting: 'Hello! How can I help you today?'
  }), []);

  const switchToMode = useCallback((mode: string) => {
    const instructions = {
      general: 'You are a helpful assistant.',
      customer_service: 'You are a customer service representative. Help with returns, exchanges, and general questions.',
      technical: 'You are a technical support specialist. Help with technical issues and troubleshooting.',
      sales: 'You are a sales assistant. Help customers find products and make purchases.'
    };

    voiceRef.current?.updateAgentInstructions({
      instructions: instructions[mode] || instructions.general
    });
    
    setCurrentMode(mode);
  }, []);

  return (
    <div>
      <div className="mode-controls">
        <button onClick={() => switchToMode('general')}>General</button>
        <button onClick={() => switchToMode('customer_service')}>Customer Service</button>
        <button onClick={() => switchToMode('technical')}>Technical</button>
        <button onClick={() => switchToMode('sales')}>Sales</button>
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        autoConnect={true}
        onAgentUtterance={(utterance) => {
          console.log('Agent response:', utterance.text);
        }}
      />
    </div>
  );
}
```

---

## ⏱️ Asynchronous Behaviors

### 1. Auto-Connect Timing

The auto-connect feature establishes connections immediately when the component mounts:

```tsx
// Auto-connect behavior
<DeepgramVoiceInteraction
  autoConnect={true}  // Connects immediately on mount
  microphoneEnabled={false}  // Mic disabled by default
  onConnectionReady={() => {
    // Called when both connections are established and settings sent
    console.log('Ready for voice interaction');
  }}
/>
```

### 2. Settings Application Timing

Settings are sent to the agent service immediately after connection:

```tsx
const agentOptions = useMemo(() => ({
  instructions: 'You are a helpful assistant.',
  greeting: 'Hello! How can I help?',
  voice: 'aura-asteria-en'
}), []);

// Settings are sent automatically when autoConnect=true
// onConnectionReady is called after settings are confirmed
```

### 3. Greeting Playback

The greeting plays automatically when the agent connection is ready:

```tsx
<DeepgramVoiceInteraction
  agentOptions={{
    greeting: 'Welcome! I\'m ready to help you.',
    // ... other options
  }}
  onAgentStartedSpeaking={() => {
    // Called when greeting starts playing
    console.log('Greeting started');
  }}
  onPlaybackStateChange={(isPlaying) => {
    if (!isPlaying) {
      // Called when greeting playback actually completes
      console.log('Ready for user input - playback finished');
    }
  }}
/>
```

### 4. Idle Timeout Behavior

The component implements complex idle timeout logic:

```tsx
// Idle timeout is handled automatically
// Default: 10 seconds of inactivity before timeout
// Can be configured via sleepOptions

<DeepgramVoiceInteraction
  sleepOptions={{
    autoSleep: true,
    timeout: 30 // 30 seconds
  }}
  onAgentStateChange={(state) => {
    if (state === 'sleeping') {
      console.log('Agent went to sleep due to inactivity');
    }
  }}
/>
```

### 5. Context Switching and Reconnection

The component handles context switching and reconnection through simple start/stop patterns. Session management is handled internally for seamless user experience.

**How it works:**
- The component automatically manages session IDs and conversation history internally
- Context changes are handled by updating props and calling `start()`
- The component preserves conversation context across reconnections
- No need to manually manage sessions or conversation history

```tsx
// Change context by updating props and restarting
const switchToCustomerService = useCallback(() => {
  setAgentOptions({
    ...agentOptions,
    instructions: 'You are a customer service representative...'
  });
  // Component will use new instructions on next start()
}, [agentOptions]);

// Simple reconnection pattern
const reconnect = useCallback(async () => {
  await voiceRef.current?.stop();
  await voiceRef.current?.start();
}, []);

// Text input during conversation
const sendTextMessage = useCallback((text: string) => {
  voiceRef.current?.injectUserMessage(text);
}, []);
```

**Simplified Session Management:**
```tsx
// Session management is handled internally
// No need to access session IDs or conversation history
// Component automatically maintains context across reconnections
```

---

## 🚨 Error Handling

### 1. Comprehensive Error Handling

```tsx
function ErrorHandlingApp() {
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleError = useCallback((error: DeepgramError) => {
    console.error('Voice interaction error:', error);
    setError(error.message);
    
    // Handle specific error types
    switch (error.service) {
      case 'transcription':
        console.error('Transcription service error');
        break;
      case 'agent':
        console.error('Agent service error');
        break;
      default:
        console.error('Unknown service error');
    }
  }, []);

  const retryConnection = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setError(null);
    // Component will automatically retry
  }, []);

  return (
    <div>
      {error && (
        <div className="error-banner">
          <p>Error: {error}</p>
          <button onClick={retryConnection}>
            Retry ({retryCount} attempts)
          </button>
        </div>
      )}
      
      <DeepgramVoiceInteraction
        apiKey={apiKey}
        agentOptions={agentOptions}
        onError={handleError}
      />
    </div>
  );
}
```

### 2. Network Error Recovery

```tsx
function NetworkResilientApp() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleConnectionStateChange = useCallback((service: ServiceType, state: ConnectionState) => {
    if (state === 'closed' && isOnline) {
      setConnectionAttempts(prev => prev + 1);
    }
  }, [isOnline]);

  return (
    <div>
      <div className="network-status">
        Status: {isOnline ? 'Online' : 'Offline'}
        {connectionAttempts > 0 && (
          <span> (Reconnection attempts: {connectionAttempts})</span>
        )}
      </div>
      
      <DeepgramVoiceInteraction
        apiKey={apiKey}
        agentOptions={agentOptions}
        onConnectionStateChange={handleConnectionStateChange}
        onError={(error) => {
          if (error.message.includes('network')) {
            console.log('Network error detected, will retry when online');
          }
        }}
      />
    </div>
  );
}
```

---

## 🔧 Simplified API Approach

The component follows a **simplified API design** that reduces complexity and confusion:

### **Core Methods: `start()` and `stop()`**

The component provides only **two primary methods** for connection control:

- **`start()`** - Connects to all configured services (transcription + agent)
- **`stop()`** - Disconnects from all services

This approach eliminates the need for complex reconnection methods and session management APIs.

### **Mode-Based Configuration**

The component automatically determines which services to use based on props:

- **Dual Mode**: Both `transcriptionOptions` and `agentOptions` provided
- **Transcription-Only**: Only `transcriptionOptions` provided  
- **Agent-Only**: Only `agentOptions` provided

### **Internal Session Management**

Session IDs and conversation history are managed internally:
- No need to manually track sessions
- Context is preserved across reconnections
- Developers focus on business logic, not session management

### **Removed Redundant APIs**

The following APIs have been removed to reduce confusion:
- ❌ `resumeWithText()` / `resumeWithAudio()` - Use `start()`/`stop()` instead
- ❌ `connectWithContext()` - Update props and call `start()`
- ❌ `connectTextOnly()` - Use agent-only mode
- ❌ `toggleMicrophone()` - Use `start()`/`stop()` for connection control
- ❌ `onMicToggle` - Not needed with simplified approach
- ❌ `onVADEvent` - Use `onUtteranceEnd` for better accuracy
- ❌ `onKeepalive` - Internal logging only, no developer value
- ❌ `agentMute()` / `agentUnmute()` - Use `interruptAgent()` instead
- ❌ `toggleTtsMute()` / `setTtsMuted()` - Use `interruptAgent()` instead
- ❌ `agentMuted` prop - Not needed with simplified approach
- ❌ `onAgentMuteChange` - Not needed with simplified approach

---

## 🎯 Advanced Features

This section covers advanced integration patterns and features that provide fine-grained control over voice interactions. These features are essential for building production-ready voice applications with proper user experience and performance.

### 1. Agent Audio Control

**Purpose**: Demonstrates how to provide users with immediate control over agent audio playback, essential for user experience and preventing audio-related issues.

**Context**: Users need the ability to stop agent speech immediately, whether for interruption, error recovery, or user preference. The `interruptAgent()` method provides this control while properly managing audio buffers.

**Use Cases**: User interruption, error recovery, audio buffer management, accessibility controls.

```tsx
function AgentAudioControlApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const stopAgent = useCallback(() => {
    voiceRef.current?.interruptAgent();
  }, []);

  return (
    <div>
      <button onClick={stopAgent}>
        Stop Agent
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

### 2. Voice Activity Detection Events

**Purpose**: Shows how to implement real-time visual feedback and proper conversation flow control using voice activity detection events.

**Context**: VAD events provide precise timing information about when users start and stop speaking, enabling applications to provide visual feedback, manage idle timeouts, and control conversation flow more accurately than microphone state alone.

**Use Cases**: Visual feedback during speech, idle timeout management, conversation flow control, accessibility features.

```tsx
function VADEventApp() {
  const [vadEvents, setVadEvents] = useState<string[]>([]);

  const handleUserStartedSpeaking = useCallback(() => {
    setVadEvents(prev => [...prev, 'User started speaking']);
  }, []);

  const handleUserStoppedSpeaking = useCallback(() => {
    setVadEvents(prev => [...prev, 'User stopped speaking']);
  }, []);

  const handleUtteranceEnd = useCallback((data: { channel: number[]; lastWordEnd: number }) => {
    setVadEvents(prev => [...prev, `Utterance ended: ${data.lastWordEnd}s`]);
  }, []);

  return (
    <div>
      <div className="vad-events">
        <h3>Voice Activity Events:</h3>
        {vadEvents.map((event, index) => (
          <div key={index}>{event}</div>
        ))}
      </div>
      
      <DeepgramVoiceInteraction
        apiKey={apiKey}
        transcriptionOptions={{
          vad_events: true,
          utterance_end_ms: 1000
        }}
        agentOptions={agentOptions}
        onUserStartedSpeaking={handleUserStartedSpeaking}
        onUserStoppedSpeaking={handleUserStoppedSpeaking}
        onUtteranceEnd={handleUtteranceEnd}
      />
    </div>
  );
}
```

### 3. Dynamic Instructions Update

**Purpose**: Demonstrates how to update agent behavior in real-time without restarting the voice interaction, enabling dynamic conversation modes and context switching.

**Context**: Many voice applications need to change agent behavior based on user context, conversation state, or application mode. The `updateAgentInstructions()` method allows this without disrupting ongoing voice interaction.

**Use Cases**: Context switching, mode changes, personalized responses, conversation state management.

```tsx
function DynamicInstructionsApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [currentMode, setCurrentMode] = useState('general');

  const updateInstructions = useCallback((mode: string) => {
    const instructions = {
      general: 'You are a helpful assistant.',
      customer_service: 'You are a customer service representative. Help with returns, exchanges, and general questions.',
      sales: 'You are a sales assistant. Help customers find products and make purchases.',
      technical: 'You are a technical support specialist. Help with technical issues and troubleshooting.'
    };

    voiceRef.current?.updateAgentInstructions({
      instructions: instructions[mode] || instructions.general
    });
    
    setCurrentMode(mode);
  }, []);

  return (
    <div>
      <div className="mode-selector">
        <button onClick={() => updateInstructions('general')}>General</button>
        <button onClick={() => updateInstructions('customer_service')}>Customer Service</button>
        <button onClick={() => updateInstructions('sales')}>Sales</button>
        <button onClick={() => updateInstructions('technical')}>Technical</button>
      </div>
      
      <div>Current mode: {currentMode}</div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
      />
    </div>
  );
}
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. "Invalid hook call" Error

**Cause**: Multiple React instances or improper externalization  
**Solution**: Ensure React is properly externalized in your build configuration

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      'react': 'react',
      'react-dom': 'react-dom'
    }
  }
};
```

#### 2. Infinite Re-initialization

**Cause**: Non-memoized options props causing constant component re-initialization  
**Solution**: Always use `useMemo` for options (see [Memoization Requirements](#1-memoization-requirements) below for detailed guidance)

**Why this happens**: React re-renders cause new object creation, triggering component re-initialization and WebSocket reconnections.

**Quick Fix**: Memoize options with `useMemo` and empty dependency arrays for static configurations.

#### 3. Microphone Permission Denied

**Cause**: Browser security restrictions  
**Solution**: Guide users to enable microphone access

```tsx
const handleError = useCallback((error: DeepgramError) => {
  if (error.message.includes('microphone') || error.message.includes('permission')) {
    // Show user-friendly message
    setError('Please enable microphone access to use voice features');
  }
}, []);
```

#### 4. Connection Timeout Issues

**Cause**: Network issues or API key problems  
**Solution**: Implement retry logic and user feedback

```tsx
const [connectionRetries, setConnectionRetries] = useState(0);

const handleConnectionStateChange = useCallback((service: ServiceType, state: ConnectionState) => {
  if (state === 'closed' && connectionRetries < 3) {
    setConnectionRetries(prev => prev + 1);
    // Component will automatically retry
  }
}, [connectionRetries]);
```

### Debug Mode

Enable debug mode for detailed logging:

```tsx
<DeepgramVoiceInteraction
  apiKey={apiKey}
  agentOptions={agentOptions}
  debug={true}  // Enable detailed logging
  onLog={(log) => console.log('Voice Debug:', log)}
/>
```

---

## 📚 Best Practices

### 1. Memoization Requirements

**CRITICAL**: Always memoize options objects to prevent infinite re-initialization:

```tsx
// ✅ CORRECT
const agentOptions = useMemo(() => ({
  language: 'en',
  listenModel: 'nova-3',
  instructions: 'You are helpful'
}), []); // Empty dependency array for static config

const transcriptionOptions = useMemo(() => ({
  model: 'nova-3',
  language: 'en-US',
  smart_format: true
}), []);

// ❌ WRONG - causes infinite re-initialization
<DeepgramVoiceInteraction
  agentOptions={{
    language: 'en',
    instructions: 'You are helpful'
  }}
/>
```

### 2. Error Handling Strategy

```tsx
const handleError = useCallback((error: DeepgramError) => {
  // Log error for debugging
  console.error('Voice interaction error:', error);
  
  // Show user-friendly message
  setUserMessage(`Voice error: ${error.message}`);
  
  // Handle specific error types
  if (error.service === 'agent') {
    // Agent-specific error handling
  } else if (error.service === 'transcription') {
    // Transcription-specific error handling
  }
}, []);
```

### 3. State Management Patterns

```tsx
// Use reducer for complex state
const [state, dispatch] = useReducer(voiceReducer, initialState);

// Use refs for imperative operations
const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

// Use callbacks for event handlers
const handleReady = useCallback((ready: boolean) => {
  dispatch({ type: 'SET_READY', payload: ready });
}, []);
```

### 4. Performance Optimization

```tsx
// Memoize expensive calculations
const processedTranscript = useMemo(() => {
  return transcript ? transcript.toUpperCase() : '';
}, [transcript]);

// Debounce rapid state changes
const debouncedTranscript = useDebounce(transcript, 300);
```

### 5. Accessibility Considerations

```tsx
// Provide keyboard alternatives
<button
  onClick={toggleMicrophone}
  onKeyDown={(e) => e.key === 'Enter' && toggleMicrophone()}
  aria-label={micEnabled ? 'Disable microphone' : 'Enable microphone'}
>
  {micEnabled ? '🎤' : '🔇'}
</button>

// Announce state changes to screen readers
useEffect(() => {
  if (agentState === 'speaking') {
    // Announce to screen readers
  }
}, [agentState]);
```

---

## 📚 Related Documentation

- **[API Reference](./API-REFERENCE.md)** - Complete component API documentation
- **[Technical Setup](./TECHNICAL-SETUP.md)** - Build configuration and technical requirements  
- **[Development Guide](./DEVELOPMENT.md)** - Development workflow and testing
- **[Test App](../test-app/)** - Working examples and test scenarios
- **[VAD Events Reference](./VAD-EVENTS-REFERENCE.md)** - Voice Activity Detection events
- **[Test Utilities](./TEST-UTILITIES.md)** - Testing helpers and utilities

---

## 📞 Support and Resources

### Getting Help

- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check the [release documentation](./releases/README.md)
- **Examples**: See [test-app](../test-app/) for working examples

### Additional Resources

- **API Reference**: Complete prop and method documentation
- **Migration Guide**: Updates for existing integrations
- **Test Suite**: 268 tests with 90%+ coverage

---

**Last Updated**: October 2025  
**Component Version**: 0.4.0+  
**React Version**: 16.8.0+
