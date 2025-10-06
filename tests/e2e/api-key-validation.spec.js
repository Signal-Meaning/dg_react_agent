const { test, expect } = require('@playwright/test');

/**
 * API Key Validation Tests
 * 
 * These tests verify the fail-fast behavior when API keys are missing or invalid.
 * They mock the environment variables to test the error handling.
 */

test.describe('API Key Validation', () => {
  test('should show error when API key is missing', async ({ page }) => {
    // Set test mode and missing API key
    await page.addInitScript(() => {
      window.testApiKey = 'missing';
    });

    await page.goto('/?test-mode=true');
    await page.waitForLoadState('networkidle');

    // Should show the error banner
    await expect(page.locator('h2')).toContainText('⚠️ Deepgram API Key Status');
    await expect(page.locator('h4')).toContainText('🔴 Current Mode: MOCK');
  });

  test('should show error when API key is placeholder', async ({ page }) => {
    // Set test mode and placeholder API key
    await page.addInitScript(() => {
      window.testApiKey = 'placeholder';
    });

    await page.goto('/?test-mode=true');
    await page.waitForLoadState('networkidle');

    // Should show the error banner
    await expect(page.locator('h2')).toContainText('⚠️ Deepgram API Key Status');
    await expect(page.locator('h4')).toContainText('🔴 Current Mode: MOCK');
  });

  test('should show error when API key starts with test-', async ({ page }) => {
    // Set test mode and test-prefix API key
    await page.addInitScript(() => {
      window.testApiKey = 'test-prefix';
    });

    await page.goto('/?test-mode=true');
    await page.waitForLoadState('networkidle');

    // Should show the error banner
    await expect(page.locator('h2')).toContainText('⚠️ Deepgram API Key Status');
    await expect(page.locator('h4')).toContainText('🔴 Current Mode: MOCK');
  });

  test('should show setup instructions in error banner', async ({ page }) => {
    // Set test mode and missing API key
    await page.addInitScript(() => {
      window.testApiKey = 'missing';
    });

    await page.goto('/?test-mode=true');
    await page.waitForLoadState('networkidle');

    // Should show setup instructions
    await expect(page.locator('code')).toContainText('test-app/.env');
    await expect(page.locator('pre')).toContainText('VITE_DEEPGRAM_API_KEY=');
    await expect(page.locator('a[href="https://deepgram.com"]')).toBeVisible();
  });

  test('should NOT show error with valid API key', async ({ page }) => {
    // Set test mode and valid API key
    await page.addInitScript(() => {
      window.testApiKey = 'valid';
    });

    await page.goto('/?test-mode=true');
    await page.waitForLoadState('networkidle');

    // Should NOT show error banner
    await expect(page.locator('h2')).not.toContainText('⚠️ Deepgram API Key Status');
    await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
  });
});
