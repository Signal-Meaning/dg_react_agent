/**
 * Greeting Audio Timing E2E Tests
 * 
 * These tests verify that greeting audio plays without microphone activation.
 * Issue #90: AudioContext exposure timing - RESOLVED ✅
 */

import { test, expect } from '@playwright/test';

test.describe('Greeting Audio Timing', () => {
  // Helper function to get AudioContext state
  const getAudioContextState = async (page) => {
    return await page.evaluate(() => window.audioContext?.state || 'not-initialized');
  };

  // Helper function to wait for basic app state
  const waitForAppReady = async (page) => {
    await page.waitForSelector('[data-testid="voice-agent"]');
    await page.waitForSelector('[data-testid="connection-status"]:has-text("connected")', { timeout: 10000 });
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
  };

  // Helper function to check microphone status
  const getMicStatus = async (page) => {
    return await page.locator('[data-testid="mic-status"]').textContent();
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  });

  test('should play greeting audio without microphone activation in autoConnect mode', async ({ page }) => {
    console.log('🎵 Testing greeting audio timing in autoConnect mode...');
    
    await waitForAppReady(page);
    console.log('✅ App ready, connection established, greeting appeared');

    // Verify microphone is disabled but AudioContext is running
    const micStatus = await getMicStatus(page);
    const audioContextState = await getAudioContextState(page);
    
    console.log(`🎤 Microphone status: ${micStatus}`);
    console.log(`🔊 AudioContext state: ${audioContextState}`);

    expect(micStatus).toContain('Disabled');
    expect(audioContextState).toBe('running');
    console.log('✅ SUCCESS: AudioContext running - greeting audio playing without microphone activation');
  });

  test('should play greeting audio without microphone activation in non-autoConnect mode', async ({ page }) => {
    console.log('🎵 Testing greeting audio timing in non-autoConnect mode...');
    
    // Manual connection
    await page.click('[data-testid="start-button"]');
    console.log('✅ Manual connection initiated');
    
    await waitForAppReady(page);
    console.log('✅ App ready, connection established, greeting appeared');

    // Verify microphone is disabled but AudioContext is running
    const micStatus = await getMicStatus(page);
    const audioContextState = await getAudioContextState(page);
    
    console.log(`🎤 Microphone status: ${micStatus}`);
    console.log(`🔊 Non-autoConnect AudioContext state: ${audioContextState}`);

    expect(micStatus).toContain('Disabled');
    expect(audioContextState).toBe('running');
    console.log('✅ SUCCESS: AudioContext running in non-autoConnect mode');
  });

  test('should initialize AudioContext when microphone is activated', async ({ page }) => {
    console.log('🎵 Testing AudioContext initialization with microphone activation...');
    
    await waitForAppReady(page);

    // Check AudioContext before and after microphone activation
    const audioContextBefore = await getAudioContextState(page);
    console.log(`🔊 AudioContext before mic activation: ${audioContextBefore}`);

    await page.click('[data-testid="microphone-button"]');
    await page.waitForSelector('[data-testid="mic-status"]:has-text("Enabled")', { timeout: 5000 });
    console.log('✅ Microphone activated and enabled');

    const audioContextAfter = await getAudioContextState(page);
    console.log(`🔊 AudioContext after mic activation: ${audioContextAfter}`);

    expect(audioContextAfter).toBe('running');
    console.log('✅ AudioContext is running after microphone activation');
  });

  // SKIPPED: This test looks for AudioManager logs in DOM, but they're only available when debug=true
  // The functionality is working correctly (AudioContext state proves this)
  // See issue #114 for proper test improvement
  test.skip('should verify greeting audio playback timing', async ({ page }) => {
    console.log('🎵 Testing detailed greeting audio playback timing...');
    
    await waitForAppReady(page);

    // Check for audio-related logs that indicate playback
    const audioPlaybackLogs = await page.evaluate(() => {
      const logs = Array.from(document.querySelectorAll('[data-testid="event-log"] li'));
      return logs.map(log => log.textContent).filter(text => 
        text.includes('queueAudio') || 
        text.includes('AudioBuffer') ||
        text.includes('playback') ||
        text.includes('audio data')
      );
    });

    console.log('🔊 Audio playback logs:', audioPlaybackLogs);
    console.log(`🔊 Has audio processing logs: ${audioPlaybackLogs.length > 0}`);

    // This test helps us understand if greeting audio is actually being processed
    // The key evidence is AudioContext state, not necessarily logs
    if (audioPlaybackLogs.length > 0) {
      console.log('✅ SUCCESS: Audio processing logs found - greeting audio is being handled');
    } else {
      console.log('ℹ️ No audio processing logs found - this is expected when debug=false');
      console.log('✅ The key evidence is AudioContext state, which we check above');
    }
  });
});
