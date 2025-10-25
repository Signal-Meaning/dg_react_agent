# Issue #183: Add Context Support to AgentOptions

## Problem Statement

The Deepgram Voice Interaction component incorrectly managed session state internally (`conversationHistory`, `sessionId`) instead of accepting context through `AgentOptions`. This violated the architectural principles established in Issues #159 and #158:

1. **Session Management Violation**: The component stored and managed conversation history internally, making it responsible for session management when this should be an application-layer concern.

2. **Architectural Inconsistency**: The Deepgram Voice Agent API supports conversation context through the `agent.context` parameter in Settings messages, but the component's `AgentOptions` interface did not expose this capability.

3. **Deprecated Methods**: Several methods (`resumeWithText`, `resumeWithAudio`, `connectWithContext`, `toggleMicrophone`) were built around internal session management and needed removal.

## Solution

### 1. Add Context to AgentOptions

Added a `context` field to the `AgentOptions` interface to accept conversation history from the application layer:

```typescript
export interface AgentOptions {
  // ... existing fields ...
  
  // Conversation context for session continuity
  context?: ConversationMessage[];
}
```

### 2. Remove Internal Session State

Removed `conversationHistory` and `sessionId` from the component's internal state (`VoiceInteractionState`), along with related action types:
- `ADD_CONVERSATION_MESSAGE`
- `SET_SESSION_ID`
- `CLEAR_CONVERSATION_HISTORY`

### 3. Update Settings Message Generation

Modified `sendAgentSettings()` to use `agentOptions.context` instead of internal state:

```typescript
// Before:
context: transformConversationHistory(state.conversationHistory)

// After:
context: agentOptions.context ? transformConversationHistory(agentOptions.context) : undefined
```

### 4. Remove Deprecated Methods

Removed the following methods from the component and type definitions:
- `resumeWithText()` - Managed internal conversation history
- `resumeWithAudio()` - Managed internal session state
- `connectWithContext()` - Sent settings with internal context
- `toggleMicrophone()` - Microphone control responsibility violation

Also removed helper utilities:
- `generateSessionId()` - Session ID generation (application concern)
- `LAZY_RECONNECT_CONFIG` - Reconnection constants (inline where needed)

### 5. Update Test-App Implementation

Updated `test-app/src/App.tsx` to demonstrate proper context injection:

```typescript
// Track conversation history in application state
const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);

// Update history when messages are received
const handleAgentUtterance = useCallback((utterance: LLMResponse) => {
  setConversationHistory(prev => [...prev, {
    role: 'assistant',
    content: utterance.text,
    timestamp: Date.now()
  }]);
}, []);

const handleUserMessage = useCallback((message: UserMessageResponse) => {
  setConversationHistory(prev => [...prev, {
    role: 'user',
    content: message.text,
    timestamp: Date.now()
  }]);
}, []);

// Pass context through agentOptions
const memoizedAgentOptions = useMemo(() => ({
  language: 'en',
  listenModel: 'nova-3',
  thinkProviderType: 'open_ai',
  thinkModel: 'gpt-4o-mini',
  voice: 'aura-asteria-en',
  instructions: loadedInstructions,
  greeting: 'Hello! How can I assist you today?',
  // Pass conversation history as context for session continuity
  context: conversationHistory
}), [loadedInstructions, conversationHistory]);
```

## Breaking Changes

### Removed Methods

The following methods have been removed from `DeepgramVoiceInteractionHandle`:
- `resumeWithText(text: string): Promise<void>`
- `resumeWithAudio(): Promise<void>`
- `connectWithContext(sessionId: string, history: ConversationMessage[], options: AgentOptions): Promise<void>`
- `toggleMicrophone(enabled: boolean): Promise<void>`

### Removed State

The component no longer stores:
- `conversationHistory: ConversationMessage[]`
- `sessionId: string | null`

## Migration Path

### Before (v0.4.x)

```typescript
// Component managed conversation history internally
await voiceRef.current?.resumeWithText("Hello");
await voiceRef.current?.connectWithContext(sessionId, history, options);
```

### After (v0.5.0)

```typescript
// Application manages conversation history
const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);

// Track messages in callbacks
const handleAgentUtterance = (utterance: LLMResponse) => {
  setConversationHistory(prev => [...prev, {
    role: 'assistant',
    content: utterance.text,
    timestamp: Date.now()
  }]);
};

// Pass context through agentOptions
const agentOptions = useMemo(() => ({
  ...baseOptions,
  context: conversationHistory
}), [conversationHistory]);

// Context is automatically included in Settings messages
<DeepgramVoiceInteraction 
  agentOptions={agentOptions}
  onAgentUtterance={handleAgentUtterance}
  onUserMessage={handleUserMessage}
/>
```

## Benefits

1. **Architectural Clarity**: Clear separation between component responsibilities (WebSocket management, audio handling) and application concerns (session management, context preservation).

2. **API Alignment**: The component now directly exposes the Deepgram Voice Agent API's context capabilities without abstraction.

3. **Flexibility**: Applications have full control over conversation history, including filtering, summarization, and persistence strategies.

4. **Testability**: Easier to test context injection patterns without internal state management.

5. **Simplicity**: Reduced component complexity by removing session management logic.

## References

- [Deepgram Voice Agent History API](https://developers.deepgram.com/docs/voice-agent-history#conversation-context-history)
- Issue #159: Clarify reconnection methods and session management
- Issue #158: Remove microphone control methods
- Issue #183: API reference documentation corrections

## Related Documentation

- [API Reference](../releases/v0.5.0/API-REFERENCE.md) - Updated session management section
- [Test-App README](../../test-app/README.md) - Context injection examples
- [Session Management Guide](../../test-app/docs/SESSION-MANAGEMENT.md)
- [Context Handling Guide](../../test-app/docs/CONTEXT-HANDLING.md)


