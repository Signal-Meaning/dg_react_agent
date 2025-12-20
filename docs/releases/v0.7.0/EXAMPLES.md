# Usage Examples - v0.7.0

## Declarative Props Examples

### Basic Declarative User Message

```typescript
import React, { useState } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  const [userMessage, setUserMessage] = useState('');

  const handleSendMessage = () => {
    setUserMessage('Hello, how are you?');
  };

  return (
    <>
      <button onClick={handleSendMessage}>Send Message</button>
      <DeepgramVoiceInteraction
        apiKey={apiKey}
        userMessage={userMessage}
        onUserMessageSent={() => setUserMessage('')}
        agentOptions={{
          language: 'en',
          thinkProviderType: 'open_ai',
          thinkModel: 'gpt-4o-mini',
          voice: 'aura-asteria-en',
          instructions: 'You are a helpful assistant.'
        }}
      />
    </>
  );
}
```

### Auto-Start Services

```typescript
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  return (
    <DeepgramVoiceInteraction
      apiKey={apiKey}
      autoStartAgent={true}
      autoStartTranscription={true}
      agentOptions={agentOptions}
      transcriptionOptions={transcriptionOptions}
    />
  );
}
```

### Declarative Connection State Control

```typescript
import React, { useState } from 'react';
import { DeepgramVoiceInteraction, ConnectionState } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('closed');

  return (
    <>
      <button onClick={() => setConnectionState('connected')}>
        Connect
      </button>
      <button onClick={() => setConnectionState('closed')}>
        Disconnect
      </button>
      <DeepgramVoiceInteraction
        apiKey={apiKey}
        connectionState={connectionState}
        agentOptions={agentOptions}
      />
    </>
  );
}
```

### Declarative Agent Interruption

```typescript
import React, { useState } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  const [interruptAgent, setInterruptAgent] = useState(false);

  const handleInterrupt = () => {
    setInterruptAgent(true);
  };

  return (
    <>
      <button onClick={handleInterrupt}>Interrupt Agent</button>
      <DeepgramVoiceInteraction
        apiKey={apiKey}
        interruptAgent={interruptAgent}
        onAgentInterrupted={() => setInterruptAgent(false)}
        agentOptions={agentOptions}
      />
    </>
  );
}
```

### Declarative Audio Capture

```typescript
import React, { useState } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  const [startAudioCapture, setStartAudioCapture] = useState(false);

  return (
    <>
      <button onClick={() => setStartAudioCapture(true)}>
        Start Microphone
      </button>
      <DeepgramVoiceInteraction
        apiKey={apiKey}
        startAudioCapture={startAudioCapture}
        agentOptions={agentOptions}
      />
    </>
  );
}
```

---

## Backend Proxy Examples

### Basic Backend Proxy Setup

**Backend (Node.js/Express)**:
```javascript
const express = require('express');
const WebSocket = require('ws');
const expressWs = require('express-ws')(express());

const app = express();
app.use(express.json());

// WebSocket proxy endpoint
app.ws('/deepgram-proxy', (ws, req) => {
  // Optional: Authenticate request
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!isValidToken(token)) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Connect to Deepgram with server-side API key
  const deepgramWs = new WebSocket('wss://agent.deepgram.com/v1/agent/converse', {
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`
    }
  });

  // Proxy messages bidirectionally
  ws.on('message', (data) => {
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.send(data);
    }
  });

  deepgramWs.on('message', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // Handle connection close
  ws.on('close', () => deepgramWs.close());
  deepgramWs.on('close', () => ws.close());

  // Handle errors
  ws.on('error', (error) => {
    console.error('Client WebSocket error:', error);
    deepgramWs.close();
  });

  deepgramWs.on('error', (error) => {
    console.error('Deepgram WebSocket error:', error);
    ws.close();
  });
});

app.listen(3000, () => {
  console.log('Backend proxy server running on port 3000');
});
```

**Frontend**:
```typescript
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  const authToken = getAuthToken(); // Your authentication logic

  return (
    <DeepgramVoiceInteraction
      proxyEndpoint="wss://api.example.com/deepgram-proxy"
      proxyAuthToken={authToken}
      agentOptions={agentOptions}
    />
  );
}
```

### Backend Proxy with JWT Authentication

**Backend**:
```javascript
const jwt = require('jsonwebtoken');

