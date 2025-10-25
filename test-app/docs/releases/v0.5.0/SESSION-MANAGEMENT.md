# Session Management Guide

This guide explains how to properly implement session management with the Deepgram Voice Interaction component, following Deepgram's stateless architecture principles.

## Core Principles

### 1. Single WebSocket = Single Session

Each WebSocket connection to Deepgram represents a complete session. When you call `start()`, you establish a new session. When you call `stop()`, you end that session.

```tsx
// Each start() call creates a new session
await voiceRef.current?.start(); // Session 1
await voiceRef.current?.stop();
await voiceRef.current?.start(); // Session 2 (completely new)
```

### 2. No Server-Side Persistence

Deepgram servers do not maintain session state between connections. Any conversation context must be provided by your application.

### 3. Client-Provided Context

All conversation history, user preferences, and context must be managed by your application and provided to the component when needed.

## Basic Session Management

### Simple Session Pattern

For single-session applications:

```tsx
function SimpleVoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [isConnected, setIsConnected] = useState(false);

  const startSession = async () => {
    await voiceRef.current?.start();
    setIsConnected(true);
  };

  const stopSession = async () => {
    await voiceRef.current?.stop();
    setIsConnected(false);
  };

  return (
    <div>
      <button onClick={startSession} disabled={isConnected}>
        Start Session
      </button>
      <button onClick={stopSession} disabled={!isConnected}>
        Stop Session
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
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

### Multi-Session Pattern

For applications that need to manage multiple sessions:

```tsx
function MultiSessionVoiceApp() {
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Map<string, SessionData>>(new Map());

  const startNewSession = async () => {
    const sessionId = generateSessionId();
    setCurrentSessionId(sessionId);
    
    // Store session data
    setSessions(prev => new Map(prev.set(sessionId, {
      id: sessionId,
      createdAt: Date.now(),
      conversationHistory: []
    })));
    
    await voiceRef.current?.start();
  };

  const switchToSession = async (sessionId: string) => {
    // Stop current session
    await voiceRef.current?.stop();
    
    // Switch to new session
    setCurrentSessionId(sessionId);
    
    // Context is automatically passed through agentOptions.context
    // which updates when currentSessionId changes (via useMemo dependency)
    await voiceRef.current?.start();
  };

  return (
    <div>
      <button onClick={startNewSession}>New Session</button>
      {Array.from(sessions.keys()).map(sessionId => (
        <button 
          key={sessionId}
          onClick={() => switchToSession(sessionId)}
          className={sessionId === currentSessionId ? 'active' : ''}
        >
          Session {sessionId.slice(-8)}
        </button>
      ))}
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
      />
    </div>
  );
}
```

## Context Management

### Conversation History

Maintain conversation history in your application state:

```tsx
interface ConversationMessage {
  role: 'agent' | 'user';
  content: string;
  timestamp: number;
}

