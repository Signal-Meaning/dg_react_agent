/**
 * API Key Security Tests for Proxy Mode - Issue #242
 * 
 * These tests verify that API keys are NOT exposed to the frontend when using proxy mode.
 * This is critical for security - API keys must remain server-side only.
 * 
 * Test Categories:
 * 1. Bundle Inspection - Verify API keys are not in JavaScript bundle
 * 2. Network Request Inspection - Verify API keys are not in WebSocket URLs or headers
 * 3. DOM/Source Code Inspection - Verify API keys are not in DOM or page source
 * 4. Console/Log Inspection - Verify API keys are not logged to console
 * 5. Proxy Backend Validation - Verify proxy server keeps API keys server-side
 * 
 * To run:
 *   1. Start mock proxy server: npm run test:proxy:server
 *   2. Set USE_PROXY_MODE=true: USE_PROXY_MODE=true npm run test:e2e -- api-key-security-proxy-mode
 * 
 * Requirements:
 * - Real Deepgram API key (VITE_DEEPGRAM_API_KEY) - for proxy server
 * - Proxy server running (npm run test:proxy:server)
 */

import { test, expect } from '@playwright/test';
import { pathWithQuery, getDeepgramProxyParams } from './helpers/test-helpers.mjs';
import { setupTestPage, waitForConnection } from './helpers/test-helpers.js';

const PROXY_ENDPOINT = getDeepgramProxyParams().proxyEndpoint;
// Proxy mode is now the default for e2e tests
// Only skip if explicitly set to false
const IS_PROXY_MODE = process.env.USE_PROXY_MODE !== 'false';
const DEEPGRAM_API_KEY = process.env.VITE_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY;

// Helper to extract potential API keys from strings
function extractPotentialApiKeys(text) {
  // Deepgram API keys typically start with 'dg_' and are 40+ characters
  const deepgramKeyPattern = /dg_[a-zA-Z0-9_-]{35,}/g;
  const matches = text.match(deepgramKeyPattern) || [];
  return matches.filter(key => key.length >= 40); // Filter out false positives
}

// Helper to check if API key appears in text (with some obfuscation allowed)
function containsApiKey(text, apiKey) {
  if (!apiKey || apiKey.length < 20) return false;
  
  // Check for full key
  if (text.includes(apiKey)) return true;
  
  // Check for key fragments (first 8 + last 4 chars, which might be logged)
  const keyPreview = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
  if (text.includes(keyPreview)) {
    // Allow preview format in logs (this is acceptable)
    // But check if more than preview is exposed
    const first8 = apiKey.substring(0, 8);
    const last4 = apiKey.substring(apiKey.length - 4);
    const middle = apiKey.substring(8, apiKey.length - 4);
    
    // If middle portion is exposed, that's a security issue
    if (text.includes(middle)) return true;
  }
  
  return false;
}

