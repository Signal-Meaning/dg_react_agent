/**
 * E2E Test Helpers
 * 
 * Shared utilities for Playwright E2E tests to promote DRY principles
 * and consistent testing patterns across the test suite.
 */

/**
 * Common test selectors
 */
export const SELECTORS = {
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
export async function setupTestPage(page: any, timeout = 10000) {
  await page.goto('/');
  await page.waitForSelector(SELECTORS.voiceAgent, { timeout });
}

/**
 * Wait for connection to be established (auto-connect)
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 5000)
 */
export async function waitForConnection(page: any, timeout = 5000) {
  const connectionReady = page.locator(SELECTORS.connectionReady);
  await connectionReady.waitFor({ state: 'visible', timeout });
  await page.waitForFunction(
    (selector: string) => document.querySelector(selector)?.textContent === 'true',
    SELECTORS.connectionReady,
    { timeout }
  );
}

/**
 * Wait for agent to finish greeting
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in ms (default: 8000)
 */
export async function waitForAgentGreeting(page: any, timeout = 8000) {
  const greetingSent = page.locator(SELECTORS.greetingSent);
  await page.waitForFunction(
    (selector: string) => {
      const element = document.querySelector(selector);
      const text = element?.textContent || '';
      return text.includes('Agent finished speaking') || text.includes('ready for interaction');
    },
    SELECTORS.greetingSent,
    { timeout }
  );
}

/**
 * Send a text message through the UI
 * @param {import('@playwright/test').Page} page
 * @param {string} message - The message to send
 * @returns {Promise<void>}
 */
export async function sendTextMessage(page: any, message: string) {
  const textInput = page.locator(SELECTORS.textInput);
  const sendButton = page.locator(SELECTORS.sendButton);
  
  await textInput.fill(message);
  await sendButton.click();
  
  // Wait for input to clear (confirms send)
  await textInput.waitFor({ state: 'visible', timeout: 1000 });
  await page.waitForFunction(
    (selector: string) => (document.querySelector(selector) as HTMLInputElement)?.value === '',
    SELECTORS.textInput,
    { timeout: 1000 }
  );
}

/**
 * Install WebSocket message capture in the browser context
 * @param {import('@playwright/test').Page} page
 */
export async function installWebSocketCapture(page: any) {
  await page.addInitScript(() => {
    // Extend window interface for our custom properties
    interface WindowWithWebSocketCapture extends Window {
      capturedWebSocketUrl?: string;
      capturedWebSocketProtocols?: string | string[];
      capturedSentMessages?: Array<{timestamp: string, type: string, data?: any, size?: number}>;
      capturedReceivedMessages?: Array<{timestamp: string, type: string, data?: any, size?: number}>;
    }
    
    const windowWithCapture = window as WindowWithWebSocketCapture;
    
    const OriginalWebSocket = window.WebSocket;
    (window as any).WebSocket = function(url: any, protocols: any) {
      console.log('WebSocket created:', { url, protocols });
      windowWithCapture.capturedWebSocketUrl = url;
      windowWithCapture.capturedWebSocketProtocols = protocols;
      
      const ws = new OriginalWebSocket(url, protocols);
      const originalSend = ws.send;
      
      // Capture sent messages
      ws.send = function(data) {
        try {
          const parsed = JSON.parse(data as string);
          windowWithCapture.capturedSentMessages = windowWithCapture.capturedSentMessages || [];
          windowWithCapture.capturedSentMessages.push({
            timestamp: new Date().toISOString(),
            type: parsed.type,
            data: parsed
          });
          console.log('WebSocket send:', parsed.type, parsed);
        } catch (e) {
          // Not JSON, might be binary audio data
          windowWithCapture.capturedSentMessages = windowWithCapture.capturedSentMessages || [];
          windowWithCapture.capturedSentMessages.push({
            timestamp: new Date().toISOString(),
            type: 'binary',
            size: (data as any).byteLength || (data as any).length
          });
        }
        return originalSend.call(this, data);
      };
      
      // Capture received messages
      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          windowWithCapture.capturedReceivedMessages = windowWithCapture.capturedReceivedMessages || [];
          windowWithCapture.capturedReceivedMessages.push({
            timestamp: new Date().toISOString(),
            type: parsed.type,
            data: parsed
          });
          console.log('WebSocket receive:', parsed.type, parsed);
        } catch (e) {
          // Binary data
          windowWithCapture.capturedReceivedMessages = windowWithCapture.capturedReceivedMessages || [];
          windowWithCapture.capturedReceivedMessages.push({
            timestamp: new Date().toISOString(),
            type: 'binary',
            size: (event.data as any).byteLength || (event.data as any).length
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
export async function getCapturedWebSocketData(page: any) {
  return await page.evaluate(() => {
    const windowWithCapture = window as any;
    return {
      url: windowWithCapture.capturedWebSocketUrl,
      protocols: windowWithCapture.capturedWebSocketProtocols,
      sent: windowWithCapture.capturedSentMessages || [],
      received: windowWithCapture.capturedReceivedMessages || []
    };
  });
}

/**
 * Install a mock WebSocket for testing without real API
 * @param {import('@playwright/test').BrowserContext} context
 */
export async function installMockWebSocket(context: any) {
  await context.addInitScript(() => {
    console.log('🔧 Installing WebSocket mock...');
    
    // Extend window interface for our custom properties
    interface WindowWithWebSocketCapture extends Window {
      capturedWebSocketUrl?: string;
      capturedWebSocketProtocols?: string | string[];
      capturedSentMessages?: Array<{timestamp: string, type: string, data?: any, size?: number}>;
      capturedReceivedMessages?: Array<{timestamp: string, type: string, data?: any, size?: number}>;
    }
    
    const windowWithCapture = window as WindowWithWebSocketCapture;
    
    // Store original WebSocket
    const OriginalWebSocket = window.WebSocket;
    let mockWs = null;
    
    // Create mock WebSocket
    class MockWebSocket extends EventTarget {
      url: string;
      protocols: string | string[];
      readyState: number;
      bufferedAmount: number;
      extensions: string;
      protocol: string;
      binaryType: string;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string, protocols?: string | string[]) {
        super();
        console.log('🎭 MockWebSocket created:', url, protocols);
        mockWs = this;
        this.url = url;
        this.protocols = protocols || '';
        this.readyState = 0; // CONNECTING
        this.bufferedAmount = 0;
        this.extensions = '';
        this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
        this.binaryType = 'arraybuffer';
        
        // Simulate connection
        setTimeout(() => {
          this.readyState = 1; // OPEN
          console.log('🎭 Mock WebSocket opened');
          if (this.onopen) this.onopen({ type: 'open' } as Event);
          
          // Send mock Welcome message
          setTimeout(() => {
            const welcomeMsg = JSON.stringify({
              type: 'Welcome',
              request_id: 'mock-request-id-12345'
            });
            console.log('🎭 Mock sending Welcome:', welcomeMsg);
            if (this.onmessage) {
              this.onmessage({ data: welcomeMsg, type: 'message' } as MessageEvent);
            }
            
            // Send SettingsApplied
            setTimeout(() => {
              const settingsMsg = JSON.stringify({ type: 'SettingsApplied' });
              console.log('🎭 Mock sending SettingsApplied');
              if (this.onmessage) {
                this.onmessage({ data: settingsMsg, type: 'message' } as MessageEvent);
              }
            }, 100);
          }, 100);
        }, 100);
      }
      
      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        console.log('🎭 Mock WebSocket send:', typeof data === 'string' ? data.substring(0, 100) : 'binary');
        
        // Simulate response to text message
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'UserText') {
              // Send mock agent response
              setTimeout(() => {
                const responseMsg = JSON.stringify({
                  type: 'ConversationText',
                  role: 'assistant',
                  content: '[MOCK] I received your message: "' + parsed.content + '". How can I help you with that?'
                });
                console.log('🎭 Mock sending agent response');
                if (this.onmessage) {
                  this.onmessage({ data: responseMsg, type: 'message' } as MessageEvent);
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
        if (this.onclose) this.onclose({ type: 'close', code: 1000, reason: 'Normal closure' } as CloseEvent);
      }
      
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        super.addEventListener(type, listener);
      }
      
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        super.removeEventListener(type, listener);
      }
    }
    
    // Mock static constants
    (MockWebSocket as any).CONNECTING = 0;
    (MockWebSocket as any).OPEN = 1;
    (MockWebSocket as any).CLOSING = 2;
    (MockWebSocket as any).CLOSED = 3;
    
    // Replace global WebSocket
    (window as any).WebSocket = MockWebSocket;
    console.log('✅ WebSocket mock installed');
  });
}

/**
 * Common assertions for connection state
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').expect} expect
 */
export async function assertConnectionHealthy(page: any, expect: any) {
  const connectionStatus = page.locator(SELECTORS.connectionStatus);
  const connectionReady = page.locator(SELECTORS.connectionReady);
  
  await expect(connectionStatus).toHaveText('connected');
  await expect(connectionReady).toHaveText('true');
}

// All exports are now individual named exports above

