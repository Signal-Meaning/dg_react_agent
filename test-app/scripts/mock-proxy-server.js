/**
 * Mock Backend Proxy Server - Issue #242, #381
 *
 * Single WebSocket proxy server for E2E testing. Hosts one or both:
 *   - /deepgram-proxy: proxies to Deepgram (when DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY present)
 *   - /openai: proxies to OpenAI Realtime via subprocess (when OPENAI_API_KEY present)
 *
 * At least one of DEEPGRAM_API_KEY or OPENAI_API_KEY must be set.
 *
 * Usage:
 *   node test-app/scripts/mock-proxy-server.js
 *   or
 *   npm run test:proxy:server
 *
 * Environment Variables (from test-app/.env when run via npm run test:proxy:server):
 *   - DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY: Deepgram API key (optional if OPENAI_API_KEY set)
 *   - OPENAI_API_KEY: OpenAI API key for /openai (optional if Deepgram key set)
 *   - PROXY_PORT: Port to run proxy on (default: 8080)
 *   - PROXY_PATH: Deepgram WebSocket path (default: /deepgram-proxy)
 */

import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import https from 'https';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load test-app/.env so VITE_DEEPGRAM_API_KEY (and DEEPGRAM_API_KEY) are available when run via npm run test:proxy:server
// Skip when SKIP_DOTENV=1 (used by integration tests to assert "at least one key required")
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.SKIP_DOTENV !== '1') {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

// Configuration
const RAW_DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;

/**
 * Normalizes Deepgram API key for WebSocket authentication.
 * 
 * This function matches the logic in src/utils/api-key-normalizer.ts
 * but is implemented here for Node.js compatibility (no TypeScript imports).
 * 
 * Deepgram API keys are stored in .env without any prefix (as provided by Deepgram).
 * For WebSocket subprotocol ['token', apiKey], Deepgram expects the raw key.
 * 
 * This function strips the 'dgkey_' prefix if accidentally present (legacy support),
 * but keys should be stored without prefix in .env.
 * 
 * @param apiKey - The API key from environment (should be raw, without prefix)
 * @returns The normalized API key ready for WebSocket authentication, or undefined if invalid
 */
function normalizeApiKeyForWebSocket(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return undefined;
  }
  
  const trimmed = apiKey.trim();
  
  // Test keys are used as-is (for testing/mocking scenarios)
  if (trimmed.startsWith('test')) {
    return trimmed;
  }
  
  // Deepgram WebSocket API expects raw keys (without 'dgkey_' prefix)
  // If key accidentally has 'dgkey_' prefix (legacy support), strip it
  // Keys should be stored in .env without prefix (as provided by Deepgram)
  if (trimmed.startsWith('dgkey_')) {
    return trimmed.substring(6); // Remove 'dgkey_' prefix (6 characters)
  }
  
  // Return raw key as-is (correct format)
  return trimmed;
}

// Normalize API key for WebSocket authentication
// Keys should be stored in .env without prefix (as provided by Deepgram)
// This function strips prefix if accidentally present (legacy support)
const DEEPGRAM_API_KEY = normalizeApiKeyForWebSocket(RAW_DEEPGRAM_API_KEY);
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '8080', 10);
const PROXY_PATH = process.env.PROXY_PATH || '/deepgram-proxy';
const OPENAI_INTERNAL_PORT = 8081; // subprocess for /openai
const DEEPGRAM_AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const DEBUG_LOG_PATH = path.join(process.cwd(), '.cursor', 'debug.log');
const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';
const wsScheme = useHttps ? 'wss' : 'ws';

// Log API key status at startup (for debugging authentication issues)
if (DEEPGRAM_API_KEY) {
  const apiKeyPreview = DEEPGRAM_API_KEY.length > 8 
    ? `${DEEPGRAM_API_KEY.substring(0, 8)}...${DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4)}`
    : '***';
  const hadPrefix = RAW_DEEPGRAM_API_KEY && RAW_DEEPGRAM_API_KEY.startsWith('dgkey_');
  console.log(`[Proxy] DEEPGRAM_API_KEY loaded: ${apiKeyPreview} (length: ${DEEPGRAM_API_KEY.length})`);
  console.log(`[Proxy]    Raw key from env: ${RAW_DEEPGRAM_API_KEY ? (RAW_DEEPGRAM_API_KEY.substring(0, 8) + '...') : 'NOT SET'}`);
  console.log(`[Proxy]    Prefix stripped: ${hadPrefix ? 'YES (dgkey_ removed for WebSocket auth)' : 'NO (raw key used as-is)'}`);
} else {
  console.error('[Proxy] ❌ DEEPGRAM_API_KEY not found in environment');
  console.error('[Proxy]    Checked: DEEPGRAM_API_KEY, VITE_DEEPGRAM_API_KEY');
  console.error('[Proxy]    Raw key value:', RAW_DEEPGRAM_API_KEY ? 'SET' : 'NOT SET');
}

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

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '').trim();
const hasDeepgram = DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.trim() !== '';
const hasOpenAI = OPENAI_API_KEY.length > 0;

