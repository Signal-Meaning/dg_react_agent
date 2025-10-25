import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Microphone Control
 * 
 * IMPORTANT: These tests require a REAL Deepgram API key!
 * 
 * These tests use actual WebSocket connections to Deepgram services,
 * not mocks. This provides authentic integration testing but requires
 * valid API credentials in test-app/.env:
 * 
 * - VITE_DEEPGRAM_API_KEY: Your real Deepgram API key
 * - VITE_DEEPGRAM_PROJECT_ID: Your Deepgram project ID
 * 
 * If tests fail with "connection closed" or "API key required" errors,
 * check that your test-app/.env file has valid Deepgram credentials.
 * 
 * Why not use mocks? Real API testing catches integration issues
 * and provides authentic component behavior validation.
 */

test.describe('Microphone Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Note: Component doesn't connect without a valid API key
    // The connection status will be "closed" due to invalid test API key
    // This is expected behavior for testing without real Deepgram credentials
  });

  test('should enable microphone when button clicked', async ({ page }) => {
    // Wait for component to be ready
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true');
    
    // Verify initial state - microphone should be disabled
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
    
    // Click the microphone button to enable it
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for state to update
    await page.waitForTimeout(2000);
    
    // Verify microphone is now enabled
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
  });

  test('should disable microphone when button clicked again', async ({ page }) => {
    // Wait for component to be ready
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true');
    
    // First enable the microphone
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
    
    // Now disable it by clicking again
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000);
    
    // Verify microphone is now disabled
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
  });

  // TODO: Fix permission mocking - see https://github.com/Signal-Meaning/dg_react_agent/issues/178
  test.skip('should handle microphone permission denied', async ({ page }) => {
    // Wait for component to be ready
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true');
    
    // Mock permission denied - use the actual origin
    const currentUrl = page.url();
    const origin = new URL(currentUrl).origin;
    await page.context().grantPermissions([], { origin });
    
    // Try to enable microphone - should handle permission error gracefully
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    // Should remain disabled due to permission error
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
  });

  test('should handle microphone permission granted', async ({ page }) => {
    // Wait for component to be ready
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true');
    
    // Grant microphone permission - use the actual origin
    const currentUrl = page.url();
    const origin = new URL(currentUrl).origin;
    await page.context().grantPermissions(['microphone'], { origin });
    
    // Try to enable microphone - should work with permission granted
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    // Should be enabled with permission granted
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
  });

  // TODO: Fix permission mocking - see https://github.com/Signal-Meaning/dg_react_agent/issues/178
  test.skip('should handle microphone errors gracefully', async ({ page }) => {
    // Wait for component to be ready
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true');
    
    // Mock getUserMedia to throw error
    await page.addInitScript(() => {
      // Override getUserMedia to throw error
      navigator.mediaDevices.getUserMedia = () => {
        return Promise.reject(new DOMException('Microphone access denied', 'NotAllowedError'));
      };
    });
    
    // Try to enable microphone - should handle error gracefully
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    // Should remain disabled due to error
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
  });
});
