# Deepgram Voice Interaction - Integration Guide

**Version**: 0.4.0+  
**Target Audience**: Voice-commerce teams, frontend developers, integration teams  
**Last Updated**: December 2024

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
  
  // TTS mute state
  ttsMuted: boolean;
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

  const handleAgentSpeaking = useCallback(() => {
    setIsSpeaking(true);
  }, []);

  const handleAgentSilent = useCallback(() => {
    setIsSpeaking(false);
  }, []);

  return (
    <DeepgramVoiceInteraction
      // ... other props
      onReady={handleReady}
      onAgentStateChange={handleAgentStateChange}
      onConnectionStateChange={handleConnectionStateChange}
      onAgentSpeaking={handleAgentSpeaking}
      onAgentSilent={handleAgentSilent}
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
        onAgentSpeaking={() => console.log('Agent speaking')}
        onAgentSilent={() => console.log('Agent finished')}
      />
    </div>
  );
}
```

### 2. Manual Control Pattern

**Use Case**: Applications that need full control over when voice interaction starts/stops.

```tsx
function ManualControlApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startInteraction = useCallback(async () => {
    try {
      await voiceRef.current?.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start:', error);
    }
  }, []);

  const stopInteraction = useCallback(async () => {
    try {
      await voiceRef.current?.stop();
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  }, []);

  const interruptAgent = useCallback(() => {
    voiceRef.current?.interruptAgent();
  }, []);

  return (
    <div>
      <button onClick={startInteraction} disabled={isRecording}>
        Start Voice Interaction
      </button>
      <button onClick={stopInteraction} disabled={!isRecording}>
        Stop Voice Interaction
      </button>
      <button onClick={interruptAgent} disabled={!isRecording}>
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

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;
    
    try {
      // Use lazy reconnect for text input
      await voiceRef.current?.resumeWithText(textInput);
      setTextInput('');
    } catch (error) {
      console.error('Failed to send text:', error);
    }
  }, [textInput]);

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
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        autoConnect={true}
        microphoneEnabled={false} // Start with mic disabled
      />
    </div>
  );
}
```

### 4. Voice Commerce Pattern

**Use Case**: E-commerce applications with voice shopping capabilities.

```tsx
function VoiceCommerceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [currentContext, setCurrentContext] = useState('browsing');

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: `You are a helpful e-commerce voice assistant. Help customers:
    - Find products by category, brand, or description
    - Check product availability and pricing
    - Process orders and answer shipping questions
    - Handle returns and exchanges
    - Provide product recommendations
    Be friendly, helpful, and concise.`,
    greeting: 'Welcome to our store! How can I help you find what you\'re looking for?'
  }), []);

  const switchToOrderMode = useCallback(() => {
    setCurrentContext('order');
    voiceRef.current?.updateAgentInstructions({
      instructions: `Help the customer with their order. They can check status, modify items, or get shipping updates.`
    });
  }, []);

  const switchToCustomerService = useCallback(() => {
    setCurrentContext('support');
    voiceRef.current?.updateAgentInstructions({
      instructions: `You are a customer service representative. Help with returns, exchanges, refunds, and general questions.`
    });
  }, []);

  return (
    <div>
      <div className="context-controls">
        <button onClick={switchToOrderMode}>Order Help</button>
        <button onClick={switchToCustomerService}>Customer Service</button>
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        autoConnect={true}
        onAgentUtterance={(utterance) => {
          // Handle agent responses for commerce flow
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
  onAgentSpeaking={() => {
    // Called when greeting starts playing
    console.log('Greeting started');
  }}
  onAgentSilent={() => {
    // Called when greeting finishes
    console.log('Ready for user input');
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
    timeout: 30, // 30 seconds
    wakeWords: ['hey assistant', 'wake up']
  }}
  onAgentStateChange={(state) => {
    if (state === 'sleeping') {
      console.log('Agent went to sleep due to inactivity');
    }
  }}
/>
```

### 5. Lazy Reconnection

The component supports lazy reconnection for better user experience:

```tsx
// Resume with text input
await voiceRef.current?.resumeWithText('Hello, I need help');

// Resume with audio input
await voiceRef.current?.resumeWithAudio();

// Connect with conversation context
await voiceRef.current?.connectWithContext(sessionId, history, options);
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

## 🎯 Advanced Features

### 1. TTS Mute Control

```tsx
function TTSControlApp() {
  const [isTtsMuted, setIsTtsMuted] = useState(false);
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const toggleTtsMute = useCallback(() => {
    voiceRef.current?.toggleTtsMute();
  }, []);

  const handleTtsMuteToggle = useCallback((muted: boolean) => {
    setIsTtsMuted(muted);
    console.log(`TTS ${muted ? 'muted' : 'unmuted'}`);
  }, []);

  return (
    <div>
      <button 
        onClick={toggleTtsMute}
        className={isTtsMuted ? 'muted' : 'unmuted'}
      >
        {isTtsMuted ? '🔇 TTS MUTED' : '🔊 TTS ENABLED'}
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        ttsMuted={isTtsMuted}
        onTtsMuteToggle={handleTtsMuteToggle}
      />
    </div>
  );
}
```

### 2. VAD (Voice Activity Detection) Events

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

  const handleVADEvent = useCallback((data: { speechDetected: boolean; confidence?: number }) => {
    setVadEvents(prev => [...prev, `VAD: ${data.speechDetected ? 'Speech detected' : 'No speech'}`]);
  }, []);

  return (
    <div>
      <div className="vad-events">
        <h3>VAD Events:</h3>
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
        onVADEvent={handleVADEvent}
      />
    </div>
  );
}
```

### 3. Dynamic Instructions Update

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

**Cause**: Non-memoized options props  
**Solution**: Always use `useMemo` for options

```tsx
// ❌ WRONG - causes infinite re-initialization
<DeepgramVoiceInteraction
  agentOptions={{
    language: 'en',
    instructions: 'You are helpful'
  }}
/>

// ✅ CORRECT - memoized options
const agentOptions = useMemo(() => ({
  language: 'en',
  instructions: 'You are helpful'
}), []);

<DeepgramVoiceInteraction agentOptions={agentOptions} />
```

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

## 🎯 Voice Commerce Specific Patterns

### 1. Product Search Integration

```tsx
function ProductSearchApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [searchResults, setSearchResults] = useState([]);

  const handleTranscript = useCallback((transcript: TranscriptResponse) => {
    const text = transcript.channel.alternatives[0].transcript;
    
    // Trigger product search based on transcript
    if (text.includes('search for') || text.includes('find')) {
      performProductSearch(text);
    }
  }, []);

  const performProductSearch = useCallback(async (query: string) => {
    // Extract search terms
    const searchTerms = query.replace(/search for|find/gi, '').trim();
    
    // Call your product search API
    const results = await searchProducts(searchTerms);
    setSearchResults(results);
    
    // Update agent with search results
    voiceRef.current?.updateAgentInstructions({
      instructions: `Help the customer with these search results: ${JSON.stringify(results)}`
    });
  }, []);

  return (
    <div>
      <div className="search-results">
        {searchResults.map(product => (
          <div key={product.id}>{product.name}</div>
        ))}
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        transcriptionOptions={transcriptionOptions}
        agentOptions={agentOptions}
        onTranscriptUpdate={handleTranscript}
      />
    </div>
  );
}
```

### 2. Order Management Integration

```tsx
function OrderManagementApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [currentOrder, setCurrentOrder] = useState(null);

  const switchToOrderMode = useCallback((orderId: string) => {
    // Load order details
    const order = loadOrder(orderId);
    setCurrentOrder(order);
    
    // Update agent with order context
    voiceRef.current?.updateAgentInstructions({
      instructions: `Help the customer with their order #${orderId}. Order details: ${JSON.stringify(order)}`
    });
  }, []);

  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    // Process agent responses for order management
    if (utterance.text.includes('add to cart')) {
      // Extract product and add to cart
    } else if (utterance.text.includes('checkout')) {
      // Proceed to checkout
    }
  }, []);

  return (
    <div>
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onAgentUtterance={handleAgentUtterance}
      />
    </div>
  );
}
```

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

**Last Updated**: December 2024  
**Component Version**: 0.4.0+  
**React Version**: 16.8.0+
