/**
 * Backend server for test-app - Issue #242, #381
 *
 * Single HTTP(S) server that hosts both proxy endpoints and app-backend function execution (Issue #407):
 *   - /deepgram-proxy: pass-through to Deepgram Voice Agent (and optionally transcription) API
 *   - /openai: OpenAI Realtime translation proxy (spawns scripts/openai-proxy/run.ts; no duplicate proxy logic)
 *   - POST /function-call: execute function calls (common handlers; see function-call-handlers.js)
 *
 * One implementation per proxy (DRY). See docs/BACKEND-PROXY/ARCHITECTURE.md.
 *
 * At least one of DEEPGRAM_API_KEY or OPENAI_API_KEY must be set.
 *
 * Usage (canonical):
 *   cd test-app && npm run backend
 *
 * Environment Variables (from test-app/.env):
 *   - DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY: Deepgram API key (optional if OPENAI_API_KEY set)
 *   - OPENAI_API_KEY: OpenAI API key for /openai (optional if Deepgram key set)
 *   - PROXY_PORT: Port to run on (default: 8080)
 *   - PROXY_PATH: Deepgram WebSocket path (default: /deepgram-proxy)
 */

import http from 'http';
import https from 'https';
import url from 'url';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { executeFunctionCall } from './function-call-handlers.js';
import { getLogger, generateTraceId } from './logger.js';

// Load test-app/.env so VITE_DEEPGRAM_API_KEY (and DEEPGRAM_API_KEY) are available when run via npm run backend
// Skip when SKIP_DOTENV=1 (used by integration tests to assert "at least one key required")
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Issue #423: use voice-agent-backend package for /function-call (thin wrapper)
// Issue #445: OpenAI proxy lives in voice-agent-backend; spawn with cwd = backend package dir
const require = createRequire(import.meta.url);
const voiceAgentBackendPath = path.resolve(__dirname, '..', '..', 'packages', 'voice-agent-backend', 'src', 'index.js');
const voiceAgentBackendPkgDir = path.resolve(__dirname, '..', '..', 'packages', 'voice-agent-backend');
const { createFunctionCallHandler, attachVoiceAgentUpgrade } = require(voiceAgentBackendPath);
const functionCallHandler = createFunctionCallHandler({ execute: executeFunctionCall });
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
const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';
const wsScheme = useHttps ? 'wss' : 'ws';

// Issue #412: shared logger; LOG_LEVEL env controls verbosity
const rootLog = getLogger({ level: process.env.LOG_LEVEL || 'info' });

// Log API key status at startup (for debugging authentication issues)
if (DEEPGRAM_API_KEY) {
  const apiKeyPreview = DEEPGRAM_API_KEY.length > 8 
    ? `${DEEPGRAM_API_KEY.substring(0, 8)}...${DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4)}`
    : '***';
  const hadPrefix = RAW_DEEPGRAM_API_KEY && RAW_DEEPGRAM_API_KEY.startsWith('dgkey_');
  rootLog.info('[Proxy] DEEPGRAM_API_KEY loaded', { apiKeyPreview, length: DEEPGRAM_API_KEY.length });
  rootLog.info('[Proxy] Raw key from env', { raw: RAW_DEEPGRAM_API_KEY ? (RAW_DEEPGRAM_API_KEY.substring(0, 8) + '...') : 'NOT SET' });
  rootLog.info('[Proxy] Prefix stripped', { hadPrefix: hadPrefix ? 'YES (dgkey_ removed for WebSocket auth)' : 'NO (raw key used as-is)' });
} else {
  rootLog.error('[Proxy] DEEPGRAM_API_KEY not found in environment', { checked: 'DEEPGRAM_API_KEY, VITE_DEEPGRAM_API_KEY', rawSet: !!RAW_DEEPGRAM_API_KEY });
}

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '').trim();
const hasDeepgram = DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.trim() !== '';
const hasOpenAI = OPENAI_API_KEY.length > 0;

if (!hasDeepgram && !hasOpenAI) {
  rootLog.error('At least one of DEEPGRAM_API_KEY or OPENAI_API_KEY is required', {
  hintDeepgram: 'Set DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY for /deepgram-proxy',
  hintOpenAI: 'Set OPENAI_API_KEY or VITE_OPENAI_API_KEY for /openai (default for test-app)',
  });
  process.exit(1);
}

