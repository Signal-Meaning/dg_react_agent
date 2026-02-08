/**
 * OpenAI injectUserMessage E2E Tests (Issue #380)
 *
 * Validates that after sending a text message (injectUserMessage flow), an agent response
 * is received. When the bug is present, the upstream (OpenAI) WebSocket closes with code 1000
 * ~2.7–3 seconds after the first message, so no agent reply is delivered and this test fails.
 *
 * This repo does NOT run an OpenAI proxy. VITE_OPENAI_PROXY_ENDPOINT must point to an
 * external proxy (e.g. a backend that speaks the component's protocol and proxies to OpenAI).
 * Backend server: test-app/scripts/backend-server.js → ws://localhost:8080/deepgram-proxy and /openai.
 *
 * Run with external OpenAI proxy: VITE_OPENAI_PROXY_ENDPOINT=ws://your-proxy-host/path npm run test:e2e -- openai-inject-connection-stability
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoOpenAIProxy,
  setupTestPageWithOpenAIProxy,
  establishConnectionViaText,
  waitForSettingsApplied,
  sendTextMessage,
  waitForAgentResponseEnhanced,
  assertNoRecoverableAgentErrors,
} from './helpers/test-helpers.js';

test.describe('OpenAI injectUserMessage (issue #380)', () => {
  test.beforeEach(() => {
    skipIfNoOpenAIProxy('Requires VITE_OPENAI_PROXY_ENDPOINT to run against real OpenAI proxy');
  });

  test('should receive agent response after first text message (real OpenAI proxy)', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    await sendTextMessage(page, 'What is 2 plus 2?');
    // Expected: an agent reply is delivered. When the bug is present, the connection
    // closes before the reply and no response appears, so this times out and the test fails.
    await waitForAgentResponseEnhanced(page, { timeout: 15000 });
    await assertNoRecoverableAgentErrors(page);
  });
});
