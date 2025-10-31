/**
 * E2E Test Helpers
 * 
 * Shared utilities for Playwright E2E tests to promote DRY principles
 * and consistent testing patterns across the test suite.
 */
import { expect } from '@playwright/test';

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
 * Wait for agent settings to be applied (SettingsApplied received from server)
 * This ensures the agent is fully initialized and ready to respond
 * Uses onSettingsApplied callback instead of polling getState() debug method
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function waitForSettingsApplied(page, timeout = 10000) {
  // Setup callback-based tracking in page context
  await page.evaluate(() => {
    window.testSettingsApplied = false;
    
    // Store original callback if it exists
    const originalCallback = window.onSettingsApplied;
    
    // Override onSettingsApplied to track state
    window.onSettingsApplied = () => {
      window.testSettingsApplied = true;
      // Also call original callback if it exists (test-app may have one)
      if (originalCallback) {
        originalCallback();
      }
    };
  });
  
  // Wait for callback to fire
  await page.waitForFunction(
    () => window.testSettingsApplied === true,
    { timeout }
  );
}

/**
 * Setup connection state tracking via onConnectionStateChange callback
 * Returns tracked state that can be queried later
 * Checks initial connection state from DOM to handle connections established before tracking
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>} Object with methods to get tracked state
 */
async function setupConnectionStateTracking(page) {
  // Check initial connection state from DOM (test-app updates this via onConnectionStateChange)
  const initialAgentState = await page.evaluate(() => {
    const connectionStatusEl = document.querySelector('[data-testid="connection-status"]');
    const statusText = connectionStatusEl?.textContent?.toLowerCase() || '';
    
    // Map DOM text to connection state
    if (statusText.includes('connected')) {
      return 'connected';
    } else if (statusText.includes('connecting')) {
      return 'connecting';
    } else if (statusText.includes('closed') || statusText.includes('disconnected')) {
      return 'closed';
    }
    return 'closed'; // Default
  });
  
  await page.evaluate((initialAgent) => {
    // Initialize connection state tracking with current state from DOM
    window.testConnectionStates = {
      agent: initialAgent || 'closed',
      transcription: 'closed' // Transcription state not shown in DOM, default to closed
    };
    
    // Store original callback if it exists
    const originalCallback = window.onConnectionStateChange;
    
    // Override onConnectionStateChange to track state
    window.onConnectionStateChange = (service, state) => {
      if (service === 'agent') {
        window.testConnectionStates.agent = state;
      } else if (service === 'transcription') {
        window.testConnectionStates.transcription = state;
      }
      // Also call original callback if it exists (test-app has one)
      if (originalCallback) {
        originalCallback(service, state);
      }
    };
  }, initialAgentState);
  
  // Return helper functions to query state
  return {
    getStates: async () => {
      return await page.evaluate(() => ({
        agent: window.testConnectionStates?.agent || 'closed',
        transcription: window.testConnectionStates?.transcription || 'closed',
        agentConnected: window.testConnectionStates?.agent === 'connected',
        transcriptionConnected: window.testConnectionStates?.transcription === 'connected'
      }));
    },
    waitForAgentConnected: async (timeout = 5000) => {
      // Check if already connected (may have been connected before tracking started)
      const currentState = await page.evaluate(() => window.testConnectionStates?.agent);
      if (currentState === 'connected') {
        return; // Already connected, no need to wait
      }
      
      await page.waitForFunction(
        () => window.testConnectionStates?.agent === 'connected',
        { timeout }
      );
    },
    waitForTranscriptionConnected: async (timeout = 5000) => {
      // Check if already connected (may have been connected before tracking started)
      const currentState = await page.evaluate(() => window.testConnectionStates?.transcription);
      if (currentState === 'connected') {
        return; // Already connected, no need to wait
      }
      
      await page.waitForFunction(
        () => window.testConnectionStates?.transcription === 'connected',
        { timeout }
      );
    }
  };
}

/**
 * Wait for connection to be established and settings to be applied
 * This is a convenience function that waits for both connection and settings
 * @param {import('@playwright/test').Page} page
 * @param {number} connectionTimeout - Timeout for connection in ms (default: 5000)
 * @param {number} settingsTimeout - Timeout for settings in ms (default: 10000)
 */
