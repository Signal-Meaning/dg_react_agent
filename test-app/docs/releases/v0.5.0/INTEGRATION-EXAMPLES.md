# Integration Examples

This guide provides real-world integration examples showing how to properly use the Deepgram Voice Interaction component with session management and context handling.

## Basic Integration

### Simple Voice App

```tsx
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/voice-agent-react';

function SimpleVoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.'
  }), []);

  const handleStart = async () => {
    try {
      await voiceRef.current?.start();
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to start:', error);
    }
  };

  const handleStop = async () => {
    try {
      await voiceRef.current?.stop();
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  const handleAgentUtterance = (utterance: LLMResponse) => {
    setMessages(prev => [...prev, { role: 'assistant', content: utterance.text }]);
  };

  const handleUserMessage = (message: UserMessageResponse) => {
    setMessages(prev => [...prev, { role: 'user', content: message.text }]);
  };

  return (
    <div>
      <div>
        <button onClick={handleStart} disabled={isConnected}>
          Start Voice
        </button>
        <button onClick={handleStop} disabled={!isConnected}>
          Stop Voice
        </button>
      </div>
      
      <div>
        {messages.map((msg, index) => (
          <div key={index} className={msg.role}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage}
        onConnectionStateChange={(service, state) => {
          if (service === 'agent') {
            setIsConnected(state === 'open');
          }
        }}
      />
    </div>
  );
}
```

## Advanced Integration with Session Management

### Multi-Session Voice App

```tsx
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/voice-agent-react';

interface Session {
  id: string;
  name: string;
  createdAt: number;
  conversationHistory: Array<{role: string, content: string, timestamp: number}>;
  userPreferences: Record<string, any>;
}

function MultiSessionVoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const currentSession = currentSessionId ? sessions.get(currentSessionId) : null;

  const createSession = useCallback((name: string) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession: Session = {
      id: sessionId,
      name,
      createdAt: Date.now(),
      conversationHistory: [],
      userPreferences: {}
    };
    
    setSessions(prev => new Map(prev.set(sessionId, newSession)));
    setCurrentSessionId(sessionId);
    
    return sessionId;
  }, []);

  const switchToSession = useCallback(async (sessionId: string) => {
    // Stop current connection
    if (isConnected) {
      await voiceRef.current?.stop();
    }
    
    // Switch to new session
    setCurrentSessionId(sessionId);
    
    // Start with context
    await voiceRef.current?.start();
    
    // Inject conversation history
    const session = sessions.get(sessionId);
    if (session?.conversationHistory) {
      session.conversationHistory.forEach(message => {
        voiceRef.current?.injectMessage(message.role as 'assistant' | 'user', message.content);
      });
    }
  }, [isConnected, sessions]);

  const addMessage = useCallback((role: 'assistant' | 'user', content: string) => {
    if (!currentSessionId) return;
    
    const message = {
      role,
      content,
      timestamp: Date.now()
    };
    
    setSessions(prev => {
      const newSessions = new Map(prev);
      const session = newSessions.get(currentSessionId);
      if (session) {
        session.conversationHistory.push(message);
      }
      return newSessions;
    });
  }, [currentSessionId]);

  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    addMessage('assistant', utterance.text);
  }, [addMessage]);

  const handleUserMessage = useCallback((message: UserMessageResponse) => {
    addMessage('user', message.text);
  }, [addMessage]);

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: `You are a helpful assistant. Current session: ${currentSession?.name || 'Unknown'}`
  }), [currentSession?.name]);

  return (
    <div>
      <div>
        <button onClick={() => createSession(`Session ${sessions.size + 1}`)}>
          New Session
        </button>
        <button 
          onClick={() => voiceRef.current?.start()} 
          disabled={isConnected || !currentSessionId}
        >
          Start Voice
        </button>
        <button 
          onClick={() => voiceRef.current?.stop()} 
          disabled={!isConnected}
        >
          Stop Voice
        </button>
      </div>
      
      <div>
        <h3>Sessions</h3>
        {Array.from(sessions.values()).map(session => (
          <div key={session.id}>
            <button 
              onClick={() => switchToSession(session.id)}
              className={session.id === currentSessionId ? 'active' : ''}
            >
              {session.name} ({session.conversationHistory.length} messages)
            </button>
          </div>
        ))}
      </div>
      
      <div>
        <h3>Conversation</h3>
        {currentSession?.conversationHistory.map((msg, index) => (
          <div key={index} className={msg.role}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage}
        onConnectionStateChange={(service, state) => {
          if (service === 'agent') {
            setIsConnected(state === 'open');
          }
        }}
      />
    </div>
  );
}
```

