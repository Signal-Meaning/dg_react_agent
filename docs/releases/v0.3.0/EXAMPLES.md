# Usage Examples and Best Practices

## Overview

This document provides comprehensive usage examples and best practices for dg_react_agent v1.0.0, covering basic usage, advanced patterns, and real-world scenarios.

## Basic Usage Examples

### Simple Voice Chat Implementation

```typescript
import React, { useState, useRef } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle } from 'deepgram-voice-interaction-react';

const SimpleVoiceChat = () => {
  const [isReady, setIsReady] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [agentResponse, setAgentResponse] = useState('');
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);

  return (
    <div>
      <h1>Simple Voice Chat</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey="your-deepgram-api-key"
        agentOptions={{
          language: 'en',
          voice: 'aura-asteria-en',
          instructions: 'You are a helpful assistant.',
          greeting: 'Hello! How can I help you today?'
        }}
        onUserStartedSpeaking={() => {
          console.log('User started speaking');
          setIsUserSpeaking(true);
        }}
        onUserStoppedSpeaking={() => {
          console.log('User stopped speaking');
          setIsUserSpeaking(false);
        }}
        onAgentResponse={(response) => {
          console.log('Agent response:', response);
          setAgentResponse(response);
        }}
        onStateChange={(state) => {
          setIsReady(state.isReady);
        }}
      />
      
      <div>
        <p>Status: {isReady ? 'Ready' : 'Not Ready'}</p>
        <p>User Speaking: {isUserSpeaking ? 'Yes' : 'No'}</p>
        <p>Agent Response: {agentResponse}</p>
      </div>
    </div>
  );
};

export default SimpleVoiceChat;
```

### Text-Only Chat Implementation

```typescript
import React, { useState, useRef } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle } from 'deepgram-voice-interaction-react';

const TextOnlyChat = () => {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<Array<{role: string, content: string}>>([]);
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const sendMessage = async () => {
    if (message.trim()) {
      await deepgramRef.current?.sendText(message);
      setConversation(prev => [...prev, { role: 'user', content: message }]);
      setMessage('');
    }
  };

  return (
    <div>
      <h1>Text-Only Chat</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey="your-deepgram-api-key"
        agentOptions={{
          language: 'en',
          voice: 'aura-asteria-en',
          instructions: 'You are a helpful assistant.'
        }}
        onAgentResponse={(response) => {
          setConversation(prev => [...prev, { role: 'assistant', content: response }]);
        }}
      />
      
      <div className="conversation">
        {conversation.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default TextOnlyChat;
```

## Advanced Usage Examples

### VAD Event Handling

```typescript
import React, { useState, useRef } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle, VADEvent, UtteranceEndData } from 'deepgram-voice-interaction-react';

const AdvancedVADExample = () => {
  const [speechStats, setSpeechStats] = useState({
    totalSpeakingTime: 0,
    utteranceCount: 0,
    averageUtteranceLength: 0
  });
  const [currentSpeechDuration, setCurrentSpeechDuration] = useState(0);
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const handleVADEvent = (event: VADEvent) => {
    switch (event.type) {
      case 'UserStartedSpeaking':
        console.log('User started speaking');
        setCurrentSpeechDuration(0);
        break;
        
      case 'UserStoppedSpeaking':
        console.log('User stopped speaking');
        break;
        
      case 'UtteranceEnd':
        handleUtteranceEnd(event.data);
        break;
    }
  };

  const handleUtteranceEnd = (data: UtteranceEndData) => {
    console.log('Utterance ended:', data);
    
    setSpeechStats(prev => {
      const newTotalTime = prev.totalSpeakingTime + data.duration;
      const newCount = prev.utteranceCount + 1;
      
      return {
        totalSpeakingTime: newTotalTime,
        utteranceCount: newCount,
        averageUtteranceLength: newTotalTime / newCount
      };
    });
  };

  const handleStateChange = (state: any) => {
    if (state.currentSpeechDuration) {
      setCurrentSpeechDuration(state.currentSpeechDuration);
    }
  };

  return (
    <div>
      <h1>Advanced VAD Example</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey="your-deepgram-api-key"
        agentOptions={{
          language: 'en',
          voice: 'aura-asteria-en',
          instructions: 'You are a helpful assistant.',
          utteranceEndMs: 2000,
          vadThreshold: 0.7
        }}
        onVADEvent={handleVADEvent}
        onStateChange={handleStateChange}
      />
      
      <div className="speech-stats">
        <h3>Speech Statistics</h3>
        <p>Current Speech Duration: {currentSpeechDuration}ms</p>
        <p>Total Speaking Time: {speechStats.totalSpeakingTime}ms</p>
        <p>Utterance Count: {speechStats.utteranceCount}</p>
        <p>Average Utterance Length: {speechStats.averageUtteranceLength.toFixed(0)}ms</p>
      </div>
    </div>
  );
};

export default AdvancedVADExample;
```

