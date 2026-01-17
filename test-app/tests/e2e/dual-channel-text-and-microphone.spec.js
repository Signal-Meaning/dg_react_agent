/**
 * Dual Channel E2E Tests - Text and Microphone Channels
 * 
 * These tests verify that the component works correctly when using both
 * text input and microphone channels together in the same session.
 * 
 * Test Scenarios:
 * 1. Start with text, then switch to microphone
 * 2. Start with microphone, then switch to text
 * 3. Alternate between text and microphone in same session
 * 4. Use both channels simultaneously (text while mic is active)
 * 
 * These tests use real Deepgram API connections to ensure authentic behavior.
 */

import { test, expect } from '@playwright/test';
import {
  setupTestPage,
  sendTextMessage,
  MicrophoneHelpers,
  waitForAgentResponse,
  skipIfNoRealAPI
} from './helpers/test-helpers.js';
import { buildUrlWithParams, BASE_URL } from './helpers/test-helpers.mjs';

test.describe('Dual Channel - Text and Microphone', () => {
  
  test('should start with text channel, then switch to microphone', async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    await setupTestPage(page);
    
    // Step 1: Establish connection via text input
    console.log('📝 Step 1: Establishing connection via text input');
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus(); // This triggers auto-connect
    
    // Wait for connection (may be 'connected' or 'connected (proxy)')
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent && statusEl.textContent.toLowerCase().includes('connected');
    }, { timeout: 20000 });
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection established via text');
    
    // Step 2: Send a text message
    console.log('📝 Step 2: Sending text message');
    const textMessage = "Hello, I'm testing the text channel.";
    await sendTextMessage(page, textMessage);
    
    // Wait for agent response
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse = await page.locator('[data-testid="agent-response"]').textContent();
    expect(agentResponse).toBeTruthy();
    expect(agentResponse.trim()).not.toBe('');
    console.log('✅ Agent responded to text message');
    
    // Step 3: Enable microphone (switch to microphone channel)
    console.log('🎤 Step 3: Enabling microphone channel');
    await context.grantPermissions(['microphone']);
    
    // Use microphone helper to enable mic
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    expect(micResult.success).toBe(true);
    expect(micResult.micStatus).toBe('Enabled');
    console.log('✅ Microphone enabled');
    
    // Step 4: Verify both channels are available
    // Text input should still be available
    await expect(textInput).toBeVisible();
    
    // Microphone should be enabled
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus).toContain('Enabled');
    
    console.log('✅ Both channels are available');
    console.log('🎉 Test passed - successfully switched from text to microphone');
  });

  test('should start with microphone, then switch to text', async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    await setupTestPage(page);
    await context.grantPermissions(['microphone']);
    
    // Step 1: Establish connection via microphone
    console.log('🎤 Step 1: Establishing connection via microphone');
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    expect(micResult.success).toBe(true);
    expect(micResult.micStatus).toBe('Enabled');
    console.log('✅ Connection established via microphone');
    
    // Step 2: Verify microphone is active
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus).toContain('Enabled');
    
    // Step 3: Send a text message (switch to text channel)
    console.log('📝 Step 3: Sending text message while microphone is enabled');
    const textMessage = "I'm switching to text input now.";
    await sendTextMessage(page, textMessage);
    
    // Wait for agent response
    await waitForAgentResponse(page, undefined, 20000);
    const agentResponse = await page.locator('[data-testid="agent-response"]').textContent();
    expect(agentResponse).toBeTruthy();
    expect(agentResponse.trim()).not.toBe('');
    console.log('✅ Agent responded to text message');
    
    // Step 4: Verify both channels are still available
    // Text input should be available
    const textInput = page.locator('[data-testid="text-input"]');
    await expect(textInput).toBeVisible();
    
    // Microphone should still be enabled
    const micStatusAfter = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatusAfter).toContain('Enabled');
    
    console.log('✅ Both channels remain available');
    console.log('🎉 Test passed - successfully used text while microphone is active');
  });

  test('should alternate between text and microphone in same session', async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    await setupTestPage(page);
    await context.grantPermissions(['microphone']);
    
    // Step 1: Start with text
    console.log('📝 Step 1: Starting with text channel');
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus(); // This triggers auto-connect
    
    // Wait for connection
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent && statusEl.textContent.toLowerCase().includes('connected');
    }, { timeout: 20000 });
    
    const textMessage1 = "First message via text.";
    await sendTextMessage(page, textMessage1);
    await waitForAgentResponse(page, undefined, 20000);
    console.log('✅ Text message 1 sent and responded');
    
    // Step 2: Enable microphone
    console.log('🎤 Step 2: Enabling microphone');
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    expect(micResult.success).toBe(true);
    console.log('✅ Microphone enabled');
    
    // Step 3: Send another text message (while mic is enabled)
    console.log('📝 Step 3: Sending text message while microphone is enabled');
    const textMessage2 = "Second message via text, microphone is active.";
    await sendTextMessage(page, textMessage2);
    await waitForAgentResponse(page, undefined, 20000);
    console.log('✅ Text message 2 sent and responded');
    
    // Step 4: Disable microphone
    console.log('🎤 Step 4: Disabling microphone');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(1000);
    
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus.toLowerCase()).toContain('disabled');
    console.log('✅ Microphone disabled');
    
    // Step 5: Send another text message (mic disabled)
    console.log('📝 Step 5: Sending text message after microphone disabled');
    const textMessage3 = "Third message via text, microphone is disabled.";
    await sendTextMessage(page, textMessage3);
    await waitForAgentResponse(page, undefined, 20000);
    console.log('✅ Text message 3 sent and responded');
    
    // Step 6: Re-enable microphone
    console.log('🎤 Step 6: Re-enabling microphone');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000);
    
    const micStatus2 = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus2.toLowerCase()).toContain('enabled');
    console.log('✅ Microphone re-enabled');
    
    // Verify connection is still active
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    
    console.log('🎉 Test passed - successfully alternated between text and microphone');
  });

  test('should maintain connection when switching between channels', async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    await setupTestPage(page);
    await context.grantPermissions(['microphone']);
    
    // Step 1: Establish connection via text
    console.log('📝 Step 1: Establishing connection via text');
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus(); // This triggers auto-connect
    
    // Wait for connection
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent && statusEl.textContent.toLowerCase().includes('connected');
    }, { timeout: 20000 });
    
    let connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection established');
    
    // Step 2: Enable microphone
    console.log('🎤 Step 2: Enabling microphone');
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    expect(micResult.success).toBe(true);
    
    // Verify connection is still active
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection maintained after enabling microphone');
    
    // Step 3: Send text message
    console.log('📝 Step 3: Sending text message');
    await sendTextMessage(page, "Testing connection stability.");
    await waitForAgentResponse(page, undefined, 20000);
    
    // Verify connection is still active
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection maintained after text message');
    
    // Step 4: Disable microphone
    console.log('🎤 Step 4: Disabling microphone');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(1000);
    
    // Verify connection is still active
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection maintained after disabling microphone');
    
    // Step 5: Send another text message
    console.log('📝 Step 5: Sending another text message');
    await sendTextMessage(page, "Final test message.");
    await waitForAgentResponse(page, undefined, 20000);
    
    // Verify connection is still active
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    console.log('✅ Connection maintained throughout channel switching');
    
    console.log('🎉 Test passed - connection maintained when switching channels');
  });

  test('should work in proxy mode with both text and microphone channels', async ({ page, context }) => {
    const IS_PROXY_MODE = process.env.USE_PROXY_MODE === 'true';
    
    if (!IS_PROXY_MODE) {
      test.skip(true, 'This test requires proxy mode. Run with USE_PROXY_MODE=true');
      return;
    }
    
    skipIfNoRealAPI('Requires real Deepgram API key for dual channel tests');
    
    const PROXY_ENDPOINT = process.env.VITE_PROXY_ENDPOINT || 'ws://localhost:8080/deepgram-proxy';
    
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
    
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'proxy',
      proxyEndpoint: PROXY_ENDPOINT
    });
    
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    await context.grantPermissions(['microphone']);
    
    // Step 1: Establish connection via text in proxy mode
    console.log('📝 Step 1: Establishing connection via text (proxy mode)');
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus(); // This triggers auto-connect
    
    // Wait for connection
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl && statusEl.textContent && statusEl.textContent.toLowerCase().includes('connected');
    }, { timeout: 20000 });
    
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus.toLowerCase()).toContain('connected');
    
    // Verify proxy mode
    const connectionMode = await page.locator('[data-testid="connection-mode"]').textContent();
    expect(connectionMode).toContain('proxy');
    console.log('✅ Connection established via proxy');
    
    // Step 2: Send text message
    console.log('📝 Step 2: Sending text message');
    await sendTextMessage(page, "Testing text channel in proxy mode.");
    await waitForAgentResponse(page, undefined, 20000);
    console.log('✅ Text message sent and responded');
    
    // Step 3: Enable microphone
    console.log('🎤 Step 3: Enabling microphone');
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    expect(micResult.success).toBe(true);
    console.log('✅ Microphone enabled');
    
    // Step 4: Send another text message (while mic is enabled)
    console.log('📝 Step 4: Sending text message while microphone is enabled');
    await sendTextMessage(page, "Testing text channel while microphone is active in proxy mode.");
    await waitForAgentResponse(page, undefined, 20000);
    console.log('✅ Text message sent and responded');
    
    // Verify connection is still active
    const finalConnectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(finalConnectionStatus).toContain('connected');
    
    console.log('🎉 Test passed - both channels work in proxy mode');
  });
});
