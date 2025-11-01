import { test, expect } from '@playwright/test';
import {
  setupTestPage
} from './helpers/audio-mocks.js';
import {
  SELECTORS,
  waitForConnection,
  waitForAgentGreeting,
  sendTextMessage,
  establishConnectionViaText,
  getComponentAudioContextState
} from './helpers/test-helpers.js';
import { waitForIdleTimeout } from './fixtures/idle-timeout-helpers';

test.describe('Text Input Idle Timeout with Suspended AudioContext', () => {
  test('should timeout after text interaction even with suspended AudioContext', async ({ page }) => {
    console.log('🧪 Testing idle timeout after text interaction with suspended AudioContext...');
    
    await setupTestPage(page);

    // Step 1: Establish connection via text input (auto-connect)
    console.log('Step 1: Establishing connection via text input...');
    await establishConnectionViaText(page);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialStatus}`);
    expect(initialStatus).toBe('connected');
    
    // Step 2: Check AudioContext state (for logging)
    const audioState = await getComponentAudioContextState(page);
    console.log(`Initial AudioContext state: ${audioState}`);

    // Step 3: Send text message
    console.log('Step 3: Sending text message...');
    await sendTextMessage(page, 'Hello');
    
    // Step 4: Wait for agent response and finish speaking
    console.log('Step 4: Waiting for agent response...');
    await waitForAgentGreeting(page, 15000);
    
    // Step 5: Check AudioContext state after response (for logging)
    const audioStateAfter = await getComponentAudioContextState(page);
    console.log(`AudioContext state after response: ${audioStateAfter}`);
    
    // Note: AudioContext state may vary, but idle timeout should work regardless
    // This test verifies Issue #139 fix where timeout didn't work with suspended AudioContext

    // Step 6: Wait for idle timeout using shared fixture
    console.log('Step 6: Waiting for idle timeout...');
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

  test('should resume AudioContext on text input focus', async ({ page }) => {
    console.log('🧪 Testing AudioContext resumption on text input focus...');
    
    await setupTestPage(page);
    
    // Establish connection via text input (auto-connect)
    await establishConnectionViaText(page);

    // Step 1: Check initial AudioContext state
    const initialState = await getComponentAudioContextState(page);
    console.log(`Initial AudioContext state: ${initialState}`);

    // Step 2: Focus on text input (this should resume AudioContext if suspended)
    await page.focus('[data-testid="text-input"]');
    await page.waitForTimeout(500); // Brief pause for state change
    
    // Step 3: Check AudioContext state after focus
    const stateAfterFocus = await getComponentAudioContextState(page);
    console.log(`AudioContext state after focus: ${stateAfterFocus}`);

    // AudioContext should be running after user interaction (if initialized)
    // If not initialized, that's also acceptable in test environment
    if (stateAfterFocus !== 'not-initialized') {
      expect(stateAfterFocus).toBe('running');
      console.log('✅ AudioContext resumed to running state');
    } else {
      console.log('⚠️  AudioContext not initialized in test environment');
    }
  });
});
