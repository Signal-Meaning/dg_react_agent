/**
 * VAD (Voice Activity Detection) testing fixtures
 * 
 * Provides reusable utilities for VAD event detection, state checking, and assertions.
 * These fixtures simplify VAD testing by encapsulating common patterns.
 */

import { test } from '@playwright/test';
import { setupTestPage } from '../helpers/test-helpers.js';

/**
 * Standard test setup for VAD/audio tests
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Setup options
 * @param {boolean} options.skipInCI - Skip in CI (default: true)
 * @param {string} options.skipReason - Reason for skipping (default: 'Requires real API')
 * @param {boolean} options.waitForNetworkIdle - Wait for network idle (default: true)
 * @returns {Promise<void>}
 */
export async function setupVADTest(page, options = {}) {
  const { 
    skipInCI = true, 
    skipReason = 'Requires real Deepgram API connections', 
    waitForNetworkIdle = true 
  } = options;
  
  if (process.env.CI && skipInCI) {
    test.skip(true, skipReason);
    return;
  }
  
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

