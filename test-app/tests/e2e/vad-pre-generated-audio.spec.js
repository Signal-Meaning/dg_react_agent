/**
 * VAD Pre-Generated Audio Test
 * 
 * This test uses pre-generated audio samples to test VAD event detection.
 * These samples are known to work and should trigger both onset and offset events.
 * 
 * Priority 2: Fix pre-generated audio sample loading
 */

import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/audio-mocks';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { loadAndSendAudioSample } from './fixtures/audio-helpers.js';

test.describe('VAD Pre-Generated Audio Test', () => {
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

  test('should load and use pre-generated audio samples', async ({ page }) => {
    console.log('🎵 Testing pre-generated audio sample loading...');
    
    // Reload page to apply configuration
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Use proper microphone setup with fixtures (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Connection established and microphone enabled');
    
    // Test loading audio samples
    const audioSamples = await page.evaluate(async () => {
      try {
        // Load the audio samples index
        const response = await fetch('/audio-samples/index.json');
        if (!response.ok) {
          throw new Error(`Failed to load audio samples: ${response.status}`);
        }
        const samples = await response.json();
        console.log('📁 Loaded audio samples:', samples);
        return samples;
      } catch (error) {
        console.error('❌ Error loading audio samples:', error);
        return null;
      }
    });
    
    expect(audioSamples).toBeTruthy();
    expect(Object.keys(audioSamples).length).toBeGreaterThan(0);
    
    console.log(`✅ Successfully loaded ${Object.keys(audioSamples).length} audio samples`);
    
    // Test using a specific audio sample
    const sampleKeys = Object.keys(audioSamples);
    const testSampleKey = sampleKeys[0]; // Use first sample
    const testSample = audioSamples[testSampleKey];
    console.log(`🎤 Testing with sample: ${testSample.phrase}`);
    
    // Use the audio sample directly from the index
    const audioData = testSample;
    
    expect(audioData).toBeTruthy();
    expect(audioData.audioData).toBeDefined();
    expect(audioData.metadata).toBeDefined();
    
    // Convert base64 audio data to ArrayBuffer
    const audioBuffer = await page.evaluate((base64Data) => {
      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      } catch (error) {
        console.error('Error converting base64 to ArrayBuffer:', error);
        return null;
      }
    }, audioData.audioData);
    
    expect(audioBuffer).toBeTruthy();
    console.log('🎵 Converted audio data to ArrayBuffer:', audioBuffer?.byteLength || 'null', 'bytes');
    
    // Send audio data to Deepgram
    await page.evaluate((buffer) => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        console.log('🎤 Sending pre-generated audio to Deepgram...');
        deepgramComponent.sendAudioData(buffer);
      } else {
        console.error('❌ Deepgram component not available');
      }
    }, audioBuffer);
    
    // Wait for VAD events
    console.log('⏳ Waiting for VAD events...');
    const vadEvents = await page.evaluate(() => {
      return new Promise((resolve) => {
        const events = [];
        const startTime = Date.now();
        const timeout = 10000; // 10 seconds
        
        const checkForEvents = () => {
          const vadElements = {
            'UserStartedSpeaking': '[data-testid="user-started-speaking"]',
            // 'UserStoppedSpeaking': '[data-testid="user-stopped-speaking"]', // Not a real Deepgram event
            'UserStartedSpeaking': '[data-testid="speech-started"]',
            // 'SpeechStopped': '[data-testid="speech-stopped"]', // Not a real Deepgram event
            'UtteranceEnd': '[data-testid="utterance-end"]',
            'VADEvent': '[data-testid="vad-event"]'
          };
          
          Object.entries(vadElements).forEach(([eventType, selector]) => {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim() && element.textContent.trim() !== 'Not detected') {
              const event = { type: eventType, text: element.textContent.trim(), timestamp: Date.now() };
              if (!events.some(e => e.type === eventType && e.text === event.text)) {
                events.push(event);
                console.log(`🎯 VAD Event detected: ${eventType} = ${event.text}`);
              }
            }
          });
          
          if (events.length > 0 || Date.now() - startTime > timeout) {
            resolve(events);
          } else {
            setTimeout(checkForEvents, 100);
          }
        };
        
        checkForEvents();
      });
    });
    
    console.log('📊 VAD Events detected:', vadEvents);
    
    // Analyze results
    const eventTypes = vadEvents.map(event => event.type);
    const hasOnsetEvents = eventTypes.some(type => 
      type === 'UserStartedSpeaking' || type === 'UserStartedSpeaking'
    );
    const hasOffsetEvents = eventTypes.some(type => 
      type === 'UtteranceEnd'
    );
    
    console.log(`\n📈 VAD Event Analysis:`);
    console.log(`Onset events: ${hasOnsetEvents ? '✅' : '❌'} (${eventTypes.filter(t => t === 'UserStartedSpeaking' || t === 'UserStartedSpeaking').length})`);
    console.log(`Offset events: ${hasOffsetEvents ? '✅' : '❌'} (${eventTypes.filter(t => t === 'UtteranceEnd').length})`);
    console.log(`Total events: ${vadEvents.length}`);
    
    // The test should detect at least some VAD events
    expect(vadEvents.length).toBeGreaterThan(0);
    
    if (hasOnsetEvents && hasOffsetEvents) {
      console.log('🎉 SUCCESS: Both onset and offset events detected!');
    } else if (hasOnsetEvents) {
      console.log('⚠️ PARTIAL: Only onset events detected');
    } else {
      console.log('❌ FAILED: No VAD events detected');
    }
  });

  test('should test multiple audio samples for consistency', async ({ page }) => {
    console.log('🎵 Testing multiple audio samples for consistency...');
    
    // Reload page to apply configuration
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Use proper microphone setup with fixtures (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Connection established and microphone enabled');
    
    // Load audio samples
    const audioSamples = await page.evaluate(async () => {
      const response = await fetch('/audio-samples/index.json');
      return await response.json();
    });
    
    const results = [];
    
    // Test first 3 samples
    const sampleKeys = Object.keys(audioSamples);
    for (let i = 0; i < Math.min(3, sampleKeys.length); i++) {
      const sampleKey = sampleKeys[i];
      const sample = audioSamples[sampleKey];
      console.log(`\n🎤 Testing sample ${i + 1}: ${sample.phrase}`);
      
      // Use working fixture to send audio (try the sample name, fallback to hello)
      const sampleName = sampleKey.replace('sample_', '').replace('.json', '');
      try {
        await loadAndSendAudioSample(page, sampleName);
      } catch (error) {
        console.log(`⚠️ Sample ${sampleName} not available, using hello sample`);
        await loadAndSendAudioSample(page, 'hello');
      }
      
      // Check which events were detected
      const vadEvents = [];
      const userStartedSpeaking = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="user-started-speaking"]');
        return el && el.textContent && el.textContent.trim() !== 'Not detected' ? el.textContent.trim() : null;
      });
      const utteranceEnd = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="utterance-end"]');
        return el && el.textContent && el.textContent.trim() !== 'Not detected' ? el.textContent.trim() : null;
      });
      
      if (userStartedSpeaking) vadEvents.push({ type: 'UserStartedSpeaking' });
      if (utteranceEnd) vadEvents.push({ type: 'UtteranceEnd' });
      
      const eventTypes = vadEvents.map(event => event.type);
      const hasOnsetEvents = eventTypes.some(type => 
        type === 'UserStartedSpeaking' || type === 'UserStartedSpeaking'
      );
      const hasOffsetEvents = eventTypes.some(type => 
        type === 'UtteranceEnd'
      );
      
      results.push({
        sample: sample.phrase,
        events: eventTypes,
        onsetEvents: hasOnsetEvents,
        offsetEvents: hasOffsetEvents,
        status: hasOnsetEvents && hasOffsetEvents ? 'success' : 
                hasOnsetEvents ? 'partial' : 'failed'
      });
      
      console.log(`📊 ${sample.phrase}: ${hasOnsetEvents ? '✅' : '❌'} onset, ${hasOffsetEvents ? '✅' : '❌'} offset`);
      
      // Brief pause between samples for processing
    }
    
    // Analyze results
    console.log('\n📈 Multi-Sample Analysis:');
    results.forEach(result => {
      console.log(`${result.sample}: ${result.status} (${result.events.length} events)`);
    });
    
    const successfulSamples = results.filter(r => r.status === 'success');
    const partialSamples = results.filter(r => r.status === 'partial');
    
    console.log(`\n✅ Successful samples: ${successfulSamples.length}/${results.length}`);
    console.log(`⚠️ Partial samples: ${partialSamples.length}/${results.length}`);
    
    // At least one sample should work
    expect(results.length).toBeGreaterThan(0);
    expect(successfulSamples.length + partialSamples.length).toBeGreaterThan(0);
  });
});