### Lazy Reconnection with Context

```typescript
import React, { useState, useRef } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle, VoiceInteractionState } from 'deepgram-voice-interaction-react';

const LazyReconnectionExample = () => {
  const [state, setState] = useState<VoiceInteractionState | null>(null);
  const [reconnectionText, setReconnectionText] = useState('');
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const handleReconnection = async () => {
    if (reconnectionText.trim()) {
      try {
        await deepgramRef.current?.resumeWithText(reconnectionText);
        console.log('Reconnected with text:', reconnectionText);
        setReconnectionText('');
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }
  };

  const handleAudioReconnection = async () => {
    try {
      await deepgramRef.current?.resumeWithAudio();
      console.log('Reconnected with audio');
    } catch (error) {
      console.error('Audio reconnection failed:', error);
    }
  };

  const analyzeConversation = () => {
    if (!state?.conversationHistory) return;
    
    const userMessages = state.conversationHistory.filter(msg => msg.role === 'user');
    const agentMessages = state.conversationHistory.filter(msg => msg.role === 'assistant');
    
    console.log('Conversation Analysis:', {
      totalMessages: state.conversationHistory.length,
      userMessages: userMessages.length,
      agentMessages: agentMessages.length,
      sessionId: state.sessionId,
      duration: state.conversationHistory.length > 0 
        ? Date.now() - state.conversationHistory[0].timestamp 
        : 0
    });
  };

  return (
    <div>
      <h1>Lazy Reconnection Example</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey="your-deepgram-api-key"
        agentOptions={{
          language: 'en',
          voice: 'aura-asteria-en',
          instructions: 'You are a helpful assistant.'
        }}
        onStateChange={setState}
      />
      
      <div className="connection-status">
        <h3>Connection Status</h3>
        <p>Agent: {state?.connections.agent || 'Unknown'}</p>
        <p>Session ID: {state?.sessionId || 'None'}</p>
        <p>Messages: {state?.conversationHistory.length || 0}</p>
      </div>
      
      <div className="reconnection-controls">
        <h3>Reconnection Controls</h3>
        <input
          type="text"
          value={reconnectionText}
          onChange={(e) => setReconnectionText(e.target.value)}
          placeholder="Enter text to reconnect with..."
        />
        <button onClick={handleReconnection}>Reconnect with Text</button>
        <button onClick={handleAudioReconnection}>Reconnect with Audio</button>
        <button onClick={analyzeConversation}>Analyze Conversation</button>
      </div>
      
      <div className="conversation-history">
        <h3>Conversation History</h3>
        {state?.conversationHistory.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <strong>{message.role}:</strong> {message.content}
            <small> ({new Date(message.timestamp).toLocaleTimeString()})</small>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LazyReconnectionExample;
```

### Performance Monitoring

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle, VoiceInteractionState } from 'deepgram-voice-interaction-react';