if (!hasDeepgram && !hasOpenAI) {
  console.error('❌ Error: At least one of DEEPGRAM_API_KEY or OPENAI_API_KEY is required');
  console.error('   Set DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY for /deepgram-proxy');
  console.error('   Set OPENAI_API_KEY or VITE_OPENAI_API_KEY for /openai (default proxy for test-app)');
  process.exit(1);
}

// Validate API key format (Deepgram keys don't require prefix)
if (!DEEPGRAM_API_KEY.startsWith('test') && DEEPGRAM_API_KEY.length < 40) {
  console.warn(`[Proxy] ⚠️  Warning: API key appears to be too short (should be 40+ characters)`);
  console.warn(`[Proxy]    API key preview: ${DEEPGRAM_API_KEY.substring(0, 10)}...`);
}

// Create HTTP or HTTPS server for WebSocket upgrade (HTTPS when HTTPS=true for wss://)
const requestHandler = (req, res) => {
  // Handle OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    const originValidation = validateOrigin(origin);
    
    if (originValidation.valid && origin) {
      setSecurityHeaders(res);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.writeHead(200);
      res.end();
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Origin not allowed');
    }
    return;
  }
  
  // For other requests, set security headers
  setSecurityHeaders(res);
  
  // Default handler (WebSocket upgrade is handled by WebSocketServer)
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
};

let server;
if (useHttps) {
  const require = createRequire(import.meta.url);
  const selfsigned = require('selfsigned');
  const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { keySize: 2048, days: 365 });
  server = https.createServer({ key: pems.private, cert: pems.cert }, requestHandler);
} else {
  server = http.createServer(requestHandler);
}

// Helper function to validate authentication token
// For testing purposes, we reject tokens that start with "invalid-" or "expired-"
function validateAuthToken(token) {
  if (!token) {
    return { valid: true, reason: null }; // Optional authentication
  }
  
  // Reject invalid tokens (for testing invalid token rejection)
  if (token.startsWith('invalid-') || token === 'invalid' || token === 'malformed-token') {
    return { valid: false, reason: 'Invalid authentication token' };
  }
  
  // Reject expired tokens (for testing token expiration)
  if (token.startsWith('expired-')) {
    return { valid: false, reason: 'Token expired' };
  }
  
  // Accept valid tokens (any other token is considered valid for testing)
  return { valid: true, reason: null };
}

// Helper function to validate Origin header (CORS)
// For testing purposes, reject origins that start with "blocked-"
function validateOrigin(origin) {
  if (!origin) {
    return { valid: true, reason: null }; // Allow requests without Origin (same-origin)
  }
  
  // Reject blocked origins (for testing CORS validation)
  if (origin.startsWith('blocked-') || origin.includes('blocked-origin')) {
    return { valid: false, reason: 'Origin not allowed' };
  }
  
  // Accept valid origins (any other origin is considered valid for testing)
  return { valid: true, reason: null };
}

