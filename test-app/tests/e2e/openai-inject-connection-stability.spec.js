/**
 * OpenAI injectUserMessage E2E Tests (Issue #380)
 *
 * Validates that after sending a text message (injectUserMessage flow), an agent response
 * is received. When the bug is present, the upstream (OpenAI) WebSocket closes with code 1000
 * ~2.7–3 seconds after the first message, so no agent reply is delivered and this test fails.
 *
 * This repo does NOT run an OpenAI proxy. VITE_OPENAI_PROXY_ENDPOINT must point to an
 * external proxy (e.g. a backend that speaks the component's protocol and proxies to OpenAI).
 * Our proxy is Deepgram-only: test-app/scripts/mock-proxy-server.js → ws://localhost:8080/deepgram-proxy.
 *
 * Run with external OpenAI proxy: VITE_OPENAI_PROXY_ENDPOINT=ws://your-proxy-host/path npm run test:e2e -- openai-inject-connection-stability
 */

import { test, expect } from '@playwright/test';
import { buildUrlWithParams, BASE_URL } from './helpers/test-helpers.mjs';
import {
  skipIfNoOpenAIProxy,
  establishConnectionViaText,
  sendTextMessage,
  waitForAgentResponseEnhanced,
} from './helpers/test-helpers.js';

const OPENAI_PROXY_ENDPOINT = process.env.VITE_OPENAI_PROXY_ENDPOINT || '';

test.describe('OpenAI injectUserMessage (issue #380)', () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoOpenAIProxy('Requires VITE_OPENAI_PROXY_ENDPOINT to run against real OpenAI proxy');
  });

  test('should receive agent response after first text message (real OpenAI proxy)', async ({ page }) => {
    const testUrl = buildUrlWithParams(BASE_URL, {
      connectionMode: 'proxy',
      proxyEndpoint: OPENAI_PROXY_ENDPOINT,
    });
    await page.goto(testUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });

    await establishConnectionViaText(page, 30000);

    await sendTextMessage(page, 'hi');

    // Expected: an agent reply is delivered. When the bug is present, the connection
    // closes before the reply and no response appears, so this times out and the test fails.
    await waitForAgentResponseEnhanced(page, { timeout: 15000 });
  });
});