const PerformanceMonitoringExample = () => {
  const [metrics, setMetrics] = useState({
    stateUpdateCount: 0,
    lastUpdateTime: Date.now(),
    averageUpdateInterval: 0,
    connectionStability: 0,
    audioLatency: 0
  });
  const [state, setState] = useState<VoiceInteractionState | null>(null);
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        connectionStability: state?.connections.agent === 'connected' ? 1 : 0,
        audioLatency: state?.currentSpeechDuration || 0
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  const handleStateChange = (newState: VoiceInteractionState) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - metrics.lastUpdateTime;
    
    setMetrics(prev => ({
      ...prev,
      stateUpdateCount: prev.stateUpdateCount + 1,
      lastUpdateTime: now,
      averageUpdateInterval: (prev.averageUpdateInterval + timeSinceLastUpdate) / 2
    }));
    
    setState(newState);
  };

  const resetMetrics = () => {
    setMetrics({
      stateUpdateCount: 0,
      lastUpdateTime: Date.now(),
      averageUpdateInterval: 0,
      connectionStability: 0,
      audioLatency: 0
    });
  };

  return (
    <div>
      <h1>Performance Monitoring Example</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey="your-deepgram-api-key"
        agentOptions={{
          language: 'en',
          voice: 'aura-asteria-en',
          instructions: 'You are a helpful assistant.'
        }}
        onStateChange={handleStateChange}
        debug={true}
      />
      
      <div className="performance-metrics">
        <h3>Performance Metrics</h3>
        <p>State Updates: {metrics.stateUpdateCount}</p>
        <p>Average Update Interval: {metrics.averageUpdateInterval.toFixed(0)}ms</p>
        <p>Connection Stability: {metrics.connectionStability ? 'Stable' : 'Unstable'}</p>
        <p>Audio Latency: {metrics.audioLatency}ms</p>
        <button onClick={resetMetrics}>Reset Metrics</button>
      </div>
      
      <div className="current-state">
        <h3>Current State</h3>
        <p>Ready: {state?.isReady ? 'Yes' : 'No'}</p>
        <p>Recording: {state?.isRecording ? 'Yes' : 'No'}</p>
        <p>Playing: {state?.isPlaying ? 'Yes' : 'No'}</p>
        <p>User Speaking: {state?.isUserSpeaking ? 'Yes' : 'No'}</p>
        <p>Agent State: {state?.agentState}</p>
      </div>
    </div>
  );
};

export default PerformanceMonitoringExample;
```

## Real-World Scenarios

### Customer Service Chatbot

```typescript
import React, { useState, useRef } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle } from 'deepgram-voice-interaction-react';

const CustomerServiceChatbot = () => {
  const [conversation, setConversation] = useState<Array<{role: string, content: string, timestamp: number}>>([]);
  const [isHandlingRequest, setIsHandlingRequest] = useState(false);
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const handleUtteranceEnd = (data: any) => {
    if (data.isFinal && data.confidence > 0.8) {
      setIsHandlingRequest(true);
      // Process customer request
      setTimeout(() => {
        setIsHandlingRequest(false);
      }, 2000);
    }
  };

  const handleAgentResponse = (response: string) => {
    setConversation(prev => [...prev, {
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    }]);
  };

  const escalateToHuman = async () => {
    await deepgramRef.current?.sendText("I need to speak with a human agent");
  };

  return (
    <div className="customer-service">
      <h1>Customer Service Chatbot</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey="your-deepgram-api-key"
        agentOptions={{
          language: 'en',
          voice: 'aura-asteria-en',
          instructions: 'You are a helpful customer service representative. Be polite and helpful.',
          greeting: 'Hello! I\'m here to help you with any questions or issues you may have.'
        }}
        onUtteranceEnd={handleUtteranceEnd}
        onAgentResponse={handleAgentResponse}
      />
      
      <div className="conversation">
        {conversation.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'Customer' : 'Agent'}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <div className="controls">
        {isHandlingRequest && <p>Processing your request...</p>}
        <button onClick={escalateToHuman}>Speak with Human Agent</button>
      </div>
    </div>
  );
};

export default CustomerServiceChatbot;
```

### Educational Assistant

```typescript
import React, { useState, useRef } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle } from 'deepgram-voice-interaction-react';

