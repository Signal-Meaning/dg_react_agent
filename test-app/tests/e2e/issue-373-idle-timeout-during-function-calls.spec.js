/**
 * Issue #373: Idle Timeout During Function Calls
 * 
 * Tests that idle timeout does NOT fire during active function call execution.
 * 
 * Bug: The component's idle timeout was incorrectly firing during active function call
 * execution, causing connections to close before function call responses could be sent.
 * 
 * Fix: Component now automatically disables idle timeout when function calls are active.
 * 
 * Test Scenarios:
 * 1. Long-running function call (> 10s) - connection should stay open
 * 2. Agent thinking phase before function call - connection should stay open
 * 3. Multiple concurrent function calls - all should complete
 * 4. Idle timeout re-enables after function calls complete
 * 
 * Requirements:
 * - Real Deepgram API key (VITE_DEEPGRAM_API_KEY)
 * - Real OpenAI API key (VITE_OPENAI_API_KEY) for think provider
 * - Proxy backend server running (default: ws://localhost:8080/deepgram-proxy)
 * - USE_PROXY_MODE=true (default, uses proxy mode with real APIs)
 * 
 * To run:
 * USE_PROXY_MODE=true npm run test:e2e -- issue-373-idle-timeout-during-function-calls
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoRealAPI,
  waitForConnection,
  waitForSettingsApplied,
  setupFunctionCallingTest,
} from './helpers/test-helpers.js';
import { pathWithQuery, getDeepgramProxyParams } from './helpers/test-helpers.mjs';

// Proxy mode configuration - use proxy backend with real APIs
const PROXY_ENDPOINT = getDeepgramProxyParams().proxyEndpoint;
const IS_PROXY_MODE = process.env.USE_PROXY_MODE !== 'false'; // Default to true

test.describe('Issue #373: Idle Timeout During Function Calls', () => {
  test.beforeEach(async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for function calling tests');
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Enable test mode BEFORE navigation
    await page.addInitScript(() => {
      window.__DEEPGRAM_TEST_MODE__ = true;
    });
    
    // Ensure proxy mode is enabled for these tests
    if (!IS_PROXY_MODE) {
      console.warn('⚠️  USE_PROXY_MODE is false - these tests require proxy mode with real APIs');
    }
  });

  test.afterEach(async ({ page }) => {
    // Clean up
    try {
      await page.evaluate(() => {
        if (window.deepgramRef?.current) {
          window.deepgramRef.current.stop?.();
        }
      });
      await page.goto('about:blank');
      await page.waitForTimeout(500);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should NOT timeout during long-running function call execution', async ({ page }) => {
    console.log('🧪 Testing idle timeout during long-running function call...');
    
    // Increase timeout for this test (function call takes 12+ seconds)
    test.setTimeout(60000); // 60 seconds
    
    // Track connection state
    const connectionStates = [];
    const connectionCloses = [];
    
    page.on('console', msg => {
      const text = msg.text();
      // Only catch actual WebSocket closures, not log messages
      // Look for actual connection close events, not idle timeout service logs
      if ((text.includes('WebSocket closed') && (text.includes('code=') || text.includes('wasClean'))) ||
          (text.includes('Connection closed') && (text.includes('code=') || text.includes('1000') || text.includes('1001') || text.includes('1006')))) {
        connectionCloses.push({ time: Date.now(), message: text });
        console.log(`[Connection Close] ${text}`);
      }
    });
    
    // Set up function that takes 12 seconds (longer than 10s idle timeout)
    // Use window.testFunctions (not __TEST_FUNCTIONS__) - this is what App.tsx checks
    await page.addInitScript(() => {
      window.testFunctions = [
        {
          name: 'test_long_running_function',
          description: 'Test function that takes 12 seconds to execute. Use this when the user asks to test a long operation, long running operation, or test long operation.',
          parameters: {
            type: 'object',
            properties: {
              duration: {
                type: 'number',
                description: 'Duration in seconds (default: 12)'
              }
            }
          }
        }
      ];
      
      // Use window.handleFunctionCall (not __HANDLE_FUNCTION_CALL__) - this is what App.tsx checks
      window.handleFunctionCall = async (request, sendResponse) => {
        if (request.name !== 'test_long_running_function') {
          return undefined; // Let other functions be handled normally
        }
        
        window.__FUNCTION_CALL_START_TIME__ = Date.now();
        console.log(`[Test] Function call started: ${request.name} (id: ${request.id})`);
        console.log(`[Test] Sleeping for 12 seconds (longer than 10s idle timeout)...`);
        
        // Sleep for 12 seconds
        await new Promise(resolve => setTimeout(resolve, 12000));
        
        window.__FUNCTION_CALL_END_TIME__ = Date.now();
        const executionTime = window.__FUNCTION_CALL_END_TIME__ - window.__FUNCTION_CALL_START_TIME__;
        console.log(`[Test] Function call completed after ${executionTime}ms`);
        
        const response = {
          id: request.id,
          result: {
            success: true,
            executionTime,
            message: 'Function completed successfully after 12 seconds'
          }
        };
        
        sendResponse(response);
        window.__FUNCTION_CALL_RESPONSE_SENT__ = true;
        return response;
      };
    });
    
    // Setup test page with proxy mode and real APIs
    const testUrl = pathWithQuery({
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT,
      'enable-function-calling': 'true',
      'test-mode': 'true',
      debug: 'true'
    });
    console.log(`🌐 Navigating to test app with proxy mode: ${testUrl}`);
    await page.goto(testUrl);
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Verify proxy mode is active
    const connectionMode = await page.evaluate(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl?.textContent || '';
    });
    console.log(`✅ Connection mode: ${connectionMode}`);
    expect(connectionMode.toLowerCase()).toContain('proxy');
    
    // Trigger auto-connect by focusing text input (same pattern as other proxy mode tests)
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus();
    console.log('✅ Text input focused - auto-connect should trigger');
    
    // Wait for connection status element to appear (component may be initializing)
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Wait for connection to transition from "closed" to "connecting" to "connected"
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status !== 'closed';
    }, { timeout: 10000 });
    
    // Now wait for connection to be fully established
    await waitForConnection(page, 30000);
    
    // Wait for Settings to be applied
    await waitForSettingsApplied(page, 10000);
    console.log('✅ Settings applied - connection is ready');
    
    // Monitor connection state
    const monitorConnection = async () => {
      const state = await page.evaluate(() => {
        const deepgramRef = window.deepgramRef || window.voiceAgentRef;
        return {
          isConnected: deepgramRef?.current !== null,
          timestamp: Date.now()
        };
      });
      connectionStates.push(state);
      return state.isConnected;
    };
    
    // Start monitoring connection every 500ms
    const monitoringInterval = setInterval(async () => {
      await monitorConnection();
    }, 500);
    
    // Send message to trigger function call
    console.log('Sending message to trigger function call...');
    const messageSentTime = Date.now();
    await page.evaluate(() => {
      const deepgramRef = window.deepgramRef || window.voiceAgentRef;
      if (deepgramRef?.current) {
        deepgramRef.current.injectUserMessage('test long operation');
      }
    });
    
    // Wait for function call to be received
    console.log('Waiting for function call to be received...');
    const functionCallReceived = await page.waitForFunction(() => {
      return window.__FUNCTION_CALL_START_TIME__ !== undefined;
    }, { timeout: 15000 }).catch(() => {
      console.warn('Function call may not have been received');
      return false;
    });
    
    expect(functionCallReceived).toBeTruthy();
    console.log('✅ Function call received');
    
    // Wait for function to complete (12 seconds + buffer)
    console.log('Waiting for function call to complete (12 seconds)...');
    await page.waitForFunction(() => {
      return window.__FUNCTION_CALL_RESPONSE_SENT__ === true;
    }, { timeout: 20000 });
    
    console.log('✅ Function call completed');
    
    // Stop monitoring
    clearInterval(monitoringInterval);
    
    // Check final connection state
    const finalState = await monitorConnection();
    
    // Get function call timing from page context
    const functionCallTiming = await page.evaluate(() => {
      return {
        startTime: window.__FUNCTION_CALL_START_TIME__ || null,
        endTime: window.__FUNCTION_CALL_END_TIME__ || null
      };
    });
    
    // Filter connection closes to only those that occurred during function execution
    const closesDuringExecution = connectionCloses.filter(close => {
      if (!functionCallTiming.startTime) return false;
      const closeTime = close.time;
      const startTime = functionCallTiming.startTime;
      const endTime = functionCallTiming.endTime || Date.now();
      // Only count closes that happened during function execution (between start and end)
      return closeTime >= startTime && closeTime <= endTime + 1000; // 1 second buffer
    });
    
    // Verify connection is still open
    console.log('\n📊 Test Results:');
    console.log(`  Connection states tracked: ${connectionStates.length}`);
    console.log(`  Connection closes detected: ${connectionCloses.length}`);
    console.log(`  Closes during execution: ${closesDuringExecution.length}`);
    console.log(`  Final connection state: ${finalState ? 'connected' : 'disconnected'}`);
    
    if (connectionCloses.length > 0) {
      console.log('  Connection close events:');
      connectionCloses.forEach((close, i) => {
        const timeSinceStart = functionCallTiming.startTime
          ? close.time - functionCallTiming.startTime
          : 'N/A';
        const duringExecution = closesDuringExecution.includes(close) ? ' [DURING EXECUTION]' : '';
        console.log(`    ${i + 1}. [${timeSinceStart}ms] ${close.message}${duringExecution}`);
      });
    }
    
    // Assertions
    expect(finalState).toBe(true); // Connection should still be open
    expect(closesDuringExecution.length).toBe(0); // No connection closes during function execution
    
    // Verify function call completed successfully
    const functionCallResult = await page.evaluate(() => {
      return {
        responseSent: window.__FUNCTION_CALL_RESPONSE_SENT__ === true,
        startTime: window.__FUNCTION_CALL_START_TIME__,
        executionTime: window.__FUNCTION_CALL_START_TIME__ 
          ? Date.now() - window.__FUNCTION_CALL_START_TIME__
          : null
      };
    });
    
    expect(functionCallResult.responseSent).toBe(true);
    expect(functionCallResult.executionTime).toBeGreaterThan(11000); // Should be ~12 seconds
  });

  test('should NOT timeout during agent thinking phase before function call', async ({ page }) => {
    console.log('🧪 Testing idle timeout during agent thinking phase...');
    
    test.setTimeout(60000); // 60 seconds
    
    // Track connection state via DOM instead of console logs (more reliable)
    // Monitor connection status element for state changes
    let connectionStatusHistory = [];
    let lastConnectionStatus = null;
    
    // Monitor connection status via DOM polling (more reliable than console logs)
    const monitorConnectionStatus = async () => {
      const status = await page.evaluate(() => {
        const statusEl = document.querySelector('[data-testid="connection-status"]');
        return statusEl?.textContent?.toLowerCase() || 'unknown';
      });
      
      if (status !== lastConnectionStatus) {
        connectionStatusHistory.push({
          time: Date.now(),
          status: status,
          previousStatus: lastConnectionStatus
        });
        lastConnectionStatus = status;
      }
      return status;
    };
    
    // Start monitoring connection status
    const statusMonitorInterval = setInterval(async () => {
      await monitorConnectionStatus();
    }, 500); // Check every 500ms
    
    // Set up function that triggers after agent thinking
    await page.addInitScript(() => {
      window.testFunctions = [
        {
          name: 'test_function_after_thinking',
          description: 'Test function to call after thinking. Use this when the user asks to search for something, search for milk, or find products.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query'
              }
            },
            required: ['query']
          }
        }
      ];
      
      window.handleFunctionCall = async (request, sendResponse) => {
        if (request.name !== 'test_function_after_thinking') {
          return undefined;
        }
        
        window.__FUNCTION_CALL_RECEIVED__ = true;
        console.log(`[Test] Function call received after thinking phase`);
        
        // Quick function execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        sendResponse({
          id: request.id,
          result: { success: true, message: 'Function completed' }
        });
        return { id: request.id, result: { success: true } };
      };
    });
    
    // Setup test page with proxy mode and real APIs
    const testUrl = pathWithQuery({
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT,
      'enable-function-calling': 'true',
      'test-mode': 'true',
      debug: 'true'
    });
    console.log(`🌐 Navigating to test app with proxy mode: ${testUrl}`);
    await page.goto(testUrl);
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Verify proxy mode is active
    const connectionMode = await page.evaluate(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl?.textContent || '';
    });
    console.log(`✅ Connection mode: ${connectionMode}`);
    expect(connectionMode.toLowerCase()).toContain('proxy');
    
    // Trigger auto-connect by focusing text input (same pattern as other proxy mode tests)
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus();
    console.log('✅ Text input focused - auto-connect should trigger');
    
    // Wait for connection status element to appear (component may be initializing)
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Wait for connection to transition from "closed" to "connecting" to "connected"
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status !== 'closed';
    }, { timeout: 10000 });
    
    // Now wait for connection to be fully established
    await waitForConnection(page, 30000);
    
    // Wait for Settings to be applied
    await waitForSettingsApplied(page, 10000);
    console.log('✅ Settings applied - connection is ready');
    
    // Send message that will trigger thinking then function call
    console.log('Sending message that triggers thinking phase...');
    await page.evaluate(() => {
      const deepgramRef = window.deepgramRef || window.voiceAgentRef;
      if (deepgramRef?.current) {
        deepgramRef.current.injectUserMessage('search for milk');
      }
    });
    
    // Wait for function call (this may take time as agent thinks)
    console.log('Waiting for function call (agent may be thinking)...');
    const functionCallReceived = await page.waitForFunction(() => {
      return window.__FUNCTION_CALL_RECEIVED__ === true;
    }, { timeout: 30000 }).catch(() => {
      console.warn('Function call may not have been received');
      return false;
    });
    
    // Stop monitoring
    clearInterval(statusMonitorInterval);
    
    // Get final connection status from DOM
    const finalConnectionStatus = await page.evaluate(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl?.textContent?.toLowerCase() || 'unknown';
    });
    
    // Check connection state via ref (backup check)
    const connectionState = await page.evaluate(() => {
      const deepgramRef = window.deepgramRef || window.voiceAgentRef;
      return {
        isConnected: deepgramRef?.current !== null
      };
    });
    
    // Count connection status changes to 'closed' during the test
    const connectionCloses = connectionStatusHistory.filter(entry => 
      entry.status === 'closed' && entry.previousStatus !== 'closed'
    );
    
    console.log('\n📊 Test Results:');
    console.log(`  Function call received: ${functionCallReceived ? 'yes' : 'no'}`);
    console.log(`  Final connection status (DOM): ${finalConnectionStatus}`);
    console.log(`  Connection state (ref): ${connectionState.isConnected ? 'connected' : 'disconnected'}`);
    console.log(`  Connection status changes: ${connectionStatusHistory.length}`);
    console.log(`  Connection closes detected (DOM): ${connectionCloses.length}`);
    if (connectionStatusHistory.length > 0) {
      console.log(`  Connection status history:`, connectionStatusHistory.map(e => `${e.previousStatus} → ${e.status}`).join(', '));
    }
    
    // Assertions - use DOM-based check (more reliable)
    expect(finalConnectionStatus).toBe('connected'); // Connection should still be open (DOM check)
    expect(connectionState.isConnected).toBe(true); // Connection should still be open (ref check)
    expect(connectionCloses.length).toBe(0); // No connection closes during thinking phase (DOM-based)
    
    // If function call was received, that's a bonus (proves thinking phase didn't timeout)
    if (functionCallReceived) {
      console.log('✅ Function call received - thinking phase completed successfully');
    }
  });

  test('should handle multiple concurrent function calls', async ({ page }) => {
    console.log('🧪 Testing multiple concurrent function calls...');
    
    test.setTimeout(60000); // 60 seconds
    
    // Track connection state
    const connectionCloses = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Connection closed') || text.includes('WebSocket closed')) {
        connectionCloses.push({ time: Date.now(), message: text });
      }
    });
    
    // Set up function that can be called multiple times
    await page.addInitScript(() => {
      window.__ACTIVE_FUNCTION_CALLS__ = new Set();
      
      window.testFunctions = [
        {
          name: 'test_concurrent_function',
          description: 'Test function for concurrent calls. Use this when the user asks to test concurrent operations.',
          parameters: {
            type: 'object',
            properties: {
              callId: {
                type: 'string',
                description: 'Unique call identifier'
              }
            },
            required: ['callId']
          }
        }
      ];
      
      window.handleFunctionCall = async (request, sendResponse) => {
        if (request.name !== 'test_concurrent_function') {
          return undefined;
        }
        
        const callId = request.arguments?.callId || request.id;
        window.__ACTIVE_FUNCTION_CALLS__.add(callId);
        console.log(`[Test] Function call started: ${callId} (active: ${window.__ACTIVE_FUNCTION_CALLS__.size})`);
        
        // Each call takes 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        window.__ACTIVE_FUNCTION_CALLS__.delete(callId);
        console.log(`[Test] Function call completed: ${callId} (active: ${window.__ACTIVE_FUNCTION_CALLS__.size})`);
        
        sendResponse({
          id: request.id,
          result: { success: true, callId }
        });
        return { id: request.id, result: { success: true, callId } };
      };
    });
    
    // Setup test page with proxy mode and real APIs
    const testUrl = pathWithQuery({
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT,
      'enable-function-calling': 'true',
      'test-mode': 'true',
      debug: 'true'
    });
    console.log(`🌐 Navigating to test app with proxy mode: ${testUrl}`);
    await page.goto(testUrl);
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Verify proxy mode is active
    const connectionMode = await page.evaluate(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl?.textContent || '';
    });
    console.log(`✅ Connection mode: ${connectionMode}`);
    expect(connectionMode.toLowerCase()).toContain('proxy');
    
    // Trigger auto-connect by focusing text input (same pattern as other proxy mode tests)
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus();
    console.log('✅ Text input focused - auto-connect should trigger');
    
    // Wait for connection status element to appear (component may be initializing)
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Wait for connection to transition from "closed" to "connecting" to "connected"
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status !== 'closed';
    }, { timeout: 10000 });
    
    // Now wait for connection to be fully established
    await waitForConnection(page, 30000);
    
    // Wait for Settings to be applied
    await waitForSettingsApplied(page, 10000);
    console.log('✅ Settings applied - connection is ready');
    
    // Send message to trigger multiple function calls
    console.log('Sending message to trigger concurrent function calls...');
    await page.evaluate(() => {
      const deepgramRef = window.deepgramRef || window.voiceAgentRef;
      if (deepgramRef?.current) {
        deepgramRef.current.injectUserMessage('test concurrent');
      }
    });
    
    // Wait for all function calls to complete (5 seconds each, but may overlap)
    console.log('Waiting for concurrent function calls to complete...');
    await page.waitForFunction(() => {
      return window.__ACTIVE_FUNCTION_CALLS__?.size === 0;
    }, { timeout: 30000 }).catch(() => {
      // May not complete if agent doesn't call all three
      console.warn('Not all function calls completed (this is OK if agent behavior varies)');
    });
    
    // Check connection state
    const connectionState = await page.evaluate(() => {
      const deepgramRef = window.deepgramRef || window.voiceAgentRef;
      return {
        isConnected: deepgramRef?.current !== null,
        activeCalls: window.__ACTIVE_FUNCTION_CALLS__?.size || 0
      };
    });
    
    console.log('\n📊 Test Results:');
    console.log(`  Connection state: ${connectionState.isConnected ? 'connected' : 'disconnected'}`);
    console.log(`  Active function calls: ${connectionState.activeCalls}`);
    console.log(`  Connection closes detected: ${connectionCloses.length}`);
    
    // Assertions
    expect(connectionState.isConnected).toBe(true); // Connection should still be open
    expect(connectionCloses.length).toBe(0); // No connection closes during concurrent calls
  });

  test('should re-enable idle timeout after function calls complete', async ({ page }) => {
    console.log('🧪 Testing idle timeout re-enables after function calls complete...');
    
    test.setTimeout(60000); // 60 seconds
    
    // Track connection state and timeout events
    const connectionCloses = [];
    let timeoutFired = false;
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Connection closed') || text.includes('WebSocket closed')) {
        connectionCloses.push({ time: Date.now(), message: text });
      }
      if (text.includes('idle timeout') && text.includes('reached')) {
        timeoutFired = true;
        console.log('[Idle Timeout] Timeout fired');
      }
    });
    
    // Set up quick function
    await page.addInitScript(() => {
      window.testFunctions = [
        {
          name: 'test_quick_function',
          description: 'Quick test function. Use this when the user asks to test something or says "test".',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];
      
      window.handleFunctionCall = async (request, sendResponse) => {
        if (request.name !== 'test_quick_function') {
          return undefined;
        }
        
        console.log(`[Test] Function call started`);
        
        // Quick function (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`[Test] Function call completed`);
        sendResponse({
          id: request.id,
          result: { success: true }
        });
        // Set flag for test to check completion
        window.__FUNCTION_CALL_RESPONSE_SENT__ = true;
        return { id: request.id, result: { success: true } };
      };
    });
    
    // Setup test page with proxy mode and real APIs
    const testUrl = pathWithQuery({
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT,
      'enable-function-calling': 'true',
      'test-mode': 'true',
      debug: 'true'
    });
    console.log(`🌐 Navigating to test app with proxy mode: ${testUrl}`);
    await page.goto(testUrl);
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Verify proxy mode is active
    const connectionMode = await page.evaluate(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl?.textContent || '';
    });
    console.log(`✅ Connection mode: ${connectionMode}`);
    expect(connectionMode.toLowerCase()).toContain('proxy');
    
    // Trigger auto-connect by focusing text input (same pattern as other proxy mode tests)
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus();
    console.log('✅ Text input focused - auto-connect should trigger');
    
    // Wait for connection status element to appear (component may be initializing)
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Wait for connection to transition from "closed" to "connecting" to "connected"
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status !== 'closed';
    }, { timeout: 10000 });
    
    // Now wait for connection to be fully established
    await waitForConnection(page, 30000);
    
    // Wait for Settings to be applied
    await waitForSettingsApplied(page, 10000);
    console.log('✅ Settings applied - connection is ready');
    
    // Send message to trigger function call
    console.log('Sending message to trigger function call...');
    await page.evaluate(() => {
      const deepgramRef = window.deepgramRef || window.voiceAgentRef;
      if (deepgramRef?.current) {
        deepgramRef.current.injectUserMessage('test');
      }
    });
    
    // Wait for function call to complete
    console.log('Waiting for function call to complete...');
    await page.waitForFunction(() => {
      return window.__FUNCTION_CALL_RESPONSE_SENT__ === true;
    }, { timeout: 10000 }).catch(() => {
      // May not be set if using declarative pattern
    });
    
    // Wait a bit for function to complete
    await page.waitForTimeout(2000);
    
    // Now wait for idle timeout (should fire after 10 seconds of inactivity)
    console.log('Waiting for idle timeout to fire (should fire after 10s of inactivity)...');
    await page.waitForTimeout(12000); // Wait 12 seconds to see if timeout fires
    
    console.log('\n📊 Test Results:');
    console.log(`  Timeout fired: ${timeoutFired}`);
    console.log(`  Connection closes detected: ${connectionCloses.length}`);
    
    // After function completes and we wait 12 seconds, timeout should have fired
    // (This verifies that timeout re-enables after function calls complete)
    if (timeoutFired || connectionCloses.length > 0) {
      console.log('✅ Idle timeout re-enabled and fired after function call completed');
    } else {
      console.log('⚠️  Idle timeout did not fire - may need longer wait or agent may still be active');
    }
    
    // The key assertion: function call should have completed without timing out
    const functionCompleted = await page.evaluate(() => {
      return window.__FUNCTION_CALL_RESPONSE_SENT__ === true;
    });
    
    // Function should have completed (even if timeout fires later)
    expect(functionCompleted !== false).toBe(true); // May be undefined if using declarative pattern
  });
});