## Context-Aware Integration

### Smart Context Management

```tsx
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/voice-agent-react';

interface UserProfile {
  name: string;
  preferences: {
    language: string;
    expertise: string;
    interests: string[];
  };
  conversationContext: {
    currentTopic?: string;
    lastIntent?: string;
    conversationMood?: 'formal' | 'casual' | 'technical';
  };
}

function ContextAwareVoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'User',
    preferences: {
      language: 'en',
      expertise: 'beginner',
      interests: []
    },
    conversationContext: {}
  });
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string, timestamp: number}>>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Update user preferences
  const updateUserPreferences = useCallback((preferences: Partial<UserProfile['preferences']>) => {
    setUserProfile(prev => ({
      ...prev,
      preferences: { ...prev.preferences, ...preferences }
    }));
  }, []);

  // Update conversation context
  const updateConversationContext = useCallback((context: Partial<UserProfile['conversationContext']>) => {
    setUserProfile(prev => ({
      ...prev,
      conversationContext: { ...prev.conversationContext, ...context }
    }));
  }, []);

  // Add message to history
  const addMessage = useCallback((role: 'assistant' | 'user', content: string) => {
    const message = {
      role,
      content,
      timestamp: Date.now()
    };
    
    setConversationHistory(prev => [...prev, message]);
    
    // Analyze message for context updates
    if (role === 'user') {
      // Simple intent detection
      if (content.toLowerCase().includes('react') || content.toLowerCase().includes('javascript')) {
        updateConversationContext({ currentTopic: 'React Development' });
      }
      
      if (content.toLowerCase().includes('help') || content.toLowerCase().includes('how')) {
        updateConversationContext({ lastIntent: 'help_request' });
      }
    }
  }, [updateConversationContext]);

  // Generate context-aware instructions
  const generateInstructions = useCallback(() => {
    const { name, preferences, conversationContext } = userProfile;
    
    let instructions = `You are a helpful assistant talking to ${name}.`;
    
    if (preferences.expertise === 'beginner') {
      instructions += ' Explain things in simple terms.';
    } else if (preferences.expertise === 'expert') {
      instructions += ' You can use technical terminology and advanced concepts.';
    }
    
    if (conversationContext.currentTopic) {
      instructions += ` The current topic is: ${conversationContext.currentTopic}.`;
    }
    
    if (conversationContext.lastIntent === 'help_request') {
      instructions += ' The user is asking for help, so be especially helpful and detailed.';
    }
    
    return instructions;
  }, [userProfile]);

  // Update agent with current context
  const updateAgentContext = useCallback(() => {
    if (!isConnected) return;
    
    const instructions = generateInstructions();
    const context = {
      userProfile,
      recentHistory: conversationHistory.slice(-5),
      conversationContext: userProfile.conversationContext
    };
    
    voiceRef.current?.updateAgentInstructions({
      instructions,
      context: JSON.stringify(context)
    });
  }, [isConnected, generateInstructions, userProfile, conversationHistory]);

  // Update context when profile changes
  useEffect(() => {
    updateAgentContext();
  }, [updateAgentContext]);

  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    addMessage('assistant', utterance.text);
  }, [addMessage]);

  const handleUserMessage = useCallback((message: UserMessageResponse) => {
    addMessage('user', message.text);
  }, [addMessage]);

  const agentOptions = useMemo(() => ({
    language: userProfile.preferences.language,
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: generateInstructions()
  }), [userProfile.preferences.language, generateInstructions]);

  return (
    <div>
      <div>
        <h3>User Profile</h3>
        <div>
          <label>
            Name: 
            <input 
              value={userProfile.name}
              onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
            />
          </label>
        </div>
        <div>
          <label>
            Expertise: 
            <select 
              value={userProfile.preferences.expertise}
              onChange={(e) => updateUserPreferences({ expertise: e.target.value as any })}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            Language: 
            <select 
              value={userProfile.preferences.language}
              onChange={(e) => updateUserPreferences({ language: e.target.value })}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </label>
        </div>
      </div>
      
      <div>
        <button 
          onClick={() => voiceRef.current?.start()} 
          disabled={isConnected}
        >
          Start Voice
        </button>
        <button 
          onClick={() => voiceRef.current?.stop()} 
          disabled={!isConnected}
        >
          Stop Voice
        </button>
        <button onClick={updateAgentContext} disabled={!isConnected}>
          Update Context
        </button>
      </div>
      
      <div>
        <h3>Conversation</h3>
        {conversationHistory.map((msg, index) => (
          <div key={index} className={msg.role}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage}
        onConnectionStateChange={(service, state) => {
          if (service === 'agent') {
            setIsConnected(state === 'open');
          }
        }}
      />
    </div>
  );
}
```

