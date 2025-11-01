import { test, expect } from '@playwright/test';
import {
  setupTestPage
} from './helpers/audio-mocks.js';

test.describe('Suspended AudioContext Idle Timeout (Issue #139)', () => {
  test('should timeout even with suspended AudioContext', async ({ page }) => {
    await setupTestPage(page);

    // Force AudioContext to be suspended
    await page.evaluate(() => {
      if (window.audioContext) {
        // Suspend the AudioContext to simulate the real browser behavior
        window.audioContext.suspend();
        console.log('AudioContext manually suspended for testing');
      }
    });

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

    // Verify AudioContext is suspended
    const audioState = await page.evaluate(() => window.audioContext?.state);
    console.log(`AudioContext state after greeting: ${audioState}`);
    expect(audioState).toBe('suspended');

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

  test('should demonstrate the bug with suspended AudioContext', async ({ page }) => {
    await setupTestPage(page);

    // Force AudioContext to be suspended
    await page.evaluate(() => {
      if (window.audioContext) {
        window.audioContext.suspend();
        console.log('AudioContext manually suspended for testing');
      }
    });

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

    // Verify AudioContext is suspended
    const audioState = await page.evaluate(() => window.audioContext?.state);
    console.log(`AudioContext state: ${audioState}`);
    expect(audioState).toBe('suspended');

    // Wait for 20 seconds to see if connection closes
    const startTime = Date.now();
    await page.waitForTimeout(20000);
    
    // Check if connection is still open
    const connectionStatus = await page.evaluate(() => {
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      const logs = eventLog ? eventLog.textContent : '';
      const lastConnectionLog = logs.split('\n').reverse().find(line => 
        line.includes('agent connection state:')
      );
      return lastConnectionLog ? lastConnectionLog.includes('connected') : false;
    });

    const elapsed = Date.now() - startTime;
    console.log(`After ${elapsed}ms, connection still open: ${connectionStatus}`);

    // This test should FAIL - connection should still be open after 20s
    // This demonstrates the bug
    expect(connectionStatus).toBe(false); // Should be closed, but will be true (open)
  });
});
