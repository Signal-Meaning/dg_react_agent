/**
 * VAD (Voice Activity Detection) testing fixtures
 * 
 * Provides reusable utilities for VAD event detection, state checking, and assertions.
 * These fixtures simplify VAD testing by encapsulating common patterns.
 * 
 * This is the DRY, canonical implementation for VAD testing.
 * All tests should use these fixtures instead of duplicate implementations.
 */

import { test } from '@playwright/test';
import { setupTestPage } from '../helpers/test-helpers.js';
import { skipIfNoRealAPI } from '../helpers/test-helpers.js';

/**
 * Standard test setup for VAD/audio tests
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Setup options
 * @param {boolean} options.waitForNetworkIdle - Wait for network idle (default: true)
 * @returns {Promise<void>}
 */
export async function setupVADTest(page, options = {}) {
  const { 
    waitForNetworkIdle = true 
  } = options;
  
  // Skip if real API key is not available
  // Reason: VAD tests require real Deepgram API connections to validate actual VAD behavior
  // Uses skipIfNoRealAPI() for consistency with other real API tests
  skipIfNoRealAPI('VAD tests require real Deepgram API connections');
  
  await setupTestPage(page);
  if (waitForNetworkIdle) {
    await page.waitForLoadState('networkidle');
  }
  await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
}

/**
 * Get current VAD state from DOM elements
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Array<string>} eventTypes - Events to check (default: ['UserStartedSpeaking', 'UtteranceEnd'])
 * @returns {Promise<Object>} Object with event states { UserStartedSpeaking, UtteranceEnd, UserStoppedSpeaking }
 */
export async function getVADState(page, eventTypes = ['UserStartedSpeaking', 'UtteranceEnd']) {
  return await page.evaluate((events) => {
    const state = {};
    
    const selectors = {
      UserStartedSpeaking: '[data-testid="user-started-speaking"]',
      UtteranceEnd: '[data-testid="utterance-end"]',
      UserStoppedSpeaking: '[data-testid="user-stopped-speaking"]'
    };
    
    for (const eventType of events) {
      const selector = selectors[eventType];
      if (!selector) continue;
      
      const el = document.querySelector(selector);
      const value = el?.textContent?.trim();
      state[eventType] = value && value !== 'Not detected' ? value : null;
    }
    
    return state;
  }, eventTypes);
}

/**
 * Assert that VAD events were detected (lenient - requires at least one by default)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').Expect} expect - Playwright expect instance
 * @param {Array<string>} eventTypes - Events to check (default: ['UserStartedSpeaking', 'UtteranceEnd'])
 * @param {Object} options - Assertion options
 * @param {boolean} options.requireAll - Require all events to be detected (default: false)
 * @returns {Promise<Object>} Detected events object
 */
export async function assertVADEventsDetected(page, expect, eventTypes = ['UserStartedSpeaking', 'UtteranceEnd'], options = {}) {
  const { requireAll = false } = options;
  const state = await getVADState(page, eventTypes);
  
  if (requireAll) {
    for (const eventType of eventTypes) {
      expect(state[eventType]).toBeTruthy();
    }
  } else {
    const hasAnyEvent = eventTypes.some(eventType => state[eventType]);
    expect(hasAnyEvent).toBe(true);
  }
  
  return state;
}

