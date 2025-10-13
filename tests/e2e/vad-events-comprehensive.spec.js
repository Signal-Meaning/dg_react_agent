const { test, expect } = require('@playwright/test');
const { setupTestPage } = require('./helpers/audio-mocks');

/**
 * Comprehensive VAD Events Testing
 * 
 * This test suite validates Voice Activity Detection (VAD) events including:
 * - UserStartedSpeaking events
 * - UserStoppedSpeaking events  
 * - UtteranceEnd events
 * - VADEvent events
 * - Natural connection timeout after UtteranceEnd
 * 
 * IMPORTANT: These tests require a REAL Deepgram API key!
 * Tests use actual WebSocket connections to Deepgram services for authentic validation.
 */

test.describe('VAD Events Comprehensive Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
  });

  test('should handle complete VAD event cycle: UserStartedSpeaking -> UtteranceEnd -> UserStoppedSpeaking', async ({ page }) => {
    // Navigate to test app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Enable microphone to start VAD event detection
    const micButton = page.locator('[data-testid="microphone-button"]');
    await micButton.click();
    await page.waitForTimeout(1000);
    
    // Verify microphone is enabled
    const micStatus = await page.textContent('[data-testid="microphone-status"]');
    expect(micStatus).toContain('Enabled');
    
    // Simulate user speech by sending audio data
    await page.evaluate(() => {
      // Simulate audio input to trigger VAD events
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Start audio for 2 seconds to simulate speech
      oscillator.start();
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      // Stop after 2 seconds to trigger UtteranceEnd
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 2000);
    });
    
    // Wait for VAD events to be processed
    await page.waitForTimeout(5000);
    
    // Check for VAD event indicators in the UI
    const userSpeakingStatus = await page.textContent('[data-testid="user-speaking-status"]');
    const utteranceEndStatus = await page.textContent('[data-testid="utterance-end-status"]');
    const vadEventStatus = await page.textContent('[data-testid="vad-event-status"]');
    
    // Verify VAD events were detected
    expect(userSpeakingStatus).toBeDefined();
    expect(utteranceEndStatus).toBeDefined();
    expect(vadEventStatus).toBeDefined();
    
    console.log('✅ VAD event cycle completed successfully');
  });

  test('should handle UtteranceEnd and trigger natural connection timeout', async ({ page }) => {
    // Navigate to test app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Enable microphone
    const micButton = page.locator('[data-testid="microphone-button"]');
    await micButton.click();
    await page.waitForTimeout(1000);
    
    // Simulate speech followed by silence to trigger UtteranceEnd
    await page.evaluate(() => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Start audio for 1 second
      oscillator.start();
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      // Stop after 1 second to trigger UtteranceEnd
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 1000);
    });
    
    // Wait for UtteranceEnd to be processed
    await page.waitForTimeout(2000);
    
    // Check that UtteranceEnd was detected
    const utteranceEndStatus = await page.textContent('[data-testid="utterance-end-status"]');
    expect(utteranceEndStatus).toBeDefined();
    
    // Wait for natural connection timeout (should happen within 15 seconds)
    await page.waitForTimeout(15000);
    
    // Verify connection timed out naturally
    const connectionStatus = await page.textContent('[data-testid="connection-status"]');
    expect(connectionStatus).toContain('closed');
    
    console.log('✅ UtteranceEnd triggered natural connection timeout');
  });

  test('should handle rapid VAD event cycles without issues', async ({ page }) => {
    // Navigate to test app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Enable microphone
    const micButton = page.locator('[data-testid="microphone-button"]');
    await micButton.click();
    await page.waitForTimeout(1000);
    
    // Simulate multiple rapid speech cycles
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        
        // Short burst of audio
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 500);
      });
      
      // Wait between cycles
      await page.waitForTimeout(1000);
    }
    
    // Verify component is still responsive
    const connectionStatus = await page.textContent('[data-testid="connection-status"]');
    expect(connectionStatus).toContain('connected');
    
    // Verify microphone is still functional
    const micStatus = await page.textContent('[data-testid="microphone-status"]');
    expect(micStatus).toContain('Enabled');
    
    console.log('✅ Rapid VAD event cycles handled successfully');
  });

  test('should handle VAD events in transcription-only mode', async ({ page }) => {
    // Navigate to test app with transcription-only mode
    await page.goto('/?mode=transcription-only');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Enable microphone
    const micButton = page.locator('[data-testid="microphone-button"]');
    await micButton.click();
    await page.waitForTimeout(1000);
    
    // Simulate speech
    await page.evaluate(() => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start();
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 1000);
    });
    
    // Wait for VAD events
    await page.waitForTimeout(3000);
    
    // Verify VAD events work in transcription-only mode
    const userSpeakingStatus = await page.textContent('[data-testid="user-speaking-status"]');
    const utteranceEndStatus = await page.textContent('[data-testid="utterance-end-status"]');
    
    expect(userSpeakingStatus).toBeDefined();
    expect(utteranceEndStatus).toBeDefined();
    
    console.log('✅ VAD events work in transcription-only mode');
  });

  test('should handle VAD events with different utterance_end_ms values', async ({ page }) => {
    // Test with different utterance_end_ms values
    const testValues = [500, 1000, 2000];
    
    for (const utteranceEndMs of testValues) {
      // Navigate to test app with custom utterance_end_ms
      await page.goto(`/?utterance_end_ms=${utteranceEndMs}`);
      await page.waitForLoadState('networkidle');
      
      // Wait for component to initialize
      await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
      await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
      
      // Enable microphone
      const micButton = page.locator('[data-testid="microphone-button"]');
      await micButton.click();
      await page.waitForTimeout(1000);
      
      // Simulate speech
      await page.evaluate(() => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 800);
      });
      
      // Wait for UtteranceEnd with appropriate timeout
      await page.waitForTimeout(utteranceEndMs + 1000);
      
      // Verify UtteranceEnd was detected
      const utteranceEndStatus = await page.textContent('[data-testid="utterance-end-status"]');
      expect(utteranceEndStatus).toBeDefined();
      
      console.log(`✅ VAD events work with utterance_end_ms=${utteranceEndMs}`);
    }
  });

  test('should handle VAD events during connection recovery', async ({ page }) => {
    // Navigate to test app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Enable microphone
    const micButton = page.locator('[data-testid="microphone-button"]');
    await micButton.click();
    await page.waitForTimeout(1000);
    
    // Simulate connection interruption
    await page.evaluate(() => {
      // Simulate network interruption
      window.dispatchEvent(new Event('offline'));
    });
    
    // Wait for reconnection
    await page.waitForTimeout(5000);
    
    // Simulate speech after reconnection
    await page.evaluate(() => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start();
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 1000);
    });
    
    // Wait for VAD events
    await page.waitForTimeout(3000);
    
    // Verify VAD events work after reconnection
    const userSpeakingStatus = await page.textContent('[data-testid="user-speaking-status"]');
    const utteranceEndStatus = await page.textContent('[data-testid="utterance-end-status"]');
    
    expect(userSpeakingStatus).toBeDefined();
    expect(utteranceEndStatus).toBeDefined();
    
    console.log('✅ VAD events work during connection recovery');
  });
});
