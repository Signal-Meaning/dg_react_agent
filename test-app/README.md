# Deepgram Voice Interaction Test App

This is a comprehensive demonstration app for the Deepgram Voice Interaction React component. It demonstrates the different operating modes of the component and provides examples of proper session management and context handling patterns.

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file in the root of this directory with your Deepgram API key:
   ```
   VITE_DEEPGRAM_API_KEY=your_deepgram_api_key_here
   VITE_DEEPGRAM_PROJECT_ID=your_project_id_here
   # optional LLM provider key e.g. OpenAI API key
   # VITE_THINK_API_KEY=your_think_api_key_here
   ```
4. Start the development server: `npm run dev`

## Component Modes

The Deepgram Voice Interaction component supports three operating modes, all demonstrated in this application:

### 1. Transcription Only Mode

To use the component in transcription-only mode:

```tsx
<DeepgramVoiceInteraction
  ref={deepgramRef}
  apiKey={apiKey}
  transcriptionOptions={transcriptionOptions}
  // No agentOptions prop - completely omit it, don't pass empty object
  onReady={handleReady}
  onTranscriptUpdate={handleTranscriptUpdate}
  onError={handleError}
  debug={true}
/>
```

### 2. Agent Only Mode

To use the component in agent-only mode:

```tsx
<DeepgramVoiceInteraction
  ref={deepgramRef}
  apiKey={apiKey}
  // No transcriptionOptions prop - completely omit it, don't pass empty object
  agentOptions={agentOptions}
  onReady={handleReady}
  onAgentStateChange={handleAgentStateChange}
  onAgentUtterance={handleAgentUtterance}
  onError={handleError}
  debug={true}
/>
```

### 3. Dual Mode (Transcription + Agent)

To use the component with both transcription and agent functionality:

```tsx
<DeepgramVoiceInteraction
  ref={deepgramRef}
  apiKey={apiKey}
  transcriptionOptions={transcriptionOptions}
  agentOptions={agentOptions}
  onReady={handleReady}
  onTranscriptUpdate={handleTranscriptUpdate}
  onAgentStateChange={handleAgentStateChange}
  onAgentUtterance={handleAgentUtterance}
  onError={handleError}
  debug={true}
/>
```

## Session Management Patterns

### Key Principles

The test-app demonstrates proper session management patterns that align with Deepgram's architecture:

1. **Single WebSocket = Single Session**: Each WebSocket connection is a complete session
2. **No Server-Side Persistence**: Deepgram servers don't maintain session state
3. **Client-Provided Context**: All conversation context must be provided by the client
4. **Single `start()` Method**: One WebSocket and single `start()` is sufficient for both voice and text interactions

### Context Preservation

The component enables applications to maintain conversation context across reconnections, but this is handled at the application layer, not within the component itself.

#### Basic Context Handling

```tsx
function VoiceApp() {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  const startWithContext = async () => {
    // Generate session ID if needed
    const currentSessionId = sessionId || generateSessionId();
    setSessionId(currentSessionId);
    
    // Start the component
    await voiceRef.current?.start();
    
    // Inject conversation context if needed
    if (conversationHistory.length > 0) {
      conversationHistory.forEach(message => {
        voiceRef.current?.injectMessage(message.role, message.content);
      });
    }
  };

  const handleAgentUtterance = (utterance: LLMResponse) => {
    // Store in application's session management
    setConversationHistory(prev => [...prev, {
      role: 'agent',
      content: utterance.text,
      timestamp: Date.now()
    }]);
  };

  const handleUserMessage = (message: UserMessageResponse) => {
    // Store in application's session management
    setConversationHistory(prev => [...prev, {
      role: 'user',
      content: message.text,
      timestamp: Date.now()
    }]);
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

#### Advanced Session Management

For more complex applications, consider implementing a dedicated SessionManager:

```tsx
class SessionManager {
  private conversationHistory: ConversationMessage[] = [];
  private sessionId: string | null = null;

  generateSessionId(): string {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.sessionId;
  }

  addMessage(role: 'agent' | 'user', content: string): void {
    this.conversationHistory.push({
      role,
      content,
      timestamp: Date.now()
    });
  }

  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}
```

### Context Updates via Settings

The component supports updating agent instructions and context during an active session:

```tsx
const updateAgentContext = () => {
  const newInstructions = "You are now a specialized assistant for technical support.";
  
  voiceRef.current?.updateAgentInstructions({
    instructions: newInstructions,
    // Additional context can be provided
    context: {
      userPreferences: { language: 'en', expertise: 'technical' },
      conversationHistory: conversationHistory.slice(-5) // Last 5 messages
    }
  });
};
```

### Reconnection Patterns

The test-app demonstrates proper reconnection patterns that preserve context:

```tsx
const handleReconnection = async () => {
  // Stop current connection
  await voiceRef.current?.stop();
  
  // Context is automatically included in agentOptions.context
  // Just restart the connection
  await voiceRef.current?.start();
};
```

## Important Notes

- **Session Management**: The component does not manage conversation history or session state internally. This is an application-layer concern.
- **Context Preservation**: Pass conversation history through `agentOptions.context`. The component will automatically include it in the Settings message.
- **Reconnection**: Always call `start()` after `stop()` to establish a new connection. Context is preserved through agentOptions.
- **State Management**: Monitor connection states through the `onConnectionStateChange` callback.

## Testing Features

The test-app includes comprehensive testing features:

- **Mock Mode**: Works with test API keys for development
- **Debug Mode**: Enable detailed logging with `?debug=true` in URL
- **Timeout Testing**: Built-in timeout simulation for testing idle behavior
- **VAD Testing**: Voice Activity Detection testing and monitoring
- **Audio Control**: Test audio interruption and playback controls

## Environment Variables

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete configuration options.

## Documentation

- [Session Management Guide](./docs/SESSION-MANAGEMENT.md) - Detailed session management patterns
- [Context Handling Guide](./docs/CONTEXT-HANDLING.md) - Conversation context management
- [Integration Examples](./docs/INTEGRATION-EXAMPLES.md) - Real-world integration patterns