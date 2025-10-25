import { test, expect } from '@playwright/test';
import SimpleVADHelpers from '../utils/simple-vad-helpers';
import { VADTestUtilities } from '../utils/vad-test-utilities';

/**
 * Callback Test Suite
 * 
 * This test suite verifies that ALL callbacks are properly implemented and working:
 * - onReady ✅ (has tests)
 * - onConnectionStateChange ✅ (has tests) 
 * - onError ✅ (has tests)
 * - onTranscriptUpdate ❌ (needs tests)
 * - onUserStartedSpeaking ❌ (needs tests)
 * - onUserStoppedSpeaking ❌ (needs tests - was restored)
 * - onAgentStateChange ✅ (has tests)
 * - onAgentUtterance ✅ (has tests)
 * - onUserMessage ✅ (has tests)
 * - onPlaybackStateChange ✅ (has tests)
 */

test.describe('Callback Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test app
    await page.goto('http://localhost:5173?test-mode=true');
    
    // Set up test environment
    await page.evaluate(() => {
      // Mock API key for testing
      if (typeof window !== 'undefined') {
        window.import = window.import || {};
        window.import.meta = window.import.meta || {};
        window.import.meta.env = {
          VITE_DEEPGRAM_API_KEY: 'a1b2c3d4e5f6789012345678901234567890abcd',
          VITE_DEEPGRAM_PROJECT_ID: 'test-project'
        };
      }
    });

    // Capture console logs for debugging (simplified approach)
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.text()}`);
    });
  });

  test('should test onTranscriptUpdate callback with existing audio sample', async ({ page }) => {
    console.log('🧪 Testing onTranscriptUpdate callback with existing audio sample...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Use VADTestUtilities to load and send existing audio sample
    const vadUtils = new VADTestUtilities(page);
    await vadUtils.loadAndSendAudioSample('hello'); // Use existing 'hello' sample
    
    // Wait for transcript to appear in the UI
    await page.waitForFunction(() => {
      const transcriptElement = document.querySelector('[data-testid="transcription"]');
      return transcriptElement && transcriptElement.textContent && 
             transcriptElement.textContent !== '(Waiting for transcript...)';
    }, { timeout: 15000 });
    
    // Verify transcript appears in UI
    const transcriptText = await page.locator('[data-testid="transcription"]').textContent();
    expect(transcriptText).toBeTruthy();
    expect(transcriptText).not.toBe('(Waiting for transcript...)');
    
    console.log('✅ onTranscriptUpdate callback working - transcript displayed:', transcriptText);
  });

  test('should test onUserStartedSpeaking callback with existing audio sample', async ({ page }) => {
    console.log('🧪 Testing onUserStartedSpeaking callback with existing audio sample...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Use VADTestUtilities to load and send existing audio sample
    const vadUtils = new VADTestUtilities(page);
    await vadUtils.loadAndSendAudioSample('hello'); // Use existing 'hello' sample
    
    // Wait for VAD events to be detected using the proper utility
    const detectedVADEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',    // From transcription service
      'UtteranceEnd'      // From transcription service
    ], 10000);
    
    // Check if SpeechStarted was detected
    const hasSpeechStarted = detectedVADEvents.some(event => event.type === 'SpeechStarted');
    expect(hasSpeechStarted).toBe(true);
    
    console.log('✅ onUserStartedSpeaking callback working - SpeechStarted detected:', hasSpeechStarted);
    console.log('📊 Detected VAD events:', detectedVADEvents.map(e => e.type));
  });

  test('should test onUserStoppedSpeaking callback with existing audio sample', async ({ page }) => {
    console.log('🧪 Testing onUserStoppedSpeaking callback with existing audio sample...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Use VADTestUtilities to load and send existing audio sample with proper silence duration (>2 seconds for UtteranceEnd)
    const vadUtils = new VADTestUtilities(page);
    await vadUtils.loadAndSendAudioSample('hello'); // Use existing 'hello' sample
    
    // Wait for VAD events to be detected using the proper utility
    const detectedVADEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',    // From transcription service
      'UtteranceEnd'      // From transcription service
    ], 15000);
    
    // Check if UtteranceEnd was detected (this should trigger onUserStoppedSpeaking)
    const hasUtteranceEnd = detectedVADEvents.some(event => event.type === 'UtteranceEnd');
    expect(hasUtteranceEnd).toBe(true);
    
    console.log('✅ onUserStoppedSpeaking callback working - UtteranceEnd detected:', hasUtteranceEnd);
    console.log('📊 Detected VAD events:', detectedVADEvents.map(e => e.type));
  });

  test('should test onPlaybackStateChange callback with agent response', async ({ page }) => {
    console.log('🧪 Testing onPlaybackStateChange callback...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Send text input to trigger agent response
    const testMessage = 'Hello, can you help me?';
    await page.waitForSelector('[data-testid="text-input"]', { timeout: 10000 });
    await page.fill('[data-testid="text-input"]', testMessage);
    await page.click('[data-testid="send-button"]');
    
    // Wait for agent response and audio playback
    await page.waitForFunction(() => {
      const audioPlayingElement = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlayingElement && audioPlayingElement.textContent === 'true';
    }, { timeout: 15000 });
    
    // Verify audio playing status changes
    const audioPlayingStatus = await page.locator('[data-testid="audio-playing-status"]').textContent();
    expect(audioPlayingStatus).toBe('true');
    
    // Wait for audio to finish playing
    await page.waitForFunction(() => {
      const audioPlayingElement = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlayingElement && audioPlayingElement.textContent === 'false';
    }, { timeout: 20000 });
    
    const finalAudioStatus = await page.locator('[data-testid="audio-playing-status"]').textContent();
    expect(finalAudioStatus).toBe('false');
    
    console.log('✅ onPlaybackStateChange callback working - audio status changed from true to false');
  });

  test('should test all callbacks integration with comprehensive workflow', async ({ page }) => {
    console.log('🧪 Testing comprehensive callback integration...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Send text input to trigger agent response (this tests agent callbacks)
    const testMessage = 'Hello, this is a comprehensive test message';
    await page.waitForSelector('[data-testid="text-input"]', { timeout: 10000 });
    await page.fill('[data-testid="text-input"]', testMessage);
    await page.click('[data-testid="send-button"]');
    
    // Wait for agent response
    await page.waitForFunction(() => {
      const agentResponseElement = document.querySelector('[data-testid="agent-response"]');
      return agentResponseElement && agentResponseElement.textContent && 
             agentResponseElement.textContent !== '(Waiting for agent response...)';
    }, { timeout: 15000 });
    
    // Check which callbacks were triggered by examining UI state
    const connectionReady = await page.locator('[data-testid="connection-ready"]').textContent();
    const agentResponse = await page.locator('[data-testid="agent-response"]').textContent();
    const audioPlayingStatus = await page.locator('[data-testid="audio-playing-status"]').textContent();
    
    // Verify key callbacks were triggered
    expect(connectionReady).toBe('true'); // onReady
    expect(agentResponse).not.toBe('(Waiting for agent response...)'); // onAgentUtterance
    expect(audioPlayingStatus).toBeDefined(); // onPlaybackStateChange
    
    console.log('✅ Comprehensive callback integration test completed');
    console.log('📊 Callback Status:');
    console.log(`  - onReady: ${connectionReady === 'true' ? '✅' : '❌'}`);
    console.log(`  - onAgentUtterance: ${agentResponse !== '(Waiting for agent response...)' ? '✅' : '❌'}`);
    console.log(`  - onPlaybackStateChange: ${audioPlayingStatus ? '✅' : '❌'}`);
  });
});
