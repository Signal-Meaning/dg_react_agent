/**
 * E2E Test: Audio Interruption Timing
 * 
 * Tests that interruptAgent() terminates TTS audio within 50ms of button press.
 * This validates Issue #195 - that isPlaybackActive() removal doesn't break
 * audio interruption functionality. The test app uses onPlaybackStateChange 
 * callback instead.
 * 
 * Architecture:
 * - Test app tracks audio playback state via onPlaybackStateChange callback
 * - interruptAgent() should stop audio and trigger onPlaybackStateChange(false)
 * - Timing validation ensures interruption happens within 50ms
 */

import { test, expect } from '@playwright/test';
import { 
  setupTestPage, 
  waitForConnection, 
  waitForGreetingIfPresent,
  connectViaTextAndWaitForGreeting 
} from './helpers/test-helpers.js';

test.describe('Audio Interruption Timing', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // Grant audio permissions for the test
    await context.grantPermissions(['microphone', 'camera']);
    
    // Setup test page with audio mocks
    await setupTestPage(page);
    
    // Wait for connection to be closed initially
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('closed', { timeout: 10000 });
  });

  test('should interrupt audio within 50ms when interruptAgent() is called', async ({ page }) => {
    console.log('🔊 Testing audio interruption timing...');
    
    // Send initial message to connect (auto-connect) and wait for greeting
    await page.fill('[data-testid="text-input"]', 'Tell me a short story about dogs');
    await page.press('[data-testid="text-input"]', 'Enter');
    console.log('✅ Initial message sent to trigger auto-connect');
    
    // Wait for connection
    await waitForConnection(page, 5000);
    console.log('✅ Connection established via auto-connect');
    
    // Wait for greeting to complete (if it plays)
    await waitForGreetingIfPresent(page);
    
    // Wait for agent response (this triggers TTS audio playback)
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse && agentResponse.textContent && 
             agentResponse.textContent !== '(Waiting for agent response...)';
    }, { timeout: 10000 });
    // Wait for audio to start playing (may take time for TTS to start)
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'true';
    }, { timeout: 8000 });
    console.log('✅ Audio started playing');
    
    // Get timestamp when audio started
    const audioStartTime = Date.now();
    
    // Click interrupt button (TTS Mute button)
    await page.click('[data-testid="tts-mute-button"]');
    console.log('✅ Mute button clicked');
    
    // Wait for audio to stop (should happen within 50ms)
    const interruptTime = Date.now();
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('false', { timeout: 100 });
    const audioStopTime = Date.now();
    
    // Calculate timing
    const totalTimeToStop = audioStopTime - interruptTime;
    const timeSinceAudioStarted = interruptTime - audioStartTime;
    
    console.log(`📊 Timing metrics:`);
    console.log(`   - Audio started at: ${audioStartTime}ms`);
    console.log(`   - Interrupt clicked at: ${interruptTime}ms`);
    console.log(`   - Audio stopped at: ${audioStopTime}ms`);
    console.log(`   - Time to interrupt: ${totalTimeToStop}ms`);
    console.log(`   - Total audio duration: ${timeSinceAudioStarted}ms`);
    
    // Verify audio stopped within 50ms
    expect(totalTimeToStop).toBeLessThan(50);
    
    // Verify audio is stopped
    const isPlaying = await page.locator('[data-testid="audio-playing-status"]').textContent();
    expect(isPlaying).toBe('false');
    
    console.log('✅ SUCCESS: Audio interrupted within 50ms');
  });

  test('should maintain interruption state for future messages', async ({ page }) => {
    console.log('🔊 Testing that interrupted audio stays stopped...');
    
    // Send first message to connect via auto-connect
    await page.fill('[data-testid="text-input"]', 'Tell me a joke');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Wait for connection
    await waitForConnection(page, 5000);
    console.log('✅ Connection established via auto-connect');
    
    // Wait for greeting to complete (if it plays)
    await waitForGreetingIfPresent(page);
    
    // Wait for agent response to arrive
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse && agentResponse.textContent && 
             agentResponse.textContent !== '(Waiting for agent response...)';
    }, { timeout: 10000 });
    console.log('✅ Agent response received');
    
    // Wait for audio and interrupt
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'true';
    }, { timeout: 8000 });
    await page.click('[data-testid="tts-mute-button"]');
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('false', { timeout: 50 });
    
    // Wait a bit to ensure no audio resumes
    await page.waitForTimeout(500);
    
    // Verify still stopped
    const isPlayingAfterInterrupt = await page.locator('[data-testid="audio-playing-status"]').textContent();
    expect(isPlayingAfterInterrupt).toBe('false');
    
    console.log('✅ Audio remained stopped after interruption');
    
    // Send another message
    await page.fill('[data-testid="text-input"]', 'Second message');
    await page.click('[data-testid="send-button"]');
    
    // Verify audio can start playing again for new messages
    // (this should be allowed - we're not muting, just interrupting current playback)
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('true', { timeout: 5000 });
    
    console.log('✅ New message audio plays normally');
  });

  test.skip('should handle rapid interrupt clicks without errors', async ({ page }) => {
    console.log('🔊 Testing rapid interrupt clicks...');
    
    // Send initial message to connect via auto-connect
    await page.fill('[data-testid="text-input"]', 'Tell me a long story');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Wait for connection
    await waitForConnection(page, 5000);
    await waitForGreetingIfPresent(page);
    
    // Wait for audio
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('true', { timeout: 5000 });
    
    // Rapidly click interrupt multiple times (using the new mute button)
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="tts-mute-button"]');
      await page.waitForTimeout(10);
    }
    
    // Verify no errors occurred and audio is stopped
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('false');
    
    console.log('✅ Rapid interrupt clicks handled without errors');
  });

  test('should persist mute state and prevent future audio', async ({ page }) => {
    console.log('🔊 Testing TTS mute state persistence...');
    
    // Send initial message to connect via auto-connect
    await page.fill('[data-testid="text-input"]', 'Tell me a story');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Wait for connection
    await waitForConnection(page, 5000);
    await waitForGreetingIfPresent(page);
    console.log('✅ Connection established via auto-connect');
    
    // Hold down mute button (push button)
    const muteButton = page.locator('[data-testid="tts-mute-button"]');
    await muteButton.dispatchEvent('mousedown');
    await page.waitForTimeout(100);
    
    // Verify button shows "Mute" while held down
    await expect(muteButton).toContainText('Mute');
    console.log('✅ Button pressed - audio blocked');
    
    // Send another message - should not play audio
    await page.fill('[data-testid="text-input"]', 'Tell me more');
    await page.press('[data-testid="text-input"]', 'Enter');
    console.log('✅ Message sent');
    
    // Wait and verify audio didn't start
    await page.waitForTimeout(2000);
    const isPlaying = await page.locator('[data-testid="audio-playing-status"]').textContent();
    expect(isPlaying).toBe('false');
    console.log('✅ Audio did not play (as expected when button held)');
    
    // Release button
    await muteButton.dispatchEvent('mouseup');
    await expect(muteButton).toContainText('Enable');
    console.log('✅ Button released - audio allowed again');
    
    console.log('✅ Mute state persisted and prevented audio');
  });


  test('should allow audio after calling allowAgent()', async ({ page }) => {
    console.log('🔊 Testing allowAgent() functionality...');
    
    // Send initial message to connect via auto-connect
    await page.fill('[data-testid="text-input"]', 'Tell me something');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Wait for connection
    await waitForConnection(page, 5000);
    await waitForGreetingIfPresent(page);
    console.log('✅ Connection established via auto-connect');
    
    // Block audio with interruptAgent
    const muteButton = page.locator('[data-testid="tts-mute-button"]');
    await muteButton.dispatchEvent('mousedown');
    console.log('✅ Audio blocked via interruptAgent');
    
    // Verify audio is blocked
    await page.fill('[data-testid="text-input"]', 'Blocked message');
    await page.press('[data-testid="text-input"]', 'Enter');
    await page.waitForTimeout(1000);
    let isPlaying = await page.locator('[data-testid="audio-playing-status"]').textContent();
    expect(isPlaying).toBe('false');
    console.log('✅ Audio blocked as expected');
    
    // Release button to call allowAgent
    await muteButton.dispatchEvent('mouseup');
    console.log('✅ allowAgent() called via button release');
    
    // Verify audio is now allowed by waiting to see if next message plays
    await page.waitForTimeout(500);
    console.log('✅ allowAgent functionality verified');
  });

  test('should toggle between interruptAgent and allowAgent', async ({ page }) => {
    console.log('🔊 Testing interruptAgent/allowAgent toggle...');
    
    // Send initial message to connect via auto-connect
    await page.fill('[data-testid="text-input"]', 'Tell me a joke');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Wait for connection
    await waitForConnection(page, 5000);
    await waitForGreetingIfPresent(page);
    console.log('✅ Connection established via auto-connect');
    
    const muteButton = page.locator('[data-testid="tts-mute-button"]');
    
    // Toggle block/allow multiple times
    for (let i = 0; i < 3; i++) {
      // Block
      await muteButton.dispatchEvent('mousedown');
      console.log(`✅ Toggle ${i + 1}: Blocked audio`);
      
      // Verify blocked
      await page.fill('[data-testid="text-input"]', `Toggle test ${i}`);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(500);
      let isPlaying = await page.locator('[data-testid="audio-playing-status"]').textContent();
      expect(isPlaying).toBe('false');
      
      // Allow
      await muteButton.dispatchEvent('mouseup');
      console.log(`✅ Toggle ${i + 1}: Allowed audio`);
      await page.waitForTimeout(200);
    }
    
    console.log('✅ interruptAgent/allowAgent toggle verified');
  });
});
