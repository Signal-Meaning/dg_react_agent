/**
 * Issue #353: Component Should Handle Binary JSON Messages (Blob Tests)
 * 
 * E2E test to verify that the component correctly handles FunctionCallRequest messages
 * when they arrive as binary WebSocket messages (Blob) instead of text messages.
 * 
 * This test simulates Deepgram's behavior of sending FunctionCallRequest as binary JSON.
 * 
 * Note: ArrayBuffer binary JSON tests are in Jest unit tests (tests/websocket-binary-json.test.ts)
 * because ArrayBuffer works fine in jsdom. Blob tests require real browser APIs, so they're here.
 * 
 * To run:
 *   1. Start mock proxy server: npm run test:proxy:server
 *   2. Run test: USE_PROXY_MODE=true npm run test:e2e -- issue-353-binary-json-messages
 * 
 * Requirements:
 * - Real Deepgram API key (VITE_DEEPGRAM_API_KEY)
 * - Real OpenAI API key (VITE_OPENAI_API_KEY) for think provider
 * - Proxy server running (npm run test:proxy:server)
 */

import { test, expect } from '@playwright/test';
import {
  pathWithQuery,
  getDeepgramProxyParams
} from './helpers/test-helpers.mjs';
import {
  skipIfNoRealAPI,
  setupFunctionCallingTest,
  waitForFunctionCall,
  tryPromptsForFunctionCall,
} from './helpers/test-helpers.js';

const IS_PROXY_MODE = process.env.USE_PROXY_MODE === 'true';
const PROXY_ENDPOINT = getDeepgramProxyParams().proxyEndpoint;

