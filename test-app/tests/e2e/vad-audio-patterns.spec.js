/**
 * VAD Audio Patterns Test
 * 
 * This consolidated test file validates VAD detection with various audio patterns:
 * - Pre-generated audio samples
 * - Realistic TTS audio patterns
 * - Longer audio samples
 * 
 * Consolidates: vad-pre-generated-audio, vad-realistic-audio, vad-advanced-simulation
 */

import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/audio-mocks.js';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';
import { setupVADTest } from './fixtures/vad-helpers.js';

test.describe('VAD Audio Patterns', () => {
  test.beforeEach(async ({ page }) => {
    await setupVADTest(page, {
      skipInCI: true,
      skipReason: 'VAD tests require real Deepgram API connections - skipped in CI.'
    });
  });

  test('should detect VAD events with pre-generated audio samples', async ({ page }) => {
    console.log('🧪 Testing VAD with pre-generated audio samples...');
    
    // Use proper microphone setup with fixtures
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Connection established and microphone enabled');
    
    // Test with pre-generated audio sample
    await loadAndSendAudioSample(page, 'hello');
    
    // Wait for VAD events (fixture polls internally)
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);
    
    expect(eventsDetected).toBeGreaterThan(0);
    console.log(`✅ VAD events detected with pre-generated audio: ${eventsDetected}`);
  });

  test('should detect VAD events with realistic audio patterns', async ({ page }) => {
    console.log('🧪 Testing VAD with realistic audio patterns...');
    
    // Use proper microphone setup with fixtures
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    // Test with different audio samples that represent realistic speech
    const audioSamples = ['hello', 'hello__how_are_you_today_'];
    
    for (const sample of audioSamples) {
      console.log(`🎤 Testing with audio sample: ${sample}`);
      
      await loadAndSendAudioSample(page, sample);
      
      // Wait for VAD events (fixture polls internally)
      const eventsDetected = await waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UtteranceEnd'
      ], 15000);
      
      expect(eventsDetected).toBeGreaterThan(0);
      console.log(`✅ VAD events detected for ${sample}: ${eventsDetected}`);
    }
    
    console.log('✅ Realistic audio patterns verified');
  });

  test('should detect VAD events with longer audio samples', async ({ page }) => {
    console.log('🧪 Testing VAD with longer audio samples...');
    
    // Use proper microphone setup with fixtures
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    // Test with longer audio sample if available
    const longerSample = 'hello__how_are_you_today_';
    console.log(`🎤 Testing with longer audio sample: ${longerSample}`);
    
    await loadAndSendAudioSample(page, longerSample);
    
    // Wait for VAD events (fixture polls internally)
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);
    
    expect(eventsDetected).toBeGreaterThan(0);
    console.log(`✅ VAD events detected with longer audio sample: ${eventsDetected}`);
  });

  test('should handle multiple audio samples in sequence', async ({ page }) => {
    console.log('🧪 Testing VAD with multiple audio samples in sequence...');
    
    // Use proper microphone setup with fixtures
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    // Test with multiple samples in sequence to simulate conversation
    const samples = ['hello', 'hello'];
    
    for (let i = 0; i < samples.length; i++) {
      console.log(`🎤 Sending audio sample ${i + 1}/${samples.length}: ${samples[i]}`);
      
      await loadAndSendAudioSample(page, samples[i]);
      
      // Wait for VAD events (fixture polls internally)
      const eventsDetected = await waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UtteranceEnd'
      ], 15000);
      
      expect(eventsDetected).toBeGreaterThan(0);
      console.log(`✅ VAD events detected for sample ${i + 1}: ${eventsDetected}`);
    }
    
    console.log('✅ Multiple audio samples in sequence verified');
  });
});

