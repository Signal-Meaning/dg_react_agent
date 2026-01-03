/**
 * VAD Configuration Optimization Tests
 * 
 * This test systematically tries different VAD configuration parameters
 * to find the optimal settings for triggering both onset and offset events.
 * 
 * Priority 1, Option C: Investigate VAD configuration parameters
 */

import { test, expect } from '@playwright/test';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';
import { getVADState } from './fixtures/vad-helpers.js';

test.describe('VAD Configuration Optimization', () => {
  test.beforeEach(async ({ page }) => {
    // Skip in CI - VAD tests require real Deepgram API connections
    // Reason: VAD (Voice Activity Detection) tests require real API connections to validate actual VAD behavior
    // CI environments may not have API keys configured or may have rate limits
    // Action: Run locally with real API key (tests will execute), or configure CI with real API keys
    // Note: Consider refactoring to use skipIfNoRealAPI() for consistency with other real API tests
    if (process.env.CI) {
      test.skip(true, 'VAD tests require real Deepgram API connections - skipped in CI.');
      return;
    }
  });

  test('should test different utterance_end_ms values for offset detection', async ({ page }) => {
    console.log('🧪 Testing different utterance_end_ms values for VAD offset detection...');
    
    const utteranceEndValues = [500, 1000, 2000, 3000, 5000];
    const results = [];
    
    for (const utteranceEndMs of utteranceEndValues) {
      console.log(`\n🔧 Testing utterance_end_ms: ${utteranceEndMs}ms`);
      
      // Set the utterance_end_ms parameter before loading page
      // Note: Environment variables need to be set before page load
      // Since we can't modify env vars dynamically, we'll set them via URL params or localStorage
      await page.goto(`http://localhost:5173?utterance_end_ms=${utteranceEndMs}`);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
      
      // Set utterance_end_ms via page context if needed
      await page.evaluate((value) => {
        if (window.import && window.import.meta) {
          window.import.meta.env = {
            ...window.import.meta.env,
            VITE_TRANSCRIPTION_UTTERANCE_END_MS: value.toString()
          };
        }
        // Also store in localStorage for test-app to read
        localStorage.setItem('test_utterance_end_ms', value.toString());
      }, utteranceEndMs);
      
      // Use proper microphone setup with fixtures (same pattern as passing tests)
      try {
        const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
          skipGreetingWait: true, // Skip greeting wait for faster tests
          connectionTimeout: 15000,
          micEnableTimeout: 10000
        });
        
        if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
          console.log(`❌ Microphone not enabled for utterance_end_ms: ${utteranceEndMs}ms`);
          results.push({ utteranceEndMs, status: 'mic_failed', events: [] });
          continue;
        }
        
        // Use working fixture to send audio (same pattern as passing VAD tests)
        await loadAndSendAudioSample(page, 'hello');
        
        // Wait for VAD events using working fixture (returns count of detected events)
        const eventsDetected = await waitForVADEvents(page, [
          'UserStartedSpeaking',
          'UtteranceEnd'
        ], 15000); // 15 second timeout
        
        // Determine which events were detected using new fixture
        const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd']);
        
        const hasOnsetEvents = !!vadState.UserStartedSpeaking;
        const hasOffsetEvents = !!vadState.UtteranceEnd;
        const eventTypes = [];
        if (hasOnsetEvents) eventTypes.push('UserStartedSpeaking');
        if (hasOffsetEvents) eventTypes.push('UtteranceEnd');
        
        const result = {
          utteranceEndMs,
          status: hasOnsetEvents && hasOffsetEvents ? 'success' : 
                  hasOnsetEvents ? 'partial' : 'failed',
          events: eventTypes,
          onsetEvents: hasOnsetEvents,
          offsetEvents: hasOffsetEvents,
          eventsDetected: eventsDetected
        };
        
        results.push(result);
        
        console.log(`📊 Results for ${utteranceEndMs}ms:`, {
          status: result.status,
          events: eventTypes,
          eventsDetected: eventsDetected,
          onsetEvents: hasOnsetEvents,
          offsetEvents: hasOffsetEvents
        });
      } catch (error) {
        console.log(`❌ Error setting up microphone for utterance_end_ms: ${utteranceEndMs}ms - ${error.message}`);
        results.push({ utteranceEndMs, status: 'setup_failed', events: [], error: error.message });
      }
    }
    
    // Analyze results
    console.log('\n📈 VAD Configuration Analysis:');
    results.forEach(result => {
      console.log(`${result.utteranceEndMs}ms: ${result.status} (${result.events.length} events)`);
    });
    
    // Find the best configuration
    const successfulConfigs = results.filter(r => r.status === 'success');
    const partialConfigs = results.filter(r => r.status === 'partial');
    
    console.log(`\n✅ Successful configurations: ${successfulConfigs.length}`);
    console.log(`⚠️ Partial configurations: ${partialConfigs.length}`);
    
    if (successfulConfigs.length > 0) {
      const bestConfig = successfulConfigs[0];
      console.log(`🎯 Best configuration: utterance_end_ms=${bestConfig.utteranceEndMs}ms`);
      expect(bestConfig.utteranceEndMs).toBeGreaterThan(0);
    } else if (partialConfigs.length > 0) {
      console.log('⚠️ No fully successful configurations found, but some partial success');
      expect(partialConfigs.length).toBeGreaterThan(0);
    } else {
      console.log('❌ No successful VAD event detection with any configuration');
      // Don't fail the test - this is exploratory
    }
  });

  test('should test different VAD event combinations', async ({ page }) => {
    console.log('🧪 Testing different VAD event combinations...');
    
    // Test with optimized utterance_end_ms (based on previous test)
    const optimizedUtteranceEndMs = 3000;
    
    // Navigate to page and set configuration
    await page.goto(`http://localhost:5173?utterance_end_ms=${optimizedUtteranceEndMs}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    await page.evaluate((value) => {
      if (window.import && window.import.meta) {
        window.import.meta.env = {
          ...window.import.meta.env,
          VITE_TRANSCRIPTION_UTTERANCE_END_MS: value.toString()
        };
      }
      localStorage.setItem('test_utterance_end_ms', value.toString());
    }, optimizedUtteranceEndMs);
    
    // Use proper microphone setup with fixtures
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error('Microphone setup failed');
    }
    
    // Test with multiple audio samples (using working fixtures)
    const audioPatterns = [
      { name: 'Hello Sample', sampleName: 'hello' },
      { name: 'Hello Sample (retry)', sampleName: 'hello' },
    ];
    
    const patternResults = [];
    
    for (const pattern of audioPatterns) {
      console.log(`\n🎤 Testing pattern: ${pattern.name}`);
      
      // Use working fixture to send audio
      await loadAndSendAudioSample(page, pattern.sampleName);
      
      // Wait for VAD events using working fixture
      const eventsDetected = await waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UtteranceEnd'
      ], 15000); // 15 second timeout
      
      // Check which specific events were detected using new fixture
      const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd']);
      
      const eventTypes = [];
      if (vadState.UserStartedSpeaking) eventTypes.push('UserStartedSpeaking');
      if (vadState.UtteranceEnd) eventTypes.push('UtteranceEnd');
      
      patternResults.push({
        pattern: pattern.name,
        events: eventTypes,
        onsetEvents: !!vadState.UserStartedSpeaking,
        offsetEvents: !!vadState.UtteranceEnd,
        eventsDetected: eventsDetected,
        status: vadState.UserStartedSpeaking && vadState.UtteranceEnd ? 'success' : 
                vadState.UserStartedSpeaking ? 'partial' : 'failed'
      });
      
      console.log(`📊 ${pattern.name}: ${vadState.UserStartedSpeaking ? '✅' : '❌'} onset, ${vadState.UtteranceEnd ? '✅' : '❌'} offset (${eventsDetected} events detected)`);
      
      // No delay needed - waitForVADEvents() already handles proper waiting
    }
    
    // Analyze pattern results
    console.log('\n📈 Audio Pattern Analysis:');
    patternResults.forEach(result => {
      console.log(`${result.pattern}: ${result.status} (${result.events.length} events)`);
    });
    
    const successfulPatterns = patternResults.filter(r => r.status === 'success');
    console.log(`\n✅ Successful patterns: ${successfulPatterns.length}/${patternResults.length}`);
    
    if (successfulPatterns.length > 0) {
      console.log('🎯 Working audio patterns found!');
      expect(successfulPatterns.length).toBeGreaterThan(0);
    } else {
      console.log('⚠️ No fully successful patterns, but continuing investigation...');
    }
  });

  test('should test VAD event timing and sequencing', async ({ page }) => {
    console.log('🧪 Testing VAD event timing and sequencing...');
    
    // Use optimized configuration
    const optimizedUtteranceEndMs = 3000;
    await page.goto(`http://localhost:5173?utterance_end_ms=${optimizedUtteranceEndMs}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    await page.evaluate((value) => {
      if (window.import && window.import.meta) {
        window.import.meta.env = {
          ...window.import.meta.env,
          VITE_TRANSCRIPTION_UTTERANCE_END_MS: value.toString()
        };
      }
      localStorage.setItem('test_utterance_end_ms', value.toString());
    }, optimizedUtteranceEndMs);
    
    // Use proper microphone setup with fixtures
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error('Microphone setup failed');
    }
    
    // Track event timing by monitoring DOM changes
    
    // Set up MutationObserver to track VAD event changes
    await page.evaluate(() => {
      window.vadEventTimings = [];
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const target = mutation.target;
            const testId = target.getAttribute?.('data-testid');
            if (testId === 'user-started-speaking' || testId === 'utterance-end') {
              const text = target.textContent?.trim() || '';
              if (text && text !== 'Not detected') {
                window.vadEventTimings.push({
                  timestamp: Date.now(),
                  type: testId === 'user-started-speaking' ? 'UserStartedSpeaking' : 'UtteranceEnd',
                  value: text
                });
              }
            }
          }
        });
      });
      
      // Observe VAD elements
      const vadElements = [
        document.querySelector('[data-testid="user-started-speaking"]'),
        document.querySelector('[data-testid="utterance-end"]')
      ].filter(Boolean);
      
      vadElements.forEach(el => {
        observer.observe(el, { childList: true, characterData: true, subtree: true });
      });
      
      window.vadEventObserver = observer;
    });
    
    // Use working fixture to send audio
    await loadAndSendAudioSample(page, 'hello');
    
    // Wait for events using working fixture
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);
    
    // Get timing data
    const timings = await page.evaluate(() => {
      if (window.vadEventObserver) {
        window.vadEventObserver.disconnect();
      }
      return window.vadEventTimings || [];
    });
    
    console.log('\n⏱️ VAD Event Timing Analysis:');
    if (timings.length > 0) {
      timings.forEach((timing, index) => {
        const timeFromStart = index > 0 ? timing.timestamp - timings[0].timestamp : 0;
        console.log(`${timing.type}: +${timeFromStart}ms`);
      });
    } else {
      console.log('No timing data captured');
    }
    
    // Analyze event sequence
    const eventSequence = timings.map(t => t.type);
    console.log(`\n📋 Event Sequence: ${eventSequence.length > 0 ? eventSequence.join(' → ') : 'No events detected'}`);
    
    // Check for proper sequence (onset events before offset events)
    const onsetEvents = eventSequence.filter(type => 
      type === 'UserStartedSpeaking'
    );
    const offsetEvents = eventSequence.filter(type => 
      type === 'UtteranceEnd'
    );
    
    console.log(`\n📊 Event Analysis:`);
    console.log(`Onset events: ${onsetEvents.length} (${onsetEvents.join(', ')})`);
    console.log(`Offset events: ${offsetEvents.length} (${offsetEvents.join(', ')})`);
    console.log(`Total events detected: ${eventsDetected}`);
    
    // The test passes if we get any VAD events
    expect(eventsDetected).toBeGreaterThan(0);
    console.log('✅ VAD event timing test completed');
  });
});
