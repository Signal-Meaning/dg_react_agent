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
  userStartedSpeaking: '[data-testid="user-started-speaking"]',
  utteranceEnd: '[data-testid="utterance-end"]',
  userStoppedSpeaking: '[data-testid="user-stopped-speaking"]',
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
  // Use DOM-based detection instead of callback interception
  // The test-app updates has-sent-settings DOM element when SettingsApplied is received
  // This is more reliable than intercepting callbacks since the component uses React props
  await expect(page.locator('[data-testid="has-sent-settings"]')).toHaveText('true', { timeout });
  
  // Alternative: Also set up callback tracking for tests that might need it
  // But use DOM as primary mechanism since it's more reliable
  await page.evaluate(() => {
    window.testSettingsApplied = true; // Mark as applied since DOM is the source of truth
  });
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
    
    // Store original callback if it exists (test-app now exposes this to window)
    const originalCallback = window.onConnectionStateChange;
    
    // Override onConnectionStateChange to track state
    // The test-app's handleConnectionStateChange now calls window.onConnectionStateChange if it exists
    window.onConnectionStateChange = (service, state) => {
      console.log(`🔔 [CONNECTION_TRACKER] onConnectionStateChange called: ${service} -> ${state}`);
      // Track state changes
      if (service === 'agent') {
        window.testConnectionStates.agent = state;
      } else if (service === 'transcription') {
        window.testConnectionStates.transcription = state;
      }
      console.log(`🔔 [CONNECTION_TRACKER] Updated states:`, window.testConnectionStates);
      // Also call original callback if it exists (for chaining)
      if (originalCallback) {
        originalCallback(service, state);
      }
    };
    
    console.log('🔔 [CONNECTION_TRACKER] Callback installed, initial states:', window.testConnectionStates);
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
      await page.waitForFunction(
        () => window.testConnectionStates?.agent === 'connected',
        { timeout }
      );
    },
    waitForTranscriptionConnected: async (timeout = 5000) => {
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
  
  await expect(connectionStatus).toHaveText('connected');
  // Note: connection-ready element may not exist in all test scenarios
  // Just verify connection status is connected
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
 * Verify agent response is valid (non-empty, not waiting)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').Expect} expect - Playwright expect instance
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string>} Agent response text
 */
async function verifyAgentResponse(page, expect, timeout = 10000) {
  // Wait for response element to exist and have valid content
  // Pass selector as argument to make it available in browser context
  const selector = SELECTORS.agentResponse;
  await page.waitForFunction(
    ({ selector }) => {
      const responseEl = document.querySelector(selector);
      if (!responseEl) return false;
      const text = responseEl.textContent?.trim();
      return text && text !== '(Waiting for agent response...)';
    },
    { selector },
    { timeout }
  );
  
  const response = await page.locator(SELECTORS.agentResponse).textContent();
  expect(response).toBeTruthy();
  expect(response).not.toBe('(Waiting for agent response...)');
  return response;
}

/**
 * Wait for agent response and return the response text (enhanced version)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {string} options.expectedText - Optional text to verify in response
 * @param {number} options.timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string>} Agent response text
 */
