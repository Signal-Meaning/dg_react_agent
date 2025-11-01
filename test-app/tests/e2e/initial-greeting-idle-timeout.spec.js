import { test, expect } from '@playwright/test';
import {
  setupTestPage
} from './helpers/audio-mocks.js';

test.describe('Initial Greeting Idle Timeout (Issue #139)', () => {
  test('should timeout after initial greeting on page load', async ({ page }) => {
    await setupTestPage(page);

    // Wait for initial greeting to complete using state-based detection
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

    // Check AudioContext state
    const audioState = await page.evaluate(() => window.audioContext?.state);
    console.log(`AudioContext state after greeting: ${audioState}`);

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

  test('should NOT play greeting if AudioContext is suspended', async ({ page }) => {
    await setupTestPage(page);

    // Check if greeting was played
    const greetingPlayed = await page.evaluate(() => {
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      return eventLog && eventLog.textContent.includes('Agent said:');
    });

    // Check AudioContext state
    const audioState = await page.evaluate(() => window.audioContext?.state);
    console.log(`AudioContext state: ${audioState}`);

    if (audioState === 'suspended') {
      // If AudioContext is suspended, greeting should NOT have played
      expect(greetingPlayed).toBe(false);
    } else {
      // If AudioContext is running, greeting should have played
      expect(greetingPlayed).toBe(true);
    }
  });
});
