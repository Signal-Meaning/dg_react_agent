# Context Handling Guide

This guide explains how to properly handle conversation context with the Deepgram Voice Interaction component, including context preservation, updates, and best practices.

## Understanding Context

### What is Context?

Context in voice interactions refers to:
- **Conversation History**: Previous messages in the conversation
- **User Preferences**: Language, expertise level, personal settings
- **Session State**: Current topic, user intent, conversation flow
- **Agent Instructions**: How the agent should behave in this context

### Why Context Matters

- **Continuity**: Maintains conversation flow across reconnections
- **Personalization**: Adapts agent behavior to user preferences
- **Efficiency**: Reduces need to repeat information
- **User Experience**: Creates more natural, human-like interactions

## Context Preservation Patterns

### Basic Context Preservation

```tsx
function VoiceAppWithContext() {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  // Capture conversation data
  const handleAgentUtterance = (utterance: LLMResponse) => {
    setConversationHistory(prev => [...prev, {
      role: 'assistant',
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

  // Create agentOptions with context
  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    thinkProviderType: 'open_ai',
    thinkModel: 'gpt-4o-mini',
    voice: 'aura-asteria-en',
    instructions: `You are a helpful assistant. User preferences: ${JSON.stringify(userPreferences)}`,
    // Pass conversation history as context in Deepgram API format
    context: conversationHistory.length > 0 ? {
      messages: conversationHistory.map(message => ({
        type: "History",
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))
    } : undefined
  }), [conversationHistory, userPreferences]);
  
  // Provide context when starting
  const startWithContext = async () => {
    // Context is automatically included via agentOptions.context
    await voiceRef.current?.start();
  };

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

### Advanced Context Management

```tsx
interface ContextData {
  conversationHistory: ConversationMessage[];
  userPreferences: UserPreferences;
  currentTopic?: string;
  userIntent?: string;
  sessionMetadata: Record<string, any>;
}

class ContextManager {
  private context: ContextData;
  private maxHistoryLength = 10;

  constructor(initialContext?: Partial<ContextData>) {
    this.context = {
      conversationHistory: [],
      userPreferences: {},
      sessionMetadata: {},
      ...initialContext
    };
  }

  addMessage(role: 'assistant' | 'user', content: string) {
    const message: ConversationMessage = {
      role,
      content,
      timestamp: Date.now()
    };

    this.context.conversationHistory.push(message);

    // Keep only recent history
    if (this.context.conversationHistory.length > this.maxHistoryLength) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  updatePreferences(preferences: Partial<UserPreferences>) {
    this.context.userPreferences = {
      ...this.context.userPreferences,
      ...preferences
    };
  }

  setCurrentTopic(topic: string) {
    this.context.currentTopic = topic;
  }

  setUserIntent(intent: string) {
    this.context.userIntent = intent;
  }

  getContextForAgent(): any {
    return {
      conversationHistory: this.context.conversationHistory,
      userPreferences: this.context.userPreferences,
      currentTopic: this.context.currentTopic,
      userIntent: this.context.userIntent,
      sessionMetadata: this.context.sessionMetadata
    };
  }

  getRecentHistory(count: number = 5): ConversationMessage[] {
    return this.context.conversationHistory.slice(-count);
  }
}
```

## Context Updates

### Real-time Context Updates

```tsx
function VoiceAppWithDynamicContext() {
  const contextManager = useMemo(() => new ContextManager(), []);
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  // Update context when user preferences change
  const updateUserPreferences = (preferences: Partial<UserPreferences>) => {
    contextManager.updatePreferences(preferences);
    
    // Update agent with new preferences
    voiceRef.current?.updateAgentInstructions({
      instructions: `You are a helpful assistant. Current user preferences: ${JSON.stringify(contextManager.getContextForAgent().userPreferences)}`,
      context: JSON.stringify(contextManager.getContextForAgent())
    });
  };

  // Update context when topic changes
  const updateTopic = (topic: string) => {
    contextManager.setCurrentTopic(topic);
    
    voiceRef.current?.updateAgentInstructions({
      instructions: `You are now discussing: ${topic}. Previous context: ${JSON.stringify(contextManager.getContextForAgent())}`,
      context: JSON.stringify(contextManager.getContextForAgent())
    });
  };

  // Capture conversation data
  const handleAgentUtterance = (utterance: LLMResponse) => {
    contextManager.addMessage('assistant', utterance.text);
  };

  const handleUserMessage = (message: UserMessageResponse) => {
    contextManager.addMessage('user', message.text);
  };

  return (
    <div>
      <button onClick={() => updateUserPreferences({ language: 'en', expertise: 'technical' })}>
        Set Technical Mode
      </button>
      <button onClick={() => updateTopic('React Development')}>
        Switch to React Topic
      </button>
      
      <DeepgramVoiceInteraction
        ref={voiceRef}
        apiKey={apiKey}
        agentOptions={agentOptions}
        onAgentUtterance={handleAgentUtterance}
        onUserMessage={handleUserMessage}
      />
    </div>
  );
}
```

### Context Persistence

```tsx
class PersistentContextManager extends ContextManager {
  private storageKey: string;

