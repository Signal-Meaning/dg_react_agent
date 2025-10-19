# API Changes in v1.0.0

## Overview

This document details all API surface changes in dg_react_agent v1.0.0, including new props, callback signatures, state properties, methods, and TypeScript types.

## Component Props Changes

### DeepgramVoiceInteractionProps Interface

#### Added Props
```typescript
interface DeepgramVoiceInteractionProps {
  // Existing props (unchanged)
  apiKey?: string;
  agentOptions?: AgentOptions;
  transcriptionOptions?: TranscriptionOptions;
  autoConnect?: boolean;
  debug?: boolean;
  
  // Existing callbacks (unchanged)
  onUserStartedSpeaking?: () => void;
  onAgentSilent?: () => void;
  onAgentSpeaking?: () => void;
  onAgentResponse?: (response: string) => void;
  onError?: (error: string) => void;
  
  // NEW: VAD event callbacks
  onUserStoppedSpeaking?: () => void;
  onUtteranceEnd?: (data: UtteranceEndData) => void;
  
  // NEW: State change callback
  onStateChange?: (state: VoiceInteractionState) => void;
}
```

#### New Callback Props

##### onUserStoppedSpeaking
```typescript
onUserStoppedSpeaking?: () => void;
```
**Purpose**: Called when the user stops speaking  
**Parameters**: None  
**Usage**: Handle user stopping speech, trigger timeouts, update UI

**Example:**
```typescript
<DeepgramVoiceInteraction
  onUserStoppedSpeaking={() => {
    console.log('User stopped speaking');
    setUserSpeaking(false);
    startResponseTimeout();
  }}
/>
```

##### onUtteranceEnd
```typescript
onUtteranceEnd?: (data: UtteranceEndData) => void;
```
**Purpose**: Called when a user utterance ends  
**Parameters**: `UtteranceEndData` object with utterance details  
**Usage**: Handle utterance completion, process speech data, trigger responses

**Example:**
```typescript
<DeepgramVoiceInteraction
  onUtteranceEnd={(data) => {
    console.log('Utterance ended:', data);
    if (data.isFinal && data.confidence > 0.8) {
      processUserUtterance(data);
    }
  }}
/>
```


##### onStateChange
```typescript
onStateChange?: (state: VoiceInteractionState) => void;
```
**Purpose**: Called when component state changes  
**Parameters**: Complete `VoiceInteractionState` object  
**Usage**: State synchronization, UI updates, analytics

**Example:**
```typescript
<DeepgramVoiceInteraction
  onStateChange={(state) => {
    setComponentState(state);
    updateUI(state);
    trackAnalytics(state);
  }}
/>
```

## State Interface Changes

### VoiceInteractionState Interface

#### Added Properties
```typescript
interface VoiceInteractionState {
  // Existing properties (unchanged)
  isReady: boolean;
  connections: Record<string, ConnectionState>;
  agentState: AgentState;
  microphonePermission: PermissionState;
  isRecording: boolean;
  isPlaying: boolean;
  error: string | null;
  micEnabledInternal: boolean;
  hasSentSettings: boolean;
  welcomeReceived: boolean;
  greetingInProgress: boolean;
  greetingStarted: boolean;
  isNewConnection: boolean;
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  
  // NEW: VAD-related state properties
  isUserSpeaking: boolean;
  lastUserSpeechTime: number | null;
  currentSpeechDuration: number | null;
  utteranceEndData: UtteranceEndData | null;
}
```

#### New State Properties

##### isUserSpeaking
```typescript
isUserSpeaking: boolean;
```
**Purpose**: Indicates whether the user is currently speaking  
**Type**: `boolean`  
**Usage**: UI updates, speech indicators, conversation flow control

**Example:**
```typescript
const { isUserSpeaking } = state;

return (
  <div>
    {isUserSpeaking && <div className="speaking-indicator">User is speaking...</div>}
  </div>
);
```

##### lastUserSpeechTime
```typescript
lastUserSpeechTime: number | null;
```
**Purpose**: Timestamp of the last speech activity  
**Type**: `number | null` (milliseconds since epoch)  
**Usage**: Speech timing analysis, timeout calculations, conversation analytics

**Example:**
```typescript
const { lastUserSpeechTime } = state;

if (lastUserSpeechTime) {
  const timeSinceLastSpeech = Date.now() - lastUserSpeechTime;
  console.log(`Time since last speech: ${timeSinceLastSpeech}ms`);
}
```

##### currentSpeechDuration
```typescript
currentSpeechDuration: number | null;
```
**Purpose**: Duration of current speech in milliseconds  
**Type**: `number | null`  
**Usage**: Real-time speech duration display, speech analysis

**Example:**
```typescript
const { currentSpeechDuration } = state;

if (currentSpeechDuration) {
  console.log(`Current speech duration: ${currentSpeechDuration}ms`);
}
```

##### utteranceEndData
```typescript
utteranceEndData: UtteranceEndData | null;
```
**Purpose**: Data from the most recent utterance end event  
**Type**: `UtteranceEndData | null`  
**Usage**: Access utterance details, speech analysis, conversation processing

