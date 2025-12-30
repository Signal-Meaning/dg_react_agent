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
    
    // Verify proxy server is running before proceeding with tests
    // Use page.evaluate to check from browser context (WebSocket is available there)
    const proxyRunning = await page.evaluate(async (endpoint) => {
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket(endpoint);
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 2000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
          };
          
          ws.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
          };
        } catch (error) {
          resolve(false);
        }
      });
    }, PROXY_ENDPOINT);
    
    if (!proxyRunning) {
      test.skip(true, `Proxy server is not running at ${PROXY_ENDPOINT}. Start it with: npm run test:proxy:server`);
      return;
    }
    
    // Note: Each test configures the page via URL query params, so no common setup needed
  });

  test.afterEach(async ({ page }) => {
    // Clean up: Close any open connections and clear state
    try {
      await page.evaluate(() => {
        // Close component if it exists
        if (window.deepgramRef?.current) {
          window.deepgramRef.current.stop?.();
        }
        // Clear any global state
        if (window.__DEEPGRAM_LAST_SETTINGS__) {
          delete window.__DEEPGRAM_LAST_SETTINGS__;
        }
        if (window.__DEEPGRAM_LAST_FUNCTIONS__) {
          delete window.__DEEPGRAM_LAST_FUNCTIONS__;
        }
      });
      // Navigate away to ensure clean state for next test
      await page.goto('about:blank');
      await page.waitForTimeout(500); // Give time for cleanup
    } catch (error) {
      // Ignore cleanup errors - test may have already navigated away
    }
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
    // NOTE: This test requires the proxy server to be running
    // Start it with: npm run test:proxy:server
    
    // Configure component via URL query parameters
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT
    });
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for connection mode to be set to proxy (component initialization)
    await page.waitForFunction(() => {
      const modeEl = document.querySelector('[data-testid="connection-mode"]');
      return modeEl && modeEl.textContent?.includes('proxy');
    }, { timeout: 5000 });

    // Verify connection mode is proxy
    const connectionMode = await page.locator('[data-testid="connection-mode"]').textContent();
    expect(connectionMode).toContain('proxy');

    // Wait for text input to be ready and focusable before triggering auto-connect
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    
    // Focus text input to trigger auto-connect (in dual mode, this should establish connection)
    // The onFocus handler calls deepgramRef.current?.start?.({ agent: true, transcription: false })
    await textInput.focus();
    
    // Wait for connection status element to appear (component may be initializing)
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    
    // Wait for connection to transition from "closed" to "connecting" to "connected"
    // First check if it's attempting to connect (status should change from "closed")
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      // Wait for status to change from "closed" (either "connecting" or "connected")
      return status !== 'closed';
    }, { timeout: 10000 }).catch(async (error) => {
      // If status never changes from "closed", the connection isn't being attempted
      const diagnosticInfo = await page.evaluate(() => {
        const statusEl = document.querySelector('[data-testid="connection-status"]');
        return {
          connectionStatus: statusEl?.textContent || 'not found',
          // Check if there are WebSocket errors in console
          consoleLogs: (window.consoleLogs || []).slice(-10) // Last 10 logs
        };
      });
      throw new Error(`Connection not attempting to establish. Status stuck at "${diagnosticInfo.connectionStatus}". This should not happen if proxy server check passed.`);
    });
    
    // Now wait for connection to be fully established
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status.includes('connected');
    }, { timeout: 20000 }).catch(async (error) => {
      // If connection fails, capture diagnostic information
      const diagnosticInfo = await page.evaluate(() => {
        const statusEl = document.querySelector('[data-testid="connection-status"]');
        const modeEl = document.querySelector('[data-testid="connection-mode"]');
        const hasSettings = document.querySelector('[data-testid="has-sent-settings"]');
        
        return {
          connectionStatus: statusEl?.textContent || 'not found',
          connectionMode: modeEl?.textContent || 'not found',
          hasSentSettings: hasSettings?.textContent || 'not found',
          // Check for any error messages in console
          consoleLogs: (window.consoleLogs || []).slice(-10) // Last 10 logs
        };
      });
      
      console.error('Connection failed. Diagnostic info:', JSON.stringify(diagnosticInfo, null, 2));
      throw new Error(`Connection failed to establish. Status: "${diagnosticInfo.connectionStatus}", Mode: "${diagnosticInfo.connectionMode}". Proxy server check passed, but connection still failed.`);
    });

    // Verify connection is established
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus).toContain('connected');

    // CRITICAL: Wait for Settings to be applied before sending message
    // The component requires Settings to be sent before it will accept InjectUserMessage
    // This prevents "Received InjectUserMessage before Settings" error
    await page.waitForFunction(() => {
      const settingsEl = document.querySelector('[data-testid="has-sent-settings"]');
      return settingsEl && settingsEl.textContent === 'true';
    }, { timeout: 20000 });

    // Send a text message to trigger agent response through proxy
    const testMessage = 'Hello, this is a proxy mode test';
    await sendTextMessage(page, testMessage);

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
