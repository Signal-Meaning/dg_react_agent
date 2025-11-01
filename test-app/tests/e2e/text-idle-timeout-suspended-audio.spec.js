import { test, expect } from '@playwright/test';
import {
  setupTestPage
} from './helpers/audio-mocks.js';

test.describe('Text Input Idle Timeout with Suspended AudioContext', () => {
  test('should timeout after text interaction even with suspended AudioContext', async ({ page }) => {
    await setupTestPage(page);

    // Monitor AudioContext state
    const audioState = await page.evaluate(() => window.audioContext?.state);
    console.log(`Initial AudioContext state: ${audioState}`);

    // Send text WITHOUT clicking anything first (no user gesture to resume audio)
    await page.fill('[data-testid="text-input"]', 'Hello');
    await page.click('[data-testid="send-button"]');

    // Wait for agent response
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // Check AudioContext state after response
    const audioStateAfter = await page.evaluate(() => window.audioContext?.state);
    console.log(`AudioContext state after response: ${audioStateAfter}`);

    // Wait for agent to finish speaking using state-based detection
    await page.waitForFunction(() => {
      const agentSilent = document.querySelector('[data-testid="agent-silent"]')?.textContent?.trim();
      const agentSpeaking = document.querySelector('[data-testid="agent-speaking"]')?.textContent?.trim();
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]')?.textContent?.trim();
      const agentState = document.querySelector('[data-testid="agent-state"]')?.textContent?.trim();
      
      // Agent has finished speaking if any of these conditions are met
      return agentSilent === 'true' || 
             agentSpeaking === 'false' || 
             audioPlaying === 'false' || 
             agentState === 'idle';
    }, { timeout: 10000 });

    // Wait for idle timeout (should be ~10s, not 60s)
    const idleTime = Date.now();
    
    // Wait for connection to close within 15 seconds
    await page.waitForFunction(() => {
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      return eventLog && eventLog.textContent.includes('agent connection state: closed');
    }, { timeout: 15000 });
    
    const elapsed = Date.now() - idleTime;
    console.log(`Connection closed after ${elapsed}ms`);

    // Should close within 15 seconds (not 60 seconds)
    expect(elapsed).toBeLessThan(15000);
  });

  test('should resume AudioContext on text input focus', async ({ page }) => {
    await setupTestPage(page);

    // Check initial AudioContext state
    const initialState = await page.evaluate(() => window.audioContext?.state);
    console.log(`Initial AudioContext state: ${initialState}`);

    // Focus on text input (this should resume AudioContext)
    await page.focus('[data-testid="text-input"]');
    
    // Check AudioContext state after focus
    const stateAfterFocus = await page.evaluate(() => window.audioContext?.state);
    console.log(`AudioContext state after focus: ${stateAfterFocus}`);

    // AudioContext should be running after user interaction
    expect(stateAfterFocus).toBe('running');
  });
});