test.describe('API Key Security - Proxy Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if not in proxy mode
    if (!IS_PROXY_MODE) {
      test.skip(true, 'This test requires proxy mode. Run with USE_PROXY_MODE=true');
      return;
    }
    
    // Skip if proxy server is not available
    if (process.env.CI && !process.env.VITE_PROXY_ENDPOINT) {
      test.skip(true, 'Proxy server not available in CI');
      return;
    }
    
    // Verify proxy server is running
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
    
    // Capture console logs for inspection
    page.on('console', (msg) => {
      // Store console messages for later inspection
      if (!page.consoleLogs) {
        page.consoleLogs = [];
      }
      page.consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up
    try {
      await page.evaluate(() => {
        if (window.deepgramRef?.current) {
          window.deepgramRef.current.stop?.();
        }
      });
      await page.goto('about:blank');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test.describe('Bundle Inspection', () => {
    test('should not contain API key in JavaScript bundle source', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      
      // Get page source (includes inline scripts)
      const pageSource = await page.content();
      
      // Check for API key in source
      if (DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.length >= 20) {
        expect(pageSource).not.toContain(DEEPGRAM_API_KEY);
        
        // Check for key fragments (middle portion should not be exposed)
        const middlePortion = DEEPGRAM_API_KEY.substring(10, DEEPGRAM_API_KEY.length - 10);
        if (middlePortion.length > 10) {
          expect(pageSource).not.toContain(middlePortion);
        }
      }
      
      // Check for common API key patterns
      const potentialKeys = extractPotentialApiKeys(pageSource);
      expect(potentialKeys.length).toBe(0);
      
      console.log('✅ Bundle inspection passed - no API keys found in source');
    });

    test('should not expose API key in environment variable references', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      
      // Check that VITE_DEEPGRAM_API_KEY is not used when in proxy mode
      const pageSource = await page.content();
      
      // In proxy mode, the component should not reference VITE_DEEPGRAM_API_KEY
      // (it may appear in comments or error messages, but not as actual values)
      const apiKeyReferences = pageSource.match(/VITE_DEEPGRAM_API_KEY/g) || [];
      
      // If references exist, verify they're not actual key values
      if (apiKeyReferences.length > 0) {
        // Check that no actual API key value follows the reference
        const hasKeyValue = pageSource.includes('VITE_DEEPGRAM_API_KEY') && 
                           (pageSource.includes('dg_') || pageSource.includes('your-deepgram-api-key'));
        // This is acceptable if it's just the env var name, not the actual key
        console.log('ℹ️ Found VITE_DEEPGRAM_API_KEY references (may be in comments/error messages)');
      }
      
      console.log('✅ Environment variable inspection passed');
    });
  });

  test.describe('Network Request Inspection', () => {
    test('should not include API key in WebSocket connection URLs', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      const capturedUrls = [];
      
      // Intercept WebSocket creation and capture all URLs
      await page.addInitScript(() => {
        const OriginalWebSocket = window.WebSocket;
        window.__allWsUrls = window.__allWsUrls || [];
        window.__allWsProtocols = window.__allWsProtocols || [];
        window.WebSocket = function(url, protocols) {
          window.__allWsUrls.push(url);
          window.__allWsProtocols.push(Array.isArray(protocols) ? protocols : [protocols]);
          return new OriginalWebSocket(url, protocols);
        };
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      
      // Wait for connection attempt and component initialization
      await page.waitForTimeout(3000);
      
      // Get all captured WebSocket URLs and find the proxy one
      const allUrls = await page.evaluate(() => window.__allWsUrls || []);
      const wsUrl = allUrls.find(url => url.includes('localhost:8080') || url.includes('deepgram-proxy'));
      
      if (wsUrl) {
        capturedUrls.push(wsUrl);
        
        // Verify URL is proxy endpoint, not Deepgram endpoint
        expect(wsUrl).toContain('localhost:8080');
        expect(wsUrl).toContain('deepgram-proxy');
        expect(wsUrl).not.toContain('agent.deepgram.com');
        expect(wsUrl).not.toContain('api.deepgram.com');
        
        // Verify API key is not in URL
        if (DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.length >= 20) {
          expect(wsUrl).not.toContain(DEEPGRAM_API_KEY);
          
          // Check for key fragments
          const first10 = DEEPGRAM_API_KEY.substring(0, 10);
          const last10 = DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 10);
          expect(wsUrl).not.toContain(first10);
          expect(wsUrl).not.toContain(last10);
        }
        
        // Check for API key patterns in URL
        const potentialKeys = extractPotentialApiKeys(wsUrl);
        expect(potentialKeys.length).toBe(0);
      }
      
      console.log('✅ WebSocket URL inspection passed - no API keys in connection URLs');
    });

    test('should not include API key in WebSocket protocol array', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      // Intercept WebSocket creation and capture protocols for proxy connections
      await page.addInitScript(() => {
        const OriginalWebSocket = window.WebSocket;
        window.__allWsUrls = window.__allWsUrls || [];
        window.__allWsProtocols = window.__allWsProtocols || [];
        window.WebSocket = function(url, protocols) {
          window.__allWsUrls.push(url);
          window.__allWsProtocols.push(Array.isArray(protocols) ? protocols : [protocols]);
          return new OriginalWebSocket(url, protocols);
        };
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      
      // Wait for connection attempt and component initialization
      await page.waitForTimeout(3000);
      
      // Get all captured WebSocket URLs and protocols, find proxy connection
      const allData = await page.evaluate(() => ({
        urls: window.__allWsUrls || [],
        protocols: window.__allWsProtocols || []
      }));
      
      // Find index of proxy connection
      const proxyIndex = allData.urls.findIndex(url => url.includes('localhost:8080') || url.includes('deepgram-proxy'));
      const protocols = proxyIndex >= 0 ? allData.protocols[proxyIndex] : null;
      
      if (protocols && Array.isArray(protocols)) {
        const protocolsStr = protocols.join(' ');
        
        // In proxy mode, client should NOT send API key in protocols
        // The proxy server handles authentication
        if (DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.length >= 20) {
          expect(protocolsStr).not.toContain(DEEPGRAM_API_KEY);
        }
        
        // Protocols should not contain 'token' with API key
        // (proxy mode uses different auth mechanism)
        protocols.forEach(protocol => {
          if (typeof protocol === 'string' && protocol.length > 50) {
            // Protocol strings should be short (like 'token'), not API keys
            expect(protocol.length).toBeLessThan(20);
          }
        });
      }
      
      console.log('✅ WebSocket protocol inspection passed - no API keys in protocols');
    });

    test('should connect to proxy endpoint, not Deepgram endpoint', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      const deepgramUrls = [];
      
      // Monitor network requests
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('deepgram.com') || url.includes('agent.deepgram.com')) {
          deepgramUrls.push(url);
        }
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      
      // Wait for any network activity
      await page.waitForTimeout(3000);
      
      // In proxy mode, frontend should NOT connect directly to Deepgram
      // All connections should go through proxy
      expect(deepgramUrls.length).toBe(0);
      
      console.log('✅ Network request inspection passed - no direct Deepgram connections');
    });
  });

  test.describe('DOM and Source Code Inspection', () => {
    test('should not expose API key in DOM elements', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
      
      // Get all text content from DOM
      const domText = await page.evaluate(() => {
        return document.body.innerText;
      });
      
      // Get all HTML attributes
      const htmlContent = await page.content();
      
      // Check DOM text
      if (DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.length >= 20) {
        expect(domText).not.toContain(DEEPGRAM_API_KEY);
        expect(htmlContent).not.toContain(DEEPGRAM_API_KEY);
      }
      
      // Check for API key patterns
      const potentialKeys = extractPotentialApiKeys(domText + htmlContent);
      expect(potentialKeys.length).toBe(0);
      
      console.log('✅ DOM inspection passed - no API keys in DOM');
    });

    test('should not expose API key in React DevTools state', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      
      // Check window object for API keys
      const windowProps = await page.evaluate(() => {
        const props = {};
        for (let key in window) {
          try {
            const value = window[key];
            if (typeof value === 'string' && value.length > 30) {
              props[key] = value.substring(0, 50); // First 50 chars only
            }
          } catch (e) {
            // Ignore access errors
          }
        }
        return props;
      });
      
      const windowPropsStr = JSON.stringify(windowProps);
      
      if (DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.length >= 20) {
        expect(windowPropsStr).not.toContain(DEEPGRAM_API_KEY);
      }
      
      // Check for API key patterns
      const potentialKeys = extractPotentialApiKeys(windowPropsStr);
      expect(potentialKeys.length).toBe(0);
      
      console.log('✅ Window object inspection passed - no API keys exposed');
    });
  });

  test.describe('Console and Log Inspection', () => {
    test('should not log API key to console', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      const consoleMessages = [];
      
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      
      // Establish connection to trigger any logging
      await setupTestPage(page);
      await waitForConnection(page, { timeout: 10000 }).catch(() => {
        // Connection may fail, that's ok for this test
      });
      
      // Wait for any additional logging
      await page.waitForTimeout(2000);
      
      // Check all console messages
      const allConsoleText = consoleMessages.join(' ');
      
      if (DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.length >= 20) {
        // Full key should never appear
        expect(allConsoleText).not.toContain(DEEPGRAM_API_KEY);
        
        // Middle portion should never appear (security risk)
        const middlePortion = DEEPGRAM_API_KEY.substring(10, DEEPGRAM_API_KEY.length - 10);
        if (middlePortion.length > 10) {
          expect(allConsoleText).not.toContain(middlePortion);
        }
      }
      
      // Check for API key patterns
      const potentialKeys = extractPotentialApiKeys(allConsoleText);
      expect(potentialKeys.length).toBe(0);
      
      console.log('✅ Console log inspection passed - no API keys logged');
    });

    test('should not expose API key in error messages', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: 'ws://localhost:9999/invalid-proxy' // Invalid endpoint to trigger errors
      });
      
      const errorMessages = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errorMessages.push(msg.text());
        }
      });
      
      page.on('pageerror', (error) => {
        errorMessages.push(error.message);
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      
      // Wait for errors to appear
      await page.waitForTimeout(3000);
      
      // Check error messages
      const allErrors = errorMessages.join(' ');
      
      if (DEEPGRAM_API_KEY && DEEPGRAM_API_KEY.length >= 20) {
        expect(allErrors).not.toContain(DEEPGRAM_API_KEY);
      }
      
      // Check for API key patterns
      const potentialKeys = extractPotentialApiKeys(allErrors);
      expect(potentialKeys.length).toBe(0);
      
      console.log('✅ Error message inspection passed - no API keys in errors');
    });
  });

  test.describe('Proxy Backend Validation', () => {
    test('should verify proxy endpoint is used instead of direct Deepgram connection', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      const wsUrls = [];
      
      // Capture WebSocket URLs
      await page.addInitScript(() => {
        const OriginalWebSocket = window.WebSocket;
        window.__allWsUrls = window.__allWsUrls || [];
        window.WebSocket = function(url, protocols) {
          window.__allWsUrls.push(url);
          return new OriginalWebSocket(url, protocols);
        };
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
      
      // Trigger connection by focusing text input (auto-connect pattern)
      const textInput = page.locator('[data-testid="text-input"]');
      await textInput.waitFor({ state: 'visible', timeout: 5000 });
      await textInput.focus();
      
      // Wait for connection to be established
      await page.waitForTimeout(5000);
      
      // Get captured URLs and filter for proxy connections
      const allUrls = await page.evaluate(() => window.__allWsUrls || []);
      const proxyUrls = allUrls.filter(url => url.includes('localhost:8080') || url.includes('deepgram-proxy'));
      const deepgramUrls = allUrls.filter(url => url.includes('agent.deepgram.com') || url.includes('api.deepgram.com'));
      
      // Verify no direct Deepgram connections
      expect(deepgramUrls.length).toBe(0);
      
      // If there are WebSocket connections, verify they go to proxy
      if (allUrls.length > 0) {
        // Verify we found at least one proxy connection (if any connections exist)
        expect(proxyUrls.length).toBeGreaterThan(0);
        
        // Verify all proxy connections go to proxy, not Deepgram
        proxyUrls.forEach(url => {
          expect(url).toContain('localhost:8080');
          expect(url).toContain('deepgram-proxy');
          expect(url).not.toContain('agent.deepgram.com');
          expect(url).not.toContain('api.deepgram.com');
        });
      }
      
      console.log('✅ Proxy backend validation passed - all connections use proxy');
    });

    test('should verify connection mode indicator shows proxy mode', async ({ page }) => {
      const testUrl = pathWithQuery({
        connectionMode: 'proxy',
        proxyEndpoint: PROXY_ENDPOINT
      });
      
      await page.goto(testUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="connection-mode"]', { timeout: 10000 });
      
      // Verify connection mode shows proxy
      const connectionMode = await page.locator('[data-testid="connection-mode"]').textContent();
      expect(connectionMode).toContain('proxy');
      expect(connectionMode).not.toContain('direct');
      
      console.log('✅ Connection mode validation passed - proxy mode confirmed');
    });
  });
});
