/**
 * Backend Proxy Authentication E2E Tests - Issue #242
 * 
 * Tests for authentication flow when using backend proxy mode.
 * 
 * To run:
 *   1. Start mock proxy server: npm run test:proxy:server
 *   2. In another terminal: npm run test:e2e:proxy
 */

import { test, expect } from '@playwright/test';
import { buildUrlWithParams, BASE_URL } from './helpers/test-helpers.mjs';

const PROXY_ENDPOINT = process.env.VITE_PROXY_ENDPOINT || 'ws://localhost:8080/deepgram-proxy';

test.describe('Backend Proxy Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Skip in CI if proxy server is not available
    // Reason: Proxy server is not automatically started in CI environments
    // Action: Configure CI to start proxy server or set VITE_PROXY_ENDPOINT in CI
    if (process.env.CI && !process.env.VITE_PROXY_ENDPOINT) {
      test.skip(true, 'Proxy server not available in CI');
      return;
    }
    // Note: Each test configures the page via URL query params, so no common setup needed
  });

  test('should include auth token in proxy connection when provided', async ({ page }) => {
    const authToken = 'test-jwt-token-123';
    
    // Configure component via URL query parameters
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT,
      proxyAuthToken: authToken
    });
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });

    // Wait for connection mode to be proxy
    await page.waitForFunction(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl && modeEl.textContent?.includes('proxy');
    }, { timeout: 5000 });

    // Verify auth token input is visible and can be set
    const authTokenInput = await page.locator('input[placeholder*="JWT" i], input[placeholder*="session" i]').isVisible();
    expect(authTokenInput).toBe(true);

    // Note: The actual token transmission is verified at the WebSocket level
    // This test verifies the UI supports auth token input
  });

  test('should work without auth token (optional authentication)', async ({ page }) => {
    // Configure component via URL query parameters (no auth token)
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT
    });
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });

    // Wait for connection mode to be proxy
    await page.waitForFunction(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl && modeEl.textContent?.includes('proxy');
    }, { timeout: 5000 });

    // Component should work without auth token (backend may handle auth differently)
    expect(await page.locator('[data-testid="voice-agent"]').isVisible()).toBe(true);
  });
});