const EducationalAssistant = () => {
  const [currentTopic, setCurrentTopic] = useState('');
  const [learningProgress, setLearningProgress] = useState(0);
  const [speechStats, setSpeechStats] = useState({
    totalSpeakingTime: 0,
    questionCount: 0
  });
  const deepgramRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const handleUtteranceEnd = (data: any) => {
    if (data.duration > 3000) { // Long utterance - likely a question
      setSpeechStats(prev => ({
        ...prev,
        questionCount: prev.questionCount + 1,
        totalSpeakingTime: prev.totalSpeakingTime + data.duration
      }));
    }
  };

  const handleAgentResponse = (response: string) => {
    // Analyze response for learning progress
    if (response.includes('correct') || response.includes('good')) {
      setLearningProgress(prev => Math.min(prev + 10, 100));
    }
  };

  const startNewTopic = async (topic: string) => {
    setCurrentTopic(topic);
    setLearningProgress(0);
    await deepgramRef.current?.sendText(`Let's learn about ${topic}`);
  };

  return (
    <div className="educational-assistant">
      <h1>Educational Assistant</h1>
      
      <DeepgramVoiceInteraction
        ref={deepgramRef}
        apiKey="your-deepgram-api-key"
        agentOptions={{
          language: 'en',
          voice: 'aura-asteria-en',
          instructions: 'You are an educational assistant. Help students learn by asking questions and providing explanations.',
          greeting: 'Hello! I\'m here to help you learn. What would you like to study today?'
        }}
        onUtteranceEnd={handleUtteranceEnd}
        onAgentResponse={handleAgentResponse}
      />
      
      <div className="learning-dashboard">
        <h3>Learning Dashboard</h3>
        <p>Current Topic: {currentTopic || 'None'}</p>
        <p>Progress: {learningProgress}%</p>
        <p>Questions Asked: {speechStats.questionCount}</p>
        <p>Total Speaking Time: {speechStats.totalSpeakingTime}ms</p>
      </div>
      
      <div className="topic-selection">
        <h3>Select a Topic</h3>
        <button onClick={() => startNewTopic('Mathematics')}>Mathematics</button>
        <button onClick={() => startNewTopic('Science')}>Science</button>
        <button onClick={() => startNewTopic('History')}>History</button>
        <button onClick={() => startNewTopic('Literature')}>Literature</button>
      </div>
    </div>
  );
};

export default EducationalAssistant;
```

## Best Practices

### Performance Optimization

#### 1. Efficient State Updates
```typescript
// Good: Use specific state properties
const { isUserSpeaking, currentSpeechDuration } = state;

// Avoid: Accessing entire state object unnecessarily
const entireState = state; // Don't do this unless needed
```

#### 2. Callback Optimization
```typescript
// Good: Use useCallback for stable references
const handleVADEvent = useCallback((event: VADEvent) => {
  // Handle event
}, []);

// Good: Memoize expensive calculations
const speechStats = useMemo(() => {
  return {
    averageDuration: totalTime / utteranceCount,
    speakingRate: utteranceCount / totalTime
  };
}, [totalTime, utteranceCount]);
```

#### 3. Error Handling
```typescript
// Good: Comprehensive error handling
const handleError = (error: string) => {
  console.error('Error:', error);
  
  // Categorize errors
  if (error.includes('WebSocket')) {
    handleConnectionError(error);
  } else if (error.includes('Audio')) {
    handleAudioError(error);
  } else {
    handleGenericError(error);
  }
};
```

### User Experience

#### 1. Visual Feedback
```typescript
// Good: Provide clear visual feedback
const VoiceUI = () => {
  const { isUserSpeaking, isRecording, agentState } = state;
  
  return (
    <div>
      {isUserSpeaking && <div className="speaking-indicator">🎤 Speaking...</div>}
      {isRecording && <div className="recording-indicator">🔴 Recording</div>}
      {agentState === 'thinking' && <div className="thinking-indicator">🤔 Thinking...</div>}
    </div>
  );
};
```

#### 2. Graceful Degradation
```typescript
// Good: Handle missing features gracefully
const handleVADEvent = (event: VADEvent) => {
  try {
    // Process VAD event
    processVADEvent(event);
  } catch (error) {
    console.warn('VAD event processing failed:', error);
    // Continue without VAD features
  }
};
```

#### 3. Accessibility
```typescript
// Good: Provide accessibility features
<DeepgramVoiceInteraction
  onUserStartedSpeaking={() => {
    // Announce to screen readers
    announceToScreenReader('User started speaking');
  }}
  onAgentResponse={(response) => {
    // Announce agent response
    announceToScreenReader(`Agent response: ${response}`);
  }}
/>
```

### Security Considerations

#### 1. API Key Management
```typescript
// Good: Use environment variables
const apiKey = process.env.REACT_APP_DEEPGRAM_API_KEY;

