# New Features - v0.7.0

## 🎯 Declarative Props API

### Overview

v0.7.0 introduces a comprehensive declarative props API that allows you to control the component using React-friendly patterns, eliminating the need for imperative refs in many common use cases.

### Key Benefits

- **React-Friendly**: Use standard React patterns with props instead of imperative refs
- **Simplified Integration**: Easier to integrate with React state management
- **Better Type Safety**: Full TypeScript support for all declarative props
- **Backward Compatible**: All existing imperative APIs continue to work

### New Declarative Props

#### User Message Handling

```typescript
// Declaratively send user messages
<DeepgramVoiceInteraction
  userMessage={userMessage}  // Send message when this prop changes
  onUserMessageSent={() => {
    // Called after message is sent
    setUserMessage('');  // Clear input
  }}
/>
```

#### Automatic Service Start

```typescript
// Automatically start services when component mounts
<DeepgramVoiceInteraction
  autoStartAgent={true}           // Start agent service automatically
  autoStartTranscription={true}   // Start transcription service automatically
/>
```

#### Connection State Control

```typescript
// Declaratively control connection state
const [connectionState, setConnectionState] = useState<ConnectionState>('closed');

<DeepgramVoiceInteraction
  connectionState={connectionState}  // Control connection state
  // Component will automatically start/stop to match this state
/>
```

#### Agent Interruption

```typescript
// Declaratively interrupt agent speech
const [interruptAgent, setInterruptAgent] = useState(false);

<DeepgramVoiceInteraction
  interruptAgent={interruptAgent}
  onAgentInterrupted={() => {
    setInterruptAgent(false);  // Reset after interruption
  }}
/>
```

#### Audio Capture Control

```typescript
// Declaratively start audio capture
const [startAudioCapture, setStartAudioCapture] = useState(false);

<DeepgramVoiceInteraction
  startAudioCapture={startAudioCapture}
  // Component will start audio capture when this becomes true
/>
```

### Migration from Imperative API

**Before (Imperative)**:
```typescript
const ref = useRef<DeepgramVoiceInteractionHandle>(null);

const sendMessage = () => {
  ref.current?.injectUserMessage('Hello');
};

<DeepgramVoiceInteraction ref={ref} />
```

**After (Declarative)**:
```typescript
const [userMessage, setUserMessage] = useState('');

const sendMessage = () => {
  setUserMessage('Hello');
};

<DeepgramVoiceInteraction
  userMessage={userMessage}
  onUserMessageSent={() => setUserMessage('')}
/>
```

### Documentation

For complete details, see [Issue #305 Documentation](docs/issues/ISSUE-305-REFACTORING-ANALYSIS.md).

---

## 🔐 Backend Proxy Support

### Overview

v0.7.0 introduces backend proxy support, allowing you to keep your Deepgram API key secure on your backend server instead of exposing it in the frontend JavaScript bundle.

### Key Benefits

- **Security**: API keys never exposed in client-side code
- **Cost Control**: Better control over API usage and costs
- **Compliance**: Meets security requirements for organizations with strict policies
- **Flexibility**: Use your existing backend infrastructure

### Architecture

```
Browser → Your Backend Proxy → Deepgram API
         (API key stored here)
```

### Usage

#### Backend Setup

Add a WebSocket proxy endpoint to your existing backend:

```javascript
// Example: Express.js backend
const WebSocket = require('ws');

app.ws('/deepgram-proxy', (ws, req) => {
  // Authenticate request (optional)
  const token = req.headers.authorization;
  if (!isValidToken(token)) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Connect to Deepgram with API key from server-side config
  const deepgramWs = new WebSocket('wss://agent.deepgram.com/v1/agent/converse', {
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`
    }
  });

  // Proxy messages bidirectionally
  ws.on('message', (data) => deepgramWs.send(data));
  deepgramWs.on('message', (data) => ws.send(data));
  
  ws.on('close', () => deepgramWs.close());
  deepgramWs.on('close', () => ws.close());
});
```

#### Frontend Usage

```typescript
<DeepgramVoiceInteraction
  proxyEndpoint="wss://api.example.com/deepgram-proxy"
  proxyAuthToken={authToken}  // Optional: JWT or session token
  agentOptions={agentOptions}
/>
```

### Connection Mode Selection

The component automatically selects the connection mode:

- **Direct Mode**: When `apiKey` is provided (existing behavior)
- **Proxy Mode**: When `proxyEndpoint` is provided
- **Error**: If neither is provided

### Feature Parity

Backend proxy mode supports all features available in direct mode:
- Agent service
- Transcription service
- Audio streaming
- Function calling
- All callbacks and events

### Documentation

For complete implementation details, backend examples, and security best practices, see [Issue #242 Documentation](docs/issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md).

---

## 📚 Related Documentation

- [API Reference](../API-REFERENCE.md) - Complete API documentation
- [Issue #305: Declarative Props](docs/issues/ISSUE-305-REFACTORING-ANALYSIS.md) - Detailed declarative props documentation
- [Issue #242: Backend Proxy](docs/issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md) - Complete backend proxy guide
