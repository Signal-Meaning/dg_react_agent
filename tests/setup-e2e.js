/**
 * E2E Test Setup for Playwright
 * 
 * This file sets up the test environment for Playwright E2E tests,
 * including global mocks and test utilities.
 */

// Global test setup
beforeAll(async () => {
  // Set up any global test configuration
  console.log('Setting up E2E test environment...');
});

afterAll(async () => {
  // Clean up after all tests
  console.log('Cleaning up E2E test environment...');
});

// Global test utilities
global.testHelpers = {
  /**
   * Wait for element to be visible with custom timeout
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} selector - Element selector
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForElement(page, selector, timeout = 5000) {
    await page.waitForSelector(selector, { timeout });
  },

  /**
   * Wait for text to be visible in element
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} selector - Element selector
   * @param {string} text - Text to wait for
   * @param {number} timeout - Timeout in milliseconds
   */
  async waitForText(page, selector, text, timeout = 5000) {
    await page.waitForFunction(
      ({ selector, text }) => {
        const element = document.querySelector(selector);
        return element && element.textContent.includes(text);
      },
      { selector, text },
      { timeout }
    );
  },

  /**
   * Simulate user interaction
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} action - Action to perform
   * @param {Object} options - Action options
   */
  async simulateUserAction(page, action, options = {}) {
    switch (action) {
      case 'click':
        await page.click(options.selector);
        break;
      case 'type':
        await page.fill(options.selector, options.text);
        break;
      case 'press':
        await page.press(options.selector, options.key);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },

  /**
   * Mock API responses
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {Object} responses - Mock responses
   */
  async mockAPIResponses(page, responses) {
    await page.addInitScript((responses) => {
      window.mockAPIResponses = responses;
    }, responses);
  },

  /**
   * Simulate network conditions
   * @param {import('@playwright/test').Page} page - Playwright page object
   * @param {string} condition - Network condition
   */
  async simulateNetworkCondition(page, condition) {
    switch (condition) {
      case 'offline':
        await page.context().setOffline(true);
        break;
      case 'online':
        await page.context().setOffline(false);
        break;
      case 'slow':
        await page.addInitScript(() => {
          // Simulate slow network
          const originalFetch = window.fetch;
          window.fetch = async (...args) => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return originalFetch(...args);
          };
        });
        break;
    }
  }
};

// Export for use in test files
module.exports = {
  testHelpers: global.testHelpers
};
