/**
 * Issue #561 — Live mode (voice-first shell) E2E smoke.
 *
 * Run from test-app with dev server (and backend for the Start/End flow):
 *   npm run test:e2e -- live-mode.spec.js
 *
 * `test-mode=true` loads the app without requiring browser Deepgram keys (proxy mode).
 */

import { test, expect } from '@playwright/test';
import { pathWithQuery } from './helpers/test-helpers.mjs';

test.describe('Live mode (Issue #561)', () => {
  test('debug-main-layout visible; Live shell not mounted (test-mode)', async ({ page }) => {
    await page.goto(pathWithQuery({ 'test-mode': 'true' }));
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('debug-main-layout')).toBeVisible();
    await expect(page.getByTestId('live-mode-root')).toHaveCount(0);
  });

  test('Start enters Live; End Live restores debug (requires agent + mic)', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(pathWithQuery({ 'test-mode': 'true' }));
    await page.waitForLoadState('networkidle');

    await page.waitForFunction(
      () => document.querySelector('[data-testid="component-ready-status"]')?.textContent === 'true',
      { timeout: 25_000 }
    );

    await page.getByTestId('start-button').click();

    await expect(page.getByTestId('live-mode-root')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId('debug-main-layout')).toHaveCount(0);

    await page.getByTestId('live-end-live-button').click();

    await expect(page.getByTestId('debug-main-layout')).toBeVisible();
    await expect(page.getByTestId('live-mode-root')).toHaveCount(0);
  });
});
