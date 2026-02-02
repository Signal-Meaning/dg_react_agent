/**
 * E2E Test Helpers
 * 
 * Shared utilities for Playwright E2E tests to promote DRY principles
 * and consistent testing patterns across the test suite.
 */

/**
 * Base URL for test app navigation
 * Can be overridden via PLAYWRIGHT_BASE_URL environment variable
 * Falls back to VITE_BASE_URL or default localhost URL
 * Matches the baseURL configured in playwright.config.js
 */
export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5173';

/**
 * Get proxy configuration from environment variables
 * @returns {Record<string, string>} Proxy configuration params or empty object
 */
function getProxyConfig() {
  // Check if proxy mode is enabled via environment variable
  if (process.env.USE_PROXY_MODE === 'true') {
    const proxyEndpoint = process.env.VITE_PROXY_ENDPOINT || 'ws://localhost:8080/deepgram-proxy';
    const proxyAuthToken = process.env.VITE_PROXY_AUTH_TOKEN || '';
    
    const config = {
      connectionMode: 'proxy',
      proxyEndpoint: proxyEndpoint
    };
    
    if (proxyAuthToken) {
      config.proxyAuthToken = proxyAuthToken;
    }
    
    return config;
  }
  return {};
}

/**
 * Params for Deepgram proxy (used by tests that target the Deepgram proxy).
 * Prefer VITE_DEEPGRAM_PROXY_ENDPOINT; same default as mock proxy server.
 * @returns {Record<string, string>} connectionMode and proxyEndpoint
 */
export function getDeepgramProxyParams() {
  return {
    connectionMode: 'proxy',
    proxyEndpoint: process.env.VITE_DEEPGRAM_PROXY_ENDPOINT || process.env.VITE_PROXY_ENDPOINT || 'ws://localhost:8080/deepgram-proxy',
  };
}

/**
 * Params for OpenAI proxy (used by tests that target the OpenAI Realtime proxy).
 * Uses VITE_OPENAI_PROXY_ENDPOINT; default ws://localhost:8080/openai.
 * See docs/issues/ISSUE-381/E2E-TEST-PLAN.md.
 * @returns {Record<string, string>} connectionMode and proxyEndpoint
 */
export function getOpenAIProxyParams() {
  return {
    connectionMode: 'proxy',
    proxyEndpoint: process.env.VITE_OPENAI_PROXY_ENDPOINT || 'ws://localhost:8080/openai',
  };
}

/**
 * Backend for E2E test runs: 'openai' | 'deepgram'.
 * Test-app defaults to OpenAI (see App.tsx proxyEndpoint default).
 * Use E2E_BACKEND=openai or E2E_BACKEND=deepgram to choose; unset/default uses OpenAI.
 * URL is built with connectionMode + proxyEndpoint query params (the "URL input" the app reads).
 * @returns {'openai' | 'deepgram'}
 */
export function getE2EBackend() {
  const backend = process.env.E2E_BACKEND;
  if (backend === 'deepgram') return 'deepgram';
  return 'openai';
}

/**
 * Proxy params for the selected E2E backend (openai or deepgram).
 * Use for specs that support both; for OpenAI-only specs use getOpenAIProxyParams() and skip when E2E_BACKEND=deepgram.
 * @returns {Record<string, string>} connectionMode and proxyEndpoint
 */
export function getBackendProxyParams() {
  return getE2EBackend() === 'deepgram' ? getDeepgramProxyParams() : getOpenAIProxyParams();
}

/**
 * Safely build a URL with query parameters
 * Prevents URL injection by properly constructing URLs
 * Automatically adds proxy configuration if USE_PROXY_MODE env var is set
 * @param {string} baseUrl - Base URL (should be BASE_URL constant)
 * @param {Record<string, string>} params - Query parameters as key-value pairs
 * @returns {string} Safe URL with query parameters
 */