// Helper function to set security headers
function setSecurityHeaders(res) {
  // Security headers for WebSocket upgrade responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // CORS headers (if needed for preflight requests)
  // Note: WebSocket connections don't use CORS preflight, but we set headers for testing
  const origin = res.req?.headers?.origin;
  if (origin && validateOrigin(origin).valid) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

// --- Deepgram proxy (when API key present) ---
let wssDeepgram = null;
if (hasDeepgram) {
  wssDeepgram = new WebSocketServer({
  server,
  path: PROXY_PATH,
  verifyClient: (info) => {
    // Validate Origin header (CORS)
    const origin = info.origin || info.req.headers.origin;
    const originValidation = validateOrigin(origin);
    
    if (!originValidation.valid) {
      console.log(`[Proxy] ❌ Rejecting connection: ${originValidation.reason}`);
      console.log(`[Proxy]    Origin: ${origin || 'none'}`);
      return false; // Reject connection
    }
    
    // Validate authentication token if provided
    const token = url.parse(info.req.url, true).query.token;
    const validation = validateAuthToken(token);
    
    if (!validation.valid) {
      console.log(`[Proxy] ❌ Rejecting connection: ${validation.reason}`);
      console.log(`[Proxy]    Token preview: ${token ? token.substring(0, 10) + '...' : 'none'}`);
      return false; // Reject connection
    }
    
    // Set security headers on the upgrade response
    // Note: WebSocketServer handles the upgrade, but we can set headers via the request
    if (info.req && info.req.res) {
      setSecurityHeaders(info.req.res);
    }
    
    if (token) {
      console.log(`[Proxy] Connection with auth token: ${token.substring(0, 10)}...`);
    }
    if (origin) {
      console.log(`[Proxy] Connection from origin: ${origin}`);
    }
    return true;
  }
});

console.log(`🚀 Mock Backend Proxy Server starting...`);
if (hasDeepgram) {
  console.log(`   Deepgram: ${wsScheme}://localhost:${PROXY_PORT}${PROXY_PATH} → ${DEEPGRAM_AGENT_URL}`);
  console.log(`   API Key: ${DEEPGRAM_API_KEY.substring(0, 8)}...`);
}
if (hasOpenAI) {
  console.log(`   OpenAI:   ${wsScheme}://localhost:${PROXY_PORT}/openai (subprocess on ${OPENAI_INTERNAL_PORT})`);
}

wssDeepgram.on('connection', (clientWs, req) => {
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
  // Validate API key format before attempting connection
  if (!DEEPGRAM_API_KEY || DEEPGRAM_API_KEY.trim() === '') {
    console.error(`[Proxy] ❌ DEEPGRAM_API_KEY is empty or invalid for ${serviceType} service`);
    clientWs.close(1011, 'Proxy configuration error: DEEPGRAM_API_KEY not set');
    return;
  }
  
  // Log API key status (first 8 chars only for security)
  const apiKeyPreview = DEEPGRAM_API_KEY.length > 8 
    ? `${DEEPGRAM_API_KEY.substring(0, 8)}...${DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4)}`
    : '***';
  console.log(`[Proxy] Connecting to Deepgram with API key: ${apiKeyPreview} (length: ${DEEPGRAM_API_KEY.length})`);
  
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
          
          // Special logging for UserStartedSpeaking to debug idle timeout issue
          if (messageType === 'UserStartedSpeaking') {
            console.log(`[Proxy] 🎤 UserStartedSpeaking received from Deepgram, forwarding to client`);
            debugLog('mock-proxy-server.js:194', 'UserStartedSpeaking received', { 
              serviceType, 
              clientReady: clientWs.readyState === WebSocket.OPEN,
              deepgramReady: deepgramWs.readyState === WebSocket.OPEN
            }, 'F');
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
    const errorMessage = error.message || String(error);
    debugLog('mock-proxy-server.js:156', 'Deepgram error', { serviceType, targetUrl: targetDeepgramUrl, error: errorMessage }, 'C');
    // #endregion
    console.error(`[Proxy] Deepgram ${serviceType} error:`, errorMessage);
    
    // Special handling for authentication errors (401)
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      console.error(`[Proxy] ❌ Authentication failed - check DEEPGRAM_API_KEY is valid and not expired`);
      console.error(`[Proxy] ❌ API key length: ${DEEPGRAM_API_KEY.length}, preview: ${DEEPGRAM_API_KEY.substring(0, 8)}...`);
      console.error(`[Proxy] ❌ Target URL: ${deepgramUrl.toString()}`);
    }
    
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, `Proxy error: ${errorMessage}`);
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
} // end if (hasDeepgram)

// --- OpenAI proxy (when API key present): spawn subprocess on OPENAI_INTERNAL_PORT, forward /openai on main port ---
let openaiChild = null;
let wssOpenAI = null;

function spawnOpenAIProxy(spawnFn) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  openaiChild = spawnFn('npx', ['tsx', 'scripts/openai-proxy/run.ts'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      OPENAI_PROXY_PORT: String(OPENAI_INTERNAL_PORT),
      OPENAI_API_KEY,
    },
  });
  openaiChild.stdout?.on('data', (d) => process.stdout.write(d));
  openaiChild.stderr?.on('data', (d) => process.stderr.write(d));
  openaiChild.on('error', (err) => console.error('[Proxy] OpenAI subprocess error:', err));
  openaiChild.on('exit', (code, sig) => {
    if (code != null && code !== 0) console.error('[Proxy] OpenAI subprocess exited with code', code);
    if (sig) console.error('[Proxy] OpenAI subprocess killed:', sig);
  });
}

