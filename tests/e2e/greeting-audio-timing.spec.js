/**
 * Greeting Audio Timing E2E Tests
 * 
 * These tests investigate Issue #43: Greetings not played until microphone activation
 * Specifically testing if this issue is autoConnect-specific.
 */

const { test, expect } = require('@playwright/test');

test.describe('Greeting Audio Timing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test app
    await page.goto('http://localhost:5173');
    
    // Wait for the app to load
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  });

  test('should play greeting audio without microphone activation in autoConnect mode', async ({ page }) => {
    console.log('🎵 Testing greeting audio timing in autoConnect mode...');
    
    // Wait for component to be ready (using the correct selector)
    await page.waitForSelector('[data-testid="voice-agent"]');
    console.log('✅ Component is ready');

    // Wait for connection to be established
    await page.waitForSelector('[data-testid="connection-status"]:has-text("connected")', { timeout: 10000 });
    console.log('✅ Connection established');

    // Wait for greeting to appear in logs/text
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
    console.log('✅ Greeting text appeared');

    // Check microphone status - should be disabled initially
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    console.log(`🎤 Microphone status: ${micStatus}`);
    expect(micStatus).toContain('Disabled');

    // Check if AudioContext is running (indicates audio playback)
    const audioContextState = await page.evaluate(() => {
      return window.audioContext?.state || 'not-initialized';
    });
    console.log(`🔊 AudioContext state: ${audioContextState}`);

    // Check if audio is actually playing by looking for audio-related logs
    const audioLogs = await page.evaluate(() => {
      const logs = Array.from(document.querySelectorAll('[data-testid="event-log"] li'));
      return logs.map(log => log.textContent).filter(text => 
        text.includes('audio') || 
        text.includes('playback') || 
        text.includes('AudioContext') ||
        text.includes('queueAudio')
      );
    });

    console.log('🔊 Audio-related logs:', audioLogs);

    // The key test: AudioContext should be running even with microphone disabled
    // This would indicate that greeting audio is playing without microphone activation
    if (audioContextState === 'running') {
      console.log('✅ SUCCESS: AudioContext is running - greeting audio is playing without microphone activation');
      expect(audioContextState).toBe('running');
    } else {
      console.log('❌ ISSUE CONFIRMED: AudioContext is not running - greeting audio requires microphone activation');
      console.log(`AudioContext state: ${audioContextState}`);
      
      // This would confirm Issue #43 exists
      expect(audioContextState).toBe('running');
    }
  });

  test('should play greeting audio without microphone activation in non-autoConnect mode', async ({ page }) => {
    console.log('🎵 Testing greeting audio timing in non-autoConnect mode...');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    console.log('✅ Component is ready');

    // Manually connect (simulate user interaction)
    await page.click('[data-testid="start-button"]');
    console.log('✅ Manual connection initiated');

    // Wait for connection to be established
    await page.waitForSelector('[data-testid="connection-status"]:has-text("connected")', { timeout: 10000 });
    console.log('✅ Connection established');

    // Wait for greeting to appear in logs/text
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
    console.log('✅ Greeting text appeared');

    // Check microphone status - should be disabled initially
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    console.log(`🎤 Microphone status: ${micStatus}`);
    expect(micStatus).toContain('Disabled');

    // Check if AudioContext is running
    const audioContextState = await page.evaluate(() => {
      return window.audioContext?.state || 'not-initialized';
    });
    console.log(`🔊 AudioContext state: ${audioContextState}`);

    // In non-autoConnect mode, audio might not be initialized until microphone is activated
    // This test helps us understand if the issue is autoConnect-specific
    console.log(`🔊 Non-autoConnect AudioContext state: ${audioContextState}`);
    
    // We expect this might be different from autoConnect mode
    // This helps us understand if Issue #43 is autoConnect-specific
  });

  test('should initialize AudioContext when microphone is activated', async ({ page }) => {
    console.log('🎵 Testing AudioContext initialization with microphone activation...');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    await page.waitForSelector('[data-testid="connection-status"]:has-text("connected")', { timeout: 10000 });

    // Check AudioContext state before microphone activation
    const audioContextStateBefore = await page.evaluate(() => {
      return window.audioContext?.state || 'not-initialized';
    });
    console.log(`🔊 AudioContext before mic activation: ${audioContextStateBefore}`);

    // Activate microphone
    await page.click('[data-testid="microphone-button"]');
    console.log('🎤 Microphone activated');

    // Wait for microphone to be enabled
    await page.waitForSelector('[data-testid="mic-status"]:has-text("Enabled")', { timeout: 5000 });
    console.log('✅ Microphone enabled');

    // Check AudioContext state after microphone activation
    const audioContextStateAfter = await page.evaluate(() => {
      return window.audioContext?.state || 'not-initialized';
    });
    console.log(`🔊 AudioContext after mic activation: ${audioContextStateAfter}`);

    // AudioContext should definitely be running after microphone activation
    expect(audioContextStateAfter).toBe('running');
    console.log('✅ AudioContext is running after microphone activation');
  });

  test('should verify greeting audio playback timing', async ({ page }) => {
    console.log('🎵 Testing detailed greeting audio playback timing...');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    await page.waitForSelector('[data-testid="connection-status"]:has-text("connected")', { timeout: 10000 });

    // Wait for greeting to appear
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });

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

    // Check if there are any audio processing logs
    const hasAudioProcessing = audioPlaybackLogs.length > 0;
    console.log(`🔊 Has audio processing logs: ${hasAudioProcessing}`);

    // This test helps us understand if greeting audio is actually being processed
    // regardless of AudioContext state
    if (hasAudioProcessing) {
      console.log('✅ SUCCESS: Audio processing logs found - greeting audio is being handled');
    } else {
      console.log('❌ ISSUE: No audio processing logs found - greeting audio may not be playing');
    }
  });
});
