/**
 * Readiness contract E2E (Issue #406)
 *
 * Asserts the component–backend contract: connection + Settings applied before
 * the first user message. Runs for either proxy (OpenAI or Deepgram) based on
 * E2E_BACKEND. Use the matching proxy for the selected backend:
 * - E2E_BACKEND=openai (default): OpenAI proxy (via backend server)
 * - E2E_BACKEND=deepgram: Deepgram proxy (via backend server)
 * Backend: cd test-app && npm run backend
 *
 * Run: USE_PROXY_MODE=true npm run test:e2e -- readiness-contract-e2e
 * Or:  E2E_BACKEND=deepgram USE_PROXY_MODE=true npm run test:e2e -- readiness-contract-e2e
 */

import { test, expect } from '@playwright/test';
import {
  setupTestPageForBackend,
  establishConnectionViaText,
  waitForSettingsApplied,
  sendTextMessage,
  waitForAgentResponseEnhanced,
} from './helpers/test-helpers.js';

const SETTINGS_TIMEOUT = 15000;
const CONNECTION_TIMEOUT = 30000;
const RESPONSE_TIMEOUT = 20000;

test.describe('Readiness contract – connection + Settings applied then send (Issue #406)', () => {
  test('enforces readiness (Settings applied) before first message for either proxy', async ({ page }) => {
    await setupTestPageForBackend(page);
    await establishConnectionViaText(page, CONNECTION_TIMEOUT);
    await waitForSettingsApplied(page, SETTINGS_TIMEOUT);
    await sendTextMessage(page, 'hi');
    await waitForAgentResponseEnhanced(page, { timeout: RESPONSE_TIMEOUT });
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
  });

  test('conversation state is reloaded after page refresh (Issue #406)', async ({ page }) => {
    await setupTestPageForBackend(page);
    await establishConnectionViaText(page, CONNECTION_TIMEOUT);
    await waitForSettingsApplied(page, SETTINGS_TIMEOUT);
    const uniqueMessage = `E2E reload test ${Date.now()}`;
    await sendTextMessage(page, uniqueMessage);
    await waitForAgentResponseEnhanced(page, { timeout: RESPONSE_TIMEOUT });

    const history = page.locator('[data-testid="conversation-history"]');
    await expect(history).toBeVisible();
    await expect(history.locator(`text=${uniqueMessage}`).first()).toBeVisible({ timeout: 5000 });

    await page.reload();
    await establishConnectionViaText(page, CONNECTION_TIMEOUT);
    await waitForSettingsApplied(page, SETTINGS_TIMEOUT);

    const historyAfterReload = page.locator('[data-testid="conversation-history"]');
    await expect(historyAfterReload).toBeVisible({ timeout: 10000 });
    await expect(historyAfterReload.locator(`text=${uniqueMessage}`).first()).toBeVisible({ timeout: 5000 });
  });
});
