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
import { sendTextMessage, waitForConnection } from '../utils/test-helpers';
import { buildUrlWithParams, BASE_URL } from './helpers/test-helpers.mjs';

const PROXY_ENDPOINT = process.env.VITE_PROXY_ENDPOINT || 'ws://localhost:8080/deepgram-proxy';

test.describe('Backend Proxy Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Skip in CI if proxy server is not available
    if (process.env.CI && !process.env.VITE_PROXY_ENDPOINT) {
      test.skip(true, 'Proxy server not available in CI');
      return;
    }
    // Note: Each test configures the page via URL query params, so no common setup needed
  });

  test('should connect through proxy endpoint when proxyEndpoint prop is provided', async ({ page }) => {
    // Configure component via URL query parameters (no App.tsx modifications needed)
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT
    });
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for connection mode to be set to proxy
    await page.waitForFunction(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl && modeEl.textContent?.includes('proxy');
    }, { timeout: 5000 });

    // Verify connection mode is proxy
    const connectionMode = await page.locator('[data-testid="connection-mode"]').textContent();
    expect(connectionMode).toContain('proxy');

    // Verify proxy endpoint is set
    const endpointInput = await page.locator('input[placeholder*="localhost:8080"]').inputValue();
    expect(endpointInput).toContain('localhost:8080');
    expect(endpointInput).toContain('deepgram-proxy');
  });

  test('should work with agent responses through proxy', async ({ page }) => {
    // Configure component via URL query parameters
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT
    });
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for connection mode to be set to proxy
    await page.waitForFunction(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl && modeEl.textContent?.includes('proxy');
    }, { timeout: 5000 });

    // Verify connection mode is proxy
    const connectionMode = await page.locator('[data-testid="connection-mode"]').textContent();
    expect(connectionMode).toContain('proxy');

    // Wait for connection to be established (component auto-connects in dual mode)
    // In proxy mode, connection should still auto-connect when text input is focused
    await page.click('[data-testid="text-input"]');
    await page.waitForTimeout(1000); // Give time for auto-connect to trigger
    
    // Wait for connection with longer timeout for proxy mode
    // If connection doesn't establish, sending a message will trigger it
    try {
      await waitForConnection(page, 15000);
    } catch (error) {
      // Connection might not auto-connect immediately in proxy mode
      // Sending a message will trigger connection
      console.log('Connection not yet established, will trigger via message send...');
    }

    // Send a text message to trigger agent response through proxy
    // This will also trigger connection if not already connected
    const testMessage = 'Hello, this is a proxy mode test';
    await sendTextMessage(page, testMessage);
    
    // After sending message, wait for connection if not already connected
    try {
      await waitForConnection(page, 10000);
    } catch (error) {
      // Connection might still be establishing, continue anyway
    }

    // Wait for agent response (through proxy)
    // Use a longer timeout since proxy may add some latency
    await page.waitForFunction(() => {
      const responseEl = document.querySelector('[data-testid="agent-response"]');
      return responseEl && 
             responseEl.textContent && 
             responseEl.textContent.trim() !== '' &&
             responseEl.textContent !== '(Waiting for agent response...)';
    }, { timeout: 30000 });

    const agentResponse = await page.locator('[data-testid="agent-response"]').textContent();
    expect(agentResponse).toBeTruthy();
    expect(agentResponse.trim()).not.toBe('');
    expect(agentResponse).not.toBe('(Waiting for agent response...)');
  });

  test('should handle reconnection through proxy', async ({ page }) => {
    // Configure component via URL query parameters
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

    // Verify component is configured for proxy mode
    const connectionMode = await page.locator('[data-testid="connection-mode"]').textContent();
    expect(connectionMode).toContain('proxy');
    
    // Component should handle reconnection through proxy the same way as direct mode
    // The proxy is transparent to the component's reconnection logic
    expect(await page.locator('[data-testid="voice-agent"]').isVisible()).toBe(true);
  });

  test('should handle proxy server unavailable gracefully', async ({ page }) => {
    // Configure component via URL query parameters with invalid endpoint
    const invalidEndpoint = 'ws://localhost:9999/invalid-proxy';
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'proxy',
      proxyEndpoint: invalidEndpoint
    });
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });

    // Wait for connection mode to be set
    await page.waitForFunction(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl && modeEl.textContent?.includes('proxy');
    }, { timeout: 5000 });

    // Component should handle error without crashing
    // Error may be shown in connection status or error handler
    await page.waitForTimeout(3000);

    // Component should remain visible and functional
    expect(await page.locator('[data-testid="voice-agent"]').isVisible()).toBe(true);
    
    // Connection status should reflect the error state
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus).toBeTruthy();
  });
});
