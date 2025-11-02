/**
 * Shared test utilities for Playwright E2E tests
 * 
 * This module provides common test setup patterns and utilities
 * to reduce code duplication across test files.
 */

/**
 * Sets up test mode with a specific API key scenario
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} apiKeyScenario - 'missing', 'placeholder', 'test-prefix', or 'valid'
 */
async function setupTestMode(page, apiKeyScenario) {
  await page.addInitScript((scenario) => {
    window.testApiKey = scenario;
  }, apiKeyScenario);

  await page.goto('http://localhost:5173/?test-mode=true');
  await page.waitForLoadState('networkidle');
}

/**
 * Common test selectors to avoid magic strings
 */
const SELECTORS = {
  voiceAgent: '[data-testid="voice-agent"]',
  connectionStatus: '[data-testid="connection-status"]',
  microphoneButton: '[data-testid="microphone-button"]',
  greetingSent: '[data-testid="greeting-sent"]',
  agentResponse: '[data-testid="agent-response"]',
  userMessage: '[data-testid="user-message"]',
  textInput: '[data-testid="text-input"]',
  sendButton: '[data-testid="send-button"]',
  micStatus: '[data-testid="mic-status"]',
  connectionReady: '[data-testid="connection-ready"]',
  agentSpeaking: '[data-testid="agent-speaking"]',
  agentSilent: '[data-testid="agent-silent"]',
  autoConnectStates: '[data-testid="auto-connect-states"]',
};

/**
 * Common test timeouts
 */
const TIMEOUTS = {
  short: 5000,
  medium: 10000,
  long: 15000,
  connection: 10000,
  greeting: 10000,
};

/**
 * Common test expectations
 */
const EXPECTATIONS = {
  connected: 'connected',
  closed: 'closed',
  enabled: 'Enabled',
  disabled: 'Disabled',
  mockMode: '🔴 Current Mode: MOCK',
  realMode: '🟢 REAL API Mode',
  apiKeyStatus: '⚠️ Deepgram API Key Required',
};

/**
 * Waits for connection to be established
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForConnection(page, timeout = TIMEOUTS.connection) {
  await page.waitForSelector(SELECTORS.connectionStatus);
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      return element && element.textContent?.includes('connected');
    },
    SELECTORS.connectionStatus,
    { timeout }
  );
}

/**
 * Waits for greeting to be sent
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds
 */
async function waitForGreeting(page, timeout = TIMEOUTS.greeting) {
  await page.waitForSelector(SELECTORS.greetingSent, { timeout });
}

/**
 * Clicks the microphone button and waits for state change
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function toggleMicrophone(page) {
  await page.click(SELECTORS.microphoneButton);
  // Wait for state to update
  await page.waitForTimeout(500);
}

/**
 * Sends a text message via the text input
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} message - Message to send
 */
async function sendTextMessage(page, message) {
  await page.fill(SELECTORS.textInput, message);
  await page.press(SELECTORS.textInput, 'Enter');
}

/**
 * Verifies the component is in mock mode
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function expectMockMode(page) {
  const { expect } = await import('@playwright/test');
  // When API key is invalid/missing, app shows error banner with h2
  await expect(page.locator('h2')).toContainText(EXPECTATIONS.apiKeyStatus);
  // Note: The app doesn't show a "MOCK mode" indicator - it just shows the error banner
}

/**
 * Verifies the component is in real mode
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function expectRealMode(page) {
  const { expect } = await import('@playwright/test');
  await expect(page.locator(SELECTORS.voiceAgent)).toBeVisible();
  // Should not show error banner - check if error banner exists first
  const errorBanner = page.locator('h2').filter({ hasText: EXPECTATIONS.apiKeyStatus });
  if (await errorBanner.count() > 0) {
    await expect(errorBanner).not.toBeVisible();
  }
}

export {
  setupTestMode,
  SELECTORS,
  TIMEOUTS,
  EXPECTATIONS,
  waitForConnection,
  waitForGreeting,
  toggleMicrophone,
  sendTextMessage,
  expectMockMode,
  expectRealMode,
};