**Example:**
```typescript
const { utteranceEndData } = state;

if (utteranceEndData) {
  console.log('Last utterance:', {
    duration: utteranceEndData.duration,
    confidence: utteranceEndData.confidence,
    isFinal: utteranceEndData.isFinal
  });
}
```

## New TypeScript Types

### UtteranceEndData Interface
```typescript
interface UtteranceEndData {
  duration: number;        // Speech duration in milliseconds
  timestamp: number;       // Timestamp when utterance ended
  confidence: number;      // Confidence score (0-1)
  isFinal: boolean;        // Whether this is the final utterance
  reason: 'end_of_speech' | 'timeout' | 'manual'; // Reason for end
}
```

**Usage:**
```typescript
const handleUtteranceEnd = (data: UtteranceEndData) => {
  console.log('Utterance ended:', {
    duration: data.duration,
    confidence: data.confidence,
    isFinal: data.isFinal,
    reason: data.reason
  });
};
```

### VADEvent Type
```typescript
type VADEvent = 
  | { type: 'UserStartedSpeaking' }
  | { type: 'UserStoppedSpeaking' }
  | { type: 'UtteranceEnd'; data: UtteranceEndData };
```

**Usage:**
```typescript
const handleVADEvent = (event: VADEvent) => {
  switch (event.type) {
    case 'UserStartedSpeaking':
      console.log('User started speaking');
      break;
    case 'UserStoppedSpeaking':
      console.log('User stopped speaking');
      break;
    case 'UtteranceEnd':
      console.log('Utterance ended:', event.data);
      break;
  }
};
```

### ConversationMessage Interface
```typescript
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
```

**Usage:**
```typescript
const { conversationHistory } = state;

conversationHistory.forEach((message: ConversationMessage) => {
  console.log(`${message.role}: ${message.content}`);
  console.log(`Timestamp: ${new Date(message.timestamp)}`);
});
```

## Component Methods Changes

### DeepgramVoiceInteractionHandle Interface

#### Added Methods
```typescript
interface DeepgramVoiceInteractionHandle {
  // Existing methods (unchanged)
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggleMic: () => Promise<void>;
  sendText: (text: string) => Promise<void>;
  clearAudio: () => void;
  
  // NEW: Lazy reconnection methods
  resumeWithText: (text: string) => Promise<void>;
  resumeWithAudio: () => Promise<void>;
  
  // NEW: Testing method
  triggerTimeoutForTesting: () => void;
}
```

#### New Methods

##### resumeWithText
```typescript
resumeWithText: (text: string) => Promise<void>;
```
**Purpose**: Reconnect with text input and conversation context  
**Parameters**: `text` - Text message to send  
**Returns**: `Promise<void>`  
**Usage**: Manual reconnection with context preservation

**Example:**
```typescript
const handleReconnection = async (text: string) => {
  try {
    await deepgramRef.current?.resumeWithText(text);
    console.log('Reconnected with text:', text);
  } catch (error) {
    console.error('Reconnection failed:', error);
  }
};
```

##### resumeWithAudio
```typescript
resumeWithAudio: () => Promise<void>;
```
**Purpose**: Reconnect with audio input and conversation context  
**Parameters**: None  
**Returns**: `Promise<void>`  
**Usage**: Manual audio reconnection with context preservation

**Example:**
```typescript
const handleAudioReconnection = async () => {
  try {
    await deepgramRef.current?.resumeWithAudio();
    console.log('Reconnected with audio');
  } catch (error) {
    console.error('Audio reconnection failed:', error);
  }
};
```

##### triggerTimeoutForTesting
```typescript
triggerTimeoutForTesting: () => void;
```
**Purpose**: Manually trigger connection timeout for testing  
**Parameters**: None  
**Returns**: `void`  
**Usage**: Testing lazy reconnection behavior

**Example:**
```typescript
const testTimeout = () => {
  deepgramRef.current?.triggerTimeoutForTesting();
  console.log('Timeout triggered for testing');
};
```

## Configuration Changes

### AgentOptions Interface

#### Enhanced Options
```typescript
interface AgentOptions {
  // Existing options (unchanged)
  language?: string;
  listenModel?: string;
  thinkProviderType?: string;
  thinkModel?: string;
  voice?: string;
  instructions?: string;
  greeting?: string;
  
  // NEW: Enhanced VAD options
  utteranceEndMs?: number;  // Timeout for utterance end detection
  vadThreshold?: number;    // Voice activity detection threshold
}
```

#### New Configuration Options

##### utteranceEndMs
```typescript
utteranceEndMs?: number;
```
**Purpose**: Timeout in milliseconds for utterance end detection  
**Type**: `number` (milliseconds)  
**Default**: `1000` (1 second)  
**Usage**: Control when utterances are considered complete

**Example:**
```typescript
const agentOptions: AgentOptions = {
  language: 'en',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful assistant.',
  utteranceEndMs: 2000, // 2 second timeout
};
```