function VoiceAppWithHistory() {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const handleAgentUtterance = (utterance: LLMResponse) => {
    setConversationHistory(prev => [...prev, {
      role: 'agent',
      content: utterance.text,
      timestamp: Date.now()
    }]);
  };

  const handleUserMessage = (message: UserMessageResponse) => {
    setConversationHistory(prev => [...prev, {
      role: 'user',
      content: message.text,
      timestamp: Date.now()
    }]);
  };

  const injectContext = () => {
    // Inject recent conversation history
    conversationHistory.slice(-5).forEach(message => {
      voiceRef.current?.injectMessage(message.role, message.content);
    });
  };

  return (
    <div>
      <button onClick={injectContext}>Inject Context</button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage}
      />
      
      <div>
        <h3>Conversation History</h3>
        {conversationHistory.map((msg, index) => (
          <div key={index} className={msg.role}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Context Updates

Update agent context during an active session:

```tsx
const updateAgentContext = (newInstructions: string, additionalContext?: {
  messages: Array<{
    type: string;
    role: string;
    content: string;
  }>;
}) => {
  voiceRef.current?.updateAgentInstructions({
    instructions: newInstructions,
    context: additionalContext
  });
};

// Usage
updateAgentContext(
  "You are now a specialized technical support assistant.",
  {
    messages: conversationHistory.slice(-3).map(message => ({
      type: "History",
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }))
  }
);
```

## Reconnection Patterns

### Basic Reconnection

```tsx
const handleReconnection = async () => {
  try {
    // Stop current connection
    await voiceRef.current?.stop();
    
    // Restart with preserved context
    await voiceRef.current?.start();
    
    // Re-inject conversation history
    conversationHistory.forEach(message => {
      voiceRef.current?.injectMessage(message.role, message.content);
    });
    
    console.log('Reconnected with context preserved');
  } catch (error) {
    console.error('Reconnection failed:', error);
  }
};
```

### Smart Reconnection

```tsx
const smartReconnection = async () => {
  const isConnected = connectionStates.agent === 'open';
  
  if (!isConnected) {
    await voiceRef.current?.start();
    
    // Only inject context if we have history
    if (conversationHistory.length > 0) {
      // Inject recent context (last 3 messages)
      conversationHistory.slice(-3).forEach(message => {
        voiceRef.current?.injectMessage(message.role, message.content);
      });
    }
  }
};
```

## Session Data Persistence

### Local Storage Pattern

```tsx
const SESSION_STORAGE_KEY = 'voice_app_sessions';

const saveSessionToStorage = (sessionId: string, sessionData: SessionData) => {
  const existing = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '{}');
  existing[sessionId] = sessionData;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(existing));
};

const loadSessionsFromStorage = (): Record<string, SessionData> => {
  return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '{}');
};

const clearSessionStorage = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};
```

### IndexedDB Pattern (for larger datasets)

```tsx
class SessionDatabase {
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('VoiceAppSessions', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      };
    });
  }

  async saveSession(sessionData: SessionData) {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    return store.put(sessionData);
  }

  async getSession(sessionId: string): Promise<SessionData | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
```

## Best Practices

### 1. Session Lifecycle Management

```tsx
const useSessionManager = () => {
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [sessions, setSessions] = useState<Map<string, SessionData>>(new Map());

  const createSession = useCallback((initialContext?: any) => {
    const sessionId = generateSessionId();
    const sessionData: SessionData = {
      id: sessionId,
      createdAt: Date.now(),
      conversationHistory: [],
      context: initialContext || {}
    };
    
    setSessions(prev => new Map(prev.set(sessionId, sessionData)));
    setCurrentSession(sessionData);
    
    return sessionId;
  }, []);

  const switchSession = useCallback((sessionId: string) => {
    const session = sessions.get(sessionId);
    if (session) {
      setCurrentSession(session);
    }
  }, [sessions]);

  const addMessage = useCallback((role: 'agent' | 'user', content: string) => {
    if (!currentSession) return;
    
    const message: ConversationMessage = {
      role,
      content,
      timestamp: Date.now()
    };
    
    const updatedSession = {
      ...currentSession,
      conversationHistory: [...currentSession.conversationHistory, message]
    };
    
    setSessions(prev => new Map(prev.set(currentSession.id, updatedSession)));
    setCurrentSession(updatedSession);
  }, [currentSession]);

  return {
    currentSession,
    sessions: Array.from(sessions.values()),
    createSession,
    switchSession,
    addMessage
  };
};
```

### 2. Error Handling

```tsx
const handleConnectionError = (error: DeepgramError) => {
  console.error('Connection error:', error);
  
  // Implement retry logic
  if (error.code === 'connection_failed') {
    setTimeout(() => {
      voiceRef.current?.start();
    }, 1000);
  }
  
  // Handle specific error types
  switch (error.code) {
    case 'authentication_failed':
      // Handle auth errors
      break;
    case 'rate_limit_exceeded':
      // Handle rate limiting
      break;
    default:
      // Handle other errors
      break;
  }
};
```

### 3. Performance Optimization

```tsx
// Memoize conversation history to prevent unnecessary re-renders
const memoizedHistory = useMemo(() => conversationHistory, [conversationHistory]);

// Debounce context updates
const debouncedContextUpdate = useMemo(
  () => debounce((context: any) => {
    voiceRef.current?.updateAgentInstructions({ context });
  }, 500),
  []
);
```

## Common Pitfalls

### ❌ Don't: Manage sessions in component state

```tsx
// WRONG - Component should not manage sessions
<DeepgramVoiceInteraction
  sessionId={sessionId} // This doesn't exist
  conversationHistory={history} // This doesn't exist
/>
```

### ✅ Do: Manage sessions in application state

```tsx
// CORRECT - Application manages sessions
const [sessionId, setSessionId] = useState<string | null>(null);
const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);

// Inject context when needed
useEffect(() => {
  if (conversationHistory.length > 0) {
    conversationHistory.forEach(message => {
      voiceRef.current?.injectMessage(message.role, message.content);
    });
  }
}, [conversationHistory]);
```

### ❌ Don't: Expect server-side persistence

```tsx
// WRONG - Servers don't remember sessions
await voiceRef.current?.start();
// ... user closes browser ...
await voiceRef.current?.start(); // This is a NEW session, not a continuation
```

### ✅ Do: Provide context explicitly

```tsx
// CORRECT - Always provide context
await voiceRef.current?.start();
// Restore conversation history
conversationHistory.forEach(message => {
  voiceRef.current?.injectMessage(message.role, message.content);
});
```

## Integration with Component

The component provides the tools for session management, but the actual session management logic belongs in your application:

- **`start()`** - Creates a new session
- **`stop()`** - Ends the current session  
- **`injectMessage()`** - Provides context to the session
- **`updateAgentInstructions()`** - Updates session context
- **Event callbacks** - Monitor session state and capture conversation data

Your application is responsible for:
- Generating and managing session IDs
- Storing conversation history
- Persisting session data
- Managing multiple sessions
- Providing context when needed