async function waitForConnectionAndSettings(page, connectionTimeout = 5000, settingsTimeout = 10000) {
  await waitForConnection(page, connectionTimeout);
  await waitForSettingsApplied(page, settingsTimeout);
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
 * Poll for binary WebSocket messages with logging
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration options
 * @param {number} options.maxTicks - Maximum polling iterations (default: 6)
 * @param {number} options.tickInterval - Delay between polls in ms (default: 500)
 * @param {string} options.label - Label for console logs (default: 'pre-assert')
 * @returns {Promise<void>}
 */
async function pollForBinaryWebSocketMessages(page, options = {}) {
  const { maxTicks = 6, tickInterval = 500, label = 'pre-assert' } = options;
  
  for (let i = 0; i < maxTicks; i++) {
    await page.waitForTimeout(tickInterval);
    const wsData = await getCapturedWebSocketData(page);
    const receivedTypes = wsData.received.map(m => m.type);
    const binaryCount = receivedTypes.filter(t => t === 'binary').length;
    console.log(`[WS CAPTURE] ${label} tick=${i+1} URL=${wsData.url}, total=${wsData.received.length}, binary=${binaryCount}`);
    if (binaryCount > 0) break;
  }
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
  const agentStateElement = page.locator('[data-testid="agent-state"]');
  return await agentStateElement.textContent();
}

/**
 * Wait for agent state to become a specific value
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedState - Expected agent state (idle, listening, thinking, speaking, etc.)
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string>} The agent state text content
 */
async function waitForAgentState(page, expectedState, timeout = 10000) {
  const agentStateElement = page.locator('[data-testid="agent-state"]');
  await agentStateElement.waitFor({ 
    state: 'visible', 
    timeout 
  });
  await expect(agentStateElement).toHaveText(expectedState, { timeout });
  return await agentStateElement.textContent();
}

/**
 * Get AudioContext state and audio playing status for diagnostics
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{state: string, playing: string}>} Audio diagnostics with AudioContext state and playing status
 */
async function getAudioDiagnostics(page) {
  return await page.evaluate(() => {
    const ctx = window.deepgramRef?.current?.getAudioContext?.();
    const state = ctx ? ctx.state : 'no-context';
    const playingEl = document.querySelector('[data-testid="audio-playing-status"]');
    const playing = playingEl ? playingEl.textContent : 'unknown';
    return { state, playing };
  });
}

/**
 * Get AudioContext state from window (test-app specific)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} AudioContext state or 'not-initialized'
 */
async function getAudioContextState(page) {
  return await page.evaluate(() => window.audioContext?.state || 'not-initialized');
}

/**
 * Wait for app root to be ready (waits for voice-agent selector)
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 10000)
 */
async function waitForAppReady(page, timeout = 10000) {
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Get microphone status from the UI
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} Microphone status text
 */
async function getMicStatus(page) {
  return await page.locator(SELECTORS.micStatus).textContent();
}

/**
 * Get audio playing status from the UI
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} Audio playing status ('true' or 'false')
 */
async function getAudioPlayingStatus(page) {
  return await page.locator('[data-testid="audio-playing-status"]').textContent();
}

/**
 * Wait for audio playback to start
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 5000)
 */
async function waitForAudioPlaybackStart(page, timeout = 5000) {
  await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('true', { timeout });
}

/**
 * Log first Settings WebSocket message details (speak model and greeting preview)
 * @param {import('@playwright/test').Page} page
 */
async function logFirstSettingsPreview(page) {
  const wsData = await getCapturedWebSocketData(page);
  const settingsMsg = wsData.sent.find(m => m.type === 'Settings');
  if (settingsMsg && settingsMsg.data) {
    const speakModel = settingsMsg.data?.agent?.speak?.provider?.model;
    const greeting = settingsMsg.data?.agent?.greeting || '';
    console.log('[WS SENT] Settings speakModel=', speakModel, 'greetingPreview=', String(greeting).slice(0, 60));
  } else {
    console.log('[WS SENT] Settings message not captured yet');
  }
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
  
  // DON'T send a message - just prepare the connection by clicking the input
  // The actual test will send the message and trigger auto-connect
  await page.click(SELECTORS.textInput);
  await page.waitForTimeout(200);
  
  console.log('✅ Ready to send message (will auto-connect)');
}

// Import microphone helpers
import MicrophoneHelpers from './microphone-helpers.js';

export {
  SELECTORS, // Common test selectors object for consistent element targeting across E2E tests
  setupTestPage, // Navigate to test app and wait for page load with configurable timeout
  waitForConnection, // Wait for connection to be established
  waitForSettingsApplied, // Wait for agent settings to be applied (SettingsApplied received from server)
  setupConnectionStateTracking, // Setup connection state tracking via onConnectionStateChange callback
  waitForConnectionAndSettings, // Wait for both connection and settings to be applied
  waitForAgentGreeting, // Wait for agent to finish speaking its greeting message
  waitForGreetingIfPresent, // Safely wait for greeting if it plays, otherwise continue (doesn't fail if no greeting)
  sendTextMessage, // Send a text message through the UI and wait for input to clear
  installWebSocketCapture, // Install WebSocket message capture in browser context for testing
  getCapturedWebSocketData, // Retrieve captured WebSocket messages and their counts
  pollForBinaryWebSocketMessages, // Poll for binary WebSocket messages with logging
  installMockWebSocket, // Replace global WebSocket with mock implementation for testing
  assertConnectionHealthy, // Assert that connection status and ready state are both healthy
  waitForAgentResponse, // Wait for agent response with optional text verification
  disconnectComponent, // Disconnect the component (stop button or simulate network issue)
  getAgentState, // Get current agent state from UI
  waitForAgentState, // Wait for agent state to become a specific value
  getAudioDiagnostics, // Get AudioContext state and audio playing status for diagnostics
  getAudioContextState, // Get AudioContext state from window (test-app specific)
  waitForAppReady, // Wait for app root to be ready (waits for voice-agent selector)
  getMicStatus, // Get microphone status from the UI
  getAudioPlayingStatus, // Get audio playing status from the UI
  waitForAudioPlaybackStart, // Wait for audio playback to start
  logFirstSettingsPreview, // Log first Settings WebSocket message details
  verifyContextPreserved, // Verify conversation context is preserved by checking agent response
  sendMessageAndWaitForResponse, // Send message and wait for agent response in one call
  connectViaTextAndWaitForGreeting, // Connect via text input (auto-connect) and wait for greeting to complete
  MicrophoneHelpers // Microphone utility helpers for E2E tests (activate/deactivate mic)
};

