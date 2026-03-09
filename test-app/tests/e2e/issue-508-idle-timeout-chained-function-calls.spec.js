/**
 * Issue #508: Idle timeout must NOT fire between function result and next agent message when that message is a function call (chained)
 *
 * Partner report (voice-commerce #1058): In a chained function-call flow (e.g. create_mandate → create_cart_mandate → execute_mandate),
 * the idle timeout was firing after the first function result and closing the connection before the model sent the next function call.
 *
 * This E2E exercises the reported scenario: after the app sends a function result, the next agent turn is another function call.
 * The component must keep the connection open until that second call is received (no "Idle timeout reached" in between).
 *
 * Requirements:
 * - Proxy mode with real API (OpenAI or Deepgram). E2E_BACKEND=openai (default) or deepgram.
 * - Real API key; backend running (e.g. cd test-app && npm run backend).
 *
 * Run from test-app:
 *   npm run test:e2e -- issue-508-idle-timeout-chained-function-calls.spec.js
 * With real API and existing server:
 *   E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true USE_REAL_APIS=1 npm run test:e2e -- issue-508-idle-timeout-chained-function-calls.spec.js
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoRealAPI,
  waitForConnection,
  waitForSettingsApplied,
  setupFunctionCallingTest,
} from './helpers/test-helpers.js';
import { pathWithQuery, getBackendProxyParams } from './helpers/test-helpers.mjs';

const IS_PROXY_MODE = process.env.USE_PROXY_MODE !== 'false';

/** Chained flow function names (order matters for assertion). */
const CHAINED_FIRST = 'chained_step_one';
const CHAINED_SECOND = 'chained_step_two';

const chainedFunctions = [
  {
    name: CHAINED_FIRST,
    description: 'First step of a two-step chained flow. You must call this first, then call ' + CHAINED_SECOND + '. Use when the user asks to run both steps or do step one then step two.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: CHAINED_SECOND,
    description: 'Second step of the chained flow. Call this after calling ' + CHAINED_FIRST + '. Use when the user asked to run both steps or after you have called ' + CHAINED_FIRST + '.',
    parameters: { type: 'object', properties: {} },
  },
];

test.describe('Issue #508: Idle timeout with chained function calls', () => {
  test.beforeEach(async ({ page, context }) => {
    skipIfNoRealAPI('Requires real API for chained function-call E2E');
    await context.grantPermissions(['microphone']);
    await page.addInitScript(() => {
      window.__DEEPGRAM_TEST_MODE__ = true;
    });
    if (!IS_PROXY_MODE) {
      console.warn('⚠️  USE_PROXY_MODE is false - this test requires proxy mode');
    }
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.evaluate(() => {
        if (window.deepgramRef?.current) window.deepgramRef.current.stop?.();
      });
      await page.goto('about:blank');
      await page.waitForTimeout(500);
    } catch (_) {}
  });

  /**
   * Partner scenario (voice-commerce #1058): After first function result, next agent message is another function call.
   * Connection must stay open until the second call is received (no idle timeout in between).
   */
  test('connection stays open between first function result and second (chained) function call', async ({ page }) => {
    test.setTimeout(90000);

    const idleTimeoutLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Idle timeout reached') || text.includes('closing agent connection')) {
        idleTimeoutLogs.push({ time: Date.now(), text });
      }
    });

    await setupFunctionCallingTest(page, {
      functions: chainedFunctions,
      handler: (functionName) =>
        functionName === CHAINED_FIRST ? { step: 1, id: 'step-one' } : { step: 2, id: 'step-two' },
    });

    const testUrl = pathWithQuery({
      ...getBackendProxyParams(),
      'enable-function-calling': 'true',
      'test-mode': 'true',
      debug: 'true',
    });
    await page.goto(testUrl);
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });

    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus();
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });
    await waitForConnection(page, 30000);
    await waitForSettingsApplied(page, 10000);

    await page.evaluate(() => {
      const ref = window.deepgramRef || window.voiceAgentRef;
      if (ref?.current) ref.current.injectUserMessage('Run both steps: do step one then step two.');
    });

    const deadline = Date.now() + 45000;
    let names = [];
    while (Date.now() < deadline) {
      names = await page.evaluate(() => (window.functionCallRequests || []).map((r) => r.name || r.function?.name).filter(Boolean));
      if (names.length >= 2 && names[0] === CHAINED_FIRST && names[1] === CHAINED_SECOND) break;
      await page.waitForTimeout(500);
    }

    const connectionStatus = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="connection-status"]');
      return el?.textContent?.toLowerCase() || '';
    });

    if (names.length < 2) {
      console.log('[Issue #508] Function calls received (order):', names);
      console.log('[Issue #508] Idle timeout logs:', idleTimeoutLogs.length ? idleTimeoutLogs : 'none');
    }

    expect(
      names.length >= 2 && names[0] === CHAINED_FIRST && names[1] === CHAINED_SECOND,
      'Chained flow should receive ' + CHAINED_FIRST + ' then ' + CHAINED_SECOND + '. Got: [' + names.join(', ') + ']. ' +
        'Connection status: ' + connectionStatus + '. ' +
        (idleTimeoutLogs.length ? 'Idle timeout fired: ' + idleTimeoutLogs.map((l) => l.text).join('; ') : '')
    ).toBe(true);

    expect(
      idleTimeoutLogs.length === 0 || names.length >= 2,
      'Connection must not close due to idle timeout before the second (chained) function call is received.'
    ).toBe(true);
  });
});