// Good: Validate API key
if (!apiKey) {
  throw new Error('Deepgram API key is required');
}
```

#### 2. Input Validation
```typescript
// Good: Validate user input
const sendText = async (text: string) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }
  
  if (text.length > 1000) {
    throw new Error('Text too long');
  }
  
  await deepgramRef.current?.sendText(text);
};
```

### Testing Strategies

#### 1. Unit Testing
```typescript
// Good: Test VAD event handling
describe('VAD Event Handling', () => {
  it('should handle UserStartedSpeaking event', () => {
    const mockCallback = jest.fn();
    render(<DeepgramVoiceInteraction onVADEvent={mockCallback} />);
    
    // Simulate VAD event
    fireEvent.mockVADEvent({ type: 'UserStartedSpeaking' });
    
    expect(mockCallback).toHaveBeenCalledWith({ type: 'UserStartedSpeaking' });
  });
});
```

#### 2. Integration Testing
```typescript
// Good: Test state updates
describe('State Management', () => {
  it('should update state when user starts speaking', () => {
    const mockStateChange = jest.fn();
    render(<DeepgramVoiceInteraction onStateChange={mockStateChange} />);
    
    // Simulate user speaking
    fireEvent.mockUserStartedSpeaking();
    
    expect(mockStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ isUserSpeaking: true })
    );
  });
});
```

#### 3. E2E Testing
```typescript
// Good: Test complete user flows
describe('Voice Chat Flow', () => {
  it('should handle complete conversation flow', async () => {
    await page.goto('/voice-chat');
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Start conversation
    await page.click('[data-testid="start-button"]');
    await page.waitForSelector('[data-testid="connection-status"]:has-text("connected")');
    
    // Test VAD events
    await page.waitForSelector('[data-testid="user-started-speaking"]');
    await page.waitForSelector('[data-testid="user-stopped-speaking"]');
    
    // Test agent response
    await page.waitForSelector('[data-testid="agent-response"]');
  });
});
```

## Common Patterns

### Pattern 1: Speech Timeout Handling
```typescript
const useSpeechTimeout = (timeoutMs: number) => {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  const startTimeout = useCallback(() => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => {
      console.log('Speech timeout reached');
      onTimeout?.();
    }, timeoutMs);
    setTimeoutId(id);
  }, [timeoutMs, timeoutId]);
  
  const cancelTimeout = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  }, [timeoutId]);
  
  return { startTimeout, cancelTimeout };
};
```

### Pattern 2: Conversation Analytics
```typescript
const useConversationAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    totalMessages: 0,
    userMessages: 0,
    agentMessages: 0,
    averageResponseTime: 0,
    totalDuration: 0
  });
  
  const updateAnalytics = useCallback((state: VoiceInteractionState) => {
    const { conversationHistory } = state;
    
    setAnalytics({
      totalMessages: conversationHistory.length,
      userMessages: conversationHistory.filter(m => m.role === 'user').length,
      agentMessages: conversationHistory.filter(m => m.role === 'assistant').length,
      averageResponseTime: calculateAverageResponseTime(conversationHistory),
      totalDuration: conversationHistory.length > 0 
        ? Date.now() - conversationHistory[0].timestamp 
        : 0
    });
  }, []);
  
  return { analytics, updateAnalytics };
};
```

### Pattern 3: Error Recovery
```typescript
const useErrorRecovery = () => {
  const [errorCount, setErrorCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const handleError = useCallback((error: string) => {
    setErrorCount(prev => prev + 1);
    setLastError(error);
    
    // Implement recovery logic
    if (error.includes('WebSocket')) {
      attemptReconnection();
    } else if (error.includes('Audio')) {
      resetAudioManager();
    }
  }, []);
  
  const resetErrorState = useCallback(() => {
    setErrorCount(0);
    setLastError(null);
  }, []);
  
  return { errorCount, lastError, handleError, resetErrorState };
};
```

---

**Related Documentation:**
- [MIGRATION.md](./MIGRATION.md) - Migration guide from v0.x
- [NEW-FEATURES.md](./NEW-FEATURES.md) - Detailed feature documentation
- [API-CHANGES.md](./API-CHANGES.md) - Complete API surface changes
