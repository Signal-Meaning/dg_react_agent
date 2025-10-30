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
const ENABLE_AUDIO = process.env.PW_ENABLE_AUDIO === 'true';
import { 
  setupTestPage, 
  waitForConnection, 
  waitForConnectionAndSettings,
  waitForGreetingIfPresent,
  sendMessageAndWaitForResponse,
  waitForPlaybackStart,
  getAudioDiagnostics
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

  test.skip('should interrupt audio within 50ms when interruptAgent() is called', async ({ page }) => {
    console.log('🔊 Testing audio interruption timing...');
    
    // Send a message to trigger auto-connect and get agent response
    await page.fill('[data-testid="text-input"]', 'Tell me a short story about dogs');
    await page.press('[data-testid="text-input"]', 'Enter');
    console.log('✅ Message sent (triggers auto-connect)');
    
    // Wait for connection
    await waitForConnection(page, 5000);
    console.log('✅ Connection established');
    
    // Wait for agent response to arrive
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse && agentResponse.textContent && 
             agentResponse.textContent !== '(Waiting for agent response...)';
    }, { timeout: 10000 });
    console.log('✅ Agent response received');
    
    // Give TTS a moment to start processing
    await page.waitForTimeout(2000);
    
    // Wait for audio to start playing (may take time for TTS to start)
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'true';
    }, { timeout: 6000 });
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

  if (!ENABLE_AUDIO) {
    test.skip(true, 'PW_ENABLE_AUDIO is not enabled; skipping audio playback-dependent test.');
  }
  test('should persist mute state and prevent future audio', async ({ page }) => {
    console.log('🔊 Testing TTS mute state persistence...');
    
    // Focus text input first to trigger AudioManager initialization and allow AudioContext resume
    await page.click('[data-testid="text-input"]');
    
    // Wait for connection and settings to be applied (agent ready to respond)
    await waitForConnectionAndSettings(page, 5000, 10000);
    console.log('✅ Connection established and settings applied');
    
    
    // Detect greeting playback immediately after connection/settings
    try {
      await waitForPlaybackStart(page, 6000);
      console.log('✅ Greeting/agent playback detected');
    } catch (e) {
      throw new Error('Gate failed: No playback started within 6s after SettingsApplied (no greeting audio detected)');
    }

    // Send first message and wait for agent response
    await sendMessageAndWaitForResponse(page, 'Tell me a story');
    // Minimal diagnostic: log AudioContext state and isPlaying at response time
    const diag1 = await getAudioDiagnostics(page);
    console.log('🔎 Audio diagnostic after first response:', diag1);
    console.log('✅ Agent response received');
    
    // Wait for audio to start playing (after greeting/response begins)
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'true';
    }, { timeout: 6000 });
    console.log('✅ Audio is playing');
    
    // Now hold down mute button (push button)
    const muteButton = page.locator('[data-testid="tts-mute-button"]');
    await muteButton.dispatchEvent('mousedown');
    // Wait until audio has stopped instead of a fixed delay
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('false', { timeout: 2000 });
    
    // Verify button shows "Mute" while held down
    await expect(muteButton).toContainText('Mute');
    console.log('✅ Button pressed - audio blocked');
    
    // Send another message - should not play audio while held
    await sendMessageAndWaitForResponse(page, 'Tell me more');
    const diag2 = await getAudioDiagnostics(page);
    console.log('🔎 Audio diagnostic after second response (while held):', diag2);
    console.log('✅ Message sent');
    
    // Verify audio did not start while muted
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('false', { timeout: 2000 });
    console.log('✅ Audio did not play (as expected when button held)');
    
    // Release button
    await muteButton.dispatchEvent('mouseup');
    await expect(muteButton).toContainText('Enable');
    console.log('✅ Button released - audio allowed again');
    
    console.log('✅ Mute state persisted and prevented audio');
  });


  if (!ENABLE_AUDIO) {
    test.skip(true, 'PW_ENABLE_AUDIO is not enabled; skipping audio playback-dependent test.');
  }
  test('should interrupt and allow audio repeatedly', async ({ page }) => {
    console.log('🔊 Testing interruptAgent/allowAgent functionality...');
    
    // Focus text input first to trigger AudioManager initialization and allow AudioContext resume
    await page.click('[data-testid="text-input"]');
  
    
    // Wait for connection and settings to be applied (agent ready to respond)
    await waitForConnectionAndSettings(page, 5000, 10000);
    console.log('✅ Connection established and settings applied');
    
    // Detect greeting playback immediately after connection/settings
    try {
      await waitForPlaybackStart(page, 6000);
      console.log('✅ Greeting/agent playback detected');
    } catch (e) {
      throw new Error('Gate failed: No playback started within 6s after SettingsApplied (no greeting audio detected)');
    }

    // Send first message to connect and wait for response
    await sendMessageAndWaitForResponse(page, 'Tell me a joke');
    const diag3 = await getAudioDiagnostics(page);
    console.log('🔎 Audio diagnostic after joke response:', diag3);
    
    console.log('✅ Agent response received');
    
    // Wait for audio to start playing
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'true';
    }, { timeout: 6000 });
    console.log('✅ Audio started playing');
    
    const muteButton = page.locator('[data-testid="tts-mute-button"]');
    
    // Toggle block/allow multiple times to verify functionality
    for (let i = 0; i < 3; i++) {
      // Block audio
      await muteButton.dispatchEvent('mousedown');
      console.log(`✅ Toggle ${i + 1}: Blocked audio`);
      
      // Verify audio stopped
      await page.waitForTimeout(100);
      let isPlaying = await page.locator('[data-testid="audio-playing-status"]').textContent();
      expect(isPlaying).toBe('false');
      console.log(`✅ Toggle ${i + 1}: Audio confirmed stopped`);
      
      // Allow audio
      await muteButton.dispatchEvent('mouseup');
      console.log(`✅ Toggle ${i + 1}: Allowed audio`);
      
      // Send a message and verify audio can play again
      await sendMessageAndWaitForResponse(page, `Message ${i}`);
      
      // Wait for agent response
      await page.waitForFunction(() => {
        const agentResponse = document.querySelector('[data-testid="agent-response"]');
        return agentResponse && agentResponse.textContent && 
               agentResponse.textContent !== '(Waiting for agent response...)';
      }, { timeout: 10000 });
      
      // Verify audio is playing again
      await page.waitForFunction(() => {
        const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
        return audioPlaying && audioPlaying.textContent === 'true';
      }, { timeout: 6000 });
      console.log(`✅ Toggle ${i + 1}: Audio confirmed playing after unmuting`);
    }
    
    console.log('✅ interruptAgent/allowAgent functionality verified with audio playback');
  });
});