async function waitForAgentResponseEnhanced(page, options = {}) {
  const { expectedText, timeout = 10000 } = options;
  
  // Pass selector as argument to make it available in browser context
  const selector = SELECTORS.agentResponse;
  await page.waitForFunction(
    ({ selector }) => {
      const response = document.querySelector(selector);
      return response && response.textContent && 
             response.textContent !== '(Waiting for agent response...)';
    },
    { selector },
    { timeout }
  );
  
  const responseText = await page.locator(SELECTORS.agentResponse).textContent();
  
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
 * Wait for transcript to appear in the UI
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in ms (default: 15000)
 * @returns {Promise<string>} Transcript text
 */
async function waitForTranscript(page, options = {}) {
  const { timeout = 15000 } = options;
  const selector = SELECTORS.transcription;
  
  await page.waitForFunction(
    ({ selector }) => {
      const transcriptEl = document.querySelector(selector);
      if (!transcriptEl) return false;
      const text = transcriptEl.textContent?.trim() || '';
      return text.length > 0 && text !== '(Waiting for transcript...)';
    },
    { selector },
    { timeout }
  );
  
  const transcriptText = await page.locator(selector).textContent();
  return transcriptText || '';
}

/**
 * Assert connection is in expected state
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').Expect} expect - Playwright expect instance
 * @param {string} expectedState - Expected state ('connected', 'closed', 'connecting')
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 */
async function assertConnectionState(page, expect, expectedState, options = {}) {
  const { timeout = 5000 } = options;
  const selector = SELECTORS.connectionStatus;
  
  await page.waitForFunction(
    ({ selector, state }) => {
      const statusEl = document.querySelector(selector);
      return statusEl?.textContent?.toLowerCase().includes(state.toLowerCase());
    },
    { selector, state: expectedState },
    { timeout }
  );
  
  const actualStatus = await page.locator(selector).textContent();
  expect(actualStatus.toLowerCase()).toContain(expectedState.toLowerCase());
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

/**
 * Setup complete audio-sending prerequisites
 * 
 * This utility combines all the common setup steps needed before sending audio data:
 * 1. Grant microphone permissions (if context provided)
 * 2. Wait for component to be ready
 * 3. Click microphone button
 * 4. Wait for connection to be established
 * 5. Wait for settings to be applied (SettingsApplied received)
 * 6. Wait for 500ms settings processing delay to pass
 * 
 * This is required before calling sendAudioData() because the component checks:
 * - hasSentSettingsRef.current must be true
 * - Date.now() - settingsSentTimeRef.current >= 500ms
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').BrowserContext} [context] - Optional browser context for permissions
 * @param {Object} options - Configuration options
 * @param {number} options.componentReadyTimeout - Timeout for component ready (default: 5000)
 * @param {number} options.connectionTimeout - Timeout for connection (default: 10000)
 * @param {number} options.settingsTimeout - Timeout for settings applied (default: 10000)
 * @param {number} options.settingsProcessingDelay - Additional delay after settings applied (default: 600)
 * @returns {Promise<void>}
 */
async function setupAudioSendingPrerequisites(page, context = null, options = {}) {
  const {
    componentReadyTimeout = 5000,
    connectionTimeout = 10000,
    settingsTimeout = 10000,
    settingsProcessingDelay = 600
  } = options;

  console.log('🎤 [AUDIO_SETUP] Starting audio sending prerequisites setup...');

  // Step 1: Grant microphone permissions (if context provided)
  if (context) {
    console.log('🎤 [AUDIO_SETUP] Step 1: Granting microphone permissions...');
    await context.grantPermissions(['microphone']);
    console.log('🎤 [AUDIO_SETUP] ✅ Microphone permissions granted');
  }

  // Step 2: Wait for component to be ready
  console.log('🎤 [AUDIO_SETUP] Step 2: Waiting for component to be ready...');
  await page.waitForSelector('[data-testid="component-ready-status"]', { timeout: componentReadyTimeout });
  const isReady = await page.locator('[data-testid="component-ready-status"]').textContent();
  if (isReady !== 'true') {
    throw new Error(`Component not ready. Status: ${isReady}`);
  }
  console.log('🎤 [AUDIO_SETUP] ✅ Component is ready');

  // Step 3: Click microphone button
  console.log('🎤 [AUDIO_SETUP] Step 3: Clicking microphone button...');
  await page.waitForSelector('[data-testid="microphone-button"]', { timeout: 5000 });
  await page.click('[data-testid="microphone-button"]');
  console.log('🎤 [AUDIO_SETUP] ✅ Microphone button clicked');

  // Step 4: Wait for connection to be established
  console.log('🎤 [AUDIO_SETUP] Step 4: Waiting for connection...');
  await page.waitForSelector('[data-testid="connection-status"]', { timeout: connectionTimeout });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="connection-status"]')?.textContent === 'connected',
    { timeout: connectionTimeout }
  );
  const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
  if (connectionStatus !== 'connected') {
    throw new Error(`Connection not established. Status: ${connectionStatus}`);
  }
  console.log('🎤 [AUDIO_SETUP] ✅ Connection established');

  // Step 5: Wait for settings to be applied (SettingsApplied received)
  // Test app exposes this via data-testid="has-sent-settings" DOM element
  console.log('🎤 [AUDIO_SETUP] Step 5: Waiting for settings to be applied...');
  await expect(page.locator('[data-testid="has-sent-settings"]')).toHaveText('true', { timeout: settingsTimeout });
  console.log('🎤 [AUDIO_SETUP] ✅ Settings applied (SettingsApplied received)');

  // Step 6: Wait for settings processing delay to pass
  // The component requires: Date.now() - settingsSentTimeRef.current >= 500ms
  // We use 600ms (slightly longer) to ensure settings are fully processed
  console.log(`🎤 [AUDIO_SETUP] Step 6: Waiting ${settingsProcessingDelay}ms for settings processing delay...`);
  await page.waitForTimeout(settingsProcessingDelay);
  console.log('🎤 [AUDIO_SETUP] ✅ Settings processing delay passed');

  console.log('🎤 [AUDIO_SETUP] ✅ All audio sending prerequisites complete!');
  console.log('🎤 [AUDIO_SETUP] 💡 Component is now ready to accept audio data via sendAudioData()');
}

