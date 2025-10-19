const { test, expect } = require('@playwright/test');
const { setupTestPage, simulateSpeech } = require('./helpers/audio-mocks');

/**
 * Manual VAD Workflow Test
 * 
 * This test replicates the exact manual testing workflow:
 * 1. Turn on microphone
 * 2. Talk to agent ("wait one moment") 
 * 3. Stay silent (should trigger UtteranceEnd)
 * 4. Connection should close due to timeout
 * 
 * This test uses real Deepgram APIs to validate actual VAD behavior.
 */

test.describe('Manual VAD Workflow Tests', () => {

  test('should handle complete manual workflow: speak → silence → timeout', async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
    
    // Step 1: Turn on microphone
    console.log('Step 1: Turning on microphone...');
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for microphone to be enabled (same approach as working test)
    await page.waitForTimeout(3000);
    
    // Check if microphone status changed
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    
    // Verify microphone is enabled
    expect(micStatusAfterClick).toBe('Enabled');
    console.log('✅ Microphone enabled');
    
    // Step 2: Talk to agent ("wait one moment")
    console.log('Step 2: Simulating speech "wait one moment"...');
    
    // Simulate speech using shared utility
    await simulateSpeech(page, 'wait one moment');
    
    // Wait for potential agent response
    await page.waitForTimeout(3000);
    
    // Check if agent responded (optional - event log might not exist)
    try {
      const eventLog = await page.locator('[data-testid="event-log"]').textContent({ timeout: 2000 });
      console.log('Event log after speech:', eventLog);
    } catch (error) {
      console.log('Event log not found or not accessible:', error.message);
    }
    
    // Step 3: Stay silent (should trigger UtteranceEnd)
    console.log('Step 3: Staying silent to trigger UtteranceEnd...');
    
    // Wait for UtteranceEnd detection (should happen after 1 second of silence)
    await page.waitForTimeout(3000);
    
    // Check if UtteranceEnd was detected
    const utteranceEndStatus = await page.locator('[data-testid="utterance-end"]').textContent();
    console.log('UtteranceEnd status:', utteranceEndStatus);
    
    // Step 4: Connection should close due to timeout
    console.log('Step 4: Waiting for connection to close due to timeout...');
    
    // Wait for connection to close (should happen after timeout)
    await page.waitForTimeout(10000);
    
    // Check if connection closed
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('Final connection status:', connectionStatus);
    
    // Verify the workflow completed
    expect(utteranceEndStatus).toContain('detected');
    expect(connectionStatus).toContain('closed');
    
    console.log('✅ Manual VAD workflow completed successfully');
  });

  test('should detect VAD events during manual workflow', async ({ page }) => {
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled', { timeout: 10000 });
    
    // Monitor VAD events
    const vadEvents = [];
    
    // Listen for VAD event changes
    await page.exposeFunction('onVADEvent', (eventType, status) => {
      vadEvents.push({ type: eventType, status, timestamp: Date.now() });
      console.log(`VAD Event: ${eventType} = ${status}`);
    });
    
    // Set up VAD event monitoring
    await page.evaluate(() => {
      const vadElements = {
        'user-speaking': '[data-testid="user-speaking"]',
        'user-stopped-speaking': '[data-testid="user-stopped-speaking"]', 
        'utterance-end': '[data-testid="utterance-end"]',
        'vad-event': '[data-testid="vad-event"]'
      };
      
      // Monitor changes to VAD elements
      Object.entries(vadElements).forEach(([eventType, selector]) => {
        const element = document.querySelector(selector);
        if (element) {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'childList' || mutation.type === 'characterData') {
                window.onVADEvent(eventType, element.textContent);
              }
            });
          });
          observer.observe(element, { childList: true, characterData: true, subtree: true });
        }
      });
    });
    
    // Simulate speech with realistic audio
    const AudioTestHelpers = require('../utils/audio-helpers');
    await AudioTestHelpers.simulateVADSpeech(page, 'Manual VAD workflow test', {
      silenceDuration: 1000,
      onsetSilence: 300
    });
    
    // Wait for VAD events
    await page.waitForTimeout(5000);
    
    // Check if we detected any VAD events
    console.log('VAD Events detected:', vadEvents);
    
    // Verify we got some VAD events
    expect(vadEvents.length).toBeGreaterThan(0);
    
    // Look for specific VAD events
    const userSpeakingEvents = vadEvents.filter(e => e.type === 'user-speaking');
    const utteranceEndEvents = vadEvents.filter(e => e.type === 'utterance-end');
    
    console.log('UserSpeaking events:', userSpeakingEvents);
    console.log('UtteranceEnd events:', utteranceEndEvents);
    
    // We should have at least some VAD activity
    expect(userSpeakingEvents.length + utteranceEndEvents.length).toBeGreaterThan(0);
  });

  test('should show VAD events in console logs during manual workflow', async ({ page }) => {
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled', { timeout: 10000 });
    
    // Capture console logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('VAD')) {
        consoleLogs.push(msg.text());
        console.log('VAD Console Log:', msg.text());
      }
    });
    
    // Simulate speech
    await page.evaluate(() => {
      const audioData = new ArrayBuffer(8192);
      window.dispatchEvent(new CustomEvent('simulate-audio-data', { detail: audioData }));
    });
    
    // Wait for VAD events
    await page.waitForTimeout(5000);
    
    // Check if we got VAD console logs
    console.log('All VAD Console Logs:', consoleLogs);
    
    // We should have some VAD-related console logs
    expect(consoleLogs.length).toBeGreaterThan(0);
  });
});
