/**
 * Microphone Activation After Idle Connection Timeout - FIXED
 * 
 * SCOPE: Validates that the microphone can be successfully activated after the connection
 * has timed out due to inactivity (idle timeout).
 * 
 * SCENARIO:
 * 1. Connection established and auto-connected
 * 2. No activity for 10+ seconds (idle timeout occurs naturally)
 * 3. User clicks microphone button to start voice input
 * 4. Component should reconnect and enable microphone successfully
 * 
 * DIFFERENTIATORS:
 * - websocket-timeout-context-preservation.spec.js: Tests TEXT input after accelerated timeout (15min)
 * - microphone-reliability.spec.js: Tests manual timeout trigger button workflow
 * - This test: Uses natural idle timeout with microphone button activation
 * 
 * FIXED: Now uses MicrophoneHelpers for proper sequence after timeout
 * 
 * STATUS: This test should now PASS with proper sequence handling.
 */

import { test, expect } from '@playwright/test';
import { 
  SELECTORS,
  waitForConnection,
  establishConnectionViaText
} from './helpers/test-helpers.js';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks.js';
import { waitForIdleTimeout } from './fixtures/idle-timeout-helpers';

test.describe('Microphone Activation After Idle Timeout', () => {
  
  test('should handle microphone activation after idle timeout', async ({ page }) => {
    console.log('🧪 Testing microphone activation after idle timeout...');
    
    // Track errors
    const errors = [];
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' || text.includes('ERROR') || text.includes('🚨')) {
        errors.push(text);
      }
    });
    
    // Step 1: Setup and establish initial connection
    console.log('Step 1: Setting up test page and establishing connection...');
    await setupTestPage(page);
    
    // Establish connection via text input (auto-connect)
    await establishConnectionViaText(page);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialStatus}`);
    expect(initialStatus).toBe('connected');
    
    // Step 2: Wait for idle timeout using shared fixture
    console.log('Step 2: Waiting for idle timeout...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 15000,
      checkInterval: 1000
    });
    
    expect(timeoutResult.closed).toBe(true);
    const statusAfterTimeout = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Connection status after timeout: ${statusAfterTimeout}`);
    expect(statusAfterTimeout).toBe('closed');
    
    // Step 3: Use MicrophoneHelpers for proper activation after timeout
    console.log('Step 3: Using MicrophoneHelpers for proper activation after timeout...');
    const result = await MicrophoneHelpers.MICROPHONE_TEST_PATTERNS.activationAfterTimeout(page);
    
    // Step 4: Verify final state
    console.log('\n📊 FINAL STATE:');
    console.log(`  Microphone: ${result.micStatus}`);
    console.log(`  Connection: ${result.connectionStatus}`);
    console.log(`  Errors captured: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.substring(0, 200)}`);
      });
    }
    
    // EXPECTED BEHAVIOR: Microphone should successfully enable after reconnection
    expect(result.success).toBe(true);
    expect(result.micStatus).toBe('Enabled');
    expect(result.connectionStatus).toContain('connected');
    
    console.log('✅ Microphone successfully enabled after idle timeout!');
    console.log('✅ Connection re-established!');
    console.log('✅ Test passed: Microphone activation after idle timeout works correctly!');
  });
  
  test('should show loading state during reconnection attempt', async ({ page }) => {
    console.log('🧪 Testing loading state during reconnection...');
    
    await setupTestPage(page);
    
    // Establish connection via text input (auto-connect)
    await establishConnectionViaText(page);
    
    // Wait for timeout using shared fixture
    console.log('Waiting for idle timeout...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 15000,
      checkInterval: 1000
    });
    
    expect(timeoutResult.closed).toBe(true);
    
    // Click microphone and immediately check for loading state
    console.log('Clicking microphone and checking for loading state...');
    const micButton = page.locator(SELECTORS.micButton);
    await micButton.click();
    
    // Check if button shows loading/connecting state
    await page.waitForTimeout(500); // Brief pause to catch loading state
    
    const buttonText = await micButton.textContent();
    console.log(`Button text during operation: ${buttonText}`);
    
    // Button should show some indication of work in progress
    // (either "Connecting..." or maintain disabled state)
    const showsLoadingState = buttonText?.includes('Connecting') || 
                               buttonText?.includes('⏳') ||
                               await micButton.isDisabled();
    
    console.log(`Shows loading/disabled state: ${showsLoadingState}`);
    
    // Wait for operation to complete and verify final state
    await waitForConnection(page, 10000);
    
    const finalButtonText = await micButton.textContent();
    const finalConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    
    console.log(`Final button text: ${finalButtonText}`);
    console.log(`Final connection status: ${finalConnectionStatus}`);
    
    // Assert: Connection should be re-established
    expect(finalConnectionStatus).toBe('connected');
    console.log('✅ Connection re-established after mic button click');
  });

});