// Validate API key format (Deepgram keys don't require prefix)
if (DEEPGRAM_API_KEY && !DEEPGRAM_API_KEY.startsWith('test') && DEEPGRAM_API_KEY.length < 40) {
  rootLog.warn('[Proxy] API key appears to be too short (should be 40+ characters)', { preview: DEEPGRAM_API_KEY.substring(0, 10) + '...' });
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

  const pathname = getPathname(req.url);

  // POST /function-call — Issue #407, #423: delegated to voice-agent-backend package (thin wrapper)
  if (req.method === 'POST' && pathname === '/function-call') {
    const traceId = req.headers['x-trace-id'] || req.headers['x-request-id'] || generateTraceId();
    rootLog.debug('Function call request', { traceId });
    functionCallHandler(req, res);
    return;
  }

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

/** Get pathname from request URL (no query). Used for HTTP routes and WebSocket upgrade path. */
function getPathname(reqUrl) {
  const parsed = url.parse(reqUrl || '', false);
  return parsed.pathname || '/';
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

// Issue #423: Deepgram and OpenAI proxies are attached via attachVoiceAgentUpgrade below (see Start server).
let voiceAgentAttachment = null;

// Start server (Issue #423: attach proxies via voice-agent-backend, then listen)
(async () => {
  try {
    voiceAgentAttachment = await attachVoiceAgentUpgrade(server, {
      deepgram: hasDeepgram ? {
        path: PROXY_PATH,
        apiKey: DEEPGRAM_API_KEY,
        agentUrl: DEEPGRAM_AGENT_URL,
        transcriptionUrl: 'wss://api.deepgram.com/v1/listen',
        verifyClient: (info) => {
          const origin = info.origin || info.req?.headers?.origin;
          if (!validateOrigin(origin).valid) return false;
          const token = url.parse(info.req.url, true).query.token;
          if (!validateAuthToken(token).valid) return false;
          return true;
        },
        setSecurityHeaders,
      } : undefined,
      openai: hasOpenAI ? {
        path: '/openai',
        spawn: {
          cwd: voiceAgentBackendPkgDir,
          command: 'npx',
          args: ['tsx', 'scripts/openai-proxy/run.ts'],
          env: { OPENAI_API_KEY },
          port: OPENAI_INTERNAL_PORT,
        },
      } : undefined,
      logger: rootLog,
      https: useHttps,
    });
  } catch (err) {
    rootLog.error('[Proxy] Failed to attach voice-agent proxies', { error: err?.message ?? String(err) });
    process.exit(1);
  }
  rootLog.info('Backend server starting', { hasDeepgram, hasOpenAI });
  if (hasDeepgram) rootLog.info('Deepgram proxy', { url: `${wsScheme}://localhost:${PROXY_PORT}${PROXY_PATH}`, target: DEEPGRAM_AGENT_URL });
  if (hasOpenAI) rootLog.info('OpenAI proxy', { url: `${wsScheme}://localhost:${PROXY_PORT}/openai`, subprocessPort: OPENAI_INTERNAL_PORT });
  server.listen(PROXY_PORT, () => {
    rootLog.info('Backend server running', { port: PROXY_PORT });
    if (hasDeepgram) rootLog.info('Deepgram endpoint', { url: `${wsScheme}://localhost:${PROXY_PORT}${PROXY_PATH}` });
    if (hasOpenAI) rootLog.info('OpenAI endpoint', { url: `${wsScheme}://localhost:${PROXY_PORT}/openai`, note: 'default for test-app' });
    rootLog.info('To use in test-app', {
      openaiEnv: hasOpenAI ? `VITE_OPENAI_PROXY_ENDPOINT=${wsScheme}://localhost:${PROXY_PORT}/openai` : null,
      deepgramEnv: hasDeepgram ? `VITE_DEEPGRAM_PROXY_ENDPOINT=${wsScheme}://localhost:${PROXY_PORT}${PROXY_PATH}` : null,
    });
    rootLog.info('Press Ctrl+C to stop');
  });
})();

function doShutdown() {
  rootLog.info('[Proxy] Shutting down...');
  (voiceAgentAttachment ? voiceAgentAttachment.shutdown() : Promise.resolve()).then(() => {
    server.close(() => {
      rootLog.info('[Proxy] Server closed');
      process.exit(0);
    });
  });
}
process.on('SIGINT', doShutdown);
process.on('SIGTERM', doShutdown);
