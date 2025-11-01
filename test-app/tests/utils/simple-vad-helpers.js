/**
 * Simple VAD Test Helpers
 * 
 * This module provides simplified audio generation for basic VAD testing
 * that doesn't require complex TTS or file loading. It's designed for
 * quick, reliable VAD event triggering in test environments.
 * 
 * For realistic speech simulation with proper onset/offset events,
 * use the full TTS-based audio simulation utilities.
 */

class SimpleVADHelpers {
  /**
   * Generate simple audio pattern that triggers VAD onset events
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {Object} options - Audio generation options
   * @param {number} options.duration - Duration in seconds (default: 2)
   * @param {number} options.frequency - Base frequency (default: 440)
   * @param {number} options.amplitude - Signal amplitude (default: 8000)
   * @param {number} options.sampleRate - Sample rate (default: 16000)
   */
  static async generateOnsetAudio(page, options = {}) {
    const {
      duration = 2,
      frequency = 440,
      amplitude = 8000,
      sampleRate = 16000
    } = options;

    await page.evaluate(({ duration, frequency, amplitude, sampleRate }) => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        // Create audio buffer
        const samples = sampleRate * duration;
        const audioBuffer = new ArrayBuffer(samples * 2); // 16-bit PCM
        const audioView = new Int16Array(audioBuffer);
        
        // Fill with sine wave pattern
        for (let i = 0; i < samples; i++) {
          const freq = frequency + (i % 200); // Varying frequency
          const sample = Math.sin(2 * Math.PI * freq * i / sampleRate) * amplitude;
          audioView[i] = Math.floor(sample);
        }
        
        console.log('🎤 [SimpleVAD] Sending onset audio pattern');
        deepgramComponent.sendAudioData(audioBuffer);
      }
    }, { duration, frequency, amplitude, sampleRate });
  }

  /**
   * Generate audio pattern with proper silence padding for both onset and offset events
   * This sends audio in chunks with proper timing to trigger VAD events
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {Object} options - Audio generation options
   * @param {number} options.speechDuration - Speech duration in seconds (default: 1)
   * @param {number} options.onsetSilence - Initial silence in ms (default: 300)
   * @param {number} options.offsetSilence - Ending silence in ms (default: 1000)
   * @param {number} options.chunkInterval - Interval between chunks in ms (default: 100)
   */
  static async generateOnsetOffsetAudio(page, options = {}) {
    const {
      speechDuration = 1,
      onsetSilence = 300,
      offsetSilence = 1000,
      sampleRate = 16000,
      chunkInterval = 100
    } = options;

    // Step 1: Send initial silence (should not trigger VAD events)
    console.log('🔇 [SimpleVAD] Sending initial silence...');
    await this.generateSilence(page, onsetSilence, sampleRate);
    await page.waitForTimeout(chunkInterval);

    // Step 2: Send speech (should trigger UserStartedSpeaking)
    console.log('🎤 [SimpleVAD] Sending speech audio...');
    await this.generateSpeech(page, speechDuration, sampleRate);
    await page.waitForTimeout(chunkInterval);

    // Step 3: Send ending silence (should trigger UserStoppedSpeaking)
    console.log('🔇 [SimpleVAD] Sending ending silence...');
    await this.generateSilence(page, offsetSilence, sampleRate);
    
    // Give VAD more time to process the transition
    console.log('⏳ [SimpleVAD] Waiting for VAD to process speech->silence transition...');
    await page.waitForTimeout(2000); // Wait 2 seconds for VAD processing
  }

  /**
   * Generate silence audio
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {number} durationMs - Duration in milliseconds
   * @param {number} sampleRate - Sample rate (default: 16000)
   */
  static async generateSilence(page, durationMs, sampleRate = 16000) {
    await page.evaluate(({ durationMs, sampleRate }) => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        const samples = Math.floor((durationMs / 1000) * sampleRate);
        const audioBuffer = new ArrayBuffer(samples * 2); // 16-bit PCM
        const audioView = new Int16Array(audioBuffer);
        
        // Fill with silence (zeros)
        for (let i = 0; i < samples; i++) {
          audioView[i] = 0;
        }
        
        console.log('🔇 [SimpleVAD] Sending silence:', { durationMs, samples });
        deepgramComponent.sendAudioData(audioBuffer);
      }
    }, { durationMs, sampleRate });
  }

  /**
   * Generate speech audio
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {number} durationSeconds - Duration in seconds
   * @param {number} sampleRate - Sample rate (default: 16000)
   */
  static async generateSpeech(page, durationSeconds, sampleRate = 16000) {
    await page.evaluate(({ durationSeconds, sampleRate }) => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        const samples = Math.floor(durationSeconds * sampleRate);
        const audioBuffer = new ArrayBuffer(samples * 2); // 16-bit PCM
        const audioView = new Int16Array(audioBuffer);
        
        // Fill with sine wave pattern
        for (let i = 0; i < samples; i++) {
          const frequency = 440 + (i % 200); // Varying frequency
          const amplitude = 8000;
          const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
          audioView[i] = Math.floor(sample);
        }
        
        console.log('🎤 [SimpleVAD] Sending speech:', { durationSeconds, samples });
        deepgramComponent.sendAudioData(audioBuffer);
      }
    }, { durationSeconds, sampleRate });
  }

  /**
   * Generate multiple audio chunks to simulate streaming speech
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {Object} options - Streaming options
   * @param {number} options.chunkCount - Number of chunks (default: 5)
   * @param {number} options.chunkInterval - Interval between chunks in ms (default: 200)
   * @param {number} options.speechDuration - Speech duration per chunk in seconds (default: 0.5)
   */
  static async generateStreamingAudio(page, options = {}) {
    const {
      chunkCount = 5,
      chunkInterval = 200,
      speechDuration = 0.5
    } = options;

    for (let i = 0; i < chunkCount; i++) {
      await this.generateOnsetAudio(page, { duration: speechDuration });
      
      // Wait between chunks (except for the last one)
      if (i < chunkCount - 1) {
        await page.waitForTimeout(chunkInterval);
      }
    }
  }

  /**
   * Wait for specific VAD events with timeout
   * Simplified: just wait for DOM elements to update (no complex monitoring)
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {Array<string>} expectedEvents - Expected event types
   * @param {number} timeout - Timeout in milliseconds (default: 5000)
   * @returns {Promise<Array>} - Detected events
   */
  static async waitForVADEvents(page, expectedEvents = ['UserStartedSpeaking'], timeout = 5000) {
    const detectedEvents = [];
    
    const vadElements = {
      'UserStartedSpeaking': '[data-testid="user-started-speaking"]',
      'UtteranceEnd': '[data-testid="utterance-end"]',
      'VADEvent': '[data-testid="vad-event"]'
    };

    // Get initial values to detect changes
    const initialValues = {};
    for (const eventType of expectedEvents) {
      const selector = vadElements[eventType];
      if (selector) {
        try {
          const element = await page.locator(selector).first();
          if (await element.count() > 0) {
            initialValues[eventType] = (await element.textContent())?.trim() || '';
          } else {
            initialValues[eventType] = '';
          }
        } catch {
          initialValues[eventType] = '';
        }
      }
    }

    // Wait for at least one event to occur (value changes from initial)
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      for (const eventType of expectedEvents) {
        const selector = vadElements[eventType];
        if (!selector) continue;

        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0) {
            const currentValue = (await element.textContent())?.trim() || '';
            const initialValue = initialValues[eventType] || '';
            
            // Check if value has changed and is meaningful
            if (currentValue !== initialValue && currentValue && currentValue !== 'Not detected') {
              // This event was detected
              if (!detectedEvents.find(e => e.type === eventType)) {
                detectedEvents.push({
                  type: eventType,
                  data: { text: currentValue, element: selector },
                  timestamp: Date.now()
                });
                console.log(`🎯 [SimpleVAD] Event detected: ${eventType}`);
              }
            }
          }
        } catch (error) {
          // Element might not exist yet, continue
        }
      }

      // If we got at least one event, that's sufficient
      if (detectedEvents.length > 0) {
        break;
      }

      // Small delay before next check
      await page.waitForTimeout(200);
    }

    return detectedEvents;
  }

  /**
   * Generate audio that should trigger both onset and offset VAD events
   * This is a more sophisticated approach that mimics realistic speech patterns
   * @param {import('@playwright/test').Page} page - Playwright page
   * @param {string} phrase - Text phrase (for timing estimation)
   * @param {Object} options - Audio options
   */
  static async generateRealisticVADAudio(page, phrase, options = {}) {
    const {
      onsetSilence = 300,
      offsetSilence = 1000,
      sampleRate = 16000
    } = options;

    // Estimate speech duration based on phrase length
    const words = phrase.split(' ').length;
    const estimatedSpeechMs = Math.max(500, words * 150);
    
    await this.generateOnsetOffsetAudio(page, {
      speechDuration: estimatedSpeechMs / 1000,
      onsetSilence,
      offsetSilence,
      sampleRate
    });
  }
}

export default SimpleVADHelpers;
