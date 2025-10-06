const { test, expect } = require('@playwright/test');
const { setupTestMode, expectMockMode, expectRealMode } = require('../utils/test-helpers');

/**
 * API Key Validation Tests
 * 
 * These tests verify the fail-fast behavior when API keys are missing or invalid.
 * They use test mode override to simulate different API key scenarios.
 */

test.describe('API Key Validation', () => {
  const mockApiKeyScenarios = ['missing', 'placeholder', 'test-prefix'];

  // Test all mock API key scenarios
  mockApiKeyScenarios.forEach(scenario => {
    test(`should show error when API key is ${scenario}`, async ({ page }) => {
      await setupTestMode(page, scenario);
      await expectMockMode(page);
    });
  });

  test('should show setup instructions in error banner', async ({ page }) => {
    await setupTestMode(page, 'missing');

    // Should show setup instructions
    await expect(page.locator('code').filter({ hasText: 'test-app/.env' })).toBeVisible();
    await expect(page.locator('pre')).toContainText('VITE_DEEPGRAM_API_KEY=');
    await expect(page.locator('a[href="https://deepgram.com"]')).toBeVisible();
  });

  test('should NOT show error with valid API key', async ({ page }) => {
    await setupTestMode(page, 'valid');
    await expectRealMode(page);
  });
});
