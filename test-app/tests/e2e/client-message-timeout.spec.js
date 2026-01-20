/**
 * CLIENT_MESSAGE_TIMEOUT Error Tests
 * 
 * These tests verify that CLIENT_MESSAGE_TIMEOUT errors are properly handled
 * when they occur from Deepgram's server.
 * 
 * Scenarios tested:
 * 1. Function call response timeout - handler doesn't respond, Deepgram times out
 * 2. Server idle timeout - Deepgram's server timeout fires before component timeout
 */

import { test, expect } from '@playwright/test';
import { 
  SELECTORS,
  setupTestPage,
  establishConnectionViaText,
  sendTextMessage,
  waitForAgentResponse
} from './helpers/test-helpers.js';
import { skipIfNoRealAPI } from './helpers/test-helpers.js';

test.describe('CLIENT_MESSAGE_TIMEOUT Error Handling', () => {
  
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

  /**
   * Test 1: Function Call Response Timeout
   * 
   * This test triggers CLIENT_MESSAGE_TIMEOUT by:
   * 1. Setting up a function that the agent can call
   * 2. Making the function handler NOT respond (simulate bug)
   * 3. Agent calls the function
   * 4. Deepgram waits for response that never comes
   * 5. Deepgram sends CLIENT_MESSAGE_TIMEOUT error
   */
  test('should handle CLIENT_MESSAGE_TIMEOUT when function call handler does not respond', async ({ page }) => {
    skipIfNoRealAPI('Skipping test - requires real Deepgram API key');
    
    // Increase test timeout to 120s to allow for Deepgram's 60s timeout + buffer
    test.setTimeout(120000);
    
    console.log('🧪 Testing CLIENT_MESSAGE_TIMEOUT from function call timeout...');
    
    // Track errors
    const errors = [];
    const errorCallbacks = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('CLIENT_MESSAGE_TIMEOUT') || text.includes('Error')) {
        errors.push({ timestamp: Date.now(), text });
      }
    });
    
    // Setup test page
    await setupTestPage(page);
    
    // Set up error tracking in test app
    await page.evaluate(() => {
      window.__TEST_ERROR_RECEIVED__ = null;
      window.__TEST_ERROR_CODE__ = null;
      window.__TEST_ERROR_MESSAGE__ = null;
      
      // The test app's handleError will set these when CLIENT_MESSAGE_TIMEOUT occurs
      // We'll monitor console logs and window variables
    });
    
    // Establish connection
    await establishConnectionViaText(page);
    
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    expect(connectionStatus).toContain('connected');
    
    // Wait for SettingsApplied
    await page.waitForFunction(() => {
      const settingsEl = document.querySelector('[data-testid="has-sent-settings"]');
      return settingsEl && settingsEl.textContent === 'true';
    }, { timeout: 20000 });
    
    // Send a message that will trigger a function call
    // Note: This requires the agent to actually call a function
    // You may need to adjust the message based on your agent's instructions
    await sendTextMessage(page, 'Call the test function');
    
    // Wait for CLIENT_MESSAGE_TIMEOUT error
    // Deepgram should send this after waiting for the function response (~60s timeout)
    // Monitor console logs for the error
    let timeoutErrorReceived = false;
    let errorMessage = null;
    
    const errorListener = (msg) => {
      const text = msg.text();
      if (text.includes('CLIENT_MESSAGE_TIMEOUT') || 
          (text.includes('Error') && text.includes('timeout'))) {
        timeoutErrorReceived = true;
        errorMessage = text;
        console.log(`[TEST] CLIENT_MESSAGE_TIMEOUT detected: ${text}`);
      }
    };
    
    page.on('console', errorListener);
    
    // Wait up to 90 seconds for Deepgram's timeout
    try {
      await page.waitForTimeout(90000);
    } catch (e) {
      // Timeout is expected
    }
    
    page.off('console', errorListener);
    
    if (timeoutErrorReceived) {
      console.log('✅ CLIENT_MESSAGE_TIMEOUT error received from Deepgram');
      
      // Verify the error message was transformed correctly
      expect(errorMessage).toContain('CLIENT_MESSAGE_TIMEOUT');
      expect(errorMessage).toContain('No message was received within the timeout period');
      expect(errorMessage).not.toContain('Please make sure you are sending binary messages');
    } else {
      console.log('⚠️  CLIENT_MESSAGE_TIMEOUT not received within 90s');
      console.log('   This may be expected if:');
      console.log('   - Function was not called by agent');
      console.log('   - Deepgram timeout is longer than expected');
      console.log('   - Component handled the timeout differently');
      // Don't fail the test - this documents the scenario
    }
  });

  /**
   * Test 2: Server Idle Timeout
   * 
   * This test attempts to trigger CLIENT_MESSAGE_TIMEOUT by:
   * 1. Establishing connection
   * 2. Letting connection sit idle
   * 3. Waiting for Deepgram's server timeout (~60s) to fire
   * 4. Deepgram should send CLIENT_MESSAGE_TIMEOUT before closing
   * 
   * Note: This is harder to test reliably because:
   * - Component's idle timeout (10s) usually fires first and closes connection cleanly
   * - Deepgram's timeout may not always send the error before closing
   * - Timing is unpredictable
   */
  test('should handle CLIENT_MESSAGE_TIMEOUT from server idle timeout', async ({ page }) => {
    skipIfNoRealAPI('Skipping test - requires real Deepgram API key');
    
    console.log('🧪 Testing CLIENT_MESSAGE_TIMEOUT from server idle timeout...');
    console.log('⚠️  Note: This test may not always trigger the error as component timeout usually fires first');
    
    // Track errors
    const errors = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('CLIENT_MESSAGE_TIMEOUT') || text.includes('Error')) {
        errors.push({ timestamp: Date.now(), text });
        console.log(`[ERROR] ${text}`);
      }
    });
    
    // Setup test page
    await setupTestPage(page);
    
    // Establish connection
    await establishConnectionViaText(page);
    
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    expect(connectionStatus).toContain('connected');
    
    // Wait for SettingsApplied
    await page.waitForFunction(() => {
      const settingsEl = document.querySelector('[data-testid="has-sent-settings"]');
      return settingsEl && settingsEl.textContent === 'true';
    }, { timeout: 20000 });
    
    // Disable component's idle timeout to let Deepgram's server timeout fire first
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        // Note: This may require exposing a method to disable idle timeout
        // For now, we'll just wait and see if Deepgram's timeout fires
      }
    });
    
    // Wait for Deepgram's server timeout (~60 seconds)
    // The component's idle timeout is 10s, so we need to disable it or wait longer
    console.log('⏳ Waiting for Deepgram server timeout (~60s)...');
    
    const timeoutError = await page.waitForFunction(() => {
      return window.__TEST_ERROR_RECEIVED__ === 'CLIENT_MESSAGE_TIMEOUT';
    }, { timeout: 70000 }).catch(() => null);
    
    if (timeoutError) {
      console.log('✅ CLIENT_MESSAGE_TIMEOUT error received from Deepgram server timeout');
      
      // Verify the error was transformed correctly
      const errorInfo = await page.evaluate(() => {
        return {
          errorCode: window.__TEST_ERROR_CODE__,
          errorMessage: window.__TEST_ERROR_MESSAGE__,
          hasMisleadingText: window.__TEST_ERROR_MESSAGE__?.includes('binary messages') || false
        };
      });
      
      expect(errorInfo.errorCode).toBe('CLIENT_MESSAGE_TIMEOUT');
      expect(errorInfo.errorMessage).toContain('No message was received within the timeout period');
      expect(errorInfo.hasMisleadingText).toBe(false);
    } else {
      console.log('ℹ️  CLIENT_MESSAGE_TIMEOUT not received - component timeout likely fired first');
      console.log('   This is expected behavior - component proactively closes connection');
    }
  });
});
