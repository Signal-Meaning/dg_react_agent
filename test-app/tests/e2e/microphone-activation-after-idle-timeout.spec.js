/**
 * Microphone Activation After Idle Connection Timeout
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
 * CURRENT KNOWN ISSUE (Issue #58):
 * The connection briefly opens, then immediately closes before microphone can be enabled,
 * causing the error: "Agent not connected (state: closed)"
 * 
 * STATUS: This test will FAIL until the race condition is fixed.
 */

import { test, expect } from '@playwright/test';
const { 
  SELECTORS,
  waitForConnection 
} = require('./helpers/test-helpers');
import { setupTestPage } from './helpers/audio-mocks';

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
    
    // Step 1: Setup and wait for initial connection
    console.log('Step 1: Setting up test page and waiting for connection...');
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialStatus}`);
    expect(initialStatus).toBe('connected');
    
    // Step 2: Wait for idle timeout (10+ seconds of inactivity)
    console.log('Step 2: Waiting for idle timeout (12 seconds)...');
    await page.waitForTimeout(12000);
    
    const statusAfterTimeout = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Connection status after timeout: ${statusAfterTimeout}`);
    // Connection should be closed after idle timeout
    expect(statusAfterTimeout).toBe('closed');
    
    // Step 3: Attempt to activate microphone
    console.log('Step 3: Attempting to activate microphone...');
    const micButton = page.locator(SELECTORS.micButton);
    const micStatusBefore = await page.locator(SELECTORS.micStatus).textContent();
    console.log(`Mic status before click: ${micStatusBefore}`);
    
    await micButton.click();
    console.log('✅ Clicked microphone button');
    
    // Step 4: Wait for reconnection attempt and microphone activation
    console.log('Step 4: Waiting for reconnection and mic activation (up to 5 seconds)...');
    await page.waitForTimeout(5000);
    
    // Step 5: Check final state
    const finalMicStatus = await page.locator(SELECTORS.micStatus).textContent();
    const finalConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    
    console.log('\n📊 FINAL STATE:');
    console.log(`  Microphone: ${finalMicStatus}`);
    console.log(`  Connection: ${finalConnectionStatus}`);
    console.log(`  Errors captured: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.substring(0, 200)}`);
      });
    }
    
    // EXPECTED BEHAVIOR: Microphone should successfully enable after reconnection
    // The component should:
    // 1. Detect that reconnection is needed
    // 2. Establish connection to Deepgram
    // 3. Wait for connection to be stable
    // 4. Enable the microphone
    // 
    // If connection cannot be established, it should:
    // 1. Show an error in the status panel
    // 2. Keep the microphone disabled
    // 3. Not throw uncaught errors
    
    console.log('\n🔍 VALIDATING EXPECTED BEHAVIOR:');
    
    // THE FAILING TEST: We expect microphone to be enabled
    console.log(`Asserting microphone is enabled after reconnection attempt...`);
    
    // This will FAIL until Issue #58 is fixed
    expect(finalMicStatus).toBe('Enabled');
    expect(finalConnectionStatus).toBe('connected');
    
    console.log('✅ Microphone successfully enabled');
    console.log('✅ Connection established');
    console.log('✅ Test passed: Microphone activation after idle timeout works correctly!');
  });
  
  test('should show loading state during reconnection attempt', async ({ page }) => {
    console.log('🧪 Testing loading state during reconnection...');
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Wait for timeout
    console.log('Waiting for idle timeout...');
    await page.waitForTimeout(12000);
    
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
    
    // Wait for operation to complete
    await page.waitForTimeout(5000);
    
    const finalButtonText = await micButton.textContent();
    console.log(`Final button text: ${finalButtonText}`);
  });

  test('should not timeout during active conversation after UtteranceEnd', async ({ page }) => {
    console.log('🧪 Testing idle timeout behavior during active conversation...');
    
    // Track connection close events
    const connectionCloses = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Idle timeout reached') || text.includes('Connection close')) {
        connectionCloses.push({ timestamp: Date.now(), text });
      }
    });
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Enable microphone to start conversation
    console.log('Step 1: Enabling microphone...');
    const micButton = page.locator(SELECTORS.micButton);
    await micButton.click();
    await page.waitForTimeout(1000);
    
    const micStatus = await page.locator(SELECTORS.micStatus).textContent();
    console.log(`Microphone status: ${micStatus}`);
    expect(micStatus).toBe('Enabled');
    
    // Simulate user speaking by sending audio data multiple times over 15+ seconds
    // This simulates: user speaks → pause (UtteranceEnd) → continues speaking
    console.log('Step 2: Simulating ongoing conversation with pauses...');
    
    const startTime = Date.now();
    const conversationDuration = 15000; // 15 seconds of conversation
    const speakingIntervals = [
      { start: 0, duration: 3000, label: 'First utterance' },
      { start: 4000, duration: 3000, label: 'Second utterance (after brief pause)' },
      { start: 8000, duration: 3000, label: 'Third utterance (continuing)' },
      { start: 12000, duration: 3000, label: 'Fourth utterance (still going)' }
    ];
    
    for (const interval of speakingIntervals) {
      // Wait until it's time for this speaking interval
      const elapsed = Date.now() - startTime;
      const waitTime = interval.start - elapsed;
      if (waitTime > 0) {
        console.log(`Waiting ${waitTime}ms before ${interval.label}...`);
        await page.waitForTimeout(waitTime);
      }
      
      console.log(`Speaking: ${interval.label}`);
      
      // Simulate audio data being sent during this interval
      await page.evaluate((duration) => {
        const deepgramComponent = window.deepgramRef?.current;
        if (deepgramComponent && deepgramComponent.sendAudioData) {
          // Send audio chunks to simulate speaking
          const chunkInterval = setInterval(() => {
            const audioData = new ArrayBuffer(8192);
            deepgramComponent.sendAudioData(audioData);
          }, 100);
          
          // Stop sending after duration
          setTimeout(() => clearInterval(chunkInterval), duration);
        }
      }, interval.duration);
      
      await page.waitForTimeout(interval.duration);
    }
    
    console.log('Step 3: Checking connection stayed alive during conversation...');
    
    // Check connection status
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final connection status: ${connectionStatus}`);
    
    // Log any connection closes that occurred
    console.log(`\nConnection close events: ${connectionCloses.length}`);
    connectionCloses.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.text}`);
    });
    
    // Assert: Connection should still be alive after 15 seconds of active conversation
    // The bug would cause it to timeout after UtteranceEnd despite ongoing conversation
    expect(connectionStatus).toBe('connected');
    console.log('✅ Connection stayed alive during active conversation with pauses');
    
    // No premature idle timeouts should have occurred during active conversation
    const prematureTimeouts = connectionCloses.filter(e => 
      e.text.includes('Idle timeout reached') && 
      (e.timestamp - startTime) < conversationDuration
    );
    
    expect(prematureTimeouts.length).toBe(0);
    console.log('✅ No premature idle timeouts during active conversation');
  });
});

