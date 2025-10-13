# New Features in v1.0.0

## Overview

dg_react_agent v1.0.0 introduces significant new features focused on Voice Activity Detection (VAD), enhanced state management, lazy reconnection, and improved developer experience.

## 🎤 Voice Activity Detection (VAD) Events

### Feature Overview
Comprehensive Voice Activity Detection system that provides real-time information about user speech patterns, enabling more sophisticated voice interaction experiences.

### Key Benefits
- **Real-time Speech Detection**: Know exactly when users start and stop speaking
- **Utterance Boundary Detection**: Detect natural speech boundaries for better conversation flow
- **Enhanced UX**: Create more responsive and intelligent voice interfaces
- **Natural Conversation Flow**: Enable more natural conversation patterns

### Implementation

#### UserStoppedSpeaking Event
Detect when the user stops speaking.

```typescript
<DeepgramVoiceInteraction
  onUserStoppedSpeaking={() => {
    console.log('User stopped speaking');
    // Handle user stopping speech
    setUserSpeaking(false);
    // Could trigger agent response or timeout
  }}
/>
```

**Use Cases:**
- Trigger agent responses after user stops speaking
- Implement speech timeout handling
- Create responsive UI that reacts to speech patterns
- Enable hands-free interaction modes

#### UtteranceEnd Event
Detect the end of user utterances with detailed information.

```typescript
<DeepgramVoiceInteraction
  onUtteranceEnd={(data: UtteranceEndData) => {
    console.log('Utterance ended:', data);
    // data includes:
    // - duration: number (speech duration in ms)
    // - timestamp: number (when utterance ended)
    // - confidence: number (confidence score)
    // - isFinal: boolean (whether this is final)
    
    // Handle utterance end
    if (data.isFinal) {
      processUserUtterance(data);
    }
  }}
/>
```

**UtteranceEndData Interface:**
```typescript
interface UtteranceEndData {
  duration: number;        // Speech duration in milliseconds
  timestamp: number;       // Timestamp when utterance ended
  confidence: number;      // Confidence score (0-1)
  isFinal: boolean;        // Whether this is the final utterance
  reason: 'end_of_speech' | 'timeout' | 'manual'; // Reason for end
}
```

**Use Cases:**
- Implement natural conversation flow
- Handle speech timeouts intelligently
- Create adaptive response timing
- Enable conversation analytics

#### VADEvent Callback
Comprehensive VAD event handling for all voice activity events.

```typescript
<DeepgramVoiceInteraction
  onVADEvent={(event: VADEvent) => {
    console.log('VAD event:', event);
    
    switch (event.type) {
      case 'UserStartedSpeaking':
        handleUserStartedSpeaking();
        break;
      case 'UserStoppedSpeaking':
        handleUserStoppedSpeaking();
        break;
      case 'UtteranceEnd':
        handleUtteranceEnd(event.data);
        break;
    }
  }}
/>
```

**VADEvent Interface:**
```typescript
type VADEvent = 
  | { type: 'UserStartedSpeaking' }
  | { type: 'UserStoppedSpeaking' }
  | { type: 'UtteranceEnd'; data: UtteranceEndData };
```

**Use Cases:**
- Centralized VAD event handling
- Complex voice interaction logic
- Custom voice activity analytics
- Integration with external voice processing systems

### State Integration

#### Real-time VAD State
Access VAD information through the component state.

```typescript
const { 
  isUserSpeaking, 
  lastUserSpeechTime, 
  currentSpeechDuration,
  utteranceEndData 
} = state;

// Real-time speech tracking
if (isUserSpeaking) {
  console.log(`User speaking for ${currentSpeechDuration}ms`);
}

// Access last utterance information
if (utteranceEndData) {
  console.log('Last utterance duration:', utteranceEndData.duration);
  console.log('Confidence:', utteranceEndData.confidence);
}
```

#### State Properties
```typescript
interface VoiceInteractionState {
  // VAD-related state properties
  isUserSpeaking: boolean;              // Whether user is currently speaking
  lastUserSpeechTime: number | null;    // Timestamp of last speech activity
  currentSpeechDuration: number | null; // Current speech duration in ms
  utteranceEndData: UtteranceEndData | null; // Last utterance end data
}
```

### Advanced Usage Patterns

#### Speech Timeout Handling
```typescript
const [speechTimeout, setSpeechTimeout] = useState<NodeJS.Timeout | null>(null);

const handleUserStoppedSpeaking = () => {
  // Start timeout for agent response
  const timeout = setTimeout(() => {
    console.log('User stopped speaking, triggering agent response');
    triggerAgentResponse();
  }, 2000); // 2 second timeout
  
  setSpeechTimeout(timeout);
};

const handleUserStartedSpeaking = () => {
  // Cancel timeout if user starts speaking again
  if (speechTimeout) {
    clearTimeout(speechTimeout);
    setSpeechTimeout(null);
  }
};
```