  constructor(storageKey: string, initialContext?: Partial<ContextData>) {
    super(initialContext);
    this.storageKey = storageKey;
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.context = { ...this.context, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load context from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.context));
    } catch (error) {
      console.error('Failed to save context to storage:', error);
    }
  }

  addMessage(role: 'agent' | 'user', content: string) {
    super.addMessage(role, content);
    this.saveToStorage();
  }

  updatePreferences(preferences: Partial<UserPreferences>) {
    super.updatePreferences(preferences);
    this.saveToStorage();
  }

  setCurrentTopic(topic: string) {
    super.setCurrentTopic(topic);
    this.saveToStorage();
  }

  clearContext() {
    this.context = {
      conversationHistory: [],
      userPreferences: {},
      sessionMetadata: {}
    };
    this.saveToStorage();
  }
}
```

## Context Injection Strategies

### Immediate Context Injection

```tsx
const injectContextImmediately = async () => {
  await voiceRef.current?.start();
  
  // Inject context right after connection
  const context = contextManager.getContextForAgent();
  
  // Inject conversation history
  context.conversationHistory.forEach(message => {
    voiceRef.current?.injectMessage(message.role, message.content);
  });
  
  // Update agent instructions with full context
  voiceRef.current?.updateAgentInstructions({
    instructions: `You are a helpful assistant with this context: ${JSON.stringify(context)}`,
    context: JSON.stringify(context)
  });
};
```

### Lazy Context Injection

```tsx
const injectContextLazily = async () => {
  await voiceRef.current?.start();
  
  // Inject context only when needed
  const shouldInjectContext = conversationHistory.length > 0 || userPreferences.language;
  
  if (shouldInjectContext) {
    // Inject recent history only
    const recentHistory = contextManager.getRecentHistory(3);
    recentHistory.forEach(message => {
      voiceRef.current?.injectMessage(message.role, message.content);
    });
  }
};
```

### Conditional Context Injection

```tsx
const injectContextConditionally = async (condition: (context: ContextData) => boolean) => {
  await voiceRef.current?.start();
  
  const context = contextManager.getContextForAgent();
  
  if (condition(context)) {
    // Inject full context
    context.conversationHistory.forEach(message => {
      voiceRef.current?.injectMessage(message.role, message.content);
    });
    
    voiceRef.current?.updateAgentInstructions({
      instructions: `You are a helpful assistant with full context: ${JSON.stringify(context)}`,
      context: JSON.stringify(context)
    });
  } else {
    // Inject minimal context
    voiceRef.current?.updateAgentInstructions({
      instructions: `You are a helpful assistant. User preferences: ${JSON.stringify(context.userPreferences)}`,
      context: JSON.stringify({ userPreferences: context.userPreferences })
    });
  }
};
```

## Context Optimization

### Memory Management

```tsx
class OptimizedContextManager extends ContextManager {
  private maxHistoryLength = 10;
  private maxContextSize = 50000; // 50KB limit

  addMessage(role: 'agent' | 'user', content: string) {
    super.addMessage(role, content);
    
    // Trim history if too long
    if (this.context.conversationHistory.length > this.maxHistoryLength) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-this.maxHistoryLength);
    }
    
    // Check context size
    const contextSize = JSON.stringify(this.context).length;
    if (contextSize > this.maxContextSize) {
      this.optimizeContext();
    }
  }

  private optimizeContext() {
    // Keep only essential context
    this.context.conversationHistory = this.context.conversationHistory.slice(-5);
    this.context.sessionMetadata = {};
  }
}
```

### Context Compression

```tsx
const compressContext = (context: ContextData): any => {
  return {
    // Keep only recent messages
    recentMessages: context.conversationHistory.slice(-3),
    // Keep only essential preferences
    preferences: {
      language: context.userPreferences.language,
      expertise: context.userPreferences.expertise
    },
    // Keep current topic
    currentTopic: context.currentTopic
  };
};

