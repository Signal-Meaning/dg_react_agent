/**
 * Issue #560 / #561 — OpenAI proxy + Live: real microphone capture → binary WebSocket uplink.
 *
 * Manual reports (bogus STT, `SHELX.`, etc.) are **not** fully reproduced here: this spec locks the
 * **client path** (GUM → worklet → int16-ish binary frames on the agent socket) after Settings applied.
 * PCM rate / resampler semantics remain covered by package Jest (see ISSUE-560 TDD-PLAN §2b).
 *
 * Run from test-app (dev + backend; see PROXY-SERVER.md):
 *   npm run test:e2e -- live-mode-openai-proxy-mic-uplink-issue560.spec.js
 *
 * Included in `npm run test:e2e:openai`.
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoProxyForBackend,
  setupTestPageWithOpenAIProxy,
  waitForSettingsApplied,
} from './helpers/test-helpers.js';
import { installMicE2eTelemetry } from './helpers/mic-e2e-telemetry.js';

const SPEC_TIMEOUT_MS = 120_000;
const COMPONENT_READY_TIMEOUT_MS = 25_000;
const LIVE_ROOT_VISIBLE_TIMEOUT_MS = 120_000;
const SETTINGS_DOM_TIMEOUT_MS = 60_000;
const MIC_POLL_TIMEOUT_MS = 60_000;
/** Loose bounds: worklet-sized chunks after 16 kHz int16 pack; rejects empty/trivial garbage. */
const MIN_PCM_CHUNK_BYTES = 256;
const MAX_PCM_CHUNK_BYTES = 128 * 1024;
/** Fake-device runs can emit few frames before idle; 2 is enough to assert shape. */
const MIN_LENGTH_SAMPLES_TO_CHECK = 2;

test.describe('Live + OpenAI proxy — mic uplink (Issue #560)', () => {
  test.beforeEach(async ({ context }) => {
    skipIfNoProxyForBackend('Requires OpenAI proxy (default E2E_BACKEND)');
    await context.grantPermissions(['microphone']);
  });

  test('Live + mic: Settings applied; GUM + non-empty binary PCM frames on WebSocket', async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);

    await page.addInitScript(installMicE2eTelemetry);
    await setupTestPageWithOpenAIProxy(page, 10_000, {
      extraParams: {
        e2eIdleTimeoutMs: '30000',
        'e2e-mic-assertions': '1',
      },
    });

    await page.waitForFunction(
      () => document.querySelector('[data-testid="component-ready-status"]')?.textContent === 'true',
      { timeout: COMPONENT_READY_TIMEOUT_MS }
    );

    await page.getByTestId('live-entry-button').click();
    await expect(page.getByTestId('live-mode-root')).toBeVisible({
      timeout: LIVE_ROOT_VISIBLE_TIMEOUT_MS,
    });

    await waitForSettingsApplied(page, SETTINGS_DOM_TIMEOUT_MS);

    await expect(page.getByTestId('live-session-phase')).toHaveText('active');

    await expect
      .poll(
        async () => page.evaluate(() => window.__e2eStartAudioCaptureCompletedAt ?? 0),
        { timeout: MIC_POLL_TIMEOUT_MS }
      )
      .toBeGreaterThan(0);

    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              globalThis.__e2eGumResolved === true &&
              globalThis.__e2eGumRejected !== true &&
              globalThis.__e2eGumCallCount >= 1
          ),
        { timeout: MIC_POLL_TIMEOUT_MS }
      )
      .toBe(true);

    await expect
      .poll(async () => page.evaluate(() => globalThis.__e2eWsBinarySendCount ?? 0), {
        timeout: MIC_POLL_TIMEOUT_MS,
      })
      .toBeGreaterThan(0);

    const lengths = await page.evaluate(() => globalThis.__e2eWsBinarySendByteLengths ?? []);
    expect(lengths.length, 'telemetry should record first binary send sizes').toBeGreaterThanOrEqual(
      MIN_LENGTH_SAMPLES_TO_CHECK
    );
    for (let i = 0; i < Math.min(MIN_LENGTH_SAMPLES_TO_CHECK, lengths.length); i++) {
      expect(lengths[i] % 2, `chunk ${i} should be int16-aligned (even byte length)`).toBe(0);
      expect(lengths[i]).toBeGreaterThanOrEqual(MIN_PCM_CHUNK_BYTES);
      expect(lengths[i]).toBeLessThanOrEqual(MAX_PCM_CHUNK_BYTES);
    }

    await page.getByTestId('live-end-live-button').click();
    await expect(page.getByTestId('debug-main-layout')).toBeVisible();
    await expect(page.getByTestId('live-mode-root')).toHaveCount(0);
  });
});
