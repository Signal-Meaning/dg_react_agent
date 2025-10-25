/**
 * Greeting Idle Timeout Test
 * 
 * This test verifies the core Issue #139: idle timeout should fire after agent greeting
 * completes, not after 60 seconds of server timeout.
 * 
 * TEST FLOW:
 * 1. Browser restart
 * 2. Wait for agent connection to be truthy
 * 3. Wait for agent speaking greeting
 * 4. Wait for agent idle
 * 5. Wait for agent connection to be falsy (should happen ~10 seconds after step 4)
 * 6. User sends "hi" via text
 * 7. Wait for response from agent
 * 8. Wait for idle state of Agent
 * 9. Wait for agent connection to close
 * 
 * EXPECTED BEHAVIOR:
 * - Connection should close ~10 seconds after agent finishes greeting
 * - Connection should close ~10 seconds after agent finishes responding to "hi"
 * 
 * CURRENT BUG (Issue #139):
 * - Connection stays open for 60 seconds (server timeout) instead of 10 seconds
 * - This happens because idle timeout resets are not re-enabled after agent speech
 */

import { test, expect } from '@playwright/test';
import { 
  SELECTORS,
  waitForConnection,
  sendTextMessage
} from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks.js';

test.describe('Greeting Idle Timeout', () => {
  
  test('should timeout after greeting completes (Issue #139)', async ({ page }) => {
    console.log('🧪 Testing Issue #139: Idle timeout after greeting completion...');
    
    // Step 1: Browser restart (fresh page load)
    console.log('Step 1: Starting fresh browser session...');
    await setupTestPage(page);
    
    // Step 2: Wait for agent connection to be truthy
    console.log('Step 2: Waiting for agent connection...');
    await waitForConnection(page, 10000);
    
    const initialConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialConnectionStatus}`);
    expect(initialConnectionStatus).toBe('connected');
    
    // Step 3: Wait for agent speaking greeting
    console.log('Step 3: Waiting for agent to start speaking greeting...');
    
    // Wait for greeting to be sent
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
    console.log('✅ Greeting sent');
    
    // Wait for agent to start speaking (audio playing)
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying?.textContent === 'true';
    }, { timeout: 10000 });
    console.log('✅ Agent started speaking greeting');
    
    // Step 4: Wait for agent idle
    console.log('Step 4: Waiting for agent to finish speaking and become idle...');
    
    // Wait for audio to stop playing
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying?.textContent === 'false';
    }, { timeout: 15000 });
    console.log('✅ Agent finished speaking greeting');
    
    // Record the time when agent became idle
    const agentIdleTime = Date.now();
    console.log(`Agent became idle at: ${new Date(agentIdleTime).toISOString()}`);
    
    // Step 5: Wait for agent connection to be falsy (should happen ~10 seconds after step 4)
    console.log('Step 5: Waiting for connection to close after idle timeout...');
    
    // Monitor connection status for up to 20 seconds
    const maxWaitTime = 20000; // 20 seconds max
    const checkInterval = 1000; // Check every second
    const maxChecks = maxWaitTime / checkInterval;
    
    let connectionClosed = false;
    let connectionCloseTime = null;
    
    for (let i = 0; i < maxChecks; i++) {
      await page.waitForTimeout(checkInterval);
      
      const currentStatus = await page.locator(SELECTORS.connectionStatus).textContent();
      const currentTime = Date.now();
      const timeSinceIdle = currentTime - agentIdleTime;
      
      console.log(`Check ${i + 1}/${maxChecks}: +${timeSinceIdle}ms - Connection: ${currentStatus}`);
      
      if (currentStatus === 'closed') {
        connectionClosed = true;
        connectionCloseTime = currentTime;
        console.log(`✅ Connection closed at +${timeSinceIdle}ms after agent became idle`);
        break;
      }
    }
    
    // Validate the timing
    if (connectionClosed) {
      const timeToClose = connectionCloseTime - agentIdleTime;
      console.log(`Time to close after idle: ${timeToClose}ms`);
      
      // Should close within 15 seconds (10 second timeout + 5 second buffer)
      expect(timeToClose).toBeLessThan(15000);
      console.log('✅ Connection closed within expected timeframe');
    } else {
      console.log('❌ Connection did not close within 20 seconds - this indicates Issue #139');
      expect(connectionClosed).toBe(true);
    }
    
    // Step 6: User sends "hi" via text
    console.log('Step 6: Sending "hi" via text input...');
    
    // Click into text input to trigger reconnection
    await page.click('input[type="text"]');
    
    // Wait for reconnection
    await waitForConnection(page, 10000);
    console.log('✅ Reconnected after text input');
    
    // Send the message
    await sendTextMessage(page, "hi");
    console.log('✅ Sent "hi" message');
    
    // Step 7: Wait for response from agent
    console.log('Step 7: Waiting for agent response...');
    
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse?.textContent && agentResponse.textContent.length > 10;
    }, { timeout: 15000 });
    console.log('✅ Agent started responding');
    
    // Wait for audio to finish
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying?.textContent === 'false';
    }, { timeout: 15000 });
    console.log('✅ Agent finished responding');
    
    // Step 8: Wait for idle state of Agent
    console.log('Step 8: Waiting for agent idle state...');
    
    const responseIdleTime = Date.now();
    console.log(`Agent became idle after response at: ${new Date(responseIdleTime).toISOString()}`);
    
    // Step 9: Wait for agent connection to close
    console.log('Step 9: Waiting for connection to close after response...');
    
    // Monitor connection status again
    connectionClosed = false;
    connectionCloseTime = null;
    
    for (let i = 0; i < maxChecks; i++) {
      await page.waitForTimeout(checkInterval);
      
      const currentStatus = await page.locator(SELECTORS.connectionStatus).textContent();
      const currentTime = Date.now();
      const timeSinceIdle = currentTime - responseIdleTime;
      
      console.log(`Check ${i + 1}/${maxChecks}: +${timeSinceIdle}ms - Connection: ${currentStatus}`);
      
      if (currentStatus === 'closed') {
        connectionClosed = true;
        connectionCloseTime = currentTime;
        console.log(`✅ Connection closed at +${timeSinceIdle}ms after agent became idle`);
        break;
      }
    }
    
    // Validate the timing for the second interaction
    if (connectionClosed) {
      const timeToClose = connectionCloseTime - responseIdleTime;
      console.log(`Time to close after response idle: ${timeToClose}ms`);
      
      // Should close within 15 seconds (10 second timeout + 5 second buffer)
      expect(timeToClose).toBeLessThan(15000);
      console.log('✅ Connection closed within expected timeframe after response');
    } else {
      console.log('❌ Connection did not close within 20 seconds after response - this indicates Issue #139');
      expect(connectionClosed).toBe(true);
    }
    
    console.log('\n✅ SUCCESS: Issue #139 is fixed - idle timeout works correctly after agent speech');
  });
  
  test('should demonstrate current bug behavior (Issue #139)', async ({ page }) => {
    console.log('🧪 Demonstrating Issue #139: Current bug behavior...');
    
    // This test documents the current buggy behavior
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Wait for greeting
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
    console.log('✅ Greeting sent');
    
    // Wait for agent to finish speaking
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying?.textContent === 'false';
    }, { timeout: 15000 });
    
    const agentIdleTime = Date.now();
    console.log(`Agent became idle at: ${new Date(agentIdleTime).toISOString()}`);
    
    // Monitor for 30 seconds to show the bug
    console.log('Monitoring connection for 30 seconds to demonstrate bug...');
    
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      
      const currentStatus = await page.locator(SELECTORS.connectionStatus).textContent();
      const timeSinceIdle = Date.now() - agentIdleTime;
      
      if (i % 5 === 0) { // Log every 5 seconds
        console.log(`+${timeSinceIdle}ms: Connection = ${currentStatus}`);
      }
      
      if (currentStatus === 'closed') {
        console.log(`✅ Connection closed at +${timeSinceIdle}ms`);
        break;
      }
    }
    
    const finalStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final status after 30 seconds: ${finalStatus}`);
    
    // This test documents the bug - connection should close much sooner
    if (finalStatus === 'connected') {
      console.log('❌ BUG CONFIRMED: Connection stayed open for 30+ seconds instead of closing after 10 seconds');
    } else {
      console.log('✅ Connection closed within expected timeframe');
    }
  });
});
