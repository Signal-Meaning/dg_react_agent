/**
 * Issue #561 — Live mode (voice-first shell) E2E.
 *
 * **How Live mode is activated:** the **Start** button calls `enterLiveMode()` →
 * `startServicesAndMicrophone()` (agent `start()` + `startAudioCapture()`), then shows `LiveModeView`.
 *
 * Run from test-app with dev server (and backend for the Live flow):
 *   npm run test:e2e -- live-mode.spec.js
 *
 * `test-mode=true` loads the app without requiring browser Deepgram keys (proxy mode).
 * `e2e-mic-assertions=1` enables `window.__e2eStartAudioCaptureCompletedAt` after capture succeeds.
 *
 * Mic / uplink assertions use `helpers/mic-e2e-telemetry.js` (installed before navigation).
 * Chromium runs with fake media devices (see `playwright.config.mjs`); that still exercises
 * the real getUserMedia → capture → WebSocket binary send path.
 */

import { test, expect } from '@playwright/test';
import { pathWithQuery } from './helpers/test-helpers.mjs';
import { installMicE2eTelemetry } from './helpers/mic-e2e-telemetry.js';

test.describe('Live mode (Issue #561)', () => {
  test('debug-main-layout visible; Live shell not mounted (test-mode)', async ({ page }) => {
    await page.goto(pathWithQuery({ 'test-mode': 'true' }));
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('debug-main-layout')).toBeVisible();
    await expect(page.getByTestId('live-mode-root')).toHaveCount(0);
  });

  test.describe('Live entry — microphone + uplink (Issue #561)', () => {
    test.beforeEach(async ({ context, page }) => {
      // Explicit grant (also set globally in playwright.config use.permissions)
      await context.grantPermissions(['microphone']);
      await page.addInitScript(installMicE2eTelemetry);
    });

    test('Start enters Live; permission, GUM, PCM over WebSocket, app hook; End Live restores debug', async ({
      page,
    }) => {
      test.setTimeout(120_000);

      await page.goto(
        pathWithQuery({
          'test-mode': 'true',
          'e2e-mic-assertions': '1',
        })
      );
      await page.waitForLoadState('networkidle');

      await page.waitForFunction(
        () => document.querySelector('[data-testid="component-ready-status"]')?.textContent === 'true',
        { timeout: 25_000 }
      );

      const permBefore = await page.evaluate(async () => {
        try {
          const q = await navigator.permissions.query({ name: 'microphone' });
          return q.state;
        } catch {
          return 'unsupported';
        }
      });
      if (permBefore !== 'unsupported') {
        expect(permBefore).toBe('granted');
      }

      await page.getByTestId('start-button').click();

      await expect(page.getByTestId('live-mode-root')).toBeVisible({ timeout: 120_000 });
      await expect(page.getByTestId('debug-main-layout')).toHaveCount(0);

      // 1) DOM: connected + mic on (maps to successful startAudioCapture in app)
      await expect(page.getByTestId('live-session-phase')).toHaveText('active');

      // 3) App hook after startAudioCapture completes
      await expect
        .poll(
          async () => page.evaluate(() => window.__e2eStartAudioCaptureCompletedAt ?? 0),
          { timeout: 60_000 }
        )
        .toBeGreaterThan(0);

      // getUserMedia invoked and fulfilled
      await expect
        .poll(
          async () =>
            page.evaluate(
              () =>
                globalThis.__e2eGumResolved === true &&
                globalThis.__e2eGumRejected !== true &&
                globalThis.__e2eGumCallCount >= 1
            ),
          { timeout: 60_000 }
        )
        .toBe(true);

      const permAfter = await page.evaluate(async () => {
        try {
          const q = await navigator.permissions.query({ name: 'microphone' });
          return q.state;
        } catch {
          return 'unsupported';
        }
      });
      if (permAfter !== 'unsupported') {
        expect(permAfter).toBe('granted');
      }

      // Non-empty binary frames on some WebSocket (mic uplink)
      await expect
        .poll(async () => page.evaluate(() => globalThis.__e2eWsBinarySendCount ?? 0), { timeout: 60_000 })
        .toBeGreaterThan(0);

      await page.getByTestId('live-end-live-button').click();

      await expect(page.getByTestId('debug-main-layout')).toBeVisible();
      await expect(page.getByTestId('live-mode-root')).toHaveCount(0);
    });
  });
});
