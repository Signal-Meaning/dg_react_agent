const { test, expect } = require('@playwright/test');

/**
 * API Key Validation Tests
 * 
 * These tests verify the fail-fast behavior when API keys are missing or invalid.
 * They mock the environment variables to test the error handling.
 */

test.describe('API Key Validation', () => {
  test('should show error when API key is missing', async ({ page }) => {
    // Mock missing API key
    await page.addInitScript(() => {
      // Override import.meta.env to simulate missing API key
      Object.defineProperty(window, 'import', {
        value: {
          meta: {
            env: {
              VITE_DEEPGRAM_API_KEY: undefined,
              VITE_DEEPGRAM_PROJECT_ID: 'test-project-id'
            }
          }
        },
        writable: true
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show the error banner
    await expect(page.locator('h2')).toContainText('❌ Missing Deepgram API Key');
    await expect(page.locator('strong')).toContainText('E2E Tests require a REAL Deepgram API key!');
  });

  test('should show error when API key is placeholder', async ({ page }) => {
    // Mock placeholder API key
    await page.addInitScript(() => {
      Object.defineProperty(window, 'import', {
        value: {
          meta: {
            env: {
              VITE_DEEPGRAM_API_KEY: 'your-deepgram-api-key-here',
              VITE_DEEPGRAM_PROJECT_ID: 'your-project-id-here'
            }
          }
        },
        writable: true
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show the error banner
    await expect(page.locator('h2')).toContainText('❌ Missing Deepgram API Key');
  });

  test('should show error when API key starts with test-', async ({ page }) => {
    // Mock test API key
    await page.addInitScript(() => {
      Object.defineProperty(window, 'import', {
        value: {
          meta: {
            env: {
              VITE_DEEPGRAM_API_KEY: 'test-fake-api-key',
              VITE_DEEPGRAM_PROJECT_ID: 'test-project-id'
            }
          }
        },
        writable: true
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show the error banner
    await expect(page.locator('h2')).toContainText('❌ Missing Deepgram API Key');
  });

  test('should show setup instructions in error banner', async ({ page }) => {
    // Mock missing API key
    await page.addInitScript(() => {
      Object.defineProperty(window, 'import', {
        value: {
          meta: {
            env: {
              VITE_DEEPGRAM_API_KEY: undefined,
              VITE_DEEPGRAM_PROJECT_ID: undefined
            }
          }
        },
        writable: true
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show setup instructions
    await expect(page.locator('code')).toContainText('test-app/.env');
    await expect(page.locator('pre')).toContainText('VITE_DEEPGRAM_API_KEY=');
    await expect(page.locator('a[href="https://deepgram.com"]')).toBeVisible();
  });
});
