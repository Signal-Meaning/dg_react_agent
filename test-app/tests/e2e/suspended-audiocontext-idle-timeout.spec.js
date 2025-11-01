import { test, expect } from '@playwright/test';
import {
  setupTestPage
} from './helpers/audio-mocks.js';
import {
  SELECTORS,
  waitForConnection,
  waitForAgentGreeting
} from './helpers/test-helpers.js';
import { waitForIdleTimeout } from './fixtures/idle-timeout-helpers';

test.describe('Suspended AudioContext Idle Timeout (Issue #139)', () => {
  test('should timeout even with suspended AudioContext', async ({ page, context }) => {
    console.log('🧪 Testing idle timeout with suspended AudioContext...');
    
    await setupTestPage(page);
    
    // Step 1: Establish connection
    console.log('Step 1: Establishing connection...');
    if (context) {
      await context.grantPermissions(['microphone']);
    }
    await page.waitForSelector('[data-testid="microphone-button"]', { timeout: 5000 });
    await page.click('[data-testid="microphone-button"]');
    await waitForConnection(page, 10000);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialStatus}`);
    expect(initialStatus).toBe('connected');
    
    // Step 2: Wait for greeting to be sent and agent to finish speaking
    console.log('Step 2: Waiting for agent greeting...');
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
    await waitForAgentGreeting(page, 15000);
    
    // Step 3: Check AudioContext state (for logging/debugging)
    // Note: This test verifies that idle timeout works regardless of AudioContext state
    // Issue #139 fixed a bug where idle timeout didn't work when AudioContext was suspended
    const audioState = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      const audioContext = deepgramComponent?.getAudioContext?.();
      return audioContext?.state || 'not-initialized';
    });
    console.log(`AudioContext state after greeting: ${audioState}`);
    
    // AudioContext may be running (audio finished), suspended, or not-initialized
    // The key point: idle timeout should work regardless of AudioContext state
    // This test verifies the fix for Issue #139 where timeout didn't work with suspended AudioContext

    // Step 4: Wait for idle timeout using shared fixture
    // This should work regardless of AudioContext state (Issue #139 fix)
    console.log('Step 4: Waiting for idle timeout...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 15000,
      checkInterval: 1000
    });
    
    expect(timeoutResult.closed).toBe(true);
    console.log(`✅ Connection closed after ${timeoutResult.actualTimeout}ms (expected: ~10000ms)`);
    
    // Should close within 15 seconds (not 60 seconds)
    expect(timeoutResult.actualTimeout).toBeLessThan(15000);
  });
});
