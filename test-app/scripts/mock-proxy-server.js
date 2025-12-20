/**
 * Mock Backend Proxy Server - Issue #242
 * 
 * A simple Node.js WebSocket proxy server for E2E testing.
 * This server accepts WebSocket connections from the frontend and
 * proxies them to Deepgram, adding the API key server-side.
 * 
 * Usage:
 *   node test-app/scripts/mock-proxy-server.js
 *   or
 *   npm run test:proxy:server
 * 
 * Environment Variables:
 *   - DEEPGRAM_API_KEY: Deepgram API key (required)
 *   - PROXY_PORT: Port to run proxy on (default: 8080)
 *   - PROXY_PATH: WebSocket path (default: /deepgram-proxy)
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// Configuration
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '8080', 10);
const PROXY_PATH = process.env.PROXY_PATH || '/deepgram-proxy';
const DEEPGRAM_AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse';

if (!DEEPGRAM_API_KEY) {
  console.error('❌ Error: DEEPGRAM_API_KEY environment variable is required');
  console.error('   Set it in your .env file or as an environment variable');
  process.exit(1);
}

// Create HTTP server for WebSocket upgrade
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: PROXY_PATH,
  verifyClient: (info) => {
    // Optional: Add authentication verification here
    // For now, accept all connections
    const token = url.parse(info.req.url, true).query.token;
    if (token) {
      console.log(`[Proxy] Connection with auth token: ${token.substring(0, 10)}...`);
    }
    return true;
  }
});

console.log(`🚀 Mock Backend Proxy Server starting...`);
console.log(`   Proxy endpoint: ws://localhost:${PROXY_PORT}${PROXY_PATH}`);
console.log(`   Deepgram endpoint: ${DEEPGRAM_AGENT_URL}`);
console.log(`   API Key: ${DEEPGRAM_API_KEY.substring(0, 10)}...`);

wss.on('connection', (clientWs, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[Proxy] New client connection from ${clientIp}`);

  // Extract auth token from query params if present
  const parsedUrl = url.parse(req.url, true);
  const authToken = parsedUrl.query.token;

  // Create connection to Deepgram
  const deepgramUrl = new URL(DEEPGRAM_AGENT_URL);
  deepgramUrl.searchParams.append('api_key', DEEPGRAM_API_KEY);

  console.log(`[Proxy] Connecting to Deepgram...`);
  const deepgramWs = new WebSocket(deepgramUrl.toString());

  // Forward messages from client to Deepgram
  clientWs.on('message', (data, isBinary) => {
    if (deepgramWs.readyState === WebSocket.OPEN) {
      console.log(`[Proxy] Client → Deepgram: ${isBinary ? 'binary' : 'text'} message`);
      deepgramWs.send(data, { binary: isBinary });
    } else {
      console.warn(`[Proxy] Deepgram not ready, dropping message`);
    }
  });

  // Forward messages from Deepgram to client
  deepgramWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      console.log(`[Proxy] Deepgram → Client: ${isBinary ? 'binary' : 'text'} message`);
      clientWs.send(data, { binary: isBinary });
    } else {
      console.warn(`[Proxy] Client not ready, dropping message`);
    }
  });

  // Handle Deepgram connection open
  deepgramWs.on('open', () => {
    console.log(`[Proxy] Connected to Deepgram`);
    // Forward any queued messages if needed
  });

  // Handle Deepgram connection close
  deepgramWs.on('close', (code, reason) => {
    console.log(`[Proxy] Deepgram connection closed: ${code} ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason);
    }
  });

  // Handle Deepgram errors
  deepgramWs.on('error', (error) => {
    console.error(`[Proxy] Deepgram error:`, error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Proxy error');
    }
  });

  // Handle client connection close
  clientWs.on('close', (code, reason) => {
    console.log(`[Proxy] Client connection closed: ${code} ${reason}`);
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });

  // Handle client errors
  clientWs.on('error', (error) => {
    console.error(`[Proxy] Client error:`, error);
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });

  // Handle ping/pong for keepalive
  clientWs.on('ping', () => {
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.ping();
    }
  });
});

// Start server
server.listen(PROXY_PORT, () => {
  console.log(`✅ Mock Backend Proxy Server running on port ${PROXY_PORT}`);
  console.log(`   WebSocket endpoint: ws://localhost:${PROXY_PORT}${PROXY_PATH}`);
  console.log(`\n   To use in test-app, set:`);
  console.log(`   VITE_PROXY_ENDPOINT=ws://localhost:${PROXY_PORT}${PROXY_PATH}`);
  console.log(`\n   Press Ctrl+C to stop\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Proxy] Shutting down...');
  wss.close(() => {
    server.close(() => {
      console.log('[Proxy] Server closed');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Proxy] Shutting down...');
  wss.close(() => {
    server.close(() => {
      console.log('[Proxy] Server closed');
      process.exit(0);
    });
  });
});
