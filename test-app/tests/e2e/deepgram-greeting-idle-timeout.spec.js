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
  SELECTORS, waitForConnection, sendTextMessage, waitForAgentGreeting,
  establishConnectionViaMicrophone
} from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks';
import { waitForIdleTimeout, verifyIdleTimeoutTiming } from './fixtures/idle-timeout-helpers';

test.describe('Greeting Idle Timeout', () => {
  
  test('should timeout after greeting completes (Issue #139)', async ({ page, context }) => {
    console.log('🧪 Testing Issue #139: Idle timeout after greeting completion...');
    
    // Step 1: Browser restart (fresh page load)
    console.log('Step 1: Starting fresh browser session...');
    await setupTestPage(page);
    
    // Step 2: Establish connection via microphone button
    console.log('Step 2: Establishing connection via microphone...');
    await establishConnectionViaMicrophone(page, context);
    
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
    
    // Step 4: Wait for agent greeting to complete
    console.log('Step 4: Waiting for agent to finish speaking greeting...');
    await waitForAgentGreeting(page, 15000);
    
    // Step 5: Wait for agent connection to close (should happen ~10 seconds after step 4)
    console.log('Step 5: Waiting for connection to close after idle timeout...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 20000,
      checkInterval: 1000
    });
    
    // Validate the timing
    expect(timeoutResult.closed).toBe(true);
    expect(timeoutResult.actualTimeout).toBeLessThan(15000); // 10s + 5s buffer
    verifyIdleTimeoutTiming(timeoutResult.actualTimeout, 10000, 5000);
    
    // Step 6: User sends "hi" via text
    console.log('Step 6: Sending "hi" via text input...');
    
    // Click into text input to trigger reconnection
    // Use establishConnectionViaText pattern for reliable reconnection
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus();
    console.log('✅ Text input focused - auto-connect should trigger');
    
    // Wait for connection status element to appear
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Wait for connection to transition from "closed" to "connecting" to "connected"
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status !== 'closed';
    }, { timeout: 10000 });
    
    // Wait for reconnection with longer timeout
    await waitForConnection(page, 30000);
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
    
    // Step 8: Wait for agent to finish responding
    console.log('Step 8: Waiting for agent to finish responding...');
    await waitForAgentGreeting(page, 15000);
    
    // Step 9: Wait for agent connection to close
    console.log('Step 9: Waiting for connection to close after response...');
    const responseTimeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 20000,
      checkInterval: 1000
    });
    
    // Validate the timing for the second interaction
    expect(responseTimeoutResult.closed).toBe(true);
    expect(responseTimeoutResult.actualTimeout).toBeLessThan(15000); // 10s + 5s buffer
    verifyIdleTimeoutTiming(responseTimeoutResult.actualTimeout, 10000, 5000);
    
    console.log('\n✅ SUCCESS: Issue #139 is fixed - idle timeout works correctly after agent speech');
  });
  
  test('should timeout after initial greeting on page load', async ({ page, context }) => {
    await setupTestPage(page);
    
    // Establish connection by clicking microphone button
    await establishConnectionViaMicrophone(page, context);

    // Wait for initial greeting to complete
    await waitForAgentGreeting(page, 10000);

    // Check AudioContext state
    const audioState = await page.evaluate(() => window.audioContext?.state);
    console.log(`AudioContext state after greeting: ${audioState}`);

    // Wait for idle timeout using shared fixture
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 15000,
      checkInterval: 1000
    });
    
    expect(timeoutResult.closed).toBe(true);
    
    // Fail if timeout is too early (should be ~10 seconds, not 1 second)
    // Minimum acceptable: 8 seconds (allowing 2s tolerance), maximum: 15 seconds
    expect(timeoutResult.actualTimeout).toBeGreaterThanOrEqual(8000);
    expect(timeoutResult.actualTimeout).toBeLessThan(15000);
    
    // Should close within 15s, not 60s (verifies Issue #139 is fixed)
    verifyIdleTimeoutTiming(timeoutResult.actualTimeout, 10000, 5000);
    
    console.log(`✅ Connection closed after ${timeoutResult.actualTimeout}ms (expected: ~10000ms)`);
  });

  test('should NOT play greeting if AudioContext is suspended', async ({ page, context }) => {
    await setupTestPage(page);
    
    // Establish connection via microphone button
    await establishConnectionViaMicrophone(page, context);
    
    // Wait for greeting to be sent
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
    console.log('✅ Greeting sent');
    
    // Wait a moment for audio playback to start (if it will)
    await page.waitForTimeout(1000);
    
    // Check AudioContext state from component
    const audioState = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      const audioContext = deepgramComponent?.getAudioContext?.();
      return audioContext?.state || 'not-initialized';
    });
    console.log(`AudioContext state: ${audioState}`);
    
    // Check if greeting audio was actually played
    const audioPlayed = await page.evaluate(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      const wasPlaying = audioPlaying?.textContent === 'true';
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      const hasAgentSaid = eventLog && eventLog.textContent.includes('Agent said:');
      return wasPlaying || hasAgentSaid;
    });
    console.log(`Greeting audio played: ${audioPlayed}`);

    if (audioState === 'suspended') {
      // If AudioContext is suspended, greeting audio should NOT have played
      expect(audioPlayed).toBe(false);
      console.log('✅ Test passed: AudioContext suspended, greeting audio did not play');
    } else {
      // If AudioContext is running (or not-initialized but audio works), greeting should have played
      // Note: If AudioContext is not-initialized, it might still work in some browsers
      if (audioState === 'running') {
        expect(audioPlayed).toBe(true);
        console.log('✅ Test passed: AudioContext running, greeting audio played');
      } else {
        // If not-initialized, we can't make strong assertions about playback
        console.log(`⚠️  AudioContext state is ${audioState}, cannot verify playback behavior`);
      }
    }
  });
});
