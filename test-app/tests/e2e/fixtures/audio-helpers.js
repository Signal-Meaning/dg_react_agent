/**
 * Audio testing fixtures and helpers
 * 
 * Provides reusable utilities for loading and sending audio samples in tests.
 * These fixtures simplify audio testing by encapsulating common patterns.
 * 
 * This is the DRY, canonical implementation for audio testing.
 * All tests should use these fixtures instead of duplicate implementations.
 */

/**
 * Load and send an audio sample to the Deepgram component
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} sampleName - Name of the audio sample (without 'sample_' prefix and '.json' extension)
 * @returns {Promise<void>}
 */
export async function loadAndSendAudioSample(page, sampleName) {
  await page.evaluate(async (sample) => {
    const deepgramComponent = window.deepgramRef?.current;
    if (!deepgramComponent || !deepgramComponent.sendAudioData) {
      throw new Error('DeepgramVoiceInteraction component not available');
    }
    
    // Load audio sample
    const response = await fetch(`/audio-samples/sample_${sample}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load audio sample: ${response.status}`);
    }
    
    const audioData = await response.json();
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(audioData.audioData);
    const audioBuffer = new ArrayBuffer(binaryString.length);
    const audioView = new Uint8Array(audioBuffer);
    for (let i = 0; i < binaryString.length; i++) {
      audioView[i] = binaryString.charCodeAt(i);
    }
    
    // Send audio (this will trigger VAD events automatically)
    deepgramComponent.sendAudioData(audioBuffer);
  }, sampleName);
}

/**
 * Wait for VAD events to be detected by checking data-testid elements
 * 
 * This is the DRY, canonical implementation for VAD event detection.
 * All tests should use this instead of duplicate implementations.
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Array<string>} eventTypes - Event types to check (e.g., ['UserStartedSpeaking', 'UtteranceEnd', 'UserStoppedSpeaking'])
 * @param {number} timeout - Timeout in ms (default: 5000)
 * @returns {Promise<number>} Number of events detected
 */
export async function waitForVADEvents(page, eventTypes = ['UserStartedSpeaking', 'UtteranceEnd'], timeout = 5000) {
  const vadSelectors = {
    'UserStartedSpeaking': '[data-testid="user-started-speaking"]',
    'UtteranceEnd': '[data-testid="utterance-end"]',
    'UserStoppedSpeaking': '[data-testid="user-stopped-speaking"]',
  };

  const startTime = Date.now();
  const detectedEventTypes = new Set();

  while (Date.now() - startTime < timeout) {
    for (const eventType of eventTypes) {
      const selector = vadSelectors[eventType];
      if (!selector) continue;

      try {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          const value = (await element.textContent())?.trim() || '';
          if (value && value !== 'Not detected') {
            detectedEventTypes.add(eventType);
          }
        }
      } catch {
        // Element might not exist yet, continue
      }
    }

    // If we detected at least one event, that's sufficient (don't wait for all)
    if (detectedEventTypes.size > 0) {
      break;
    }

    await page.waitForTimeout(200);
  }

  return detectedEventTypes.size;
}

