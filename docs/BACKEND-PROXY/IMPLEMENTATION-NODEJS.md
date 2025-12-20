# Backend Proxy Implementation Guide - Node.js/Express

**Issue #242** - Backend Proxy Support for Secure API Key Management

This guide shows how to implement the backend proxy interface contract using Node.js and Express.

## Prerequisites

- Node.js 16+ 
- Express.js
- `ws` package for WebSocket support
- Deepgram API key (stored server-side)

## Installation

```bash
npm install express ws
```

## Basic Implementation

### 1. Create WebSocket Proxy Endpoint

```javascript
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');

const app = express();
const server = http.createServer(app);

// WebSocket server for proxy endpoint
const wss = new WebSocket.Server({ 
  server,
  path: '/deepgram-proxy',
  verifyClient: (info) => {
    // Optional: Extract and validate auth token
    const parsedUrl = url.parse(info.req.url, true);
    const token = parsedUrl.query.token;
    
    if (token) {
      // Validate token using your auth system
      // For example, verify JWT:
      // return validateJWT(token);
    }
    
    return true; // Accept connection
  }
});

wss.on('connection', (clientWs, req) => {
  console.log('Client connected to proxy');
  
  // Extract auth token if provided
  const parsedUrl = url.parse(req.url, true);
  const authToken = parsedUrl.query.token;
  
  // Get Deepgram API key from environment (server-side only!)
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!deepgramApiKey) {
    console.error('DEEPGRAM_API_KEY not configured');
    clientWs.close(1011, 'Server configuration error');
    return;
  }
  
  // Connect to Deepgram Voice Agent API
  const deepgramUrl = 'wss://agent.deepgram.com/v1/agent/converse';
  const deepgramWs = new WebSocket(deepgramUrl, ['token', deepgramApiKey]);
  
  // Forward messages from client to Deepgram
  clientWs.on('message', (data, isBinary) => {
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.send(data, { binary: isBinary });
    }
  });
  
  // Forward messages from Deepgram to client
  deepgramWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });
  
  // Handle Deepgram connection open
  deepgramWs.on('open', () => {
    console.log('Connected to Deepgram');
  });
  
  // Handle Deepgram connection close
  deepgramWs.on('close', (code, reason) => {
    console.log(`Deepgram connection closed: ${code} ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason);
    }
  });
  
  // Handle Deepgram errors
  deepgramWs.on('error', (error) => {
    console.error('Deepgram error:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Proxy error');
    }
  });
  
  // Handle client connection close
  clientWs.on('close', () => {
    console.log('Client disconnected');
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });
  
  // Handle client errors
  clientWs.on('error', (error) => {
    console.error('Client error:', error);
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket proxy endpoint: ws://localhost:${PORT}/deepgram-proxy`);
});
```

## Advanced: JWT Authentication

```javascript
const jwt = require('jsonwebtoken');

const wss = new WebSocket.Server({ 
  server,
  path: '/deepgram-proxy',
  verifyClient: (info) => {
    const parsedUrl = url.parse(info.req.url, true);
    const token = parsedUrl.query.token;
    
    if (!token) {
      return false; // Reject connection without token
    }
    
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Store user info for later use
      info.req.user = decoded;
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false; // Reject invalid token
    }
  }
});
```

## Advanced: Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// Rate limit WebSocket connections
const connectionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 connections per windowMs
  keyGenerator: (req) => {
    return req.socket.remoteAddress;
  }
});

// Apply to WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  if (request.url.startsWith('/deepgram-proxy')) {
    // Apply rate limiting logic here
    // ...
  }
});
```

## Environment Variables

Create a `.env` file:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
JWT_SECRET=your_jwt_secret_here
PORT=3000
```

## Complete Example

See `test-app/scripts/mock-proxy-server.js` for a complete working example that includes:
- WebSocket proxying
- Authentication token extraction
- Error handling
- Connection lifecycle management
- Graceful shutdown

## Frontend Usage

Once your backend proxy is running, use it in your React component:

```tsx
<DeepgramVoiceInteraction
  proxyEndpoint="wss://api.example.com/deepgram-proxy"
  proxyAuthToken={userJwtToken} // Optional
  agentOptions={agentOptions}
/>
```

## Testing

1. Start your proxy server:
   ```bash
   node server.js
   ```

2. Test with the component:
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint="ws://localhost:3000/deepgram-proxy"
     agentOptions={agentOptions}
   />
   ```

## Security Checklist

- [ ] API key stored in environment variables (never in code)
- [ ] HTTPS/WSS used in production
- [ ] Authentication tokens validated
- [ ] Rate limiting implemented
- [ ] Error logging (without exposing sensitive data)
- [ ] CORS configured appropriately

## Troubleshooting

### Connection Refused
- Check that server is running
- Verify WebSocket path matches (`/deepgram-proxy`)
- Check firewall/network settings

### Authentication Failures
- Verify JWT secret matches
- Check token expiration
- Validate token format

### Deepgram Connection Issues
- Verify `DEEPGRAM_API_KEY` is set correctly
- Check API key permissions
- Verify network connectivity to Deepgram
