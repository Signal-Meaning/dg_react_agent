/**
 * E2E Test Helpers
 * 
 * Shared utilities for Playwright E2E tests to promote DRY principles
 * and consistent testing patterns across the test suite.
 */

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
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function setupTestPage(page, timeout = 10000) {
  await page.goto('http://localhost:5173');
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Wait for connection to be established (auto-connect)
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 5000)
 */
async function waitForConnection(page, timeout = 5000) {
  // Wait for connection status to show "connected"
  await page.waitForFunction(
    () => {
      const connectionStatus = document.querySelector('[data-testid="connection-status"]');
      return connectionStatus && connectionStatus.textContent === 'connected';
    },
    { timeout }
  );
}

/**
 * Wait for agent to finish greeting
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 8000)
 */
async function waitForAgentGreeting(page, timeout = 8000) {
  const greetingSent = page.locator(SELECTORS.greetingSent);
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      const text = element?.textContent || '';
      return text.includes('Agent finished speaking') || text.includes('ready for interaction');
    },
    SELECTORS.greetingSent,
    { timeout }
  );
}

/**
 * Wait for greeting to complete if it plays, otherwise continue
 * This is a safe helper that waits for greeting audio to play and finish
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration options
 * @param {number} options.checkTimeout - Timeout to detect if greeting starts (default: 3000)
 * @param {number} options.playTimeout - Timeout to wait for greeting to finish (default: 8000)
 * @returns {Promise<boolean>} - True if greeting played and finished, false if no greeting
 */
async function waitForGreetingIfPresent(page, options = {}) {
  const { checkTimeout = 3000, playTimeout = 8000 } = options;
  
  try {
    // Check if greeting audio starts playing
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'true';
    }, { timeout: checkTimeout });
    console.log('✅ Greeting audio started');
    
    // Wait for greeting to finish
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'false';
    }, { timeout: playTimeout });
    console.log('✅ Greeting finished');
    
    return true;
  } catch (e) {
    // No greeting played, that's ok for tests that don't expect greeting
    console.log('ℹ️ No greeting played (this is normal for some tests)');
    return false;
  }
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

/**
 * Wait for agent response text to appear
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedText - Text to wait for in agent response
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function waitForAgentResponse(page, expectedText, timeout = 10000) {
  const agentResponse = page.locator(SELECTORS.agentResponse);
  await agentResponse.waitFor({ timeout });
  const responseText = await agentResponse.textContent();
  if (expectedText) {
    // Check if any part of expected text is in the response (case-insensitive)
    const found = expectedText.split(/[\s,]+/).some(word => 
      responseText.toLowerCase().includes(word.toLowerCase())
    );
    if (!found) {
      throw new Error(`Expected to find "${expectedText}" in agent response: "${responseText}"`);
    }
  }
  return responseText;
}

/**
 * Disconnect the component (simulates stop button or network issue)
 * @param {import('@playwright/test').Page} page
 */
async function disconnectComponent(page) {
  const stopButton = page.locator('[data-testid="stop-button"]');
  if (await stopButton.isVisible({ timeout: 1000 })) {
    await stopButton.click();
  }
  
  // Wait for connection to close
  await page.waitForFunction(
    () => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent === 'closed';
    },
    { timeout: 5000 }
  );
}

/**
 * Get agent state from the UI
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} Agent state (idle, listening, thinking, speaking, etc.)
 */
async function getAgentState(page) {
  const agentStateElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
  return await agentStateElement.textContent();
}

/**
 * Verify context is preserved by checking agent response mentions key terms
 * @param {import('@playwright/test').Page} page
 * @param {string[]} expectedTerms - Array of terms that should appear in agent response
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function verifyContextPreserved(page, expectedTerms, timeout = 10000) {
  const agentResponse = page.locator(SELECTORS.agentResponse);
  await agentResponse.waitFor({ timeout });
  const responseText = await agentResponse.textContent();
  
  const missingTerms = expectedTerms.filter(term => 
    !responseText.toLowerCase().includes(term.toLowerCase())
  );
  
  if (missingTerms.length > 0) {
    throw new Error(`Context not preserved. Missing terms: ${missingTerms.join(', ')}. Response: "${responseText}"`);
  }
  
  return responseText;
}

/**
 * Send text message and wait for agent response
 * This helper combines sending and waiting for response
 * @param {import('@playwright/test').Page} page
 * @param {string} message - Message to send
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string>} Agent response text
 */
async function sendMessageAndWaitForResponse(page, message, timeout = 10000) {
  // Send the message
  const textInput = page.locator(SELECTORS.textInput);
  await textInput.fill(message);
  await textInput.press('Enter');
  
  // Wait for agent response
  const agentResponse = page.locator(SELECTORS.agentResponse);
  await agentResponse.waitFor({ timeout });
  
  return await agentResponse.textContent();
}

/**
 * Connect via text input (auto-connect) and wait for greeting to complete
 * This is the recommended pattern for text-based tests - connects via text input
 * which triggers auto-connect, then waits for greeting audio to finish
 * 
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration options
 * @param {number} options.greetingTimeout - Timeout for greeting (default: 8000)
 * @returns {Promise<void>}
 */
async function connectViaTextAndWaitForGreeting(page, options = {}) {
  const { greetingTimeout = 8000 } = options;
  
  console.log('🔌 Connecting via text input and waiting for greeting...');
  
  // Click text input to trigger auto-connect
  await page.click(SELECTORS.textInput);
  await page.waitForTimeout(200);
  
  // Send a message to trigger auto-connect
  const textInput = page.locator(SELECTORS.textInput);
  await textInput.fill('Hello');
  await textInput.press('Enter');
  
  // Wait for connection to be established
  await waitForConnection(page, 5000);
  console.log('✅ Connection established via auto-connect');
  
  // Wait for greeting to complete (if it plays)
  const greetingPlayed = await waitForGreetingIfPresent(page, { 
    checkTimeout: 3000, 
    playTimeout: greetingTimeout 
  });
  
  if (greetingPlayed) {
    console.log('✅ Greeting audio completed');
  } else {
    console.log('ℹ️ No greeting played (normal for some scenarios)');
  }
  
  console.log('✅ Ready for further interaction');
}

// Import microphone helpers
import MicrophoneHelpers from './microphone-helpers.js';

export {
  SELECTORS, // Common test selectors object for consistent element targeting across E2E tests
  setupTestPage, // Navigate to test app and wait for page load with configurable timeout
  waitForConnection, // Wait for agent connection to be established (waits for "connected" status)
  waitForAgentGreeting, // Wait for agent to finish speaking its greeting message
  waitForGreetingIfPresent, // Safely wait for greeting if it plays, otherwise continue (doesn't fail if no greeting)
  sendTextMessage, // Send a text message through the UI and wait for input to clear
  installWebSocketCapture, // Install WebSocket message capture in browser context for testing
  getCapturedWebSocketData, // Retrieve captured WebSocket messages and their counts
  installMockWebSocket, // Replace global WebSocket with mock implementation for testing
  assertConnectionHealthy, // Assert that connection status and ready state are both healthy
  waitForAgentResponse, // Wait for agent response with optional text verification
  disconnectComponent, // Disconnect the component (stop button or simulate network issue)
  getAgentState, // Get current agent state from UI
  verifyContextPreserved, // Verify conversation context is preserved by checking agent response
  sendMessageAndWaitForResponse, // Send message and wait for agent response in one call
  connectViaTextAndWaitForGreeting, // Connect via text input (auto-connect) and wait for greeting to complete
  MicrophoneHelpers // Microphone utility helpers for E2E tests (activate/deactivate mic)
};

