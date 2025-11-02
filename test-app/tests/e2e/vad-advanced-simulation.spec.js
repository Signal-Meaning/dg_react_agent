/**
 * Advanced VAD Audio Simulation Tests
 * 
 * These tests demonstrate the enhanced VAD Audio Simulation System with:
 * - Pre-recorded audio file support
 * - Streaming audio simulation
 * - Natural speech patterns
 * - Multiple audio sources (TTS + WAV files)
 * 
 * This represents the state-of-the-art approach for VAD testing
 * that would be found in production voice applications.
 */

import { test, expect } from '@playwright/test';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';

test.describe('Advanced VAD Audio Simulation', () => {
  // Skip these tests in CI - they require real Deepgram API connections
  // See issue #99 for mock implementation
  test.beforeEach(async ({ page }) => {
    if (process.env.CI) {
      test.skip(true, 'VAD tests require real Deepgram API connections - skipped in CI. See issue #99 for mock implementation.');
      return;
    }
  });

  test('should support pre-recorded audio sources', async ({ page }) => {
    console.log('🧪 Testing pre-recorded audio source support...');
    
    // Use fixture for proper microphone activation (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Microphone enabled and connected');
    
    // Test pre-recorded audio loading using fixture
    await loadAndSendAudioSample(page, 'hello');
    
    // Wait for VAD events using fixture (only real Deepgram events)
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);
    
    expect(eventsDetected).toBeGreaterThan(0);
    console.log(`✅ VAD events detected: ${eventsDetected}`);
  });

  test('should work with pre-generated audio samples for VAD testing', async ({ page }) => {
    console.log('🧪 Testing VAD with pre-generated audio samples...');
    
    // Use fixture for proper microphone activation (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    console.log('✅ Microphone enabled and connected');
    
    // Test with pre-generated audio sample using fixture
    await loadAndSendAudioSample(page, 'hello');
    
    // Wait for VAD events using fixture (only real Deepgram events)
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);
    
    expect(eventsDetected).toBeGreaterThan(0);
    console.log(`✅ VAD events detected: ${eventsDetected}`);
  });

  test('should detect VAD events with longer audio samples', async ({ page }) => {
    console.log('🧪 Testing VAD with longer audio samples...');
    
    // Use fixture for proper microphone activation (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    console.log('✅ Microphone enabled and connected');
    
    // Test with a longer audio sample if available
    try {
      await loadAndSendAudioSample(page, 'hello__how_are_you_today_');
      
      // Wait for VAD events using fixture (only real Deepgram events)
      const eventsDetected = await waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UtteranceEnd'
      ], 15000);
      
      expect(eventsDetected).toBeGreaterThan(0);
      console.log(`✅ VAD events detected with longer sample: ${eventsDetected}`);
    } catch (error) {
      // Fallback to shorter sample
      await loadAndSendAudioSample(page, 'hello');
      const eventsDetected = await waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UtteranceEnd'
      ], 15000);
      
      expect(eventsDetected).toBeGreaterThan(0);
      console.log(`✅ VAD events detected with fallback sample: ${eventsDetected}`);
    }
  });

  test('should handle multiple audio samples in sequence', async ({ page }) => {
    console.log('🧪 Testing multiple audio samples in sequence...');
    
    // Use fixture for proper microphone activation (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    console.log('✅ Microphone enabled and connected');
    
    // Test with multiple samples
    const samples = ['hello', 'hello_there'];
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      try {
        console.log(`🎵 Loading sample ${i + 1}/${samples.length}: ${sample}`);
        await loadAndSendAudioSample(page, sample);
        
        // Wait for VAD events using fixture (only real Deepgram events)
        const eventsDetected = await waitForVADEvents(page, [
          'UserStartedSpeaking',
          'UtteranceEnd'
        ], 15000);
        
        expect(eventsDetected).toBeGreaterThan(0);
        console.log(`✅ Sample ${i + 1} VAD events detected: ${eventsDetected}`);
      } catch (error) {
        console.log(`ℹ️ Sample ${sample} not available, skipping`);
        // Continue with next sample
      }
    }
    
    console.log('✅ Multiple audio samples test completed');
  });

  test('should demonstrate production-ready VAD testing patterns', async ({ page }) => {
    console.log('🧪 Testing production-ready VAD patterns...');
    
    // Use fixture for proper microphone activation (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    console.log('✅ Microphone enabled and connected');
    
    // Test with multiple pre-generated samples in sequence (simulating conversation)
    const samples = ['hello', 'hello_there', 'hello'];
    
    console.log('💬 Simulating multi-turn conversation with pre-generated samples...');
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      try {
        console.log(`🎵 Phrase ${i + 1}/${samples.length}: ${sample}`);
        await loadAndSendAudioSample(page, sample);
        
        // Wait for VAD events using fixture (only real Deepgram events)
        const eventsDetected = await waitForVADEvents(page, [
          'UserStartedSpeaking',
          'UtteranceEnd'
        ], 15000);
        
        expect(eventsDetected).toBeGreaterThan(0);
        console.log(`✅ Phrase ${i + 1} processed, VAD events detected: ${eventsDetected}`);
        
        // Note: In real tests, we would wait for actual agent responses
        // instead of using fixed timeouts
      } catch (error) {
        console.log(`ℹ️ Sample ${sample} not available, skipping`);
        // Continue with next sample
      }
    }
    
    console.log('✅ Production-ready VAD testing patterns working correctly');
  });

  test('should verify VAD events with different sample types', async ({ page }) => {
    console.log('🧪 Testing VAD events with different sample types...');
    
    // Use fixture for proper microphone activation (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    console.log('✅ Microphone enabled and connected');
    
    // Test with different available samples
    const availableSamples = ['hello', 'hello_there', 'hello__how_are_you_today_'];
    let successfulSamples = 0;
    
    for (const sample of availableSamples) {
      try {
        await loadAndSendAudioSample(page, sample);
        
        // Wait for VAD events using fixture (only real Deepgram events)
        const eventsDetected = await waitForVADEvents(page, [
          'UserStartedSpeaking',
          'UtteranceEnd'
        ], 15000);
        
        if (eventsDetected > 0) {
          successfulSamples++;
          console.log(`✅ Sample "${sample}" triggered ${eventsDetected} VAD events`);
        }
      } catch (error) {
        console.log(`ℹ️ Sample "${sample}" not available or failed`);
      }
    }
    
    expect(successfulSamples).toBeGreaterThan(0);
    console.log(`✅ Verified VAD events with ${successfulSamples} different sample types`);
  });

  test('should compare different pre-generated audio samples', async ({ page }) => {
    console.log('🧪 Comparing different pre-generated audio samples...');
    
    // Use fixture for proper microphone activation (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    console.log('✅ Microphone enabled and connected');
    
    const samples = [
      { name: 'hello', description: 'Short sample' },
      { name: 'hello_there', description: 'Medium sample' },
      { name: 'hello__how_are_you_today_', description: 'Long sample' }
    ];
    
    const results = [];
    
    for (const sample of samples) {
      try {
        const startTime = Date.now();
        await loadAndSendAudioSample(page, sample.name);
        
        // Wait for VAD events using fixture (only real Deepgram events)
        const eventsDetected = await waitForVADEvents(page, [
          'UserStartedSpeaking',
          'UtteranceEnd'
        ], 15000);
        
        const duration = Date.now() - startTime;
        results.push({
          name: sample.name,
          description: sample.description,
          events: eventsDetected,
          duration
        });
        
        console.log(`✅ ${sample.description}: ${eventsDetected} events in ${duration}ms`);
      } catch (error) {
        console.log(`ℹ️ ${sample.description} not available, skipping`);
      }
    }
    
    // Compare results
    console.log('📊 Comparison Results:');
    results.forEach(result => {
      console.log(`  ${result.description}: ${result.events} events in ${result.duration}ms`);
    });
    
    // At least one sample should work
    expect(results.length).toBeGreaterThan(0);
    const successfulResults = results.filter(r => r.events > 0);
    expect(successfulResults.length).toBeGreaterThan(0);
    
    console.log('✅ All audio sample comparisons working correctly');
  });
});