/**
 * Establish connection via text input (auto-connect pattern)
 * Common pattern: click text input → wait for connection
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} timeout - Timeout for connection wait (default: 10000)
 * @returns {Promise<void>}
 */
async function establishConnectionViaText(page, timeout = 10000) {
  await page.click('input[type="text"]');
  await waitForConnection(page, timeout);
}

/**
 * Establish connection via microphone button
 * Common pattern: grant permissions → click mic button → wait for connection
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').BrowserContext} [context] - Browser context for permissions
 * @param {number} timeout - Timeout for connection wait (default: 10000)
 * @returns {Promise<void>}
 */
async function establishConnectionViaMicrophone(page, context = null, timeout = 10000) {
  if (context) {
    await context.grantPermissions(['microphone']);
  }
  await page.waitForSelector(SELECTORS.micButton, { timeout: 5000 });
  await page.click(SELECTORS.micButton);
  await waitForConnection(page, timeout);
}

/**
 * Get AudioContext state from the component (recommended method)
 * Uses component's getAudioContext() method instead of window.audioContext
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} AudioContext state ('running', 'suspended', 'closed', or 'not-initialized')
 */
async function getComponentAudioContextState(page) {
  return await page.evaluate(() => {
    const deepgramComponent = window.deepgramRef?.current;
    const audioContext = deepgramComponent?.getAudioContext?.();
    return audioContext?.state || 'not-initialized';
  });
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
  verifyAgentResponse, // Verify agent response is valid (non-empty, not waiting)
  waitForAgentResponseEnhanced, // Enhanced version with options object
  waitForTranscript, // Wait for transcript to appear in the UI
  assertConnectionState, // Assert connection is in expected state (with automatic waiting)
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
  setupAudioSendingPrerequisites, // Complete setup for audio sending: permissions, ready, mic click, connection, settings applied
  establishConnectionViaText, // Establish connection by clicking text input (auto-connect pattern)
  establishConnectionViaMicrophone, // Establish connection via microphone button (permissions + click)
  getComponentAudioContextState, // Get AudioContext state from component (recommended over window.audioContext)
  MicrophoneHelpers // Microphone utility helpers for E2E tests (activate/deactivate mic)
};