#### Conversation Flow Management
```typescript
const handleUtteranceEnd = (data: UtteranceEndData) => {
  if (data.isFinal && data.confidence > 0.8) {
    // High confidence utterance end - process immediately
    processUserInput(data);
  } else if (data.duration > 5000) {
    // Long utterance - might be complete
    processUserInput(data);
  }
  // Otherwise wait for more speech or timeout
};
```

#### Adaptive Response Timing
```typescript
const [responseDelay, setResponseDelay] = useState(1000);

const handleUtteranceEnd = (data: UtteranceEndData) => {
  // Adapt response timing based on utterance characteristics
  if (data.duration < 1000) {
    // Short utterance - respond quickly
    setResponseDelay(500);
  } else if (data.duration > 5000) {
    // Long utterance - give user time to continue
    setResponseDelay(2000);
  } else {
    // Normal utterance - standard timing
    setResponseDelay(1000);
  }
};
```

## 🔄 Lazy Reconnection with Context

### Feature Overview
Intelligent reconnection system that preserves conversation context across disconnections, enabling seamless conversation continuation.

### Key Benefits
- **Context Preservation**: Maintain conversation history across disconnections
- **Seamless Reconnection**: Resume conversations exactly where they left off
- **Session Management**: Automatic session ID generation and tracking
- **Flexible Reconnection**: Support both text and audio reconnection modes

### Implementation

#### Automatic Context Preservation
Conversation context is automatically preserved and restored.

```typescript
// Context is automatically managed
const { conversationHistory, sessionId } = state;

console.log('Current session:', sessionId);
console.log('Conversation history:', conversationHistory);

// History includes all messages with timestamps
conversationHistory.forEach(message => {
  console.log(`${message.role}: ${message.content} (${new Date(message.timestamp)})`);
});
```

#### Manual Reconnection Methods

##### Text-based Reconnection
```typescript
const resumeWithText = async (text: string) => {
  try {
    // Reconnects with full conversation context
    await deepgramRef.current?.resumeWithText(text);
    console.log('Reconnected with text:', text);
  } catch (error) {
    console.error('Reconnection failed:', error);
  }
};

// Usage
await resumeWithText("Can you continue our conversation about the weather?");
```

##### Audio-based Reconnection
```typescript
const resumeWithAudio = async () => {
  try {
    // Reconnects with audio input and full context
    await deepgramRef.current?.resumeWithAudio();
    console.log('Reconnected with audio');
  } catch (error) {
    console.error('Audio reconnection failed:', error);
  }
};

// Usage
await resumeWithAudio();
```

#### Session Management
```typescript
// Session ID is automatically generated and managed
const { sessionId } = state;

// Session persists across page refreshes (if using localStorage)
if (sessionId) {
  console.log('Continuing session:', sessionId);
} else {
  console.log('Starting new session');
}
```

### Advanced Usage Patterns

#### Context-Aware Reconnection
```typescript
const handleReconnection = async (userInput: string) => {
  const { conversationHistory, sessionId } = state;
  
  // Add user input to conversation history
  const userMessage: ConversationMessage = {
    role: 'user',
    content: userInput,
    timestamp: Date.now()
  };
  
  // Reconnect with updated context
  await deepgramRef.current?.resumeWithText(userInput);
  
  console.log(`Reconnected with ${conversationHistory.length + 1} messages`);
};
```

#### Conversation Analytics
```typescript
const analyzeConversation = () => {
  const { conversationHistory } = state;
  
  const userMessages = conversationHistory.filter(msg => msg.role === 'user');
  const agentMessages = conversationHistory.filter(msg => msg.role === 'assistant');
  
  console.log(`Conversation stats:`);
  console.log(`- User messages: ${userMessages.length}`);
  console.log(`- Agent messages: ${agentMessages.length}`);
  console.log(`- Total duration: ${Date.now() - conversationHistory[0]?.timestamp}ms`);
};
```

#### Smart Reconnection Logic
```typescript
const smartReconnect = async () => {
  const { connections, conversationHistory } = state;
  
  if (connections.agent === 'disconnected') {
    if (conversationHistory.length > 0) {
      // Reconnect with context
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      await deepgramRef.current?.resumeWithText("Please continue our conversation");
    } else {
      // Fresh start
      await deepgramRef.current?.resumeWithText("Hello, let's start a new conversation");
    }
  }
};
```

## 🎯 Enhanced State Management

### Feature Overview
Comprehensive state management system that provides real-time updates and detailed information about all aspects of the voice interaction.

