/**
 * VAD Debug Test
 * 
 * This test focuses specifically on debugging VAD event flow
 * to understand why VAD events are not being triggered.
 */

import { test, expect } from '@playwright/test';
import { setupTestPage, simulateUserGesture } from './helpers/audio-mocks';
import { setupConnectionStateTracking } from './helpers/test-helpers';

test.describe('VAD Debug Test', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.CI) {
      test.skip(true, 'VAD tests require real Deepgram API connections - skipped in CI.');
      return;
    }
    
    await setupTestPage(page);
    
    // Enable test mode and set test API key
    await page.evaluate(() => {
      window.testMode = true;
      window.testApiKey = 'test-key';
      window.testProjectId = 'test-project';
      
      if (window.import && window.import.meta) {
        window.import.meta.env = {
          ...window.import.meta.env,
          VITE_DEEPGRAM_API_KEY: 'a1b2c3d4e5f6789012345678901234567890abcd',
          VITE_DEEPGRAM_PROJECT_ID: 'test-project'
        };
      }
    });
  });

  test('should debug VAD event flow step by step', async ({ page }) => {
    console.log('🔍 [DEBUG] Starting VAD event flow debugging...');
    
    // Capture all console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const logText = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(logText);
      // Log ALL console messages during audio processing
      console.log('🔍 [CONSOLE]', logText);
    });
    
    // Simulate user gesture
    await simulateUserGesture(page);
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Check if component initialization logs appear
    const initLogs = consoleLogs.filter(log => 
      log.includes('INIT') || 
      log.includes('Initializing in') ||
      log.includes('Service configuration check')
    );
    console.log('🔍 [DEBUG] Component initialization logs:', initLogs);
    
    // Setup connection state tracking BEFORE microphone activation to catch all connection events
    console.log('🔍 [DEBUG] Setting up connection state tracking...');
    const stateTracker = await setupConnectionStateTracking(page);
    
    // Activate microphone directly (page is already set up in beforeEach)
    // Transcription will connect when microphone activates and audio is sent
    console.log('🔍 [DEBUG] Activating microphone...');
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for agent connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    console.log('🔍 [DEBUG] Agent connection established');
    
    // Wait for microphone to be enabled
    // When mic is enabled, test-app has:
    // 1. Established connections (agent + transcription if configured)
    // 2. Applied settings (agent SettingsApplied received)
    // 3. Started audio capture (AudioManager recording)
    // 4. Transcription should be connected and receiving audio
    await page.waitForFunction(
      () => {
        const micStatus = document.querySelector('[data-testid="mic-status"]');
        return micStatus && micStatus.textContent === 'Enabled';
      },
      { timeout: 15000 }
    );
    console.log('🔍 [DEBUG] Microphone enabled - all prerequisites met (connections, settings, audio capture)');
    
    // After mic is enabled, transcription should already be connected
    // (startAudioCapture connects transcription if configured, and audio is being sent)
    const componentState = await stateTracker.getStates();
    console.log('🔍 [DEBUG] Component connection states after mic enabled:', componentState);
    
    // Transcription should be connected for VAD tests (they require transcription service)
    // If not connected, that indicates a problem with the test setup or audio flow
    if (!componentState.transcriptionConnected) {
      console.log('⚠️ [DEBUG] WARNING: Transcription not connected after mic enabled');
      console.log('⚠️ [DEBUG] This may indicate:');
      console.log('⚠️ [DEBUG]   - Audio mocks not producing audio samples');
      console.log('⚠️ [DEBUG]   - Transcription service timeout (no audio received)');
      console.log('⚠️ [DEBUG]   - Connection failed to establish');
    } else {
      console.log('✅ [DEBUG] Transcription connected - ready for VAD events');
    }
    
    // Give a moment for any async connection state updates
    await page.waitForTimeout(1000);
    
    // Get final state
    const finalState = await stateTracker.getStates();
    console.log('🔍 [DEBUG] Final component connection states:', finalState);
    
    // Check if VAD events are enabled in transcription options
    // Note: Transcription options are not exposed via public API, so we check connection state only
    const transcriptionConfig = {
      hasTranscriptionManager: finalState.transcription !== 'closed' && finalState.transcription !== 'not-found',
      transcriptionState: finalState.transcription
    };
    
    console.log('🔍 [DEBUG] Transcription configuration:', transcriptionConfig);
    
    // Wait a bit for processing
    await page.waitForTimeout(2000);
    
    // Check for VAD events in console logs
    const vadLogs = consoleLogs.filter(log => 
      log.includes('VAD') || 
      log.includes('VADEvent') || 
      log.includes('speech_detected') ||
      log.includes('UserStartedSpeaking') ||
      log.includes('UserStoppedSpeaking') ||
      log.includes('UserStartedSpeaking') ||
      log.includes('UtteranceEnd')  // Use UtteranceEnd instead of fictional SpeechStopped
    );
    
    console.log('🔍 [DEBUG] VAD-related logs found:', vadLogs);
    
    // Check if any VAD events were triggered
    const vadEventsDetected = await page.evaluate(() => {
      // Check if VAD event callbacks were called
      return {
        userStartedSpeaking: window.vadEvents?.userStartedSpeaking || 0,
        userStoppedSpeaking: window.vadEvents?.userStoppedSpeaking || 0,
        vadEvents: window.vadEvents?.vadEvents || 0
      };
    });
    
    console.log('🔍 [DEBUG] VAD events detected:', vadEventsDetected);
    
    // VAD tests require transcription service to be connected
    // When mic is enabled, test-app should have established transcription connection
    // If not connected, it indicates audio mocks aren't producing audio samples
    expect(componentState).toBeTruthy();
    expect(finalState.transcriptionConnected).toBe(true);
    
    console.log('🔍 [DEBUG] Test completed - check logs above for VAD event flow');
  });
});
