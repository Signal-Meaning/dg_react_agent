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

### If `localhost` doesn't work in the browser

If you can reach the app at `http://127.0.0.1:5173` but not at `http://localhost:5173`, your system may be resolving `localhost` to IPv6 (`::1`) instead of IPv4. Use **`http://127.0.0.1:5173`** as a workaround, or fix resolution by ensuring `/etc/hosts` has `127.0.0.1 localhost` (on macOS/Linux, edit with `sudo nano /etc/hosts`). The dev server also prints a reminder when it starts.

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

#### When is context sent to the backend?

Context is sent to the backend **only in the first Settings message per connection** — i.e. when the WebSocket connects and the component sends Settings. If the app stays on the same connection and sends a follow-up user message (e.g. "how about green?" after "I need blue suede shoes"), the backend does **not** receive an updated context; no second Settings is sent.

**When a reconnection is made** (e.g. connection dropped, user returns): the app **must** pass `agentOptions.context` with the conversation history so that the new connection’s first message is Settings with `agent.context.messages`. Otherwise the new connection has no context. The test-app and E2E context-retention tests demonstrate this: when they reconnect, they pass context so the new connection gets it. See [Reconnection Patterns](#reconnection-patterns) below.

#### Basic Context Handling

Pass conversation history in `agentOptions.context` so the component includes it in the Settings message sent when the connection is established (or when you reconnect). The shape is `context: { messages: Array<{ type: 'History', role: 'user' | 'assistant', content: string }> }`.

```tsx
function VoiceApp() {
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const voiceRef = useRef<DeepgramVoiceInteractionHandle>(null);

  // Build agentOptions with context so the component sends it in Settings on connect/reconnect
  const agentOptions = {
    // ...other options...
    context: conversationHistory.length > 0 ? {
      messages: conversationHistory.map(m => ({
        type: 'History',
        role: m.role,
        content: m.content
      }))
    } : undefined
  };

  const handleAgentUtterance = (utterance: LLMResponse) => {
    setConversationHistory(prev => [...prev, { role: 'agent', content: utterance.text, timestamp: Date.now() }]);
  };

  const handleUserMessage = (message: UserMessageResponse) => {
    setConversationHistory(prev => [...prev, { role: 'user', content: message.text, timestamp: Date.now() }]);
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

**Note:** `injectMessage` sends a user or assistant message as a new turn; it does **not** put context into the Settings that the backend uses. Backend context must be provided via `agentOptions.context` and is sent only when the component sends Settings (on connect or when you reconnect).

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

The test-app demonstrates proper reconnection patterns that preserve context. When a reconnection is made (e.g. after a disconnect or when the user returns), the backend receives context only in the **first** Settings message on the new connection. So you **must** pass `agentOptions.context` with the current conversation history when you call `start()` after a reconnect; otherwise the new connection has no context.

```tsx
const handleReconnection = async () => {
  await voiceRef.current?.stop();
  // Ensure agentOptions.context includes current conversation history (from state/ref).
  // On start(), the component sends Settings with that context to the backend.
  await voiceRef.current?.start();
};
```

The E2E tests `context-retention-agent-usage` and `context-retention-with-function-calling` follow this flow: they disconnect, then reconnect with updated `agentOptions.context`, so the new connection’s first message is Settings with context.

## Important Notes

- **Session Management**: The component does not manage conversation history or session state internally. This is an application-layer concern.
- **Context Preservation**: Pass conversation history through `agentOptions.context`. The component includes it in the **Settings** message. Settings is sent **once per connection** (when the connection is established).
- **Follow-up messages and context**: On a single connection, the backend receives context only in the first Settings; it does not receive updated context for later messages. To have the model see prior turns without reconnecting would require mid-session Settings support (not currently implemented).
- **When reconnecting**: Call `start()` after `stop()` to establish a new connection. You **must** pass `agentOptions.context` with the conversation history so the new connection’s first message is Settings with context.
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