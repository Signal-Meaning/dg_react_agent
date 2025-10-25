/**
 * Greeting Audio Timing E2E Tests
 * 
 * These tests verify that greeting audio plays correctly based on user interactions.
 * Architecture: Agent service includes TTS channel, auto-connects and buffers greeting,
 * then plays when user interacts (text input focus or mic button press).
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

  // Helper function to check audio playback status
  const getAudioPlayingStatus = async (page) => {
    return await page.locator('[data-testid="audio-playing-status"]').textContent();
  };

  // Helper function to wait for audio playback to start
  const waitForAudioPlaybackStart = async (page, timeout = 5000) => {
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('true', { timeout });
  };

  // Helper function to verify initial state (DRY)
  const verifyInitialState = async (page) => {
    const micStatus = await getMicStatus(page);
    const audioPlayingStatus = await getAudioPlayingStatus(page);
    const audioContextState = await getAudioContextState(page);
    
    console.log(`🎤 Microphone status: ${micStatus}`);
    console.log(`🔊 Audio playing status: ${audioPlayingStatus}`);
    console.log(`🔊 AudioContext state: ${audioContextState}`);

    expect(micStatus).toContain('Disabled');
    expect(audioPlayingStatus).toBe('false');
    expect(audioContextState).toBe('running');
  };


  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  });

  test('should play greeting audio when user clicks into text input field', async ({ page }) => {
    console.log('🎵 Testing greeting playback on text input focus...');
    
    // Wait for app ready and agent connection established
    await waitForAppReady(page);
    console.log('✅ App ready, agent connection established, greeting buffered');

    // Verify initial state - microphone disabled, audio not playing
    await verifyInitialState(page);

    // Click into text input field to trigger greeting playback
    await page.click('input[type="text"]');
    console.log('✅ Text input field clicked - should trigger greeting playback');

    // Wait for audio playback to start
    await waitForAudioPlaybackStart(page);
    console.log('✅ Greeting audio playback started');

    // Verify audio is playing
    const playingStatus = await getAudioPlayingStatus(page);
    expect(playingStatus).toBe('true');
    console.log('✅ SUCCESS: Greeting audio is playing after text input focus');
  });

  test('should play greeting audio when user presses microphone button', async ({ page }) => {
    console.log('🎵 Testing greeting playback on microphone activation...');
    
    // Wait for app ready and agent connection established
    await waitForAppReady(page);
    console.log('✅ App ready, agent connection established, greeting buffered');

    // Verify initial state - microphone disabled, audio not playing
    await verifyInitialState(page);

    // Click microphone button to connect to both services and trigger greeting
    await page.click('[data-testid="microphone-button"]');
    console.log('✅ Microphone button clicked - should connect to both services and trigger greeting');

    // Wait for microphone to be enabled
    await page.waitForSelector('[data-testid="mic-status"]:has-text("Enabled")', { timeout: 5000 });
    console.log('✅ Microphone enabled - both agent and transcription services connected');

    // Wait for audio playback to start
    await waitForAudioPlaybackStart(page);
    console.log('✅ Greeting audio playback started');

    // Verify audio is playing
    const playingStatus = await getAudioPlayingStatus(page);
    expect(playingStatus).toBe('true');

    // Verify microphone is enabled
    const enabledMicStatus = await getMicStatus(page);
    expect(enabledMicStatus).toContain('Enabled');
    console.log('✅ SUCCESS: Greeting audio is playing after microphone activation');
  });

  test('should replay greeting audio immediately on reconnection', async ({ page }) => {
    console.log('🎵 Testing greeting replay on reconnection...');
    
    // Wait for app ready and agent connection established
    await waitForAppReady(page);
    console.log('✅ App ready, agent connection established, greeting buffered');

    // Verify initial state
    const audioPlayingStatus = await getAudioPlayingStatus(page);
    expect(audioPlayingStatus).toBe('false');

    // Trigger initial greeting playback via text input
    await page.click('input[type="text"]');
    await waitForAudioPlaybackStart(page);
    console.log('✅ Initial greeting played successfully');

    // Disconnect by triggering timeout
    await page.click('[data-testid="trigger-timeout-button"]');
    console.log('✅ Connection timeout triggered');

    // Wait for connection status to change to 'closed' (exact value, not text parsing)
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="connection-status"]');
      return statusElement && statusElement.textContent === 'closed';
    }, { timeout: 10000 });
    console.log('✅ Connection status changed to closed');

    // Reconnect by clicking into text input field (triggers agent connection)
    await page.click('input[type="text"]');
    console.log('✅ Text input clicked - should trigger reconnection and greeting replay');

    // Wait for audio playback to start (should happen immediately on reconnection)
    await waitForAudioPlaybackStart(page);
    console.log('✅ Greeting audio replayed successfully');

    // Verify audio is playing
    const playingStatus = await getAudioPlayingStatus(page);
    expect(playingStatus).toBe('true');
    console.log('✅ SUCCESS: Greeting audio replayed after reconnection');
  });
});