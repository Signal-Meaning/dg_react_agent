/**
 * Issue #351: FunctionCallRequest Callback Not Being Invoked in Proxy Mode
 * 
 * Reproduction test for customer-reported issue where onFunctionCallRequest
 * callback is not being invoked when FunctionCallRequest messages are received
 * through backend proxy.
 * 
 * To run:
 *   1. Start mock proxy server: npm run test:proxy:server
 *   2. Run test: USE_PROXY_MODE=true npm run test:e2e -- issue-351-function-call-proxy-mode
 * 
 * Requirements:
 * - Real Deepgram API key (VITE_DEEPGRAM_API_KEY)
 * - Real OpenAI API key (VITE_OPENAI_API_KEY) for think provider
 * - Proxy server running (npm run test:proxy:server)
 */

import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  buildUrlWithParams
} from './helpers/test-helpers.mjs';
import {
  skipIfNoRealAPI,
  setupFunctionCallingTest,
  waitForFunctionCall,
  tryPromptsForFunctionCall,
} from './helpers/test-helpers.js';

const IS_PROXY_MODE = process.env.USE_PROXY_MODE === 'true';
const PROXY_ENDPOINT = process.env.VITE_PROXY_ENDPOINT || 'ws://localhost:8080/deepgram-proxy';

test.describe('Issue #351: FunctionCallRequest Callback in Proxy Mode', () => {
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
    });
    
    // Capture console logs for diagnostics
    await page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[FUNCTION]') || text.includes('[AGENT]')) {
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
      });
      await page.goto('about:blank');
      await page.waitForTimeout(500);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should invoke onFunctionCallRequest callback in proxy mode', async ({ page }) => {
    console.log('🧪 [Issue #351] Testing FunctionCallRequest callback in proxy mode...');
    
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
    // Use buildUrlWithParams which handles proxy mode configuration
    const testUrl = buildUrlWithParams(BASE_URL, { 
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
    console.log('✅ [Issue #351] Confirmed proxy mode:', connectionMode);
    
    // Wait for connection to be established
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
      console.error('❌ [Issue #351] Connection failed. Diagnostic info:', JSON.stringify(diagnosticInfo, null, 2));
      throw error;
    });
    
    // Wait for Settings to be applied
    await page.waitForFunction(() => {
      const settingsEl = document.querySelector('[data-testid="has-sent-settings"]');
      return settingsEl && settingsEl.textContent === 'true';
    }, { timeout: 20000 });
    
    console.log('✅ [Issue #351] Connection established and Settings applied');
    
    // Track function call requests
    const functionCallRequests = await page.evaluate(() => {
      return window.functionCallRequests || [];
    });
    
    // Send a message that should trigger a function call
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('What time is it?');
    await textInput.press('Enter');
    
    console.log('✅ [Issue #351] Message sent, waiting for FunctionCallRequest...');
    
    // Wait for function call request with extended timeout
    try {
      await page.waitForFunction(
        () => window.functionCallRequests && window.functionCallRequests.length > 0,
        { timeout: 45000 }
      );
      
      console.log('✅ [Issue #351] FunctionCallRequest received!');
      
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
      
      console.log('📊 [Issue #351] Function call info:', JSON.stringify(functionCallInfo, null, 2));
      
      // Verify function call was received
      expect(functionCallInfo.count).toBeGreaterThan(0);
      expect(functionCallInfo.trackerCount).toBeGreaterThan(0);
      
      // Verify the function call structure
      const functionCall = functionCallInfo.requests[0];
      expect(functionCall.id).toBeDefined();
      expect(functionCall.name).toBeDefined();
      expect(functionCall.client_side).toBe(true);
      
      console.log('✅ [Issue #351] Function call callback was invoked successfully!');
      
    } catch (error) {
      // If timeout, capture diagnostic information
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
      
      // Get console logs that might contain diagnostic information
      const consoleLogs = await page.evaluate(() => {
        // Try to get logs from window if available
        return window.consoleLogs || [];
      });
      
      console.error('❌ [Issue #351] Function call timeout. Diagnostic info:', JSON.stringify(diagnosticInfo, null, 2));
      if (consoleLogs.length > 0) {
        console.error('❌ [Issue #351] Console logs:', consoleLogs.slice(-20));
      }
      
      throw new Error(
        `FunctionCallRequest callback not invoked in proxy mode. ` +
        `Connection: "${diagnosticInfo.connectionStatus}", ` +
        `Requests: ${diagnosticInfo.functionCallRequestsCount}, ` +
        `Tracker: ${diagnosticInfo.trackerCount}, ` +
        `Handler: ${diagnosticInfo.hasFunctionHandler}`
      );
    }
  });
});

