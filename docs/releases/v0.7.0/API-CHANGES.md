# API Changes - v0.7.0

## Overview

v0.7.0 introduces new declarative props and backend proxy support while maintaining full backward compatibility with existing APIs.

## New Props

### Declarative Props API

All new props are **optional** and **backward compatible**. Existing imperative APIs continue to work.

#### `userMessage?: string`

Declaratively send user messages to the agent.

```typescript
<DeepgramVoiceInteraction
  userMessage={userMessage}
  onUserMessageSent={() => setUserMessage('')}
/>
```

**Type**: `string | undefined`  
**Default**: `undefined`  
**Behavior**: When this prop changes from `undefined` to a string, sends the message to the agent.

---

#### `onUserMessageSent?: () => void`

Callback invoked after a user message is sent via the `userMessage` prop.

**Type**: `(() => void) | undefined`  
**Default**: `undefined`

---

#### `autoStartAgent?: boolean`

Automatically start the agent service when the component mounts.

```typescript
<DeepgramVoiceInteraction
  autoStartAgent={true}
  agentOptions={agentOptions}
/>
```

**Type**: `boolean | undefined`  
**Default**: `undefined`  
**Behavior**: When `true`, automatically calls `start({ agent: true })` on mount.

---

#### `autoStartTranscription?: boolean`

Automatically start the transcription service when the component mounts.

```typescript
<DeepgramVoiceInteraction
  autoStartTranscription={true}
  transcriptionOptions={transcriptionOptions}
/>
```

**Type**: `boolean | undefined`  
**Default**: `undefined`  
**Behavior**: When `true`, automatically calls `start({ transcription: true })` on mount.

---

#### `connectionState?: ConnectionState`

Declaratively control the connection state of services.

```typescript
const [connectionState, setConnectionState] = useState<ConnectionState>('closed');

<DeepgramVoiceInteraction
  connectionState={connectionState}
  // Component automatically starts/stops to match this state
/>
```

**Type**: `ConnectionState | undefined`  
**Default**: `undefined`  
**Values**: `'closed' | 'connecting' | 'connected' | 'error'`  
**Behavior**: Component automatically starts/stops services to match the specified state.

---

#### `interruptAgent?: boolean`

Declaratively interrupt agent speech.

```typescript
const [interruptAgent, setInterruptAgent] = useState(false);

<DeepgramVoiceInteraction
  interruptAgent={interruptAgent}
  onAgentInterrupted={() => setInterruptAgent(false)}
/>
```

**Type**: `boolean | undefined`  
**Default**: `undefined`  
**Behavior**: When this prop changes from `false` to `true`, interrupts the agent's current speech.

---

#### `onAgentInterrupted?: () => void`

Callback invoked when the agent is interrupted via the `interruptAgent` prop.

**Type**: `(() => void) | undefined`  
**Default**: `undefined`

---

#### `startAudioCapture?: boolean`

Declaratively start audio capture.

```typescript
const [startAudioCapture, setStartAudioCapture] = useState(false);

<DeepgramVoiceInteraction
  startAudioCapture={startAudioCapture}
  // Component will start audio capture when this becomes true
/>
```

**Type**: `boolean | undefined`  
**Default**: `undefined`  
**Behavior**: When this prop changes from `false` to `true`, starts audio capture.

---

### Backend Proxy Props

#### `proxyEndpoint?: string`

Backend proxy WebSocket endpoint URL for secure API key management.

```typescript
<DeepgramVoiceInteraction
  proxyEndpoint="wss://api.example.com/deepgram-proxy"
  proxyAuthToken={authToken}
  agentOptions={agentOptions}
/>
```

**Type**: `string | undefined`  
**Default**: `undefined`  
**Format**: `ws://` or `wss://` URL  
**Behavior**: When provided, component connects through backend proxy instead of directly to Deepgram. `apiKey` is not required in proxy mode.

---

#### `proxyAuthToken?: string`

Authentication token for backend proxy endpoint.

```typescript
<DeepgramVoiceInteraction
  proxyEndpoint="wss://api.example.com/deepgram-proxy"
  proxyAuthToken={jwtToken}  // JWT or session token
  agentOptions={agentOptions}
/>
```

**Type**: `string | undefined`  
**Default**: `undefined`  
**Usage**: Sent as `Authorization` header when connecting to proxy endpoint.  
**Behavior**: Only used when `proxyEndpoint` is provided.

---

## Changed Props

### `apiKey?: string`

**Change**: Now optional when `proxyEndpoint` is provided.

**Before**: Required for all connections  
**After**: Required only for direct mode. Not needed when using `proxyEndpoint`.

```typescript
// Direct mode (requires apiKey)
<DeepgramVoiceInteraction apiKey={apiKey} />

// Proxy mode (apiKey not needed)
<DeepgramVoiceInteraction proxyEndpoint={proxyEndpoint} />
```

---

## Unchanged APIs

All existing APIs remain unchanged and fully supported:

- ✅ All imperative methods via ref (`start()`, `stop()`, `injectUserMessage()`, etc.)
- ✅ All existing callbacks (`onReady`, `onConnectionStateChange`, etc.)
- ✅ All existing props (except `apiKey` is now optional in proxy mode)
- ✅ All TypeScript types and interfaces

---

## Migration Guide

### No Migration Required

v0.7.0 is **fully backward compatible**. Existing code continues to work without changes.

### Optional: Adopt Declarative Props

You can optionally migrate to declarative props for better React integration:

**Before**:
```typescript
const ref = useRef<DeepgramVoiceInteractionHandle>(null);

useEffect(() => {
  ref.current?.start({ agent: true });
}, []);

<DeepgramVoiceInteraction ref={ref} />
```

**After**:
```typescript
<DeepgramVoiceInteraction
  autoStartAgent={true}
/>
```

See [NEW-FEATURES.md](./NEW-FEATURES.md) for more examples.

---

## Type Definitions

All new props are included in the `DeepgramVoiceInteractionProps` interface:

```typescript
export interface DeepgramVoiceInteractionProps {
  // ... existing props ...
  
  // New declarative props
  userMessage?: string;
  onUserMessageSent?: () => void;
  autoStartAgent?: boolean;
  autoStartTranscription?: boolean;
  connectionState?: ConnectionState;
  interruptAgent?: boolean;
  onAgentInterrupted?: () => void;
  startAudioCapture?: boolean;
  
  // New backend proxy props
  proxyEndpoint?: string;
  proxyAuthToken?: string;
}
```

---

## Related Documentation

- [NEW-FEATURES.md](./NEW-FEATURES.md) - Detailed feature documentation
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples
- [API Reference](../API-REFERENCE.md) - Complete API documentation
