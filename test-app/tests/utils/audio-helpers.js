/**
 * Audio Test Helpers for Playwright E2E Tests
 * 
 * This module provides utilities for simulating audio interactions
 * and testing audio-related functionality in the voice agent component.
 * 
 * Enhanced with VAD Audio Simulation System for realistic testing.
 */

const AudioSimulator = require('./audio-simulator');
const VADAudioSimulator = require('./vad-audio-simulator');

class AudioTestHelpers {
  /**
   * Simulate user speaking event with realistic audio
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} phrase - Text to speak (optional, defaults to "Hello")
   * @param {Object} options - Simulation options
   */
  static async simulateUserSpeaking(page, phrase = "Hello", options = {}) {
    // Use Audio Simulator for realistic speech
    await AudioSimulator.simulateSpeech(page, phrase, {
      silenceDuration: 1000,
      onsetSilence: 300,
      ...options
    });
  }

  /**
   * Simulate audio input for testing
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} duration - Duration of audio in seconds
   */
  static async simulateAudioInput(page, duration = 0.1) {
    await page.evaluate((duration) => {
      // Simulate audio input for testing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    }, duration);
  }

  /**
   * Mock audio permissions
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {boolean} granted - Whether to grant microphone permission
   */
  static async mockAudioPermissions(page, granted = true) {
    await page.context().grantPermissions(
      granted ? ['microphone'] : [],
      { origin: 'http://localhost:3000' }
    );
  }

  /**
   * Simulate microphone access denied
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async simulateMicrophoneDenied(page) {
    await page.addInitScript(() => {
      // Override getUserMedia to throw error
      navigator.mediaDevices.getUserMedia = () => {
        return Promise.reject(new Error('Microphone access denied'));
      };
    });
  }

  /**
   * Simulate audio processing delay
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} delay - Delay in milliseconds
   */
  static async simulateAudioProcessingDelay(page, delay = 1000) {
    await page.evaluate((delay) => {
      // Simulate audio processing delay
      setTimeout(() => {
        const event = new CustomEvent('audioProcessed', {
          detail: { 
            transcription: 'Test transcription',
            confidence: 0.95,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(event);
      }, delay);
    }, delay);
  }

  /**
   * Simulate barge-in during agent speech
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async simulateBargeIn(page) {
    await page.evaluate(() => {
      // Simulate user interrupting agent speech
      const event = new CustomEvent('userBargeIn', {
        detail: { 
          audioData: new ArrayBuffer(1024),
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    });
  }

  /**
   * Simulate audio level changes
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} level - Audio level (0-1)
   */
  static async simulateAudioLevel(page, level = 0.5) {
    await page.evaluate((level) => {
      // Simulate audio level change
      const event = new CustomEvent('audioLevelChange', {
        detail: { 
          level: level,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }, level);
  }

  /**
   * Simulate audio error
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} errorMessage - Error message to simulate
   */
  static async simulateAudioError(page, errorMessage = 'Audio processing error') {
    await page.evaluate((errorMessage) => {
      // Simulate audio error
      const event = new CustomEvent('audioError', {
        detail: { 
          error: errorMessage,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }, errorMessage);
  }

  /**
   * Wait for audio to be ready
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {number} timeout - Timeout in milliseconds
   */
  static async waitForAudioReady(page, timeout = 5000) {
    await page.waitForFunction(() => {
      return window.audioContext && window.audioContext.state === 'running';
    }, { timeout });
  }

  /**
   * Get audio context state
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @returns {Promise<string>} Audio context state
   */
  static async getAudioContextState(page) {
    return await page.evaluate(() => {
      return window.audioContext ? window.audioContext.state : 'not-available';
    });
  }

  /**
   * Simulate audio device change
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async simulateAudioDeviceChange(page) {
    await page.evaluate(() => {
      // Simulate audio device change
      const event = new CustomEvent('devicechange', {
        detail: { 
          timestamp: Date.now()
        }
      });
      navigator.mediaDevices.dispatchEvent(event);
    });
  }

  /**
   * VAD-Specific Helper Methods
   * ===========================
   */

  /**
   * Simulate realistic speech pattern for VAD testing
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} phrase - Text to speak
   * @param {Object} options - VAD simulation options
   * @param {number} options.silenceDuration - Silence after speech in ms
   * @param {number} options.onsetSilence - Initial silence in ms
   * @param {boolean} options.generateNew - Force new sample generation
   */
  static async simulateSpeech(page, phrase, options = {}) {
    await AudioSimulator.simulateSpeech(page, phrase, options);
  }

  /**
   * Simulate VAD speech with realistic audio
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} phrase - Text to speak
   * @param {Object} options - Speech options
   * @param {number} options.silenceDuration - Silence after speech in ms
   * @param {number} options.onsetSilence - Initial silence in ms
   * @param {boolean} options.generateNew - Force new sample generation
   */
  static async simulateVADSpeech(page, phrase, options = {}) {
    await VADAudioSimulator.simulateSpeechWithSilence(page, phrase, options);
  }

  /**
   * Simulate conversation pattern for VAD testing
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Array<string>} phrases - Array of phrases to speak
   * @param {Object} options - Conversation options
   * @param {number} options.pauseBetween - Pause between phrases in ms
   * @param {number} options.silenceDuration - Silence after each phrase
   */
  static async simulateConversation(page, phrases, options = {}) {
    await AudioSimulator.simulateConversation(page, phrases, options);
  }

  /**
   * Load and use pre-generated audio sample
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} sampleName - Name of the sample from library
   */
  static async useAudioSample(page, sampleName) {
    await AudioSimulator.simulateSpeech(page, sampleName, {
      sampleName: sampleName
    });
  }

  /**
   * Wait for VAD events to be triggered
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Array<string>} expectedEvents - Expected VAD event types
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Array>} - Array of detected events
   */
  static async waitForVADEvents(page, expectedEvents = ['UserStartedSpeaking', 'UserStoppedSpeaking'], timeout = 5000) {
    const detectedEvents = [];
    
    // Set up event listeners - check if function already exists
    try {
      await page.exposeFunction('onVADEventDetected', (eventType, data) => {
        detectedEvents.push({ type: eventType, data, timestamp: Date.now() });
        console.log(`🎯 [VAD] Event detected: ${eventType}`, data);
      });
    } catch (error) {
      if (error.message.includes('has been already registered')) {
        console.log('⚠️ [VAD] onVADEventDetected already registered, continuing...');
      } else {
        throw error;
      }
    }

    // Monitor VAD events
    await page.evaluate((expectedEvents) => {
      const vadElements = {
        'UserStartedSpeaking': '[data-testid="user-started-speaking"]',
        'SpeechStarted': '[data-testid="speech-started"]',
        'UtteranceEnd': '[data-testid="utterance-end"]',
        'VADEvent': '[data-testid="vad-event"]'
        // Note: UserStoppedSpeaking and SpeechStopped are not real Deepgram events
      };

      expectedEvents.forEach(eventType => {
        const selector = vadElements[eventType];
        if (selector) {
          const element = document.querySelector(selector);
          if (element) {
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                  const text = element.textContent;
                  if (text && text.trim()) {
                    window.onVADEventDetected(eventType, { text, element: selector });
                  }
                }
              });
            });
            observer.observe(element, { childList: true, characterData: true, subtree: true });
          }
        }
      });
    }, expectedEvents);

    // Wait for events or timeout
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (detectedEvents.length >= expectedEvents.length) {
        break;
      }
      await page.waitForTimeout(100);
    }

    return detectedEvents;
  }

  /**
   * Create audio sample library for testing
   * @returns {Promise<void>}
   */
  static async createAudioSampleLibrary() {
    await AudioSimulator.createAudioSampleLibrary();
  }

  /**
   * Clear audio sample cache
   */
  static clearAudioCache() {
    AudioSimulator.clearCache();
  }

  /**
   * Get audio cache statistics
   * @returns {Object} - Cache statistics
   */
  static getAudioCacheStats() {
    return AudioSimulator.getCacheStats();
  }
}

module.exports = AudioTestHelpers;