async function waitForPort(port, timeoutMs = 15000) {
  const net = (await import('net')).default;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const s = net.connect(port, '127.0.0.1', () => { s.destroy(); resolve(); });
      s.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Port ${port} not ready in ${timeoutMs}ms`));
        else setTimeout(tryConnect, 200);
      });
    };
    tryConnect();
  });
}

async function attachOpenAIForwarder() {
  await waitForPort(OPENAI_INTERNAL_PORT);
  const targetUrl = `${wsScheme}://127.0.0.1:${OPENAI_INTERNAL_PORT}/openai`;
  const upstreamOptions = useHttps ? { rejectUnauthorized: false } : {};
  wssOpenAI = new WebSocketServer({ server, path: '/openai', noServer: false });
  wssOpenAI.on('connection', (clientWs, req) => {
    const upstream = new WebSocket(targetUrl, upstreamOptions);
    upstream.on('open', () => {
      clientWs.on('message', (data, isBinary) => upstream.send(data, { binary: isBinary }));
      upstream.on('message', (data, isBinary) => clientWs.send(data, { binary: isBinary }));
      clientWs.on('close', () => upstream.close());
      upstream.on('close', () => clientWs.close());
      clientWs.on('error', () => upstream.close());
      upstream.on('error', () => clientWs.close());
    });
    upstream.on('error', (err) => {
      console.error('[Proxy] OpenAI forwarder upstream error:', err.message);
      clientWs.close();
    });
  });
}

// Start server (spawn OpenAI subprocess if needed, attach forwarder, then listen)
(async () => {
  if (hasOpenAI) {
    const { spawn } = await import('child_process');
    spawnOpenAIProxy(spawn);
    try {
      await attachOpenAIForwarder();
    } catch (err) {
      console.error('[Proxy] Failed to start OpenAI forwarder:', err.message);
      if (openaiChild) openaiChild.kill('SIGTERM');
      process.exit(1);
    }
  }
  server.listen(PROXY_PORT, () => {
    console.log(`✅ Mock Backend Proxy Server running on port ${PROXY_PORT}`);
    if (hasDeepgram) {
      console.log(`   Deepgram: ${wsScheme}://localhost:${PROXY_PORT}${PROXY_PATH}`);
    }
    if (hasOpenAI) {
      console.log(`   OpenAI:   ${wsScheme}://localhost:${PROXY_PORT}/openai (default for test-app)`);
    }
    console.log(`\n   To use in test-app:`);
    if (hasOpenAI) {
      console.log(`   VITE_OPENAI_PROXY_ENDPOINT=${wsScheme}://localhost:${PROXY_PORT}/openai  (default)`);
    }
    if (hasDeepgram) {
      console.log(`   VITE_DEEPGRAM_PROXY_ENDPOINT=${wsScheme}://localhost:${PROXY_PORT}${PROXY_PATH}`);
    }
    console.log(`\n   Press Ctrl+C to stop\n`);
  });
})();

// Graceful shutdown
function doShutdown() {
  console.log('\n[Proxy] Shutting down...');
  const closeServer = () => {
    if (openaiChild) {
      openaiChild.kill('SIGTERM');
      openaiChild = null;
    }
    server.close(() => {
      console.log('[Proxy] Server closed');
      process.exit(0);
    });
  };
  let pending = 0;
  if (wssDeepgram) { pending++; wssDeepgram.close(() => { pending--; if (pending === 0) closeServer(); }); }
  if (wssOpenAI) { pending++; wssOpenAI.close(() => { pending--; if (pending === 0) closeServer(); }); }
  if (pending === 0) closeServer();
}
process.on('SIGINT', doShutdown);
process.on('SIGTERM', doShutdown);