export function buildUrlWithParams(baseUrl, params = {}) {
  try {
    const url = new URL(baseUrl);
    
    // Get proxy config if enabled
    const proxyConfig = getProxyConfig();
    
    // Merge proxy config with provided params (provided params take precedence)
    const allParams = { ...proxyConfig, ...params };
    
    // Add query parameters safely
    Object.entries(allParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  } catch (error) {
    // If URL construction fails, fall back to base URL
    console.warn(`Failed to build URL with params: ${error.message}`);
    return baseUrl;
  }
}

/**
 * Common test selectors
 */
const SELECTORS = {
  voiceAgent: '[data-testid="voice-agent"]',
  connectionStatus: '[data-testid="connection-status"]',
  connectionReady: '[data-testid="connection-ready"]',
  micStatus: '[data-testid="mic-status"]',
  micButton: '[data-testid="microphone-button"]',
  textInput: '[data-testid="text-input"]',
  sendButton: '[data-testid="send-button"]',
  agentResponse: '[data-testid="agent-response"]',
  userMessage: '[data-testid="user-message"]',
  transcription: '[data-testid="transcription"]',
  greetingSent: '[data-testid="greeting-sent"]',
  agentSpeaking: '[data-testid="agent-speaking"]',
  agentSilent: '[data-testid="agent-silent"]',
};

/**
 * Navigate to the test app and wait for it to load
 * Automatically uses proxy mode if USE_PROXY_MODE env var is set
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function setupTestPage(page, timeout = 10000) {
  const url = buildUrlWithParams(BASE_URL);
  await page.goto(url);
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Wait for connection to be established (auto-connect)
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 5000)
 */
async function waitForConnection(page, timeout = 5000) {
  const connectionReady = page.locator(SELECTORS.connectionReady);
  await connectionReady.waitFor({ state: 'visible', timeout });
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.textContent === 'true',
    SELECTORS.connectionReady,
    { timeout }
  );
}

/**
 * Wait for agent to finish greeting
 * Uses state-based detection via data-testid selectors instead of log parsing
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 8000)
 */
async function waitForAgentGreeting(page, timeout = 8000) {
  // Wait for agent to finish speaking using state-based detection
  // Options: agent-silent=true, agent-speaking=false, audio-playing-status=false, or agent-state=idle
  await page.waitForFunction(
    () => {
      const agentSilent = document.querySelector('[data-testid="agent-silent"]')?.textContent?.trim();
      const agentSpeaking = document.querySelector('[data-testid="agent-speaking"]')?.textContent?.trim();
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]')?.textContent?.trim();
      const agentState = document.querySelector('[data-testid="agent-state"]')?.textContent?.trim();
      
      // Agent has finished speaking if any of these conditions are met
      return agentSilent === 'true' || 
             agentSpeaking === 'false' || 
             audioPlaying === 'false' || 
             agentState === 'idle';
    },
    { timeout }
  );
}

/**
 * Send a text message through the UI
 * @param {import('@playwright/test').Page} page
 * @param {string} message - The message to send
 * @returns {Promise<void>}
 */
async function sendTextMessage(page, message) {
  const textInput = page.locator(SELECTORS.textInput);
  const sendButton = page.locator(SELECTORS.sendButton);
  
  await textInput.fill(message);
  await sendButton.click();
  
  // Wait for input to clear (confirms send)
  await textInput.waitFor({ state: 'visible', timeout: 1000 });
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.value === '',
    SELECTORS.textInput,
    { timeout: 1000 }
  );
}

/**
 * Install WebSocket message capture in the browser context
 * @param {import('@playwright/test').Page} page
 */
async function installWebSocketCapture(page) {
  await page.addInitScript(() => {
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      console.log('WebSocket created:', { url, protocols });
      window.capturedWebSocketUrl = url;
      window.capturedWebSocketProtocols = protocols;
      
      const ws = new OriginalWebSocket(url, protocols);
      const originalSend = ws.send;
      
      // Capture sent messages
      ws.send = function(data) {
        try {
          const parsed = JSON.parse(data);
          window.capturedSentMessages = window.capturedSentMessages || [];
          window.capturedSentMessages.push({
            timestamp: new Date().toISOString(),
            type: parsed.type,
            data: parsed
          });
          console.log('WebSocket send:', parsed.type, parsed);
        } catch (e) {
          // Not JSON, might be binary audio data
          window.capturedSentMessages = window.capturedSentMessages || [];
          window.capturedSentMessages.push({
            timestamp: new Date().toISOString(),
            type: 'binary',
            size: data.byteLength || data.length
          });
        }
        return originalSend.call(this, data);
      };
      
      // Capture received messages
      ws.addEventListener('message', (event) => {
        try {
          const parsed = JSON.parse(event.data);
          window.capturedReceivedMessages = window.capturedReceivedMessages || [];
          window.capturedReceivedMessages.push({
            timestamp: new Date().toISOString(),
            type: parsed.type,
            data: parsed
          });
          console.log('WebSocket receive:', parsed.type, parsed);
        } catch (e) {
          // Binary data
          window.capturedReceivedMessages = window.capturedReceivedMessages || [];
          window.capturedReceivedMessages.push({
            timestamp: new Date().toISOString(),
            type: 'binary',
            size: event.data.byteLength || event.data.length
          });
        }
      });
      
      return ws;
    };
  });
}

