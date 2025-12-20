# Backend Proxy Interface Contract Specification

**Issue #242** - Backend Proxy Support for Secure API Key Management

## Overview

This document specifies the **interface contract** that developers must implement in their existing backend infrastructure to support backend proxy mode. This is **not a new service to deploy** - it's an interface contract that you implement by adding a WebSocket proxy endpoint to your existing backend API.

## Interface Contract

### Endpoint Requirements

Your backend must provide a WebSocket endpoint that:

1. **Accepts WebSocket connections** from the frontend at the `proxyEndpoint` URL
2. **Authenticates requests** (optional, using JWT, session tokens, or your existing auth system)
3. **Stores Deepgram API key** server-side (never exposed to client)
4. **Proxies WebSocket traffic** bidirectionally to Deepgram's Voice Agent API
5. **Handles connection lifecycle** (open, close, errors, reconnection)

### WebSocket Protocol

#### Frontend → Backend Proxy

- **Connection URL**: The `proxyEndpoint` prop value (e.g., `wss://api.example.com/deepgram-proxy`)
- **Protocol**: Standard WebSocket (no special subprotocols)
- **Authentication**: Optional `token` query parameter containing JWT/session token
  - Format: `wss://api.example.com/deepgram-proxy?token=<jwt-token>`
- **Messages**: All WebSocket messages from frontend are forwarded to Deepgram as-is (binary and text)

#### Backend Proxy → Deepgram

- **Connection URL**: `wss://agent.deepgram.com/v1/agent/converse`
- **Protocol**: WebSocket with `['token', '<api-key>']` subprotocol array
- **Authentication**: Deepgram API key passed via WebSocket subprotocol (not in URL or headers)
- **Messages**: All WebSocket messages from Deepgram are forwarded to frontend as-is

### Message Flow

```
Frontend                    Backend Proxy                  Deepgram
   │                            │                             │
   │─── WebSocket Connect ──────>│                             │
   │   (with optional token)     │                             │
   │                            │─── WebSocket Connect ──────>│
   │                            │   (with API key subprotocol) │
   │                            │<─── Connected ───────────────│
   │<─── Connected ─────────────│                             │
   │                            │                             │
   │─── Settings Message ───────>│                             │
   │                            │─── Settings Message ────────>│
   │                            │<─── SettingsApplied ────────│
   │<─── SettingsApplied ────────│                             │
   │                            │                             │
   │─── Audio Data (binary) ────>│                             │
   │                            │─── Audio Data (binary) ────>│
   │                            │<─── Transcript ──────────────│
   │<─── Transcript ─────────────│                             │
   │                            │                             │
   │─── Text Message ────────────>│                             │
   │                            │─── Text Message ─────────────>│
   │                            │<─── LLM Response ────────────│
   │<─── LLM Response ───────────│                             │
   │                            │                             │
   │─── Close ──────────────────>│                             │
   │                            │─── Close ───────────────────>│
```

### Authentication Flow (Optional)

If you provide `proxyAuthToken` in the component:

1. Frontend includes token in connection URL: `wss://api.example.com/deepgram-proxy?token=<jwt-token>`
2. Backend extracts token from query parameters
3. Backend validates token using your existing authentication system
4. If valid, proceed with proxying; if invalid, close connection with appropriate error code

### Error Handling

Your backend proxy should:

- **Handle connection failures** to Deepgram gracefully
- **Forward error messages** from Deepgram to frontend
- **Close connections** properly when errors occur
- **Log errors** for debugging (without exposing sensitive data)

### Reconnection Support

The component handles reconnection automatically. Your backend should:

- **Accept reconnection attempts** from the same client
- **Handle connection drops** gracefully
- **Not require special reconnection logic** - treat each connection independently

## Implementation Checklist

Your backend proxy endpoint must:

- [ ] Accept WebSocket connections at the specified `proxyEndpoint` URL
- [ ] Extract and validate authentication token from query parameters (if provided)
- [ ] Store Deepgram API key securely (environment variables, secrets manager, etc.)
- [ ] Create WebSocket connection to `wss://agent.deepgram.com/v1/agent/converse` with API key in subprotocol
- [ ] Forward all messages bidirectionally (frontend ↔ Deepgram)
- [ ] Handle connection lifecycle events (open, close, error)
- [ ] Preserve message types (binary for audio, text for JSON)
- [ ] Handle errors gracefully and forward error information to frontend

## Deepgram API Details

### Voice Agent Endpoint

- **URL**: `wss://agent.deepgram.com/v1/agent/converse`
- **Protocol**: WebSocket with subprotocol array `['token', '<api-key>']`
- **API Key**: Passed via WebSocket subprotocol, not in URL or headers

### Example Connection Code

```javascript
// Node.js example
const deepgramUrl = 'wss://agent.deepgram.com/v1/agent/converse';
const apiKey = process.env.DEEPGRAM_API_KEY; // Server-side only!

const deepgramWs = new WebSocket(deepgramUrl, ['token', apiKey]);
```

## Security Requirements

1. **Never expose API key** to the frontend
2. **Validate authentication tokens** before proxying
3. **Use HTTPS/WSS** in production (never `ws://` or `http://`)
4. **Rate limiting** (optional but recommended)
5. **Logging** (without exposing sensitive data)

## Testing

Use the mock proxy server in `test-app/scripts/mock-proxy-server.js` as a reference implementation:

```bash
cd test-app
npm run test:proxy:server
```

This provides a working example of the interface contract.

## Next Steps

See implementation guides for specific frameworks:
- [Node.js/Express Implementation Guide](./BACKEND-PROXY-IMPLEMENTATION-NODEJS.md)
- [Python/FastAPI Implementation Guide](./BACKEND-PROXY-IMPLEMENTATION-FASTAPI.md)
- [Python/Django Implementation Guide](./BACKEND-PROXY-IMPLEMENTATION-DJANGO.md)
