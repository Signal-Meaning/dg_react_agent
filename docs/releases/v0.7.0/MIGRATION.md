# Migration Guide - v0.7.0

**Release Date**: December 20, 2025  
**Previous Version**: v0.6.16

## Overview

v0.7.0 is **fully backward compatible** with v0.6.16. **No migration is required** - all existing code will continue to work without changes.

This guide covers:
1. **No Breaking Changes** - Confirmation that existing code works as-is
2. **Optional: Adopting Declarative Props** - How to optionally migrate to new declarative patterns
3. **Optional: Adopting Backend Proxy** - How to optionally migrate to secure backend proxy mode

---

## ✅ No Breaking Changes

### All Existing APIs Continue to Work

- ✅ All imperative methods via ref (`start()`, `stop()`, `injectUserMessage()`, etc.)
- ✅ All existing props and callbacks
- ✅ All TypeScript types and interfaces
- ✅ All existing patterns and usage examples

### What Changed (Non-Breaking)

1. **`apiKey` prop is now optional** when `proxyEndpoint` is provided
   - **Before**: `apiKey` was always required
   - **After**: `apiKey` is required only for direct mode. Not needed when using `proxyEndpoint`
   - **Impact**: None - if you provide `apiKey`, behavior is unchanged

2. **New optional declarative props added**
   - **Impact**: None - all new props are optional and don't affect existing code

---

## 🎯 Optional: Migrating to Declarative Props

You can optionally adopt declarative props for better React integration. This is **completely optional** - your existing imperative code continues to work.

### User Message Input

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

**Benefits**:
- More React-idiomatic
- Easier to test (just change props)
- Better integration with React state management
- No ref needed

### Connection Control

**Before (Imperative)**:
```typescript
const ref = useRef<DeepgramVoiceInteractionHandle>(null);

useEffect(() => {
  ref.current?.start({ agent: true });
}, []);

<DeepgramVoiceInteraction ref={ref} />
```

**After (Declarative)**:
```typescript
<DeepgramVoiceInteraction
  autoStartAgent={true}
/>
```

**Or with controlled state**:
```typescript
const [connectionState, setConnectionState] = useState<'connected' | 'disconnected'>('disconnected');

<DeepgramVoiceInteraction
  connectionState={connectionState}
  agentOptions={agentOptions}
/>
```

### Agent Interruption

**Before (Imperative)**:
```typescript
const ref = useRef<DeepgramVoiceInteractionHandle>(null);

const interrupt = () => {
  ref.current?.interruptAgent();
};

<DeepgramVoiceInteraction ref={ref} />
```

**After (Declarative)**:
```typescript
const [interruptAgent, setInterruptAgent] = useState(false);

const interrupt = () => {
  setInterruptAgent(true);
};

<DeepgramVoiceInteraction
  interruptAgent={interruptAgent}
  onAgentInterrupted={() => setInterruptAgent(false)}
/>
```

### Audio Capture

**Before (Imperative)**:
```typescript
const ref = useRef<DeepgramVoiceInteractionHandle>(null);

const startMic = async () => {
  await ref.current?.startAudioCapture();
};

<DeepgramVoiceInteraction ref={ref} />
```

**After (Declarative)**:
```typescript
const [startAudioCapture, setStartAudioCapture] = useState(false);

const startMic = () => {
  setStartAudioCapture(true);
};

<DeepgramVoiceInteraction
  startAudioCapture={startAudioCapture}
/>
```

### Mixed Approach

You can use both imperative and declarative APIs together:

```typescript
const ref = useRef<DeepgramVoiceInteractionHandle>(null);
const [userMessage, setUserMessage] = useState('');

// Use declarative for some things
<DeepgramVoiceInteraction
  ref={ref}
  userMessage={userMessage}
  onUserMessageSent={() => setUserMessage('')}
  autoStartAgent={true}
/>

// Use imperative for others
const customAction = () => {
  ref.current?.injectAgentMessage('Custom system message');
};
```

---

## 🔐 Optional: Migrating to Backend Proxy

You can optionally migrate to backend proxy mode for secure API key management. This is **completely optional** - direct mode continues to work.

### Why Migrate to Backend Proxy?

- **Security**: API keys never exposed in client-side code
- **Cost Control**: Better control over API usage
- **Compliance**: Meets security requirements for organizations

### Migration Steps

#### Step 1: Set Up Backend Proxy

Add a WebSocket proxy endpoint to your existing backend:

```javascript
// Example: Express.js backend
const WebSocket = require('ws');
const expressWs = require('express-ws')(express());

app.ws('/deepgram-proxy', (ws, req) => {
  // Authenticate request (optional)
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
  ws.on('message', (data) => deepgramWs.send(data));
  deepgramWs.on('message', (data) => ws.send(data));
  
  ws.on('close', () => deepgramWs.close());
  deepgramWs.on('close', () => ws.close());
});
```

#### Step 2: Update Frontend Code