test.describe('Issue #353: Binary JSON Message Handling', () => {
  test.beforeEach(async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for function calling tests');
    
    // Skip if not in proxy mode
    if (!IS_PROXY_MODE) {
      test.skip(true, 'This test requires proxy mode. Run with USE_PROXY_MODE=true');
      return;
    }
    
    // Verify proxy server is running
    const proxyRunning = await page.evaluate(async (endpoint) => {
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket(endpoint);
          const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 2000);
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
          };
          ws.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
          };
        } catch (error) {
          resolve(false);
        }
      });
    }, PROXY_ENDPOINT);
    
    if (!proxyRunning) {
      test.skip(true, `Proxy server is not running at ${PROXY_ENDPOINT}. Start it with: npm run test:proxy:server`);
      return;
    }
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Enable test mode BEFORE navigation
    await page.addInitScript(() => {
      window.__DEEPGRAM_TEST_MODE__ = true;
      window.__BINARY_JSON_TEST_MODE__ = true; // Flag for binary JSON test
    });
    
    // Install WebSocket interceptor to convert FunctionCallRequest to binary
    // Intercept at the message level after connection is established
    await page.addInitScript(() => {
      // Store original WebSocket
      const OriginalWebSocket = window.WebSocket;
      
      /**
       * Helper function to convert FunctionCallRequest to binary Blob format.
       * Returns a new MessageEvent with binary Blob data if the event contains
       * a FunctionCallRequest, otherwise returns null.
       * 
       * @param {MessageEvent} event - The original message event
       * @returns {MessageEvent|null} - Binary event if FunctionCallRequest, null otherwise
       */
      const convertFunctionCallRequestToBinary = (event) => {
        if (typeof event.data === 'string') {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'FunctionCallRequest') {
              console.log('🔧 [Issue #353] Converting FunctionCallRequest to binary format');
              
              // Convert text JSON to binary Blob
              const blob = new Blob([event.data], { type: 'application/json' });
              
              // Create new event with binary data
              return new MessageEvent('message', {
                data: blob,
                origin: event.origin,
                lastEventId: event.lastEventId,
                source: event.source,
                ports: event.ports
              });
            }
          } catch (e) {
            // Not JSON, continue with normal handling
          }
        }
        return null; // Not a FunctionCallRequest
      };
      
      // Intercept WebSocket creation for proxy endpoint
      window.WebSocket = function(url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        
        // Only intercept proxy endpoint connections
        if (url && url.includes('deepgram-proxy')) {
          console.log('🔧 [Issue #353] Intercepting WebSocket for binary JSON test');
          
          // Wrap addEventListener to intercept message events
          const originalAddEventListener = ws.addEventListener.bind(ws);
          ws.addEventListener = function(type, listener, options) {
            if (type === 'message') {
              // Wrap the listener to intercept FunctionCallRequest
              const wrappedListener = (event) => {
                const binaryEvent = convertFunctionCallRequestToBinary(event);
                if (binaryEvent) {
                  // Call wrapped listener with binary event
                  listener(binaryEvent);
                  return;
                }
                
                // For non-FunctionCallRequest messages, call original listener
                listener(event);
              };
              
              return originalAddEventListener(type, wrappedListener, options);
            }
            
            // For other event types, use original addEventListener
            return originalAddEventListener(type, listener, options);
          };
          
          // Also wrap onmessage property setter/getter
          let onmessageHandler = null;
          Object.defineProperty(ws, 'onmessage', {
            get: function() {
              return onmessageHandler;
            },
            set: function(handler) {
              onmessageHandler = handler;
              if (handler) {
                // Wrap handler to intercept FunctionCallRequest
                originalAddEventListener('message', (event) => {
                  const binaryEvent = convertFunctionCallRequestToBinary(event);
                  if (binaryEvent) {
                    // Call handler with binary event
                    handler.call(this, binaryEvent);
                    return;
                  }
                  
                  // For non-FunctionCallRequest messages, call original handler
                  handler.call(this, event);
                });
              } else {
                // Remove listener if handler is set to null
                // Note: This is a simplified approach - in practice, we'd need to track listeners
              }
            },
            configurable: true,
            enumerable: true
          });
        }
        
        return ws;
      };
      
      // Copy static properties and constants
      Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
      window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
      window.WebSocket.OPEN = OriginalWebSocket.OPEN;
      window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
      window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
    });
    
    // Capture console logs for diagnostics
    await page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[Issue #353]') || text.includes('[FUNCTION]') || text.includes('[AUDIO EVENT]')) {
        console.log(`[Browser Console] ${text}`);
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up
    try {
      await page.evaluate(() => {
        if (window.deepgramRef?.current) {
          window.deepgramRef.current.stop?.();
        }
        if (window.__DEEPGRAM_LAST_SETTINGS__) {
          delete window.__DEEPGRAM_LAST_SETTINGS__;
        }
        if (window.__DEEPGRAM_LAST_FUNCTIONS__) {
          delete window.__DEEPGRAM_LAST_FUNCTIONS__;
        }
        if (window.__DEEPGRAM_TEST_MODE__) {
          delete window.__DEEPGRAM_TEST_MODE__;
        }
        if (window.__BINARY_JSON_TEST_MODE__) {
          delete window.__BINARY_JSON_TEST_MODE__;
        }
      });
      await page.goto('about:blank');
      await page.waitForTimeout(500);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should handle FunctionCallRequest when sent as binary JSON message', async ({ page }) => {
    console.log('🧪 [Issue #353] Testing binary JSON FunctionCallRequest handling...');
    
    // Set up function calling test infrastructure
    await setupFunctionCallingTest(page, {
      handler: (functionName, args) => {
        const timezone = args.timezone || 'UTC';
        const now = new Date();
        return {
          success: true,
          time: now.toLocaleString('en-US', { 
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }),
          timezone: timezone,
          timestamp: now.toISOString()
        };
      }
    });
    
    // Navigate to test app with proxy mode and debug enabled
    const testUrl = pathWithQuery({ 
      'test-mode': 'true',
      'enable-function-calling': 'true',
      'debug': 'true'
    });
    await page.goto(testUrl);
    
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 15000 });
    
    // Wait for connection mode to be set
    await page.waitForFunction(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl && modeEl.textContent?.includes('proxy');
    }, { timeout: 5000 });
    
    // Verify we're in proxy mode
    const connectionMode = await page.locator('[data-testid="connection-mode"]').textContent();
    expect(connectionMode).toContain('proxy');
    console.log('✅ [Issue #353] Confirmed proxy mode:', connectionMode);
    
    // Wait for text input to be ready and focusable before triggering auto-connect
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    
    // Focus text input to trigger auto-connect
    await textInput.focus();
    
    // Wait for connection status element to appear
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Wait for connection to transition from "closed" to "connecting" to "connected"
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status !== 'closed';
    }, { timeout: 10000 });
    
    // Now wait for connection to be fully established
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent?.toLowerCase().includes('connected');
    }, { timeout: 20000 }).catch(async (error) => {
      // Capture diagnostic info if connection fails
      const diagnosticInfo = await page.evaluate(() => {
        return {
          connectionStatus: document.querySelector('[data-testid="connection-status"]')?.textContent || 'not found',
          connectionMode: document.querySelector('[data-testid="connection-mode"]')?.textContent || 'not found',
        };
      });
      console.error('❌ [Issue #353] Connection failed. Diagnostic info:', JSON.stringify(diagnosticInfo, null, 2));
      throw error;
    });
    
    // Wait for Settings to be applied
    await page.waitForFunction(() => {
      const settingsEl = document.querySelector('[data-testid="has-sent-settings"]');
      return settingsEl && settingsEl.textContent === 'true';
    }, { timeout: 20000 });
    
    console.log('✅ [Issue #353] Connection established and Settings applied');
    
    // Send a message that should trigger a function call
    await textInput.fill('What time is it?');
    await textInput.press('Enter');
    
    console.log('✅ [Issue #353] Message sent, waiting for FunctionCallRequest (as binary JSON)...');
    
    // Wait for function call request with extended timeout
    // With the fix implemented, this test should now PASS - the component handles binary JSON
    try {
      await page.waitForFunction(
        () => window.functionCallRequests && window.functionCallRequests.length > 0,
        { timeout: 45000 }
      );
      
      console.log('✅ [Issue #353] FunctionCallRequest received and callback invoked!');
      
      // Get function call details
      const functionCallInfo = await page.evaluate(() => {
        return {
          count: (window.functionCallRequests || []).length,
          requests: window.functionCallRequests || [],
          trackerCount: parseInt(document.querySelector('[data-testid="function-call-tracker"]')?.textContent || '0'),
          hasHandler: typeof window.handleFunctionCall === 'function',
          hasTestHandler: typeof window.testFunctionHandler === 'function',
        };
      });
      
      console.log('📊 [Issue #353] Function call info:', JSON.stringify(functionCallInfo, null, 2));
      
      // Verify function call was received
      expect(functionCallInfo.count).toBeGreaterThan(0);
      expect(functionCallInfo.trackerCount).toBeGreaterThan(0);
      
      // Verify the function call structure
      const functionCall = functionCallInfo.requests[0];
      expect(functionCall.id).toBeDefined();
      expect(functionCall.name).toBeDefined();
      expect(functionCall.client_side).toBe(true);
      
      console.log('✅ [Issue #353] Binary JSON FunctionCallRequest was handled correctly!');
      
    } catch (error) {
      // If this fails, capture diagnostic information
      const diagnosticInfo = await page.evaluate(() => {
        return {
          connectionStatus: document.querySelector('[data-testid="connection-status"]')?.textContent || 'not found',
          functionCallRequestsCount: (window.functionCallRequests || []).length,
          trackerCount: parseInt(document.querySelector('[data-testid="function-call-tracker"]')?.textContent || '0'),
          hasFunctionHandler: typeof window.handleFunctionCall === 'function',
          hasTestFunctionHandler: typeof window.testFunctionHandler === 'function',
          agentResponse: document.querySelector('[data-testid="agent-response"]')?.textContent || 'not found',
          hasSentSettings: document.querySelector('[data-testid="has-sent-settings"]')?.textContent || 'not found',
        };
      });
      
      console.error('❌ [Issue #353] Function call timeout. Diagnostic info:', JSON.stringify(diagnosticInfo, null, 2));
      
      // Verify that the message was received as binary (this confirms our test setup works)
      const binaryMessageReceived = await page.evaluate(() => {
        // Check if we can find evidence that binary message was received
        return window.__BINARY_JSON_TEST_MODE__ === true;
      });
      
      expect(binaryMessageReceived).toBe(true);
      
      // Re-throw with diagnostic info
      throw new Error(
        `FunctionCallRequest callback not invoked when message arrives as binary JSON. ` +
        `Connection: "${diagnosticInfo.connectionStatus}", ` +
        `Requests: ${diagnosticInfo.functionCallRequestsCount}, ` +
        `Tracker: ${diagnosticInfo.trackerCount}, ` +
        `Handler: ${diagnosticInfo.hasFunctionHandler}`
      );
    }
  });
});