### Key Benefits
- **Real-time Updates**: Live state updates for UI synchronization
- **Comprehensive Information**: Detailed state information for all interaction aspects
- **Performance Optimized**: Reduced unnecessary re-renders
- **Developer Friendly**: Clear state structure and TypeScript support

### Implementation

#### Enhanced State Interface
```typescript
interface VoiceInteractionState {
  // Core state
  isReady: boolean;
  connections: Record<string, ConnectionState>;
  agentState: AgentState;
  
  // Audio state
  microphonePermission: PermissionState;
  isRecording: boolean;
  isPlaying: boolean;
  
  // Error handling
  error: string | null;
  
  // Internal state
  micEnabledInternal: boolean;
  hasSentSettings: boolean;
  welcomeReceived: boolean;
  
  // Greeting state
  greetingInProgress: boolean;
  greetingStarted: boolean;
  
  // Connection state
  isNewConnection: boolean;
  
  // Session management
  sessionId: string | null;
  conversationHistory: ConversationMessage[];
  
  // VAD state (NEW in v1.0.0)
  isUserSpeaking: boolean;
  lastUserSpeechTime: number | null;
  currentSpeechDuration: number | null;
  utteranceEndData: UtteranceEndData | null;
}
```

#### Real-time State Updates
```typescript
const MyComponent = () => {
  const [state, setState] = useState<VoiceInteractionState | null>(null);
  
  const handleStateChange = (newState: VoiceInteractionState) => {
    setState(newState);
    
    // React to state changes
    if (newState.isUserSpeaking && !state?.isUserSpeaking) {
      console.log('User started speaking');
    }
    
    if (newState.utteranceEndData && !state?.utteranceEndData) {
      console.log('Utterance ended:', newState.utteranceEndData);
    }
  };
  
  return (
    <DeepgramVoiceInteraction
      onStateChange={handleStateChange}
      // ... other props
    />
  );
};
```

#### State-driven UI Updates
```typescript
const VoiceUI = () => {
  const { 
    isUserSpeaking, 
    currentSpeechDuration, 
    agentState,
    isRecording,
    error 
  } = state;
  
  return (
    <div>
      {/* Speech indicator */}
      {isUserSpeaking && (
        <div className="speech-indicator">
          Speaking for {currentSpeechDuration}ms
        </div>
      )}
      
      {/* Agent state */}
      <div className={`agent-state ${agentState}`}>
        Agent: {agentState}
      </div>
      
      {/* Recording indicator */}
      {isRecording && (
        <div className="recording-indicator">
          Recording...
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}
    </div>
  );
};
```

### Advanced Usage Patterns

#### State Analytics
```typescript
const useVoiceAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    totalSpeakingTime: 0,
    utteranceCount: 0,
    averageUtteranceLength: 0
  });
  
  useEffect(() => {
    if (state.utteranceEndData) {
      setAnalytics(prev => ({
        totalSpeakingTime: prev.totalSpeakingTime + state.utteranceEndData.duration,
        utteranceCount: prev.utteranceCount + 1,
        averageUtteranceLength: (prev.totalSpeakingTime + state.utteranceEndData.duration) / (prev.utteranceCount + 1)
      }));
    }
  }, [state.utteranceEndData]);
  
  return analytics;
};
```

#### State Persistence
```typescript
const useStatePersistence = () => {
  useEffect(() => {
    // Save state to localStorage
    localStorage.setItem('voiceState', JSON.stringify(state));
  }, [state]);
  
  useEffect(() => {
    // Restore state from localStorage
    const savedState = localStorage.getItem('voiceState');
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      // Restore relevant state properties
    }
  }, []);
};
```

## 🚀 Performance Improvements

### Feature Overview
Significant performance improvements across audio processing, state management, and connection handling.

### Key Benefits
- **Faster Audio Processing**: Optimized audio buffer management
- **Reduced Memory Usage**: Better resource management
- **Improved Responsiveness**: Faster UI updates
- **Better Connection Stability**: Enhanced connection management

### Implementation

#### Optimized Audio Processing
```typescript
// Audio processing is now more efficient
const handleAudioData = (data: ArrayBuffer) => {
  // Optimized buffer management
  // Reduced latency
  // Better memory usage
};
```

#### Enhanced Connection Management
```typescript
// Connection management is more stable
const { connections } = state;

// Automatic reconnection with context
if (connections.agent === 'disconnected') {
  // Smart reconnection logic
  await handleReconnection();
}
```

#### Performance Monitoring
```typescript
const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState({
    audioLatency: 0,
    connectionStability: 0,
    stateUpdateFrequency: 0
  });
  
  // Monitor performance metrics
  useEffect(() => {
    // Track audio processing performance
    // Monitor connection stability
    // Measure state update frequency
  }, [state]);
  
  return metrics;
};
```

## 🔧 Developer Experience Improvements