**Before (Direct Mode)**:
```typescript
<DeepgramVoiceInteraction
  apiKey={process.env.REACT_APP_DEEPGRAM_API_KEY}  // ❌ Exposed in bundle
  agentOptions={agentOptions}
/>
```

**After (Proxy Mode)**:
```typescript
<DeepgramVoiceInteraction
  proxyEndpoint="wss://api.example.com/deepgram-proxy"
  proxyAuthToken={authToken}  // Optional: JWT or session token
  agentOptions={agentOptions}
/>
```

### Feature Parity

Backend proxy mode supports **all features** available in direct mode:
- ✅ Agent service
- ✅ Transcription service
- ✅ Audio streaming
- ✅ Function calling
- ✅ All callbacks and events
- ✅ Declarative props
- ✅ Imperative methods

### Authentication Options

You can use any authentication method with your backend proxy:

**JWT Token**:
```typescript
const jwtToken = getJWTToken();
<DeepgramVoiceInteraction
  proxyEndpoint={proxyEndpoint}
  proxyAuthToken={`Bearer ${jwtToken}`}
/>
```

**Session Cookie**:
```typescript
// Backend reads session from cookie
<DeepgramVoiceInteraction
  proxyEndpoint={proxyEndpoint}
  // No proxyAuthToken needed if using cookies
/>
```

**Custom Header**:
```typescript
// Backend reads custom header
<DeepgramVoiceInteraction
  proxyEndpoint={proxyEndpoint}
  proxyAuthToken={customAuthToken}
/>
```

---

## 📋 Migration Checklist

### For Existing Code (No Changes Required)

- [x] ✅ No changes needed - v0.7.0 is backward compatible
- [x] ✅ Update package version: `npm install @signal-meaning/deepgram-voice-interaction-react@0.7.0`
- [x] ✅ Test existing functionality - should work exactly as before

### Optional: Adopt Declarative Props

- [ ] Review declarative props documentation
- [ ] Identify which imperative patterns to migrate
- [ ] Test declarative props in development
- [ ] Update code to use declarative props where beneficial
- [ ] Keep imperative methods for complex use cases

### Optional: Adopt Backend Proxy

- [ ] Set up backend proxy endpoint
- [ ] Test proxy connection
- [ ] Update frontend to use `proxyEndpoint` instead of `apiKey`
- [ ] Remove `apiKey` from frontend code
- [ ] Test all features with proxy mode
- [ ] Deploy backend proxy endpoint
- [ ] Update frontend deployment

---

## 🔍 Testing Your Migration

### Test Existing Code (No Migration)

```bash
# Update package
npm install @signal-meaning/deepgram-voice-interaction-react@0.7.0

# Run your existing tests
npm test

# Test in development
npm start
```

### Test Declarative Props Migration

```typescript
// Test declarative user message
const [userMessage, setUserMessage] = useState('');
// ... test sending messages

// Test auto-start
<DeepgramVoiceInteraction autoStartAgent={true} />
// ... verify connection starts automatically

// Test connection state control
const [state, setState] = useState<'connected' | 'disconnected'>('disconnected');
// ... test starting/stopping
```

### Test Backend Proxy Migration

```typescript
// Test proxy connection
<DeepgramVoiceInteraction
  proxyEndpoint="wss://localhost:3000/deepgram-proxy"
  proxyAuthToken={testToken}
/>
// ... verify connection through proxy

// Test all features work
// ... test agent, transcription, audio, function calls
```

---

## 🆘 Troubleshooting

### Declarative Props Not Working

**Issue**: Declarative props don't trigger actions

**Solution**: 
- Ensure props are changing (React state updates)
- Check that callbacks are properly clearing state
- Verify component is receiving prop updates

### Backend Proxy Connection Fails

**Issue**: Cannot connect through proxy

**Solution**:
- Verify proxy endpoint URL is correct
- Check backend proxy is running
- Verify authentication token is valid
- Check backend proxy logs for errors
- Ensure backend proxy forwards WebSocket upgrade correctly

### Mixed Imperative/Declarative Conflicts

**Issue**: Using both APIs causes conflicts

**Solution**:
- Declarative props take precedence when set
- Clear declarative props before using imperative methods
- Or use one approach consistently per feature

---

## 📚 Related Documentation

- [NEW-FEATURES.md](./NEW-FEATURES.md) - Detailed feature documentation
- [API-CHANGES.md](./API-CHANGES.md) - Complete API reference
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples
- [API Reference](../API-REFERENCE.md) - Complete API documentation
- [Issue #305: Declarative Props](../../issues/ISSUE-305-REFACTORING-ANALYSIS.md)
- [Issue #242: Backend Proxy](../../issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md)

---

## 💬 Need Help?

If you encounter issues during migration:

1. Check the [troubleshooting section](#-troubleshooting) above
2. Review the [API Reference](../API-REFERENCE.md)
3. See [EXAMPLES.md](./EXAMPLES.md) for usage patterns
4. Open an issue on GitHub with details about your use case

---

**Summary**: v0.7.0 is backward compatible. No migration required. Optionally adopt declarative props or backend proxy for improved React integration and security.