##### vadThreshold
```typescript
vadThreshold?: number;
```
**Purpose**: Voice activity detection threshold  
**Type**: `number` (0-1)  
**Default**: `0.5`  
**Usage**: Control sensitivity of voice activity detection

**Example:**
```typescript
const agentOptions: AgentOptions = {
  language: 'en',
  voice: 'aura-asteria-en',
  instructions: 'You are a helpful assistant.',
  vadThreshold: 0.7, // Higher threshold for more sensitive detection
};
```

## Error Handling Changes

### Enhanced Error Information

#### Error Object Structure
```typescript
interface EnhancedError {
  message: string;
  code?: string;
  details?: any;
  timestamp: number;
  context?: string;
}
```

#### Error Categories
- **WebSocket Errors**: Connection and communication issues
- **Audio Errors**: Audio processing and playback issues
- **Permission Errors**: Microphone and audio permission issues
- **Configuration Errors**: Invalid configuration or API key issues
- **VAD Errors**: Voice activity detection issues

**Example:**
```typescript
const handleError = (error: string) => {
  console.error('Error occurred:', error);
  
  // Enhanced error handling
  if (error.includes('WebSocket')) {
    // Handle WebSocket errors
    handleWebSocketError(error);
  } else if (error.includes('Audio')) {
    // Handle audio errors
    handleAudioError(error);
  } else if (error.includes('Permission')) {
    // Handle permission errors
    handlePermissionError(error);
  }
};
```

## Breaking Changes Summary

### ⚠️ State Interface Changes
- **Added Properties**: New VAD-related state properties
- **Impact**: Existing code continues to work, new properties are optional
- **Migration**: No immediate action required, utilize new properties as needed

### ⚠️ Callback Signature Changes
- **New Callbacks**: VAD event callbacks added
- **Impact**: Existing callbacks unchanged, new callbacks are optional
- **Migration**: Add new callbacks for enhanced functionality

### ⚠️ Method Signature Changes
- **New Methods**: Lazy reconnection methods added
- **Impact**: Existing methods unchanged, new methods are optional
- **Migration**: Use new methods for enhanced reconnection capabilities

### ⚠️ Configuration Changes
- **New Options**: VAD configuration options added
- **Impact**: Existing configuration unchanged, new options are optional
- **Migration**: Add new options for enhanced VAD control

## Migration Examples

### Before (v0.x)
```typescript
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  agentOptions={{
    language: 'en',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.'
  }}
  onUserStartedSpeaking={() => console.log('User started')}
  onAgentResponse={(response) => console.log('Agent:', response)}
/>
```

### After (v1.0.0)
```typescript
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  agentOptions={{
    language: 'en',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.',
    utteranceEndMs: 2000,  // NEW: VAD configuration
    vadThreshold: 0.7       // NEW: VAD sensitivity
  }}
  onUserStartedSpeaking={() => console.log('User started')}
  onUserStoppedSpeaking={() => console.log('User stopped')}  // NEW: VAD callback
  onUtteranceEnd={(data) => console.log('Utterance ended:', data)}  // NEW: VAD callback
  onVADEvent={(event) => console.log('VAD event:', event)}  // NEW: VAD callback
  onStateChange={(state) => console.log('State:', state)}  // NEW: State callback
  onAgentResponse={(response) => console.log('Agent:', response)}
/>
```

### State Usage Migration

#### Before (v0.x)
```typescript
const { isReady, agentState, isRecording } = state;
```

#### After (v1.0.0)
```typescript
const { 
  isReady, 
  agentState, 
  isRecording,
  isUserSpeaking,        // NEW: VAD state
  currentSpeechDuration, // NEW: VAD state
  utteranceEndData       // NEW: VAD state
} = state;
```

### Method Usage Migration

#### Before (v0.x)
```typescript
// Manual reconnection without context
await deepgramRef.current?.start();
```

#### After (v1.0.0)
```typescript
// Lazy reconnection with context
await deepgramRef.current?.resumeWithText("Continue our conversation");
```

## Compatibility Notes

### Backward Compatibility
- **Existing Props**: All existing props continue to work unchanged
- **Existing Callbacks**: All existing callbacks continue to work unchanged
- **Existing State**: All existing state properties continue to work unchanged
- **Existing Methods**: All existing methods continue to work unchanged

### Forward Compatibility
- **New Features**: New features are optional and can be adopted gradually
- **Enhanced Functionality**: Enhanced functionality is additive, not replacing
- **Type Safety**: Complete TypeScript support for all new features

### Deprecation Warnings
- **No Deprecations**: No existing features are deprecated in v1.0.0
- **Future Considerations**: Some features may be deprecated in future versions
- **Migration Path**: Clear migration path provided for any future changes

---

**Related Documentation:**
- [MIGRATION.md](./MIGRATION.md) - Complete migration guide
- [NEW-FEATURES.md](./NEW-FEATURES.md) - Detailed feature documentation
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples and patterns