### Feature Overview
Enhanced developer experience with better error handling, improved debugging, and comprehensive TypeScript support.

### Key Benefits
- **Better Error Messages**: Clear, actionable error messages
- **Enhanced Debugging**: Comprehensive logging and debugging tools
- **TypeScript Support**: Complete type definitions
- **Comprehensive Testing**: Extensive test coverage

### Implementation

#### Enhanced Error Handling
```typescript
const handleError = (error: string) => {
  // Enhanced error information
  console.error('Detailed error:', error);
  
  // Error categorization
  if (error.includes('WebSocket')) {
    // Handle WebSocket errors
  } else if (error.includes('Audio')) {
    // Handle audio errors
  } else if (error.includes('Permission')) {
    // Handle permission errors
  }
};
```

#### Debug Logging
```typescript
<DeepgramVoiceInteraction
  debug={true} // Enable comprehensive debug logging
  onUserStartedSpeaking={() => console.log('User started speaking')}
  onUserStoppedSpeaking={() => console.log('User stopped speaking')}
  onUtteranceEnd={(data) => console.log('Utterance ended:', data)}
/>
```

#### TypeScript Support
```typescript
// Complete type definitions
import { 
  DeepgramVoiceInteractionProps,
  VoiceInteractionState,
  UtteranceEndData,
  VADEvent,
  ConversationMessage
} from 'deepgram-voice-interaction-react';

// Type-safe implementation
const MyComponent: React.FC = () => {
  const [state, setState] = useState<VoiceInteractionState | null>(null);
  
  const handleVADEvent = (event: VADEvent) => {
    // Type-safe event handling
  };
  
  return (
    <DeepgramVoiceInteraction
      onStateChange={setState}
      onVADEvent={handleVADEvent}
    />
  );
};
```

## 📚 Usage Examples

### Basic VAD Implementation
```typescript
import React, { useState } from 'react';
import { DeepgramVoiceInteraction } from 'deepgram-voice-interaction-react';

const BasicVADExample = () => {
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [utteranceCount, setUtteranceCount] = useState(0);
  
  return (
    <DeepgramVoiceInteraction
      onUserStartedSpeaking={() => {
        console.log('User started speaking');
        setIsUserSpeaking(true);
      }}
      onUserStoppedSpeaking={() => {
        console.log('User stopped speaking');
        setIsUserSpeaking(false);
      }}
      onUtteranceEnd={(data) => {
        console.log('Utterance ended:', data);
        setUtteranceCount(prev => prev + 1);
      }}
    />
  );
};
```

### Advanced Context Management
```typescript
const AdvancedContextExample = () => {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  
  const handleReconnection = async (text: string) => {
    // Reconnect with context
    await deepgramRef.current?.resumeWithText(text);
  };
  
  return (
    <div>
      <DeepgramVoiceInteraction
        onStateChange={(state) => {
          setConversationHistory(state.conversationHistory);
        }}
      />
      
      <button onClick={() => handleReconnection("Continue our conversation")}>
        Reconnect with Context
      </button>
      
      <div>
        <h3>Conversation History</h3>
        {conversationHistory.map((message, index) => (
          <div key={index}>
            <strong>{message.role}:</strong> {message.content}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Performance Monitoring
```typescript
const PerformanceMonitoringExample = () => {
  const [metrics, setMetrics] = useState({
    audioLatency: 0,
    connectionStability: 0,
    stateUpdateFrequency: 0
  });
  
  return (
    <DeepgramVoiceInteraction
      debug={true}
      onStateChange={(state) => {
        // Monitor performance metrics
        setMetrics(prev => ({
          ...prev,
          stateUpdateFrequency: prev.stateUpdateFrequency + 1
        }));
      }}
    />
  );
};
```

## 🎯 Best Practices

### VAD Event Handling
1. **Use appropriate timeouts** for speech detection
2. **Handle confidence scores** appropriately
3. **Implement graceful degradation** for VAD failures
4. **Monitor performance** of VAD event processing

### Context Management
1. **Preserve conversation context** across disconnections
2. **Use session IDs** for conversation tracking
3. **Implement smart reconnection** logic
4. **Handle context overflow** gracefully

### State Management
1. **Use state efficiently** to avoid unnecessary re-renders
2. **Implement state persistence** for better UX
3. **Monitor state changes** for debugging
4. **Handle state errors** gracefully

### Performance
1. **Monitor audio processing** performance
2. **Optimize connection management** for stability
3. **Use debug logging** judiciously
4. **Test performance** in production-like environments

---

**Related Documentation:**
- [MIGRATION.md](./MIGRATION.md) - Migration guide from v0.x
- [API-CHANGES.md](./API-CHANGES.md) - Complete API surface changes
- [EXAMPLES.md](./EXAMPLES.md) - Additional usage examples and patterns
