/**
 * VAD Debug Test
 * 
 * This test focuses specifically on debugging VAD event flow
 * to understand why VAD events are not being triggered.
 */

const { test, expect } = require('@playwright/test');
const { setupTestPage, simulateUserGesture } = require('./helpers/audio-mocks');
const AudioTestHelpers = require('../utils/audio-helpers');

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
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Check component state
    const componentState = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.getConnectionStates) {
        return deepgramComponent.getConnectionStates();
      }
      return null;
    });
    
    console.log('🔍 [DEBUG] Component connection states:', componentState);
    
    // Check if VAD events are enabled in transcription options
    const transcriptionConfig = await page.evaluate(() => {
      // Try to access the component's transcription options
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.getState) {
        const state = deepgramComponent.getState();
        return {
          hasTranscriptionManager: !!state.connections?.transcription,
          transcriptionState: state.connections?.transcription
        };
      }
      return null;
    });
    
    console.log('🔍 [DEBUG] Transcription configuration:', transcriptionConfig);
    
    // Send a simple audio buffer directly
    console.log('🔍 [DEBUG] Sending simple audio buffer...');
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        // Create a simple audio buffer with speech-like pattern
        const sampleRate = 16000;
        const duration = 1; // 1 second
        const samples = sampleRate * duration;
        const audioBuffer = new ArrayBuffer(samples * 2); // 16-bit PCM
        const audioView = new Int16Array(audioBuffer);
        
        // Fill with a sine wave pattern that should trigger VAD
        for (let i = 0; i < samples; i++) {
          const frequency = 440; // A4 note
          const amplitude = 16000; // Strong signal
          const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
          audioView[i] = Math.floor(sample);
        }
        
        console.log('🔍 [DEBUG] Created audio buffer:', {
          size: audioBuffer.byteLength,
          samples: samples,
          firstFewSamples: Array.from(audioView.slice(0, 10))
        });
        
        deepgramComponent.sendAudioData(audioBuffer);
        console.log('🔍 [DEBUG] Audio buffer sent to component');
      } else {
        console.log('🔍 [DEBUG] Component or sendAudioData not available');
      }
    });
    
    // Wait a bit for processing
    await page.waitForTimeout(2000);
    
    // Check for VAD events in console logs
    const vadLogs = consoleLogs.filter(log => 
      log.includes('VAD') || 
      log.includes('VADEvent') || 
      log.includes('speech_detected') ||
      log.includes('UserStartedSpeaking') ||
      log.includes('UserStoppedSpeaking') ||
      log.includes('SpeechStarted') ||
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
    
    // The test passes if we can at least send audio data
    expect(componentState).toBeTruthy();
    expect(componentState.transcriptionConnected).toBe(true);
    
    console.log('🔍 [DEBUG] Test completed - check logs above for VAD event flow');
  });
});
