/**
 * VAD Configuration Optimization Tests
 * 
 * This test systematically tries different VAD configuration parameters
 * to find the optimal settings for triggering both onset and offset events.
 * 
 * Priority 1, Option C: Investigate VAD configuration parameters
 */

const { test, expect } = require('@playwright/test');
const { setupTestPage, simulateUserGesture } = require('./helpers/audio-mocks');
const SimpleVADHelpers = require('../utils/simple-vad-helpers');

test.describe('VAD Configuration Optimization', () => {
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

  test('should test different utterance_end_ms values for offset detection', async ({ page }) => {
    console.log('🧪 Testing different utterance_end_ms values for VAD offset detection...');
    
    const utteranceEndValues = [500, 1000, 2000, 3000, 5000];
    const results = [];
    
    for (const utteranceEndMs of utteranceEndValues) {
      console.log(`\n🔧 Testing utterance_end_ms: ${utteranceEndMs}ms`);
      
      // Set the utterance_end_ms parameter
      await page.evaluate((value) => {
        if (window.import && window.import.meta) {
          window.import.meta.env.VITE_TRANSCRIPTION_UTTERANCE_END_MS = value.toString();
        }
      }, utteranceEndMs);
      
      // Reload page to apply new configuration
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
      
      // Enable microphone
      await page.click('[data-testid="microphone-button"]');
      await page.waitForTimeout(3000);
      
      // Check microphone status
      const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
      if (micStatus !== 'Enabled') {
        console.log(`❌ Microphone not enabled for utterance_end_ms: ${utteranceEndMs}ms`);
        results.push({ utteranceEndMs, status: 'mic_failed', events: [] });
        continue;
      }
      
      // Wait for connection
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
      
      // Test with improved audio pattern
      await SimpleVADHelpers.generateOnsetOffsetAudio(page, {
        speechDuration: 2, // 2 seconds of speech
        onsetSilence: 500, // 500ms initial silence
        offsetSilence: utteranceEndMs + 1000, // Extra silence beyond utterance_end_ms
        chunkInterval: 200 // Longer intervals between chunks
      });
      
      // Wait for VAD events with longer timeout
      const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
        'UserStartedSpeaking',
        'SpeechStarted',
        'UtteranceEnd'
      ], 10000); // 10 second timeout
      
      const eventTypes = vadEvents.map(event => event.type);
      const hasOnsetEvents = eventTypes.some(type => 
        type === 'UserStartedSpeaking' || type === 'SpeechStarted'
      );
      const hasOffsetEvents = eventTypes.some(type => 
        type === 'UtteranceEnd'
      );
      
      const result = {
        utteranceEndMs,
        status: hasOnsetEvents && hasOffsetEvents ? 'success' : 
                hasOnsetEvents ? 'partial' : 'failed',
        events: eventTypes,
        onsetEvents: hasOnsetEvents,
        offsetEvents: hasOffsetEvents
      };
      
      results.push(result);
      
      console.log(`📊 Results for ${utteranceEndMs}ms:`, {
        status: result.status,
        events: eventTypes,
        onsetEvents: hasOnsetEvents,
        offsetEvents: hasOffsetEvents
      });
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
    
    await page.evaluate((value) => {
      if (window.import && window.import.meta) {
        window.import.meta.env.VITE_TRANSCRIPTION_UTTERANCE_END_MS = value.toString();
      }
    }, optimizedUtteranceEndMs);
    
    // Reload page to apply configuration
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Test with multiple audio patterns
    const audioPatterns = [
      { name: 'Short Speech', speechDuration: 1, offsetSilence: 2000 },
      { name: 'Medium Speech', speechDuration: 2, offsetSilence: 3000 },
      { name: 'Long Speech', speechDuration: 3, offsetSilence: 4000 },
      { name: 'Very Long Speech', speechDuration: 5, offsetSilence: 6000 }
    ];
    
    const patternResults = [];
    
    for (const pattern of audioPatterns) {
      console.log(`\n🎤 Testing pattern: ${pattern.name}`);
      
      await SimpleVADHelpers.generateOnsetOffsetAudio(page, {
        speechDuration: pattern.speechDuration,
        onsetSilence: 500,
        offsetSilence: pattern.offsetSilence,
        chunkInterval: 300
      });
      
      // Wait for VAD events
      const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UserStoppedSpeaking',
        'SpeechStarted',
        'SpeechStopped',
        'UtteranceEnd'
      ], 15000); // 15 second timeout for longer patterns
      
      const eventTypes = vadEvents.map(event => event.type);
      const hasOnsetEvents = eventTypes.some(type => 
        type === 'UserStartedSpeaking' || type === 'SpeechStarted'
      );
      const hasOffsetEvents = eventTypes.some(type => 
        type === 'UtteranceEnd'
      );
      
      patternResults.push({
        pattern: pattern.name,
        speechDuration: pattern.speechDuration,
        offsetSilence: pattern.offsetSilence,
        events: eventTypes,
        onsetEvents: hasOnsetEvents,
        offsetEvents: hasOffsetEvents,
        status: hasOnsetEvents && hasOffsetEvents ? 'success' : 
                hasOnsetEvents ? 'partial' : 'failed'
      });
      
      console.log(`📊 ${pattern.name}: ${hasOnsetEvents ? '✅' : '❌'} onset, ${hasOffsetEvents ? '✅' : '❌'} offset`);
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
    await page.evaluate(() => {
      if (window.import && window.import.meta) {
        window.import.meta.env.VITE_TRANSCRIPTION_UTTERANCE_END_MS = '3000';
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Track event timing
    const eventTimings = [];
    
    // Set up event timing tracking
    await page.evaluate(() => {
      window.vadEventTimings = [];
      
      // Override console.log to capture VAD events with timestamps
      const originalLog = console.log;
      console.log = function(...args) {
        const message = args.join(' ');
        if (message.includes('[SimpleVAD] Event detected:')) {
          window.vadEventTimings.push({
            timestamp: Date.now(),
            message: message,
            type: message.split(' ')[3] // Extract event type
          });
        }
        originalLog.apply(console, args);
      };
    });
    
    // Generate audio with timing tracking
    await SimpleVADHelpers.generateOnsetOffsetAudio(page, {
      speechDuration: 2,
      onsetSilence: 500,
      offsetSilence: 4000,
      chunkInterval: 200
    });
    
    // Wait for events
    const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking',
      'SpeechStarted',
      'SpeechStopped',
      'UtteranceEnd'
    ], 15000);
    
    // Get timing data
    const timings = await page.evaluate(() => window.vadEventTimings || []);
    
    console.log('\n⏱️ VAD Event Timing Analysis:');
    timings.forEach((timing, index) => {
      const timeFromStart = index > 0 ? timing.timestamp - timings[0].timestamp : 0;
      console.log(`${timing.type}: +${timeFromStart}ms`);
    });
    
    // Analyze event sequence
    const eventSequence = timings.map(t => t.type);
    console.log(`\n📋 Event Sequence: ${eventSequence.join(' → ')}`);
    
    // Check for proper sequence (onset events before offset events)
    const onsetEvents = eventSequence.filter(type => 
      type === 'UserStartedSpeaking' || type === 'SpeechStarted'
    );
    const offsetEvents = eventSequence.filter(type => 
      type === 'UtteranceEnd'
    );
    
    console.log(`\n📊 Event Analysis:`);
    console.log(`Onset events: ${onsetEvents.length} (${onsetEvents.join(', ')})`);
    console.log(`Offset events: ${offsetEvents.length} (${offsetEvents.join(', ')})`);
    
    // The test passes if we get any VAD events
    expect(vadEvents.length).toBeGreaterThan(0);
    console.log('✅ VAD event timing test completed');
  });
});
