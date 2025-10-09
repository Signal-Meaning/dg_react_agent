/**
 * Audio Test Helpers for Playwright E2E Tests
 * 
 * This module provides utilities for simulating audio interactions
 * and testing audio-related functionality in the voice agent component.
 */

class AudioTestHelpers {
  /**
   * Simulate user speaking event
   * @param {import('@playwright/test').Page} page - Playwright page object
   */
  static async simulateUserSpeaking(page) {
    await page.evaluate(() => {
      // Simulate user speaking event
      const event = new CustomEvent('userSpeaking', {
        detail: { 
          audioData: new ArrayBuffer(1024),
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
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
}

module.exports = AudioTestHelpers;

