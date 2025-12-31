/**
 * E2E Test: Issue #340 - Int16Array Error with Odd-Length TTS Audio Buffers
 * 
 * This test demonstrates the defect where the component throws RangeError
 * when processing TTS audio buffers with odd byte lengths received from Deepgram.
 * 
 * Expected Behavior (After Fix):
 * - Component should handle odd-length buffers gracefully
 * - Should truncate to even length before creating Int16Array
 * - Should not throw RangeError
 * - Connection should remain stable
 * 
 * Current Behavior (Demonstrating Defect):
 * - Throws RangeError: byte length of Int16Array should be a multiple of 2
 * - Connection closes with code 1005 (abnormal close)
 * - Function calling tests fail
 * 
 * Test Approach:
 * - Uses real Deepgram API connection
 * - Sends message to trigger TTS response
 * - Monitors console for Int16Array errors
 * - Verifies connection stability
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoRealAPI,
  setupTestPage,
  waitForConnection,
  waitForSettingsApplied,
  sendTextMessage,
  setupConnectionStateTracking,
} from './helpers/test-helpers.js';

test.describe('Issue #340: Int16Array Error with Odd-Length Buffers', () => {
  test.beforeEach(async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key to test TTS audio processing');
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    // Set up console error tracking
    const consoleErrors = [];
    const pageErrors = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
        if (text.includes('Int16Array') || text.includes('byte length') || text.includes('multiple of 2')) {
          console.log('🔴 [ISSUE-340] Detected Int16Array error in console:', text);
        }
      }
    });
    
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
      if (error.message.includes('Int16Array') || error.message.includes('byte length') || error.message.includes('multiple of 2')) {
        console.log('🔴 [ISSUE-340] Detected Int16Array error as page error:', error.message);
      }
    });
    
    // Store errors for test assertions
    await page.evaluate(() => {
      window.__ISSUE_340_ERRORS__ = [];
      window.__ISSUE_340_PAGE_ERRORS__ = [];
      
      // Override console.error to capture errors
      const originalError = console.error;
      console.error = (...args) => {
        const errorStr = args.join(' ');
        if (errorStr.includes('Int16Array') || errorStr.includes('byte length') || errorStr.includes('multiple of 2')) {
          window.__ISSUE_340_ERRORS__.push(errorStr);
        }
        originalError.apply(console, args);
      };
      
      // Catch unhandled errors
      window.addEventListener('error', (event) => {
        const errorMsg = event.message || event.error?.message || '';
        if (errorMsg.includes('Int16Array') || errorMsg.includes('byte length') || errorMsg.includes('multiple of 2')) {
          window.__ISSUE_340_PAGE_ERRORS__.push(errorMsg);
        }
      });
      
      // Catch unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const errorMsg = event.reason?.message || String(event.reason) || '';
        if (errorMsg.includes('Int16Array') || errorMsg.includes('byte length') || errorMsg.includes('multiple of 2')) {
          window.__ISSUE_340_PAGE_ERRORS__.push(errorMsg);
        }
      });
    });
  });

  test('should handle odd-length TTS audio buffers gracefully (FAILS when defect is present)', async ({ page }) => {
    console.log('🧪 Testing Issue #340: Int16Array error with odd-length TTS buffers');
    
    // Step 1: Set up page and wait for component
    await setupTestPage(page);
    
    // Step 2: Trigger connection by sending a message (lazy initialization requires explicit trigger)
    console.log('📤 Sending message to trigger connection and TTS response...');
    await sendTextMessage(page, 'Hello, can you help me?');
    
    // Step 3: Wait for connection to be established
    await waitForConnection(page, 30000);
    await waitForSettingsApplied(page, 30000);
    
    // Step 4: Wait for agent response (which triggers TTS audio processing)
    console.log('⏳ Waiting for agent TTS response...');
    await page.waitForTimeout(5000); // Wait for TTS audio to be processed
    
    // Step 5: Check for Int16Array errors
    const errors = await page.evaluate(() => {
      return {
        consoleErrors: window.__ISSUE_340_ERRORS__ || [],
        pageErrors: window.__ISSUE_340_PAGE_ERRORS__ || [],
      };
    });
    
    console.log('📊 Error check results:', {
      consoleErrors: errors.consoleErrors.length,
      pageErrors: errors.pageErrors.length,
    });
    
    // Step 6: Verify connection is still stable
    const stateTracking = await setupConnectionStateTracking(page);
    const connectionStates = await stateTracking.getStates();
    console.log('🔗 Connection state after TTS:', connectionStates);
    
    // Assert: Should NOT have Int16Array errors (correct behavior)
    // This test FAILS when defect is present (errors occur)
    // This test PASSES when defect is fixed (no errors)
    const allErrors = [...errors.consoleErrors, ...errors.pageErrors];
    const int16ArrayErrors = allErrors.filter(err => 
      err.includes('Int16Array') || 
      err.includes('byte length') || 
      err.includes('multiple of 2')
    );
    
    expect(int16ArrayErrors.length).toBe(0);
    
    // Assert: Connection should remain stable
    expect(connectionStates.agentConnected).toBe(true);
    expect(connectionStates.agent).toBe('connected');
  });

  test('should maintain connection stability when processing TTS audio (FAILS when defect is present)', async ({ page }) => {
    console.log('🧪 Testing Issue #340: Connection stability with TTS audio processing');
    
    // Step 1: Set up page and wait for component
    await setupTestPage(page);
    
    // Step 2: Set up connection state tracking
    const stateTracking = await setupConnectionStateTracking(page);
    
    // Step 3: Trigger connection by sending first message (lazy initialization requires explicit trigger)
    console.log('📤 Sending first message to trigger connection...');
    await sendTextMessage(page, 'Hello');
    
    // Step 4: Wait for connection to be established
    await waitForConnection(page, 30000);
    await waitForSettingsApplied(page, 30000);
    
    // Step 5: Record initial connection state
    const initialState = await stateTracking.getStates();
    expect(initialState.agentConnected).toBe(true);
    console.log('✅ Initial connection state: connected');
    
    // Step 6: Send additional messages to trigger multiple TTS responses
    // This increases the chance of encountering odd-length buffers
    const messages = [
      'Hello, can you help me?',
      'What is the weather like?',
      'Tell me a joke',
    ];
    
    for (const message of messages) {
      console.log(`📤 Sending message: "${message}"`);
      await sendTextMessage(page, message);
      
      // Wait for TTS audio processing
      await page.waitForTimeout(3000);
      
      // Check connection state after each message
      const state = await stateTracking.getStates();
      console.log(`🔗 Connection state after "${message}":`, state.agent);
      
      // Assert: Connection should remain stable (correct behavior)
      // This test FAILS when defect is present (connection closes)
      // This test PASSES when defect is fixed (connection remains stable)
      expect(state.agentConnected).toBe(true);
      expect(state.agent).toBe('connected');
    }
    
    // Final connection check
    const finalState = await stateTracking.getStates();
    expect(finalState.agentConnected).toBe(true);
    expect(finalState.agent).toBe('connected');
    console.log('✅ Final connection state: connected (stable)');
  });
});

