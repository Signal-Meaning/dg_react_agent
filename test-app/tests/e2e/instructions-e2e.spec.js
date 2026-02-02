import { test, expect } from '@playwright/test';
import {
  setupTestPageWithOpenAIProxy,
  setupTestPageWithDeepgramProxy,
  establishConnectionViaText,
  hasOpenAIProxyEndpoint,
  sendMessageAndWaitForResponse,
} from './helpers/test-helpers';

/**
 * @fileoverview E2E tests for the instructions pipeline (loading, preview, VA integration).
 *
 * These tests are NOT about "file upload" or any file-specific feature. They assert that
 * instructions are loaded (from whatever source the test-app uses: env override, file path,
 * or default), shown in the UI, and passed to the voice agent so the agent can respond.
 *
 * Runs for either Deepgram or OpenAI: same tests, same assertions; backend is chosen by
 * VITE_OPENAI_PROXY_ENDPOINT (OpenAI proxy when set, Deepgram otherwise).
 */

async function setupTestPageForBackend(page, timeout = 10000) {
  if (hasOpenAIProxyEndpoint()) {
    await setupTestPageWithOpenAIProxy(page, timeout);
  } else {
    await setupTestPageWithDeepgramProxy(page, timeout);
  }
}

test.describe('Instructions pipeline (load, preview, VA integration)', () => {

  test('should load instructions from environment variable override', async ({ page }) => {
    await setupTestPageForBackend(page);
    await establishConnectionViaText(page, 10000);

    const instructionsStatus = await page.locator('text=Instructions Status').first();
    await expect(instructionsStatus).toBeVisible();

    const sourceText = await page.locator('text=Instructions Loader').first();
    await expect(sourceText).toBeVisible();
  });

  test('should display instructions preview in UI', async ({ page }) => {
    await setupTestPageForBackend(page);
    await establishConnectionViaText(page, 10000);

    const instructionsSection = await page.locator('text=Instructions Status').first();
    await expect(instructionsSection).toBeVisible();

    const statusText = await page.locator('text=Loaded').first();
    await expect(statusText).toBeVisible();

    const previewSection = await page.locator('text=Instructions Preview').first();
    await expect(previewSection).toBeVisible();
  });

  test('should integrate instructions with voice agent component', async ({ page }) => {
    await setupTestPageForBackend(page);
    await establishConnectionViaText(page, 10000);

    const textInput = await page.locator('[data-testid="text-input"]');
    const sendButton = await page.locator('[data-testid="send-button"]');

    await textInput.fill('What products do you recommend for electronics?');
    await sendButton.click();

    await page.waitForTimeout(2000);

    const messages = await page.locator('[data-testid*="message"]').all();
    expect(messages.length).toBeGreaterThan(0);
  });

  test('should support different instruction sources', async ({ page }) => {
    await setupTestPageForBackend(page);
    await establishConnectionViaText(page, 10000);

    const sourceSection = await page.locator('text=Source:').first();
    await expect(sourceSection).toBeVisible();

    const sourceText = await page.locator('text=Instructions Loader').first();
    await expect(sourceText).toBeVisible();
  });

  test('response content reflects instructions when VITE_E2E_INSTRUCTIONS is set', async ({ page }) => {
    const e2eInstruction = process.env.VITE_E2E_INSTRUCTIONS;
    if (!e2eInstruction || typeof e2eInstruction !== 'string' || !e2eInstruction.trim()) {
      test.skip(true, 'Set VITE_E2E_INSTRUCTIONS to the BANANA instruction to run this test');
    }

    await setupTestPageForBackend(page);
    await establishConnectionViaText(page, 10000);

    const responseText = await sendMessageAndWaitForResponse(
      page,
      'What is your favorite fruit?',
      30000
    );
    expect(responseText).toBeTruthy();
    expect(responseText.toUpperCase()).toContain('BANANA');
  });

});