/**
 * Get captured WebSocket messages from browser context
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{url: string, protocols: string[], sent: Array, received: Array}>}
 */
async function getCapturedWebSocketData(page) {
  return await page.evaluate(() => ({
    url: window.capturedWebSocketUrl,
    protocols: window.capturedWebSocketProtocols,
    sent: window.capturedSentMessages || [],
    received: window.capturedReceivedMessages || []
  }));
}

/**
 * Install a mock WebSocket for testing without real API
 * @param {import('@playwright/test').BrowserContext} context
 */
async function installMockWebSocket(context) {
  await context.addInitScript(() => {
    console.log('🔧 Installing WebSocket mock...');
    
    // Store original WebSocket
    const OriginalWebSocket = window.WebSocket;
    let mockWs = null;
    
    // Create mock WebSocket
    class MockWebSocket extends EventTarget {
      constructor(url, protocols) {
        super();
        console.log('🎭 MockWebSocket created:', url, protocols);
        mockWs = this;
        this.url = url;
        this.protocols = protocols;
        this.readyState = 0; // CONNECTING
        this.bufferedAmount = 0;
        this.extensions = '';
        this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
        this.binaryType = 'arraybuffer';
        
        // Simulate connection
        setTimeout(() => {
          this.readyState = 1; // OPEN
          console.log('🎭 Mock WebSocket opened');
          if (this.onopen) this.onopen({ type: 'open' });
          
          // Send mock Welcome message
          setTimeout(() => {
            const welcomeMsg = JSON.stringify({
              type: 'Welcome',
              request_id: 'mock-request-id-12345'
            });
            console.log('🎭 Mock sending Welcome:', welcomeMsg);
            if (this.onmessage) {
              this.onmessage({ data: welcomeMsg, type: 'message' });
            }
            
            // Send SettingsApplied
            setTimeout(() => {
              const settingsMsg = JSON.stringify({ type: 'SettingsApplied' });
              console.log('🎭 Mock sending SettingsApplied');
              if (this.onmessage) {
                this.onmessage({ data: settingsMsg, type: 'message' });
              }
            }, 100);
          }, 100);
        }, 100);
      }
      
      send(data) {
        console.log('🎭 Mock WebSocket send:', typeof data === 'string' ? data.substring(0, 100) : 'binary');
        
        // Simulate response to text message
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'UserText' || parsed.type === 'InjectUserMessage') {
              // Send mock agent response
              setTimeout(() => {
                const responseMsg = JSON.stringify({
                  type: 'ConversationText',
                  role: 'assistant',
                  content: '[MOCK] I received your message: "' + parsed.content + '". How can I help you with that?'
                });
                console.log('🎭 Mock sending agent response');
                if (this.onmessage) {
                  this.onmessage({ data: responseMsg, type: 'message' });
                }
              }, 500);
            }
          } catch (e) {
            console.log('🎭 Could not parse sent data');
          }
        }
      }
      
      close() {
        console.log('🎭 Mock WebSocket closed');
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose({ type: 'close', code: 1000, reason: 'Normal closure' });
      }
      
      addEventListener(type, listener) {
        super.addEventListener(type, listener);
      }
      
      removeEventListener(type, listener) {
        super.removeEventListener(type, listener);
      }
    }
    
    // Mock static constants
    MockWebSocket.CONNECTING = 0;
    MockWebSocket.OPEN = 1;
    MockWebSocket.CLOSING = 2;
    MockWebSocket.CLOSED = 3;
    
    // Replace global WebSocket
    window.WebSocket = MockWebSocket;
    console.log('✅ WebSocket mock installed');
  });
}

/**
 * Common assertions for connection state
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').expect} expect
 */
async function assertConnectionHealthy(page, expect) {
  const connectionStatus = page.locator(SELECTORS.connectionStatus);
  const connectionReady = page.locator(SELECTORS.connectionReady);
  
  await expect(connectionStatus).toHaveText('connected');
  await expect(connectionReady).toHaveText('true');
}

export {
  SELECTORS,
  setupTestPage,
  waitForConnection,
  waitForAgentGreeting,
  sendTextMessage,
  installWebSocketCapture,
  getCapturedWebSocketData,
  installMockWebSocket,
  assertConnectionHealthy,
};