const injectCompressedContext = async () => {
  await voiceRef.current?.start();
  
  const fullContext = contextManager.getContextForAgent();
  const compressedContext = compressContext(fullContext);
  
  voiceRef.current?.updateAgentInstructions({
    instructions: `You are a helpful assistant with this context: ${JSON.stringify(compressedContext)}`,
    context: JSON.stringify(compressedContext)
  });
};
```

## Context Validation

### Context Validation

```tsx
const validateContext = (context: any): boolean => {
  // Check for required fields
  if (!context.conversationHistory || !Array.isArray(context.conversationHistory)) {
    return false;
  }
  
  // Check message format
  for (const message of context.conversationHistory) {
    if (!message.role || !message.content || !message.timestamp) {
      return false;
    }
  }
  
  // Check size limits
  const contextSize = JSON.stringify(context).length;
  if (contextSize > 100000) { // 100KB limit
    return false;
  }
  
  return true;
};

const safeInjectContext = async (context: any) => {
  if (!validateContext(context)) {
    console.error('Invalid context, skipping injection');
    return;
  }
  
  await voiceRef.current?.start();
  
  context.conversationHistory.forEach(message => {
    voiceRef.current?.injectMessage(message.role, message.content);
  });
  
  voiceRef.current?.updateAgentInstructions({
    instructions: `You are a helpful assistant with this context: ${JSON.stringify(context)}`,
    context: JSON.stringify(context)
  });
};
```

## Best Practices

### 1. Context Lifecycle Management

```tsx
const useContextLifecycle = () => {
  const [context, setContext] = useState<ContextData>({
    conversationHistory: [],
    userPreferences: {},
    sessionMetadata: {}
  });

  const addMessage = useCallback((role: 'agent' | 'user', content: string) => {
    setContext(prev => ({
      ...prev,
      conversationHistory: [...prev.conversationHistory, {
        role,
        content,
        timestamp: Date.now()
      }]
    }));
  }, []);

  const updatePreferences = useCallback((preferences: Partial<UserPreferences>) => {
    setContext(prev => ({
      ...prev,
      userPreferences: { ...prev.userPreferences, ...preferences }
    }));
  }, []);

  const clearContext = useCallback(() => {
    setContext({
      conversationHistory: [],
      userPreferences: {},
      sessionMetadata: {}
    });
  }, []);

  return {
    context,
    addMessage,
    updatePreferences,
    clearContext
  };
};
```

### 2. Error Handling

```tsx
const handleContextError = (error: Error) => {
  console.error('Context error:', error);
  
  // Fallback to minimal context
  voiceRef.current?.updateAgentInstructions({
    instructions: 'You are a helpful assistant.',
    context: '{}'
  });
};
```

### 3. Performance Monitoring

```tsx
const monitorContextPerformance = (context: ContextData) => {
  const startTime = performance.now();
  
  // Inject context
  context.conversationHistory.forEach(message => {
    voiceRef.current?.injectMessage(message.role, message.content);
  });
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  if (duration > 100) { // More than 100ms
    console.warn(`Context injection took ${duration}ms, consider optimizing`);
  }
};
```

## Common Pitfalls

### ❌ Don't: Inject too much context

```tsx
// WRONG - Too much context
const hugeContext = {
  conversationHistory: [...allMessagesEver], // Thousands of messages
  userPreferences: { ...allPossiblePreferences },
  sessionMetadata: { ...everything }
};
```

### ✅ Do: Inject relevant context only

```tsx
// CORRECT - Relevant context only
const relevantContext = {
  conversationHistory: recentMessages.slice(-5), // Last 5 messages
  userPreferences: { language: 'en', expertise: 'technical' },
  currentTopic: 'React Development'
};
```

### ❌ Don't: Ignore context validation

```tsx
// WRONG - No validation
voiceRef.current?.injectMessage(role, content); // Could be invalid
```

### ✅ Do: Validate context before injection

```tsx
// CORRECT - Validate first
if (validateMessage(role, content)) {
  voiceRef.current?.injectMessage(role, content);
}
```

## Integration with Component

The component provides these methods for context handling:

- **`injectMessage(role, content)`** - Inject individual messages
- **`updateAgentInstructions(payload)`** - Update agent with new context
- **Event callbacks** - Capture conversation data for context management

Your application is responsible for:
- Managing context data structure
- Validating context before injection
- Optimizing context size and relevance
- Persisting context across sessions
- Providing context when needed
