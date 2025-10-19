/**
 * VAD Realistic Audio Simulation Tests
 * 
 * These tests demonstrate the new VAD Audio Simulation System that uses
 * TTS-generated audio with proper silence padding to trigger VAD events.
 * 
 * This replaces the previous ArrayBuffer(8192) simulation with realistic
 * speech patterns that properly trigger VAD events.
 */

const { test, expect } = require('@playwright/test');
const { setupTestPage, simulateUserGesture } = require('./helpers/audio-mocks');
const AudioTestHelpers = require('../utils/audio-helpers');
const AudioSimulator = require('../utils/audio-simulator');

test.describe('VAD Realistic Audio Simulation', () => {
  // Skip these tests in CI - they require real Deepgram API connections
  // See issue #99 for mock implementation
  test.beforeEach(async ({ page }) => {
    if (process.env.CI) {
      test.skip(true, 'VAD tests require real Deepgram API connections - skipped in CI. See issue #99 for mock implementation.');
      return;
    }
    
    await setupTestPage(page);
    
    // Enable test mode and set test API key
    await page.evaluate(() => {
      // Set test mode flag
      window.testMode = true;
      
      // Set test API key in the global scope
      window.testApiKey = 'test-key';
      window.testProjectId = 'test-project';
      
      // Override the environment variables for testing
      // Use a real API key format to pass validation (40-character hex string)
      if (window.import && window.import.meta) {
        window.import.meta.env = {
          ...window.import.meta.env,
          VITE_DEEPGRAM_API_KEY: 'a1b2c3d4e5f6789012345678901234567890abcd',
          VITE_DEEPGRAM_PROJECT_ID: 'test-project'
        };
      }
    });
  });

  test('should trigger VAD events with realistic TTS audio', async ({ page }) => {
    console.log('🧪 Testing VAD events with realistic TTS audio...');
    
    // Capture console logs for debugging
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Simulate user gesture before microphone interaction
    await simulateUserGesture(page);
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established first (like working tests)
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Display relevant console logs for debugging
    console.log('\n=== CONSOLE LOGS ===');
    const relevantLogs = consoleLogs.filter(log => 
      log.includes('[toggleMic]') || 
      log.includes('[resumeWithAudio]') || 
      log.includes('[APP]') ||
      log.includes('Error') ||
      log.includes('❌')
    );
    relevantLogs.forEach(log => console.log(log));
    console.log('=== END CONSOLE LOGS ===\n');
    
    // Wait a bit for microphone toggle to complete
    await page.waitForTimeout(2000);
    
    // Now check microphone status
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    
    // If still disabled, wait a bit more and check again
    if (micStatusAfterClick === 'Disabled') {
      console.log('Microphone still disabled, waiting longer...');
      await page.waitForTimeout(3000);
      const micStatusAfterWait = await page.locator('[data-testid="mic-status"]').textContent();
      console.log('Mic status after additional wait:', micStatusAfterWait);
      
      // Verify microphone is enabled
      expect(micStatusAfterWait).toBe('Enabled');
      console.log('✅ Microphone enabled after additional wait');
    } else {
      // Verify microphone is enabled
      expect(micStatusAfterClick).toBe('Enabled');
      console.log('✅ Microphone enabled');
    }
    
    // Check if transcription service is connected
    const transcriptionInfo = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      console.log('🔧 [VAD] Deepgram component:', !!deepgramComponent);
      console.log('🔧 [VAD] Component keys:', deepgramComponent ? Object.keys(deepgramComponent) : 'none');
      
      if (deepgramComponent) {
        // Use the new debug methods
        if (deepgramComponent.getConnectionStates) {
          const connectionStates = deepgramComponent.getConnectionStates();
          console.log('🔧 [VAD] Connection states:', connectionStates);
          return {
            connected: connectionStates.transcriptionConnected,
            state: connectionStates.transcription,
            agentConnected: connectionStates.agentConnected,
            agentState: connectionStates.agent
          };
        }
        
        // Fallback to component state
        if (deepgramComponent.getState) {
          const componentState = deepgramComponent.getState();
          console.log('🔧 [VAD] Component state:', componentState);
          return {
            connected: componentState.connections?.transcription === 'connected',
            state: componentState.connections?.transcription || 'not-found',
            agentConnected: componentState.connections?.agent === 'connected',
            agentState: componentState.connections?.agent || 'not-found'
          };
        }
      }
      
      return { connected: false, state: 'not-found', agentConnected: false, agentState: 'not-found' };
    });
    
    console.log('🔧 [VAD] Transcription service info:', transcriptionInfo);
    
    // Simulate realistic speech with silence padding
    await AudioTestHelpers.simulateVADSpeech(page, 'Hello, how are you today?', {
      silenceDuration: 1000,
      onsetSilence: 300
    });
    
    // Wait for VAD events
    const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking',
      'SpeechStarted',
      'SpeechStopped'
    ], 5000);
    
    console.log('📊 VAD Events detected:', vadEvents);
    
    // Verify we got VAD events
    expect(vadEvents.length).toBeGreaterThan(0);
    
    // Check for specific event types - we should get at least one "started" and one "stopped" event
    const eventTypes = vadEvents.map(event => event.type);
    const hasStartedEvent = eventTypes.some(type => type === 'UserStartedSpeaking' || type === 'SpeechStarted');
    const hasStoppedEvent = eventTypes.some(type => type === 'UserStoppedSpeaking' || type === 'SpeechStopped');
    
    expect(hasStartedEvent).toBe(true);
    expect(hasStoppedEvent).toBe(true);
    
    console.log('✅ VAD events triggered successfully with realistic audio');
  });

  test('should work with pre-generated audio samples', async ({ page }) => {
    console.log('🧪 Testing VAD events with pre-generated audio samples...');
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for microphone to be enabled (same approach as working test)
    await page.waitForTimeout(3000);
    
    // Check if microphone status changed
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    
    // Verify microphone is enabled
    expect(micStatusAfterClick).toBe('Enabled');
    console.log('✅ Microphone enabled');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Use pre-generated sample from library
    await AudioTestHelpers.useAudioSample(page, 'hello');
    
    // Wait for VAD events
    const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 5000);
    
    console.log('📊 VAD Events with sample:', vadEvents);
    
    // Verify we got VAD events
    expect(vadEvents.length).toBeGreaterThan(0);
    
    console.log('✅ VAD events triggered successfully with audio sample');
  });

  test('should handle conversation patterns', async ({ page }) => {
    console.log('🧪 Testing VAD events with conversation patterns...');
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for microphone to be enabled (same approach as working test)
    await page.waitForTimeout(3000);
    
    // Check if microphone status changed
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    
    // Verify microphone is enabled
    expect(micStatusAfterClick).toBe('Enabled');
    console.log('✅ Microphone enabled');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Simulate conversation pattern
    const phrases = [
      'Hello there',
      'How can you help me?',
      'That sounds good'
    ];
    
    await AudioTestHelpers.simulateConversation(page, phrases, {
      pauseBetween: 2000,
      silenceDuration: 1000
    });
    
    // Wait for VAD events from all phrases
    const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 10000);
    
    console.log('📊 VAD Events from conversation:', vadEvents);
    
    // Verify we got multiple VAD events (at least 2 sets for 3 phrases)
    expect(vadEvents.length).toBeGreaterThanOrEqual(4); // 2 events per phrase minimum
    
    console.log('✅ VAD events triggered successfully with conversation pattern');
  });

  test('should generate and cache audio samples dynamically', async ({ page }) => {
    console.log('🧪 Testing dynamic audio sample generation and caching...');
    
    // Clear cache first
    AudioTestHelpers.clearAudioCache();
    
    // Check initial cache state
    let cacheStats = AudioTestHelpers.getAudioCacheStats();
    expect(cacheStats.size).toBe(0);
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    // Wait for microphone to be enabled (same approach as working test)
    await page.waitForTimeout(3000);
    
    // Check if microphone status changed
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    
    // Verify microphone is enabled
    expect(micStatusAfterClick).toBe('Enabled');
    console.log('✅ Microphone enabled');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Generate new sample
    const customPhrase = 'This is a custom test phrase for dynamic generation';
    await AudioTestHelpers.simulateVADSpeech(page, customPhrase, {
      generateNew: true,
      silenceDuration: 1500
    });
    
    // Check cache was populated
    cacheStats = AudioTestHelpers.getAudioCacheStats();
    expect(cacheStats.size).toBeGreaterThan(0);
    expect(cacheStats.samples).toContain(customPhrase);
    
    console.log('📊 Cache stats after generation:', cacheStats);
    
    // Use the same phrase again (should use cached version)
    await AudioTestHelpers.simulateVADSpeech(page, customPhrase);
    
    // Cache size should remain the same
    cacheStats = AudioTestHelpers.getAudioCacheStats();
    expect(cacheStats.size).toBe(1); // Still only one unique phrase
    
    console.log('✅ Dynamic sample generation and caching working correctly');
  });

  test('should handle different silence durations for VAD testing', async ({ page }) => {
    console.log('🧪 Testing different silence durations for VAD testing...');
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    // Wait for microphone to be enabled (same approach as working test)
    await page.waitForTimeout(3000);
    
    // Check if microphone status changed
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    
    // Verify microphone is enabled
    expect(micStatusAfterClick).toBe('Enabled');
    console.log('✅ Microphone enabled');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Test with short silence (should still trigger VAD)
    await AudioTestHelpers.simulateVADSpeech(page, 'Quick response', {
      silenceDuration: 500,
      onsetSilence: 200
    });
    
    let vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 3000);
    
    expect(vadEvents.length).toBeGreaterThan(0);
    console.log('✅ Short silence duration worked');
    
    // Test with long silence
    await AudioTestHelpers.simulateVADSpeech(page, 'Long pause response', {
      silenceDuration: 2000,
      onsetSilence: 500
    });
    
    vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 5000);
    
    expect(vadEvents.length).toBeGreaterThan(0);
    console.log('✅ Long silence duration worked');
    
    console.log('✅ Different silence durations handled correctly');
  });

  test('should compare realistic audio vs empty buffer simulation', async ({ page }) => {
    console.log('🧪 Comparing realistic audio vs empty buffer simulation...');
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    // Wait for microphone to be enabled (same approach as working test)
    await page.waitForTimeout(3000);
    
    // Check if microphone status changed
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    
    // Verify microphone is enabled
    expect(micStatusAfterClick).toBe('Enabled');
    console.log('✅ Microphone enabled');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Test with empty buffer (legacy method)
    console.log('Testing with empty ArrayBuffer(8192)...');
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        const audioData = new ArrayBuffer(8192);
        deepgramComponent.sendAudioData(audioData);
      }
    });
    
    let vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 3000);
    
    const emptyBufferEvents = vadEvents.length;
    console.log(`Empty buffer triggered ${emptyBufferEvents} VAD events`);
    
    // Test with realistic audio
    console.log('Testing with realistic TTS audio...');
    await AudioTestHelpers.simulateVADSpeech(page, 'Realistic speech test', {
      silenceDuration: 1000,
      onsetSilence: 300
    });
    
    vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 5000);
    
    const realisticAudioEvents = vadEvents.length;
    console.log(`Realistic audio triggered ${realisticAudioEvents} VAD events`);
    
    // Realistic audio should trigger more reliable VAD events
    expect(realisticAudioEvents).toBeGreaterThanOrEqual(emptyBufferEvents);
    
    console.log('✅ Realistic audio provides better VAD event triggering');
  });
});