## Production-Ready Integration

### Enterprise Voice App

```tsx
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/voice-agent-react';

interface EnterpriseSession {
  id: string;
  userId: string;
  department: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  lastActivity: number;
  conversationHistory: Array<{role: string, content: string, timestamp: number}>;
  metadata: {
    userRole: string;
    department: string;
    sessionType: 'support' | 'sales' | 'general';
    tags: string[];
  };
}

class EnterpriseSessionManager {
  private sessions: Map<string, EnterpriseSession> = new Map();
  private maxSessions = 100;
  private maxHistoryPerSession = 50;

  createSession(userId: string, department: string, priority: 'low' | 'medium' | 'high' = 'medium'): string {
    const sessionId = `ent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: EnterpriseSession = {
      id: sessionId,
      userId,
      department,
      priority,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      conversationHistory: [],
      metadata: {
        userRole: 'user',
        department,
        sessionType: 'general',
        tags: []
      }
    };
    
    this.sessions.set(sessionId, session);
    this.cleanupOldSessions();
    
    return sessionId;
  }

  getSession(sessionId: string): EnterpriseSession | undefined {
    return this.sessions.get(sessionId);
  }

  addMessage(sessionId: string, role: 'assistant' | 'user', content: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const message = {
      role,
      content,
      timestamp: Date.now()
    };
    
    session.conversationHistory.push(message);
    session.lastActivity = Date.now();
    
    // Trim history if too long
    if (session.conversationHistory.length > this.maxHistoryPerSession) {
      session.conversationHistory = session.conversationHistory.slice(-this.maxHistoryPerSession);
    }
  }

  updateMetadata(sessionId: string, metadata: Partial<EnterpriseSession['metadata']>) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata = { ...session.metadata, ...metadata };
    }
  }

  private cleanupOldSessions() {
    if (this.sessions.size <= this.maxSessions) return;
    
    const sessionsArray = Array.from(this.sessions.values());
    sessionsArray.sort((a, b) => a.lastActivity - b.lastActivity);
    
    const toRemove = sessionsArray.slice(0, sessionsArray.length - this.maxSessions);
    toRemove.forEach(session => {
      this.sessions.delete(session.id);
    });
  }

  getAllSessions(): EnterpriseSession[] {
    return Array.from(this.sessions.values());
  }
}

function EnterpriseVoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const sessionManager = useMemo(() => new EnterpriseSessionManager(), []);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessions, setSessions] = useState<EnterpriseSession[]>([]);

  const currentSession = currentSessionId ? sessionManager.getSession(currentSessionId) : null;

  const createSession = useCallback((userId: string, department: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    const sessionId = sessionManager.createSession(userId, department, priority);
    setCurrentSessionId(sessionId);
    setSessions(sessionManager.getAllSessions());
    return sessionId;
  }, [sessionManager]);

  const switchToSession = useCallback(async (sessionId: string) => {
    if (isConnected) {
      await voiceRef.current?.stop();
    }
    
    setCurrentSessionId(sessionId);
    await voiceRef.current?.start();
    
    // Inject conversation history
    const session = sessionManager.getSession(sessionId);
    if (session?.conversationHistory) {
      session.conversationHistory.forEach(message => {
        voiceRef.current?.injectMessage(message.role as 'assistant' | 'user', message.content);
      });
    }
  }, [isConnected, sessionManager]);

  const addMessage = useCallback((role: 'assistant' | 'user', content: string) => {
    if (!currentSessionId) return;
    
    sessionManager.addMessage(currentSessionId, role, content);
    setSessions(sessionManager.getAllSessions());
  }, [currentSessionId, sessionManager]);

  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    addMessage('assistant', utterance.text);
  }, [addMessage]);

  const handleUserMessage = useCallback((message: UserMessageResponse) => {
    addMessage('user', message.text);
  }, [addMessage]);

  const generateEnterpriseInstructions = useCallback(() => {
    if (!currentSession) return 'You are a helpful assistant.';
    
    const { department, priority, metadata } = currentSession;
    
    let instructions = `You are a helpful assistant for the ${department} department.`;
    
    if (priority === 'high') {
      instructions += ' This is a high-priority session, so be especially responsive and helpful.';
    }
    
    if (metadata.sessionType === 'support') {
      instructions += ' Focus on providing technical support and troubleshooting assistance.';
    } else if (metadata.sessionType === 'sales') {
      instructions += ' Focus on sales assistance and product information.';
    }
    
    if (metadata.tags.length > 0) {
      instructions += ` Relevant tags: ${metadata.tags.join(', ')}.`;
    }
    
    return instructions;
  }, [currentSession]);

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: generateEnterpriseInstructions()
  }), [generateEnterpriseInstructions]);

  return (
    <div>
      <div>
        <h3>Enterprise Voice Sessions</h3>
        <button onClick={() => createSession('user123', 'Engineering', 'high')}>
          New Engineering Session
        </button>
        <button onClick={() => createSession('user456', 'Sales', 'medium')}>
          New Sales Session
        </button>
        <button onClick={() => createSession('user789', 'Support', 'low')}>
          New Support Session
        </button>
      </div>
      
      <div>
        <h4>Active Sessions</h4>
        {sessions.map(session => (
          <div key={session.id} className={session.id === currentSessionId ? 'active' : ''}>
            <button onClick={() => switchToSession(session.id)}>
              {session.department} - {session.priority} - {session.conversationHistory.length} messages
            </button>
          </div>
        ))}
      </div>
      
      <div>
        <button 
          onClick={() => voiceRef.current?.start()} 
          disabled={isConnected || !currentSessionId}
        >
          Start Voice
        </button>
        <button 
          onClick={() => voiceRef.current?.stop()} 
          disabled={!isConnected}
        >
          Stop Voice
        </button>
      </div>
      
      <div>
        <h4>Current Session: {currentSession?.department}</h4>
        {currentSession?.conversationHistory.map((msg, index) => (
          <div key={index} className={msg.role}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage}
        onConnectionStateChange={(service, state) => {
          if (service === 'agent') {
            setIsConnected(state === 'open');
          }
        }}
      />
    </div>
  );
}
```

## Testing Integration

### Test-Friendly Voice App

```tsx
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/voice-agent-react';

interface TestSession {
  id: string;
  name: string;
  testMode: boolean;
  expectedResponses: string[];
  actualResponses: string[];
  conversationHistory: Array<{role: string, content: string, timestamp: number}>;
}

function TestableVoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const createTestSession = useCallback((name: string, expectedResponses: string[] = []) => {
    const sessionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: TestSession = {
      id: sessionId,
      name,
      testMode: true,
      expectedResponses,
      actualResponses: [],
      conversationHistory: []
    };
    
    setSessions(prev => [...prev, session]);
    setCurrentSessionId(sessionId);
    
    return sessionId;
  }, []);

  const addMessage = useCallback((role: 'assistant' | 'user', content: string) => {
    if (!currentSessionId) return;
    
    const message = {
      role,
      content,
      timestamp: Date.now()
    };
    
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId 
        ? { 
            ...session, 
            conversationHistory: [...session.conversationHistory, message],
            actualResponses: role === 'assistant' ? [...session.actualResponses, content] : session.actualResponses
          }
        : session
    ));
  }, [currentSessionId]);

  const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
    addMessage('assistant', utterance.text);
  }, [addMessage]);

  const handleUserMessage = useCallback((message: UserMessageResponse) => {
    addMessage('user', message.text);
  }, [addMessage]);

  const runTest = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    setCurrentSessionId(sessionId);
    await voiceRef.current?.start();
    
    // Run test scenarios
    for (const expectedResponse of session.expectedResponses) {
      // Simulate user input
      voiceRef.current?.injectMessage('user', expectedResponse);
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Analyze results
    const results = {
      expectedCount: session.expectedResponses.length,
      actualCount: session.actualResponses.length,
      success: session.actualResponses.length >= session.expectedResponses.length,
      responses: session.actualResponses
    };
    
    setTestResults(prev => ({ ...prev, [sessionId]: results }));
  }, [sessions]);

  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: currentSession?.testMode 
      ? 'You are a test assistant. Respond to all messages with "Test response received."'
      : 'You are a helpful assistant.'
  }), [currentSession?.testMode]);

  return (
    <div>
      <div>
        <h3>Test Sessions</h3>
        <button onClick={() => createTestSession('Basic Test', ['Hello', 'How are you?'])}>
          Create Basic Test
        </button>
        <button onClick={() => createTestSession('Advanced Test', ['Explain React', 'What is JavaScript?'])}>
          Create Advanced Test
        </button>
      </div>
      
      <div>
        <h4>Test Sessions</h4>
        {sessions.map(session => (
          <div key={session.id}>
            <div>
              <strong>{session.name}</strong> - {session.actualResponses.length} responses
              <button onClick={() => runTest(session.id)}>Run Test</button>
              {testResults[session.id] && (
                <span className={testResults[session.id].success ? 'success' : 'failure'}>
                  {testResults[session.id].success ? 'PASS' : 'FAIL'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div>
        <button 
          onClick={() => voiceRef.current?.start()} 
          disabled={isConnected || !currentSessionId}
        >
          Start Voice
        </button>
        <button 
          onClick={() => voiceRef.current?.stop()} 
          disabled={!isConnected}
        >
          Stop Voice
        </button>
      </div>
      
      <div>
        <h4>Current Session: {currentSession?.name}</h4>
        {currentSession?.conversationHistory.map((msg, index) => (
          <div key={index} className={msg.role}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage}
        onConnectionStateChange={(service, state) => {
          if (service === 'agent') {
            setIsConnected(state === 'open');
          }
        }}
      />
    </div>
  );
}
```

## Best Practices Summary

1. **Session Management**: Always manage sessions at the application level, not in the component
2. **Context Preservation**: Use `injectMessage()` to provide context when needed
3. **Error Handling**: Implement proper error handling for connection issues
4. **Performance**: Optimize context size and use memoization for expensive operations
5. **Testing**: Create testable patterns that can be easily verified
6. **Scalability**: Design for multiple sessions and users in enterprise scenarios

These examples show how to properly integrate the Deepgram Voice Interaction component with various session management and context handling patterns, following the architectural principles established in Issues #159 and #158.

