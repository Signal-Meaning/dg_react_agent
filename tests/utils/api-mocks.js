/**
 * API Test Mocks for Playwright E2E Tests
 * 
 * This module provides utilities for mocking Deepgram API responses
 * and WebSocket connections during testing.
 */

class APITestMocks {
  /**
   * Setup mock WebSocket for testing
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Object} options - Mock options
   */
  static async setupMockWebSocket(page, options = {}) {
    const {
      connectionDelay = 100,
      shouldFail = false,
      failAfter = 5000
    } = options;

    await page.addInitScript((connectionDelay, shouldFail, failAfter) => {
      // Mock WebSocket for testing
      class MockWebSocket {
        constructor(url) {
          this.url = url;
          this.readyState = WebSocket.CONNECTING;
          this.onopen = null;
          this.onclose = null;
          this.onerror = null;
          this.onmessage = null;
          
          // Simulate connection delay
          setTimeout(() => {
            if (shouldFail) {
              this.readyState = WebSocket.CLOSED;
              this.onerror?.(new Error('Connection failed'));
            } else {
              this.readyState = WebSocket.OPEN;
              this.onopen?.();
              
              // Simulate failure after specified time
              if (failAfter > 0) {
                setTimeout(() => {
                  this.readyState = WebSocket.CLOSED;
                  this.onclose?.();
                }, failAfter);
              }
            }
          }, connectionDelay);
        }

        send(data) {
          console.log('Mock WebSocket send:', data);
          
          // Simulate response based on data type
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'Settings') {
                // Simulate SettingsApplied response
                setTimeout(() => {
                  this.onmessage?.({
                    data: JSON.stringify({
                      type: 'SettingsApplied',
                      timestamp: new Date().toISOString()
                    })
                  });
                }, 100);
              }
            } catch (e) {
              // Not JSON, ignore
            }
          }
        }

        close() {
          this.readyState = WebSocket.CLOSED;
          this.onclose?.();
        }
      }

      window.WebSocket = MockWebSocket;
    }, connectionDelay, shouldFail, failAfter);
  }

  /**
   * Setup mock Deepgram API responses
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async setupMockDeepgramAPI(page) {
    await page.addInitScript(() => {
      // Mock Deepgram API responses
      window.mockDeepgramResponses = {
        settingsApplied: {
          type: 'SettingsApplied',
          timestamp: new Date().toISOString()
        },
        welcome: {
          type: 'Welcome',
          message: 'Hello! How can I help you today?'
        },
        agentResponse: {
          type: 'AgentResponse',
          text: 'I can help you with that!',
          metadata: {
            model: 'test-model',
            confidence: 0.95
          }
        },
        transcription: {
          type: 'Transcript',
          text: 'Test transcription',
          confidence: 0.95,
          timestamp: new Date().toISOString()
        },
        agentStartedSpeaking: {
          type: 'AgentStartedSpeaking',
          timestamp: new Date().toISOString()
        },
        agentAudioDone: {
          type: 'AgentAudioDone',
          timestamp: new Date().toISOString()
        }
      };

      // Mock fetch for API calls
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (url.includes('deepgram.com')) {
          return {
            ok: true,
            json: async () => window.mockDeepgramResponses.agentResponse,
            text: async () => JSON.stringify(window.mockDeepgramResponses.agentResponse)
          };
        }
        return originalFetch(url, options);
      };
    });
  }

  /**
   * Setup mock audio context
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async setupMockAudioContext(page) {
    await page.addInitScript(() => {
      // Mock AudioContext
      class MockAudioContext {
        constructor() {
          this.state = 'running';
          this.destination = { connect: () => {} };
        }

        createGain() {
          return {
            connect: () => {},
            gain: { setValueAtTime: () => {} }
          };
        }

        createMediaStreamSource() {
          return {
            connect: () => {},
            disconnect: () => {}
          };
        }

        createWorklet() {
          return Promise.resolve();
        }

        createBuffer() {
          return {
            getChannelData: () => new Float32Array(1024)
          };
        }

        createBufferSource() {
          return {
            connect: () => {},
            start: () => {},
            stop: () => {}
          };
        }
      }

      window.AudioContext = MockAudioContext;
      window.webkitAudioContext = MockAudioContext;
    });
  }

  /**
   * Setup mock media devices
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async setupMockMediaDevices(page) {
    await page.addInitScript(() => {
      // Mock media devices
      const mockStream = {
        getTracks: () => [{
          kind: 'audio',
          enabled: true,
          stop: () => {}
        }],
        getAudioTracks: () => [{
          kind: 'audio',
          enabled: true,
          stop: () => {}
        }]
      };

      navigator.mediaDevices = {
        getUserMedia: () => Promise.resolve(mockStream),
        enumerateDevices: () => Promise.resolve([
          {
            deviceId: 'default',
            kind: 'audioinput',
            label: 'Default Microphone'
          }
        ]),
        addEventListener: () => {},
        removeEventListener: () => {}
      };
    });
  }

  /**
   * Setup complete mock environment
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Object} options - Mock options
   */
  static async setupCompleteMockEnvironment(page, options = {}) {
    await this.setupMockWebSocket(page, options);
    await this.setupMockDeepgramAPI(page);
    await this.setupMockAudioContext(page);
    await this.setupMockMediaDevices(page);
  }

  /**
   * Simulate network disconnection
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async simulateNetworkDisconnection(page) {
    await page.context().setOffline(true);
  }

  /**
   * Simulate network reconnection
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async simulateNetworkReconnection(page) {
    await page.context().setOffline(false);
  }

  /**
   * Simulate API error
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} errorMessage - Error message to simulate
   */
  static async simulateAPIError(page, errorMessage = 'API Error') {
    await page.addInitScript((errorMessage) => {
      // Override fetch to return error
      window.fetch = async () => {
        throw new Error(errorMessage);
      };
    }, errorMessage);
  }

  /**
   * Simulate slow API response
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} delay - Delay in milliseconds
   */
  static async simulateSlowAPIResponse(page, delay = 5000) {
    await page.addInitScript((delay) => {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return originalFetch(...args);
      };
    }, delay);
  }

  /**
   * Setup test data
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async setupTestData(page) {
    await page.addInitScript(() => {
      window.testData = {
        conversations: [
          {
            user: 'Hello',
            agent: 'Hi! How can I help you today?'
          },
          {
            user: 'What products do you have?',
            agent: 'We have a wide range of products including electronics, clothing, and home goods.'
          },
          {
            user: 'Tell me about electronics',
            agent: 'Our electronics section includes smartphones, laptops, tablets, and accessories.'
          }
        ],
        audioFiles: {
          greeting: './fixtures/test-audio/greeting.wav',
          userResponse: './fixtures/test-audio/user-response.wav',
          bargeIn: './fixtures/test-audio/barge-in.wav'
        }
      };
    });
  }
}

module.exports = APITestMocks;
