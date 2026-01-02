/**
 * Temporary test to verify if agent response test works in direct mode
 * This helps determine if the connection closure issue is proxy-specific
 */

import { test, expect } from '@playwright/test';
import { sendTextMessage, waitForConnection } from '../utils/test-helpers';
import { buildUrlWithParams, BASE_URL } from './helpers/test-helpers.mjs';

test.describe('Backend Proxy Mode - Direct Mode Comparison', () => {
  test('should work with agent responses in DIRECT mode (comparison test)', async ({ page }) => {
    // Configure component via URL query parameters - using DIRECT mode (apiKey)
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'direct',
      // No proxyEndpoint - uses apiKey from environment
    });
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Note: Connection mode check removed - focus on core functionality test

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
      throw new Error(`Connection not attempting to establish. Status stuck at "${diagnosticInfo.connectionStatus}".`);
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
      throw new Error(`Connection failed to establish. Status: "${diagnosticInfo.connectionStatus}", Mode: "${diagnosticInfo.connectionMode}".`);
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
    }, { timeout: 20000 }).catch(async (error) => {
      // Capture diagnostic information if Settings timeout occurs
      const diagnosticInfo = await page.evaluate(() => {
        const settingsEl = document.querySelector('[data-testid="has-sent-settings"]');
        const statusEl = document.querySelector('[data-testid="connection-status"]');
        const modeEl = document.querySelector('[data-testid="connection-mode"]');
        const windowSettings = window.__DEEPGRAM_WS_SETTINGS_PARSED__;
        const globalSettingsSent = window.__DEEPGRAM_GLOBAL_SETTINGS_SENT__;
        
        return {
          hasSentSettings: settingsEl?.textContent || 'not found',
          connectionStatus: statusEl?.textContent || 'not found',
          connectionMode: modeEl?.textContent || 'not found',
          windowSettingsParsed: windowSettings ? 'exists' : 'not found',
          globalSettingsSent: globalSettingsSent || false,
          consoleLogs: (window.consoleLogs || []).slice(-20) // Last 20 logs
        };
      });
      
      console.error('Settings timeout. Diagnostic info:', JSON.stringify(diagnosticInfo, null, 2));
      throw new Error(`Settings not applied within timeout. hasSentSettings: "${diagnosticInfo.hasSentSettings}", connectionStatus: "${diagnosticInfo.connectionStatus}"`);
    });

    // Send a text message to trigger agent response
    const testMessage = 'Hello, this is a direct mode test';
    await sendTextMessage(page, testMessage);

    // Wait for agent response
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
});

