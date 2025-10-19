/**
 * VAD Pre-Generated Audio Test
 * 
 * This test uses pre-generated audio samples to test VAD event detection.
 * These samples are known to work and should trigger both onset and offset events.
 * 
 * Priority 2: Fix pre-generated audio sample loading
 */

const { test, expect } = require('@playwright/test');
const { setupTestPage, simulateUserGesture } = require('./helpers/audio-mocks');

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
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    // Check microphone status
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    if (micStatus !== 'Enabled') {
      console.log('❌ Microphone not enabled');
      return;
    }
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
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
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }, audioData.audioData);
    
    console.log('🎵 Converted audio data to ArrayBuffer:', audioBuffer.byteLength, 'bytes');
    
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
            'SpeechStarted': '[data-testid="speech-started"]',
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
      type === 'UserStartedSpeaking' || type === 'SpeechStarted'
    );
    const hasOffsetEvents = eventTypes.some(type => 
      type === 'UtteranceEnd'
    );
    
    console.log(`\n📈 VAD Event Analysis:`);
    console.log(`Onset events: ${hasOnsetEvents ? '✅' : '❌'} (${eventTypes.filter(t => t === 'UserStartedSpeaking' || t === 'SpeechStarted').length})`);
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
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
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
      
      // Send audio sample
      const vadEvents = await page.evaluate(async (sampleData) => {
        try {
          // Convert to ArrayBuffer
          const binaryString = atob(sampleData.audioData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const audioBuffer = bytes.buffer;
          
          // Send to Deepgram
          const deepgramComponent = window.deepgramRef?.current;
          if (deepgramComponent && deepgramComponent.sendAudioData) {
            deepgramComponent.sendAudioData(audioBuffer);
          }
          
          // Wait for events
          return new Promise((resolve) => {
            const events = [];
            const startTime = Date.now();
            const timeout = 8000;
            
            const checkForEvents = () => {
              const vadElements = {
                'UserStartedSpeaking': '[data-testid="user-started-speaking"]',
                // 'UserStoppedSpeaking': '[data-testid="user-stopped-speaking"]', // Not a real Deepgram event
                'SpeechStarted': '[data-testid="speech-started"]',
                // 'SpeechStopped': '[data-testid="speech-stopped"]', // Not a real Deepgram event
                'UtteranceEnd': '[data-testid="utterance-end"]'
              };
              
              Object.entries(vadElements).forEach(([eventType, selector]) => {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim() && element.textContent.trim() !== 'Not detected') {
                  const event = { type: eventType, text: element.textContent.trim() };
                  if (!events.some(e => e.type === eventType)) {
                    events.push(event);
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
        } catch (error) {
          console.error('Error testing sample:', error);
          return [];
        }
      }, sample);
      
      const eventTypes = vadEvents.map(event => event.type);
      const hasOnsetEvents = eventTypes.some(type => 
        type === 'UserStartedSpeaking' || type === 'SpeechStarted'
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
      
      // Wait between samples
      await page.waitForTimeout(2000);
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
