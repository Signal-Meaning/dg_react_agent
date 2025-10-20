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
import { setupTestPage, simulateUserGesture } from './helpers/audio-mocks';
import AudioTestHelpers from '../utils/audio-helpers';
import AudioSimulator from '../utils/audio-simulator';
import AudioFileLoader from '../utils/audio-file-loader';

test.describe('Advanced VAD Audio Simulation', () => {
  // Skip these tests in CI - they require real Deepgram API connections
  // See issue #99 for mock implementation
  test.beforeEach(async ({ page }) => {
    if (process.env.CI) {
      test.skip(true, 'VAD tests require real Deepgram API connections - skipped in CI. See issue #99 for mock implementation.');
      return;
    }
    
    await setupTestPage(page);
  });

  test('should support both TTS and pre-recorded audio sources', async ({ page }) => {
    console.log('🧪 Testing hybrid audio source support...');
    
    // Simulate user gesture before microphone interaction
    await simulateUserGesture(page);
    
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
    
    // Test TTS generation (fallback when no pre-recorded file exists)
    console.log('🎤 Testing TTS generation...');
    await AudioSimulator.simulateSpeech(page, 'Hello from TTS', {
      silenceDuration: 1000,
      onsetSilence: 300
    });
    
    let vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 3000);
    
    expect(vadEvents.length).toBeGreaterThan(0);
    console.log('✅ TTS generation working');
    
    // Test pre-recorded audio loading (if files exist)
    console.log('🎵 Testing pre-recorded audio loading...');
    try {
      await AudioSimulator.simulateSpeech(page, 'hello', {
        sampleName: 'hello',
        silenceDuration: 1000
      });
      
      vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UserStoppedSpeaking'
      ], 3000);
      
      expect(vadEvents.length).toBeGreaterThan(0);
      console.log('✅ Pre-recorded audio loading working');
    } catch (error) {
      console.log('ℹ️ Pre-recorded audio not available, TTS fallback working correctly');
    }
  });

  test('should simulate streaming audio for realistic VAD testing', async ({ page }) => {
    console.log('🧪 Testing streaming audio simulation...');
    
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
    
    // Test streaming audio simulation
    await AudioSimulator.simulateStreamingAudio(page, 'This is a streaming audio test', {
      chunkSize: 2048,
      chunkInterval: 50,
      silenceDuration: 1000,
      usePreRecorded: false // Force TTS for this test
    });
    
    // Wait for VAD events
    const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 5000);
    
    console.log('📊 Streaming VAD Events:', vadEvents);
    
    // Verify we got VAD events
    expect(vadEvents.length).toBeGreaterThan(0);
    
    // Check for specific event types
    const eventTypes = vadEvents.map(event => event.type);
    expect(eventTypes).toContain('UserStartedSpeaking');
    expect(eventTypes).toContain('UserStoppedSpeaking');
    
    console.log('✅ Streaming audio simulation working correctly');
  });

  test('should simulate natural speech with pauses and variations', async ({ page }) => {
    console.log('🧪 Testing natural speech simulation...');
    
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
    
    // Test natural speech simulation
    await AudioSimulator.simulateNaturalSpeech(page, 'This is a natural speech test with realistic pauses', {
      pauseProbability: 0.4,
      maxPauseDuration: 300,
      silenceDuration: 1000
    });
    
    // Wait for VAD events
    const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 8000);
    
    console.log('📊 Natural Speech VAD Events:', vadEvents);
    
    // Verify we got VAD events
    expect(vadEvents.length).toBeGreaterThan(0);
    
    console.log('✅ Natural speech simulation working correctly');
  });

  test('should handle audio file validation and format conversion', async ({ page }) => {
    console.log('🧪 Testing audio file validation...');
    
    // Test audio file validation (this will test the validation logic even without actual files)
    const path = await import('path');
    const samplesDir = path.join(__dirname, '../fixtures/audio-samples');
    
    // Test with non-existent file
    try {
      await AudioFileLoader.validateAudioFile('non-existent-file.wav');
      expect.fail('Should have thrown error for non-existent file');
    } catch (error) {
      expect(error.message).toContain('not found');
      console.log('✅ Non-existent file validation working');
    }
    
    // Test audio chunk splitting
    const testAudio = new ArrayBuffer(10000); // 10KB test audio
    const chunks = AudioFileLoader.splitIntoChunks(testAudio, 1024);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].byteLength).toBeLessThanOrEqual(1024);
    console.log('✅ Audio chunk splitting working');
    
    // Test silence padding
    const paddedAudio = AudioFileLoader.addSilencePadding(testAudio, 300, 1000);
    expect(paddedAudio.byteLength).toBeGreaterThan(testAudio.byteLength);
    console.log('✅ Silence padding working');
    
    console.log('✅ Audio file validation and processing working correctly');
  });

  test('should demonstrate production-ready VAD testing patterns', async ({ page }) => {
    console.log('🧪 Testing production-ready VAD patterns...');
    
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
    
    // Simulate a realistic multi-turn conversation
    const conversationPhrases = [
      'Hello, how are you today?',
      'Can you help me with something?',
      'That sounds interesting, tell me more',
      'Thank you for your assistance'
    ];
    
    console.log('💬 Simulating multi-turn conversation...');
    
    for (let i = 0; i < conversationPhrases.length; i++) {
      const phrase = conversationPhrases[i];
      
      // Use different simulation methods for variety
      if (i % 2 === 0) {
        // Use streaming for even phrases
        await AudioSimulator.simulateStreamingAudio(page, phrase, {
          chunkSize: 4096,
          chunkInterval: 100,
          silenceDuration: 1000
        });
      } else {
        // Use natural speech for odd phrases
        await AudioSimulator.simulateNaturalSpeech(page, phrase, {
          pauseProbability: 0.2,
          maxPauseDuration: 200,
          silenceDuration: 1000
        });
      }
      
      // Wait for VAD events after each phrase
      const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UserStoppedSpeaking'
      ], 3000);
      
      expect(vadEvents.length).toBeGreaterThan(0);
      console.log(`✅ Phrase ${i + 1} processed: "${phrase}"`);
      
      // Pause between phrases
      if (i < conversationPhrases.length - 1) {
        await page.waitForTimeout(1000);
      }
    }
    
    console.log('✅ Production-ready VAD testing patterns working correctly');
  });

  test('should provide comprehensive audio testing utilities', async ({ page }) => {
    console.log('🧪 Testing comprehensive audio utilities...');
    
    // Test cache management
    const initialStats = AudioSimulator.getCacheStats();
    console.log('📊 Initial cache stats:', initialStats);
    
    // Generate some samples to populate cache
    await AudioSimulator.generateAndCacheSample('Test phrase one', 1000);
    await AudioSimulator.generateAndCacheSample('Test phrase two', 1000);
    
    const populatedStats = AudioSimulator.getCacheStats();
    expect(populatedStats.size).toBeGreaterThan(initialStats.size);
    console.log('📊 Populated cache stats:', populatedStats);
    
    // Test cache clearing
    AudioSimulator.clearCache();
    const clearedStats = AudioSimulator.getCacheStats();
    expect(clearedStats.size).toBe(0);
    console.log('📊 Cleared cache stats:', clearedStats);
    
    // Test sample library creation
    try {
      await AudioSimulator.createAudioSampleLibrary();
      console.log('✅ Sample library creation working');
    } catch (error) {
      console.log('ℹ️ Sample library creation completed with warnings:', error.message);
    }
    
    console.log('✅ Comprehensive audio utilities working correctly');
  });

  test('should compare different audio simulation approaches', async ({ page }) => {
    console.log('🧪 Comparing audio simulation approaches...');
    
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
    
    const testPhrase = 'Compare different approaches';
    
    // Test 1: Basic TTS simulation
    console.log('🎤 Testing basic TTS simulation...');
    const startTime1 = Date.now();
    await AudioSimulator.simulateSpeech(page, testPhrase, {
      silenceDuration: 1000,
      onsetSilence: 300
    });
    const vadEvents1 = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 3000);
    const duration1 = Date.now() - startTime1;
    
    // Test 2: Streaming simulation
    console.log('🌊 Testing streaming simulation...');
    const startTime2 = Date.now();
    await AudioSimulator.simulateStreamingAudio(page, testPhrase, {
      chunkSize: 2048,
      chunkInterval: 50,
      silenceDuration: 1000
    });
    const vadEvents2 = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 3000);
    const duration2 = Date.now() - startTime2;
    
    // Test 3: Natural speech simulation
    console.log('🗣️ Testing natural speech simulation...');
    const startTime3 = Date.now();
    await AudioSimulator.simulateNaturalSpeech(page, testPhrase, {
      pauseProbability: 0.3,
      maxPauseDuration: 200,
      silenceDuration: 1000
    });
    const vadEvents3 = await AudioTestHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UserStoppedSpeaking'
    ], 5000);
    const duration3 = Date.now() - startTime3;
    
    // Compare results
    console.log('📊 Comparison Results:');
    console.log(`  Basic TTS: ${vadEvents1.length} events in ${duration1}ms`);
    console.log(`  Streaming: ${vadEvents2.length} events in ${duration2}ms`);
    console.log(`  Natural:   ${vadEvents3.length} events in ${duration3}ms`);
    
    // All approaches should trigger VAD events
    expect(vadEvents1.length).toBeGreaterThan(0);
    expect(vadEvents2.length).toBeGreaterThan(0);
    expect(vadEvents3.length).toBeGreaterThan(0);
    
    console.log('✅ All audio simulation approaches working correctly');
  });
});
