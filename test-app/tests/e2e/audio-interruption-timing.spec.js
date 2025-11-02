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
  waitForAudioPlaybackStart as waitForPlaybackStart,
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
    
    // Wait for button text to update (React state update)
    await expect(muteButton).toContainText('Mute', { timeout: 2000 });
    console.log('✅ Button pressed - button text updated');
    
    // Wait until audio has stopped instead of a fixed delay
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('false', { timeout: 2000 });
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
  test('should persist audio blocking across agent response turns (Issue #223)', async ({ page }) => {
    console.log('🔊 Testing audio blocking persistence across turns (Issue #223)...');
    
    // Capture console logs to see diagnostic output for allowAgentRef tracking
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('ISSUE #223') || text.includes('allowAgentRef') || 
          text.includes('interruptAgent') || text.includes('start()') ||
          text.includes('handleAgentAudio') || text.includes('🔍')) {
        consoleLogs.push(`[${msg.type()}] ${text}`);
        console.log(`[PAGE CONSOLE] ${text}`);
      }
    });
    
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
    const diag1 = await getAudioDiagnostics(page);
    console.log('🔎 Audio diagnostic after first response:', diag1);
    console.log('✅ First agent response received');
    
    // Wait for audio to start playing (after greeting/response begins)
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying && audioPlaying.textContent === 'true';
    }, { timeout: 6000 });
    console.log('✅ Audio is playing from first response');
    
    // Call interruptAgent() directly via the component ref to block audio
    // We avoid using the button because React's synthetic events (onMouseUp, onMouseLeave)
    // will still fire even if we disable DOM event handlers
    // By calling interruptAgent() directly, we ensure only interruptAgent() is called, not allowAgent()
    await page.evaluate(() => {
      const deepgramRef = window.deepgramRef;
      if (deepgramRef && deepgramRef.current) {
        deepgramRef.current.interruptAgent();
      } else {
        throw new Error('deepgramRef not available');
      }
    });
    console.log('✅ interruptAgent() called directly via ref (avoiding button React handlers)');
    
    // Step 3: Wait for audio to stop (confirming interruptAgent worked)
    await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('false', { timeout: 2000 });
    console.log('✅ Audio blocked');
    
    // Step 4: Verify button shows muted state (if UI was updated)
    const muteButton = page.locator('[data-testid="tts-mute-button"]');
    // Note: Button state may not reflect interruptAgent() call since we didn't use the button
    // This is fine - the important part is that audio blocking persisted
    
    // Send another message (continue conversation) WITHOUT calling allowAgent()
    await sendMessageAndWaitForResponse(page, 'Tell me more about that');
    const diag2 = await getAudioDiagnostics(page);
    console.log('🔎 Audio diagnostic after second response (while blocked):', diag2);
    console.log('✅ Second agent response received');
    
    // CRITICAL TEST: Audio should still be blocked in this next turn
    // The issue is that allowAgentRef blocking state is lost/reset between agent turns
    // Wait for agent audio to potentially arrive (it should be discarded if blocking persisted)
    await page.waitForTimeout(4000); // Give time for TTS to potentially start
    
    // Log diagnostic information about allowAgentRef state
    const diagnosticInfo = await page.evaluate(() => {
      // Try to access allowAgentRef if possible (for debugging)
      return {
        // We can't directly access internal refs, but we can check the behavior
        timestamp: Date.now()
      };
    });
    
    // Verify audio did NOT start playing in the next turn
    // This is the core assertion for Issue #223 - blocking should persist across turns
    const audioStatus = await page.locator('[data-testid="audio-playing-status"]').textContent();
    
    // Log for debugging
    const diag3 = await getAudioDiagnostics(page);
    console.log('🔎 Audio diagnostic after wait period:', diag3);
    
    // Output diagnostic logs captured from console
    console.log('\n📋 DIAGNOSTIC LOGS (allowAgentRef tracking):');
    consoleLogs.forEach(log => console.log(`   ${log}`));
    
    if (audioStatus === 'true') {
      console.error('❌ FAILURE: Audio started playing in second turn despite interruptAgent() being called');
      console.error('   This indicates allowAgentRef blocking state was reset/lost between turns');
      console.error('   Check diagnostic logs above to see when allowAgentRef was reset');
    } else {
      console.log('✅ Audio blocking persisted across agent response turns');
    }
    
    expect(audioStatus).toBe('false');
    
    // Verify agent response was received (conversation continued)
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse && agentResponse.textContent && 
             agentResponse.textContent !== '(Waiting for agent response...)' &&
             agentResponse.textContent !== 'Tell me a story' && // Not the first response
             agentResponse.textContent.trim().length > 0;
    }, { timeout: 10000 });
    console.log('✅ Agent response received in second turn');
    
    // Double-check audio is still blocked
    const finalAudioStatus = await page.locator('[data-testid="audio-playing-status"]').textContent();
    expect(finalAudioStatus).toBe('false');
    console.log('✅ Test passed: Audio blocking persisted across turns');
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
      
      // Wait for audio to actually stop (not just a fixed delay)
      await expect(page.locator('[data-testid="audio-playing-status"]')).toHaveText('false', { timeout: 2000 });
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

