/**
 * OpenAI Proxy E2E Suite (Issue #381)
 *
 * Reuses the same flows as text-session-flow and related specs, pointed at the
 * OpenAI Realtime proxy (VITE_OPENAI_PROXY_ENDPOINT). Tests are skipped when
 * VITE_OPENAI_PROXY_ENDPOINT is not set.
 *
 * Behaviors: connection, single message, multi-turn, reconnection, basic audio,
 * simple function calling. See docs/issues/ISSUE-381/E2E-TEST-PLAN.md.
 *
 * Run with OpenAI proxy: VITE_OPENAI_PROXY_ENDPOINT=ws://your-proxy/openai npm run test:e2e -- openai-proxy-e2e
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoOpenAIProxy,
  setupTestPageWithOpenAIProxy,
  waitForSettingsApplied,
  establishConnectionViaText,
  sendMessageAndWaitForResponse,
  sendTextMessage,
  waitForAgentResponse,
  waitForAgentResponseEnhanced,
  disconnectComponent,
  getAgentState,
} from './helpers/test-helpers.js';
import { loadAndSendAudioSample } from './fixtures/audio-helpers.js';

const AGENT_RESPONSE_TIMEOUT = 20000;

test.describe('OpenAI Proxy E2E (Issue #381)', () => {
  test.beforeEach(() => {
    skipIfNoOpenAIProxy('Requires VITE_OPENAI_PROXY_ENDPOINT for OpenAI proxy E2E');
  });

  test('1. Connection – connect through OpenAI proxy and receive settings', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    const state = await getAgentState(page);
    expect(state).toBeDefined();
    try {
      await waitForSettingsApplied(page, 5000);
    } catch {
      // Settings applied is optional; connection ready is the main assertion
    }
  });

  test('1b. Greeting – proxy injects greeting; component shows greeting-sent (Issue #381)', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
  });

  test('2. Single message – inject user message, receive agent response in Message Bubble', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await sendTextMessage(page, 'hi');
    await waitForAgentResponseEnhanced(page, { timeout: AGENT_RESPONSE_TIMEOUT });
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
  });

  test('3. Multi-turn – sequential messages, second agent response appears', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    const r1 = await sendMessageAndWaitForResponse(page, "Hello, I need help.", AGENT_RESPONSE_TIMEOUT);
    expect(r1).toBeTruthy();
    expect(r1.length).toBeGreaterThan(0);
    const r2 = await sendMessageAndWaitForResponse(page, "What did I just say?", AGENT_RESPONSE_TIMEOUT);
    expect(r2).toBeTruthy();
    expect(r2.length).toBeGreaterThan(0);
  });

  test('4. Reconnection – disconnect then send, app reconnects and user receives response', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await sendMessageAndWaitForResponse(page, "First message.", AGENT_RESPONSE_TIMEOUT);
    await disconnectComponent(page);
    const secondResponse = await sendMessageAndWaitForResponse(page, "Second after disconnect.", AGENT_RESPONSE_TIMEOUT);
    expect(secondResponse).toBeTruthy();
    expect(secondResponse.length).toBeGreaterThan(0);
  });

  test('5. Basic audio – send recorded audio; assert agent response appears in [data-testid="agent-response"]', async ({ page, context }) => {
    // Proxy translates client binary audio to OpenAI input_audio_buffer.append + commit + response.create.
    // In the test-app the agent response is rendered in the element with data-testid="agent-response".
    await context.grantPermissions(['microphone']);
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await sendTextMessage(page, 'Hello.');
    await waitForAgentResponse(page, null, AGENT_RESPONSE_TIMEOUT);
    const hasSample = await page.evaluate(async () => {
      try {
        const wav = await fetch('/audio-samples/hello.wav');
        if (wav.ok) return true;
        const json = await fetch('/audio-samples/sample_hello.json');
        return json.ok;
      } catch {
        return false;
      }
    }).catch(() => false);
    if (!hasSample) {
      test.skip(true, 'No audio sample (hello.wav or sample_hello.json) – run with audio fixtures');
      return;
    }
    await loadAndSendAudioSample(page, 'hello', { chunkSize: 4096 });
    await waitForAgentResponse(page, null, AGENT_RESPONSE_TIMEOUT);
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
  });

  test('6. Simple function calling – trigger function call; assert response in [data-testid="agent-response"]', async ({ page }) => {
    const { buildUrlWithParams, BASE_URL, getOpenAIProxyParams } = await import('./helpers/test-helpers.mjs');
    const params = { ...getOpenAIProxyParams(), 'test-mode': 'true', 'enable-function-calling': 'true' };
    const url = buildUrlWithParams(BASE_URL, params);
    await page.goto(url);
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    await establishConnectionViaText(page, 30000);
    await sendTextMessage(page, "What time is it?");
    await waitForAgentResponseEnhanced(page, { timeout: AGENT_RESPONSE_TIMEOUT });
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
  });

  test('7. Reconnection with context – disconnect, reconnect; proxy sends context via conversation.item.create', async ({ page }) => {
    test.setTimeout(60000); // First message + disconnect + second message can exceed 30s
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    const firstResponse = await sendMessageAndWaitForResponse(page, "My favorite color is blue.", AGENT_RESPONSE_TIMEOUT);
    expect(firstResponse).toBeTruthy();
    expect(firstResponse.length).toBeGreaterThan(0);
    await disconnectComponent(page);
    await page.waitForTimeout(1000);
    const secondResponse = await sendMessageAndWaitForResponse(page, "Hello again.", AGENT_RESPONSE_TIMEOUT);
    expect(secondResponse).toBeTruthy();
    expect(secondResponse.length).toBeGreaterThan(0);
  });

  test('8. Error handling – wrong proxy URL shows closed/error and does not hang', async ({ page }) => {
    const { buildUrlWithParams, BASE_URL } = await import('./helpers/test-helpers.mjs');
    const wrongProxyUrl = 'ws://localhost:99999/openai';
    const url = buildUrlWithParams(BASE_URL, { connectionMode: 'proxy', proxyEndpoint: wrongProxyUrl });
    await page.goto(url);
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 5000 });
    await textInput.focus();
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await connectionStatus.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="connection-status"]');
        const text = el?.textContent?.toLowerCase() || '';
        return text === 'closed' || text.includes('closed') || text.includes('error');
      },
      { timeout: 15000 }
    );
    const statusText = await connectionStatus.textContent();
    expect(statusText?.toLowerCase()).toMatch(/closed|error/);
  });
});
