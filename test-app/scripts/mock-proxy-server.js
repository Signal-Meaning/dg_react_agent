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

import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';

// Configuration
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '8080', 10);
const PROXY_PATH = process.env.PROXY_PATH || '/deepgram-proxy';
const DEEPGRAM_AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const DEBUG_LOG_PATH = path.join(process.cwd(), '.cursor', 'debug.log');

// Debug logging helper
function debugLog(location, message, data, hypothesisId) {
  const logEntry = {
    location,
    message,
    data,
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'run1',
    hypothesisId
  };
  try {
    // Ensure directory exists
    const dir = path.dirname(DEBUG_LOG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    console.error(`[DEBUG] Failed to write log: ${e.message}`);
  }
}

if (!DEEPGRAM_API_KEY) {
  console.error('❌ Error: DEEPGRAM_API_KEY environment variable is required');
  console.error('   Set it in your .env file or as an environment variable');
  process.exit(1);
}

// Create HTTP server for WebSocket upgrade
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocketServer({ 
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
  
  // Queue messages from Deepgram until client connection is ready (Issue #329)
  // This prevents critical messages like SettingsApplied from being dropped
  const deepgramMessageQueue = [];
  
  // Helper function to forward queued Deepgram messages when client is ready
  const forwardQueuedDeepgramMessages = () => {
    if (clientWs.readyState === WebSocket.OPEN && deepgramMessageQueue.length > 0) {
      console.log(`[Proxy] Forwarding ${deepgramMessageQueue.length} queued messages from Deepgram to client`);
      while (deepgramMessageQueue.length > 0) {
        const { data, isBinary } = deepgramMessageQueue.shift();
        if (!isBinary) {
          try {
            const text = data.toString('utf8');
            const parsed = JSON.parse(text);
            const messageType = parsed.type || 'unknown';
            console.log(`[Proxy] Deepgram → Client (queued): ${messageType} message`);
            
            if (messageType === 'SettingsApplied') {
              console.log(`[Proxy] ✅ SettingsApplied forwarded from queue`);
            }
          } catch (e) {
            console.log(`[Proxy] Deepgram → Client (queued): text message (not JSON)`);
          }
        } else {
          console.log(`[Proxy] Deepgram → Client (queued): binary message (${data.length} bytes)`);
        }
        clientWs.send(data, { binary: isBinary });
      }
    }
  };

  // #region debug log - connection received
  console.log(`[DEBUG] Connection received from ${clientIp}, URL: ${req.url}`);
  debugLog('mock-proxy-server.js:58', 'Connection received', { clientIp, url: req.url }, 'A');
  // #endregion

  // Extract auth token from query params if present
  const parsedUrl = url.parse(req.url, true);
  const authToken = parsedUrl.query.token;

  // #region debug log - URL parsing
  debugLog('mock-proxy-server.js:64', 'URL parsed', { url: req.url, pathname: parsedUrl.pathname, query: parsedUrl.query, hasAuthToken: !!authToken }, 'B');
  // #endregion

  // Determine service type from URL or query params
  // Hypothesis: Service type should be detectable from connection request
  // Handle both string and array cases for query parameter
  const serviceParam = parsedUrl.query.service;
  const serviceTypeValue = Array.isArray(serviceParam) ? serviceParam[0] : serviceParam;
  const serviceType = serviceTypeValue || (parsedUrl.pathname?.includes('transcription') ? 'transcription' : 'agent');
  
  // #region debug log - service type detection
  console.log(`[DEBUG] Service type detected: ${serviceType} (from query: ${parsedUrl.query.service}, pathname: ${parsedUrl.pathname})`);
  debugLog('mock-proxy-server.js:70', 'Service type detected', { serviceType, queryService: parsedUrl.query.service, pathname: parsedUrl.pathname }, 'B');
  // #endregion

  // Select appropriate Deepgram endpoint based on service type
  const DEEPGRAM_TRANSCRIPTION_URL = 'wss://api.deepgram.com/v1/listen';
  const targetDeepgramUrl = serviceType === 'transcription' ? DEEPGRAM_TRANSCRIPTION_URL : DEEPGRAM_AGENT_URL;

  // #region debug log - target URL selection
  console.log(`[DEBUG] Routing ${serviceType} service to ${targetDeepgramUrl}`);
  debugLog('mock-proxy-server.js:75', 'Target Deepgram URL selected', { serviceType, targetUrl: targetDeepgramUrl, isAgent: serviceType === 'agent', isTranscription: serviceType === 'transcription' }, 'A');
  // #endregion

  // Create connection to Deepgram
  // Deepgram Voice Agent API requires API key via WebSocket protocol, not query params
  // Transcription API also uses token protocol
  const deepgramUrl = new URL(targetDeepgramUrl);
  
  // Forward all query parameters from client to Deepgram (except 'service' which is only for routing)
  // This is critical for transcription service which needs model, language, smart_format, etc.
  Object.entries(parsedUrl.query).forEach(([key, value]) => {
    if (key !== 'service' && key !== 'token') { // Don't forward 'service' (routing only) or 'token' (auth handled by proxy)
      if (Array.isArray(value)) {
        // Handle array values (e.g., multiple keyterm parameters)
        value.forEach(v => deepgramUrl.searchParams.append(key, v));
      } else if (value !== undefined && value !== null) {
        deepgramUrl.searchParams.append(key, value);
      }
    }
  });
  
  // #region debug log - query params forwarding
  console.log(`[DEBUG] Forwarding query params to Deepgram (excluding service/token):`, Array.from(deepgramUrl.searchParams.entries()));
  debugLog('mock-proxy-server.js:130', 'Query params forwarded', { 
    serviceType, 
    forwardedParams: Array.from(deepgramUrl.searchParams.entries()),
    excludedParams: ['service', 'token']
  }, 'D');
  // #endregion

  console.log(`[Proxy] Connecting to Deepgram ${serviceType} service at ${deepgramUrl.toString()}...`);
  
  // #region debug log - before WebSocket creation
  debugLog('mock-proxy-server.js:140', 'Before WebSocket creation', { serviceType, targetUrl: deepgramUrl.toString(), hasApiKey: !!DEEPGRAM_API_KEY }, 'C');
  // #endregion
  
  // Pass API key via WebSocket protocol array: ['token', apiKey]
  const deepgramWs = new WebSocket(deepgramUrl.toString(), ['token', DEEPGRAM_API_KEY]);
  
  // #region debug log - after WebSocket creation
  debugLog('mock-proxy-server.js:88', 'WebSocket created', { serviceType, targetUrl: targetDeepgramUrl, readyState: deepgramWs.readyState }, 'A');
  // #endregion

  // Queue messages from client until Deepgram connection is ready
  const messageQueue = [];

  // Forward messages from client to Deepgram
  clientWs.on('message', (data, isBinary) => {
    // Always log Settings messages, even if connection is closing
    if (!isBinary) {
      try {
        const text = data.toString('utf8');
        const parsed = JSON.parse(text);
        const messageType = parsed.type || 'unknown';
        
        // Special logging for Settings messages (Issue #329)
        if (messageType === 'Settings') {
          console.log(`[Proxy] 📤 Settings message received from client!`);
          console.log(`[Proxy] 📤 Client state: ${clientWs.readyState}, Deepgram state: ${deepgramWs.readyState}`);
          debugLog('mock-proxy-server.js:200', 'Settings received from client', { 
            serviceType,
            clientState: clientWs.readyState,
            deepgramState: deepgramWs.readyState,
            hasFunctions: parsed.agent?.think?.functions?.length > 0,
            functionsCount: parsed.agent?.think?.functions?.length || 0
          }, 'G');
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }
    
    if (deepgramWs.readyState === WebSocket.OPEN) {
      if (!isBinary) {
        try {
          const text = data.toString('utf8');
          const parsed = JSON.parse(text);
          const messageType = parsed.type || 'unknown';
          console.log(`[Proxy] Client → Deepgram: ${messageType} message`);
          
          // Special logging for Settings messages (Issue #329)
          if (messageType === 'Settings') {
            console.log(`[Proxy] 📤 Settings message forwarded to Deepgram`);
          }
        } catch (e) {
          console.log(`[Proxy] Client → Deepgram: text message (not JSON)`);
        }
      } else {
        console.log(`[Proxy] Client → Deepgram: binary message (${data.length} bytes)`);
      }
      deepgramWs.send(data, { binary: isBinary });
    } else {
      // Queue message until Deepgram connection is ready
      const messageType = !isBinary ? (() => {
        try {
          const parsed = JSON.parse(data.toString('utf8'));
          return parsed.type || 'unknown';
        } catch {
          return 'unknown';
        }
      })() : 'binary';
      console.log(`[Proxy] Deepgram not ready (state: ${deepgramWs.readyState}), queuing ${messageType} message`);
      if (messageType === 'Settings') {
        console.log(`[Proxy] ⚠️ Settings message queued (Deepgram not ready yet)`);
      }
      messageQueue.push({ data, isBinary });
    }
  });

  // Forward messages from Deepgram to client
  deepgramWs.on('message', (data, isBinary) => {
    // Try to forward immediately if client is ready
    if (clientWs.readyState === WebSocket.OPEN) {
      if (!isBinary) {
        try {
          const text = data.toString('utf8');
          const parsed = JSON.parse(text);
          const messageType = parsed.type || 'unknown';
          console.log(`[Proxy] Deepgram → Client: ${messageType} message`);
          
          // Special logging for SettingsApplied to debug issue #329
          if (messageType === 'SettingsApplied') {
            console.log(`[Proxy] ✅ SettingsApplied received from Deepgram, forwarding to client`);
            debugLog('mock-proxy-server.js:194', 'SettingsApplied received', { 
              serviceType, 
              clientReady: clientWs.readyState === WebSocket.OPEN,
              deepgramReady: deepgramWs.readyState === WebSocket.OPEN
            }, 'E');
          }
        } catch (e) {
          console.log(`[Proxy] Deepgram → Client: text message (not JSON)`);
        }
      } else {
        console.log(`[Proxy] Deepgram → Client: binary message (${data.length} bytes)`);
      }
      
      try {
        clientWs.send(data, { binary: isBinary });
      } catch (error) {
        console.error(`[Proxy] Error sending message to client:`, error);
        // If send fails, queue the message to retry later
        deepgramMessageQueue.push({ data, isBinary });
      }
    } else {
      // Queue message until client connection is ready (Issue #329 fix)
      // This prevents critical messages like SettingsApplied from being dropped
      const messageType = !isBinary ? (() => {
        try {
          const parsed = JSON.parse(data.toString('utf8'));
          return parsed.type || 'unknown';
        } catch {
          return 'unknown';
        }
      })() : 'binary';
      console.log(`[Proxy] Client not ready (state: ${clientWs.readyState}), queuing ${messageType} message`);
      deepgramMessageQueue.push({ data, isBinary });
      
      // Special logging for SettingsApplied
      if (messageType === 'SettingsApplied') {
        console.log(`[Proxy] ⚠️ SettingsApplied queued (client not ready yet, will forward when ready)`);
        debugLog('mock-proxy-server.js:203', 'SettingsApplied queued', { 
          serviceType,
          clientState: clientWs.readyState,
          queuedMessages: deepgramMessageQueue.length
        }, 'F');
      }
      
      // Try to forward queued messages periodically in case client becomes ready
      // This handles edge cases where client state might change
      setTimeout(() => {
        forwardQueuedDeepgramMessages();
      }, 100);
    }
  });

  // Handle Deepgram connection open
  deepgramWs.on('open', () => {
    // #region debug log - Deepgram connection opened
    debugLog('mock-proxy-server.js:120', 'Deepgram connection opened', { serviceType, targetUrl: targetDeepgramUrl, queuedMessages: messageQueue.length }, 'A');
    // #endregion
    console.log(`[Proxy] Connected to Deepgram ${serviceType} service`);
    // Forward any queued messages from client to Deepgram now that connection is ready
    while (messageQueue.length > 0) {
      const { data, isBinary } = messageQueue.shift();
      if (!isBinary) {
        try {
          const text = data.toString('utf8');
          const parsed = JSON.parse(text);
          console.log(`[Proxy] Client → Deepgram (queued): ${parsed.type || 'unknown'} message`);
        } catch (e) {
          console.log(`[Proxy] Client → Deepgram (queued): text message (not JSON)`);
        }
      } else {
        console.log(`[Proxy] Client → Deepgram (queued): binary message (${data.length} bytes)`);
      }
      deepgramWs.send(data, { binary: isBinary });
    }
    
    // Also forward any queued messages from Deepgram to client (Issue #329)
    // This handles the case where Deepgram messages arrived before client was ready
    forwardQueuedDeepgramMessages();
  });

  // Handle Deepgram connection close
  deepgramWs.on('close', (code, reason) => {
    // #region debug log - Deepgram connection closed
    debugLog('mock-proxy-server.js:141', 'Deepgram connection closed', { serviceType, targetUrl: targetDeepgramUrl, code, reason: reason?.toString() }, 'D');
    // #endregion
    console.log(`[Proxy] Deepgram ${serviceType} connection closed: ${code} ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      // Ensure code is a valid WebSocket close code
      // 1005 (No Status Received) and 1006 (Abnormal Closure) cannot be sent
      let closeCode = 1000; // Default to normal closure
      if (typeof code === 'number' && code >= 1000 && code < 5000 && code !== 1005 && code !== 1006) {
        closeCode = code;
      }
      const closeReason = Buffer.isBuffer(reason) ? reason.toString() : (reason || 'Connection closed');
      clientWs.close(closeCode, closeReason);
    }
  });

  // Handle Deepgram errors
  deepgramWs.on('error', (error) => {
    // #region debug log - Deepgram error
    debugLog('mock-proxy-server.js:156', 'Deepgram error', { serviceType, targetUrl: targetDeepgramUrl, error: error.message || String(error) }, 'C');
    // #endregion
    console.error(`[Proxy] Deepgram ${serviceType} error:`, error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Proxy error');
    }
  });

  // Handle client connection close
  clientWs.on('close', (code, reason) => {
    console.log(`[Proxy] Client connection closed: ${code} ${reason || ''}`);
    console.log(`[Proxy] Client connection closed - messages sent to Deepgram: ${messageQueue.length} queued, messages received from Deepgram: ${deepgramMessageQueue.length} queued`);
    debugLog('mock-proxy-server.js:close', 'Client connection closed', { 
      serviceType,
      code,
      reason: reason?.toString(),
      queuedToDeepgram: messageQueue.length,
      queuedFromDeepgram: deepgramMessageQueue.length
    }, 'H');
    if (deepgramWs.readyState === WebSocket.OPEN) {
      // Ensure code is a valid WebSocket close code
      // 1005 (No Status Received) and 1006 (Abnormal Closure) cannot be sent
      let closeCode = 1000; // Default to normal closure
      if (typeof code === 'number' && code >= 1000 && code < 5000 && code !== 1005 && code !== 1006) {
        closeCode = code;
      }
      const closeReason = Buffer.isBuffer(reason) ? reason.toString() : (reason || 'Connection closed');
      deepgramWs.close(closeCode, closeReason);
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