app.ws('/deepgram-proxy', (ws, req) => {
  // Verify JWT token
  const token = req.headers.authorization?.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Token is valid, proceed with proxy
  } catch (error) {
    ws.close(1008, 'Invalid token');
    return;
  }

  // ... rest of proxy logic
});
```

**Frontend**:
```typescript
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  const jwtToken = getJWTToken(); // Get JWT from your auth system

  return (
    <DeepgramVoiceInteraction
      proxyEndpoint="wss://api.example.com/deepgram-proxy"
      proxyAuthToken={`Bearer ${jwtToken}`}
      agentOptions={agentOptions}
    />
  );
}
```

### Backend Proxy with Session Authentication

**Backend**:
```javascript
app.ws('/deepgram-proxy', (ws, req) => {
  // Verify session cookie
  const sessionId = req.headers.cookie?.split('sessionId=')[1]?.split(';')[0];
  if (!isValidSession(sessionId)) {
    ws.close(1008, 'Invalid session');
    return;
  }

  // ... rest of proxy logic
});
```

---

## Combined Examples

### Declarative Props with Backend Proxy

```typescript
import React, { useState } from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  const [userMessage, setUserMessage] = useState('');
  const authToken = getAuthToken();

  return (
    <>
      <input
        value={userMessage}
        onChange={(e) => setUserMessage(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            // Message will be sent when userMessage prop changes
          }
        }}
      />
      <DeepgramVoiceInteraction
        proxyEndpoint="wss://api.example.com/deepgram-proxy"
        proxyAuthToken={authToken}
        userMessage={userMessage}
        onUserMessageSent={() => setUserMessage('')}
        autoStartAgent={true}
        agentOptions={agentOptions}
      />
    </>
  );
}
```

### Mixed Imperative and Declarative API

```typescript
import React, { useRef, useState } from 'react';
import { DeepgramVoiceInteraction, DeepgramVoiceInteractionHandle } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  const ref = useRef<DeepgramVoiceInteractionHandle>(null);
  const [userMessage, setUserMessage] = useState('');

  // Use declarative props for some things
  // Use imperative API for others
  const handleCustomAction = () => {
    ref.current?.injectAgentMessage('Custom system message');
  };

  return (
    <>
      <input
        value={userMessage}
        onChange={(e) => setUserMessage(e.target.value)}
      />
      <button onClick={handleCustomAction}>Custom Action</button>
      <DeepgramVoiceInteraction
        ref={ref}
        apiKey={apiKey}
        userMessage={userMessage}
        onUserMessageSent={() => setUserMessage('')}
        autoStartAgent={true}
        agentOptions={agentOptions}
      />
    </>
  );
}
```

---

## Best Practices

### 1. Use Declarative Props for React State Integration

```typescript
// ✅ Good: Use declarative props with React state
const [userMessage, setUserMessage] = useState('');
<DeepgramVoiceInteraction userMessage={userMessage} />

// ❌ Avoid: Mixing imperative API with React state unnecessarily
const [userMessage, setUserMessage] = useState('');
useEffect(() => {
  if (userMessage) {
    ref.current?.injectUserMessage(userMessage);
    setUserMessage('');
  }
}, [userMessage]);
```

### 2. Keep API Keys Secure

```typescript
// ✅ Good: Use backend proxy
<DeepgramVoiceInteraction proxyEndpoint={proxyEndpoint} />

// ❌ Avoid: Exposing API keys in frontend
<DeepgramVoiceInteraction apiKey={process.env.REACT_APP_API_KEY} />
```

### 3. Handle Callbacks Properly

```typescript
// ✅ Good: Reset state in callbacks
const [interruptAgent, setInterruptAgent] = useState(false);
<DeepgramVoiceInteraction
  interruptAgent={interruptAgent}
  onAgentInterrupted={() => setInterruptAgent(false)}
/>

// ❌ Avoid: Forgetting to reset state
const [interruptAgent, setInterruptAgent] = useState(false);
<DeepgramVoiceInteraction interruptAgent={interruptAgent} />
```

---

## Related Documentation

- [NEW-FEATURES.md](./NEW-FEATURES.md) - Feature overview
- [API-CHANGES.md](./API-CHANGES.md) - Complete API reference
- [Issue #305: Declarative Props](docs/issues/ISSUE-305-REFACTORING-ANALYSIS.md) - Detailed documentation
- [Issue #242: Backend Proxy](docs/issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md) - Backend implementation guide
