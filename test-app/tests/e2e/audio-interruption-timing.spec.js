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

test.describe('Audio Interruption Timing', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // Grant audio permissions for the test
    await context.grantPermissions(['microphone', 'camera']);
    
    // Navigate to test app
    await page.goto('http://localhost:5173');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for connection to be closed initially
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('closed', { timeout: 10000 });
  });

  test.skip('should interrupt audio within 50ms when interruptAgent() is called', async ({ page }) => {
    console.log('🔊 Testing audio interruption timing...');
    
    // Get user interaction by clicking text input to enable audio playback
    await page.click('[data-testid="text-input"]');
    await page.waitForTimeout(200);
    
    // Start the connection
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    console.log('✅ Connection established');
    
    // Send a message that triggers audio playback
    await page.fill('[data-testid="text-input"]', 'Tell me a short story about dogs');
    await page.click('[data-testid="send-button"]');
    console.log('✅ Message sent');
    
    // Wait for audio to start playing
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('true', { timeout: 5000 });
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

  test.skip('should maintain interruption state for future messages', async ({ page }) => {
    console.log('🔊 Testing that interrupted audio stays stopped...');
    
    // Get user interaction by clicking text input to enable audio playback
    await page.click('[data-testid="text-input"]');
    await page.waitForTimeout(200);
    
    // Start the connection
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    
    // Send first message and interrupt
    await page.fill('[data-testid="text-input"]', 'First message');
    await page.click('[data-testid="send-button"]');
    
    // Wait for audio and interrupt
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('true', { timeout: 5000 });
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
    
    // Start the connection
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    
    // Send a message
    await page.fill('[data-testid="text-input"]', 'Long message');
    await page.click('[data-testid="send-button"]');
    
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
    
    // Get user interaction by clicking text input to enable audio playback
    await page.click('[data-testid="text-input"]');
    await page.waitForTimeout(200);
    
    // Start connection
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    console.log('✅ Connection established');
    
    // Mute TTS
    await page.click('[data-testid="tts-mute-button"]');
    const muteButton = page.locator('[data-testid="tts-mute-button"]');
    await expect(muteButton).toContainText('Muted');
    console.log('✅ TTS muted');
    
    // Send a message - should not play audio (or should be interrupted immediately)
    await page.fill('[data-testid="text-input"]', 'Hello test message');
    await page.click('[data-testid="send-button"]');
    console.log('✅ Message sent');
    
    // Wait and verify audio either doesn't start or is stopped quickly
    await page.waitForTimeout(2000);
    const isPlaying = await page.locator('[data-testid="audio-playing-status"]').textContent();
    expect(isPlaying).toBe('false');
    console.log('✅ Audio did not play (as expected when muted)');
    
    // Verify mute state persists
    await expect(muteButton).toContainText('Muted');
    console.log('✅ Mute state persisted');
    
    // Unmute
    await page.click('[data-testid="tts-mute-button"]');
    await expect(muteButton).toContainText('Enabled');
    console.log('✅ TTS unmuted');
    
    console.log('✅ Mute state persisted and prevented audio');
  });
});
