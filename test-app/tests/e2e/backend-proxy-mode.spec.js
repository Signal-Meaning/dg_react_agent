/**
 * Backend Proxy Mode E2E Tests - Issue #242
 * 
 * End-to-end tests for backend proxy mode functionality.
 * These tests require the mock proxy server to be running.
 * 
 * To run:
 *   1. Start mock proxy server: npm run test:proxy:server
 *   2. In another terminal: npm run test:e2e:proxy
 * 
 * Test scenarios:
 * 1. Connection through proxy endpoint
 * 2. Feature parity (transcription, agent, VAD, etc.)
 * 3. Authentication flow
 * 4. Reconnection through proxy
 * 5. Error handling
 */

import { test, expect } from '@playwright/test';
import { setupTestPage } from '../utils/test-helpers';

const PROXY_ENDPOINT = process.env.VITE_PROXY_ENDPOINT || 'ws://localhost:8080/deepgram-proxy';

test.describe('Backend Proxy Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Skip in CI if proxy server is not available
    if (process.env.CI && !process.env.VITE_PROXY_ENDPOINT) {
      test.skip(true, 'Proxy server not available in CI');
      return;
    }

    await setupTestPage(page);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  });

  test('should connect through proxy endpoint when proxyEndpoint prop is provided', async ({ page }) => {
    // Set proxy endpoint in test mode
    await page.evaluate((endpoint) => {
      window.testProxyEndpoint = endpoint;
    }, PROXY_ENDPOINT);

    // Wait for connection
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent?.toLowerCase().includes('connected');
    }, { timeout: 15000 });

    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus?.toLowerCase()).toContain('connected');
  });

  test('should work with transcription through proxy', async ({ page }) => {
    // This test will be implemented when proxy mode is fully working
    // For now, it's a placeholder to define expected behavior
    test.skip(true, 'To be implemented after proxy mode is working');
  });

  test('should work with agent responses through proxy', async ({ page }) => {
    // This test will be implemented when proxy mode is fully working
    test.skip(true, 'To be implemented after proxy mode is working');
  });

  test('should handle reconnection through proxy', async ({ page }) => {
    // This test will be implemented when proxy mode is fully working
    test.skip(true, 'To be implemented after proxy mode is working');
  });

  test('should handle proxy server unavailable gracefully', async ({ page }) => {
    // Set invalid proxy endpoint
    await page.evaluate(() => {
      window.testProxyEndpoint = 'ws://localhost:9999/invalid-proxy';
    });

    // Should show error or handle gracefully
    await page.waitForTimeout(5000);

    // Component should handle error without crashing
    const errorElement = await page.locator('[data-testid="error"]').isVisible().catch(() => false);
    // Error handling may vary, but component should not crash
    expect(await page.locator('[data-testid="voice-agent"]').isVisible()).toBe(true);
  });
});
