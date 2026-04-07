/**
 * Issue #561 — Live mode + OpenAI proxy: Settings sentinel + audio → assistant in history.
 *
 * `has-sent-settings` must stay in the DOM while Live is open (debug layout is unmounted).
 * This spec enters Live, waits for Settings applied, injects PCM like openai-proxy-e2e test 5,
 * and asserts the Live conversation list shows a substantive assistant line.
 *
 * Run from test-app (dev + backend should match your .env; see PROXY-SERVER.md):
 *   npm run test:e2e -- live-mode-openai-proxy.spec.js
 *
 * With existing servers:
 *   E2E_USE_EXISTING_SERVER=1 npm run test:e2e -- live-mode-openai-proxy.spec.js
 */

import { test, expect } from '@playwright/test';
import { skipIfNoProxyForBackend, setupTestPageWithOpenAIProxy } from './helpers/test-helpers.js';
import { loadAndSendAudioSample, CHUNK_20MS_16K_MONO } from './fixtures/audio-helpers.js';
import { installMicE2eTelemetry } from './helpers/mic-e2e-telemetry.js';

test.describe('Live mode + OpenAI proxy (Issue #561)', () => {
  test.beforeEach(async ({ context }) => {
    skipIfNoProxyForBackend('Requires OpenAI proxy (default E2E_BACKEND)');
    await context.grantPermissions(['microphone']);
  });

  test('Live entry: has-sent-settings visible; injected audio → assistant in live conversation', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.addInitScript(installMicE2eTelemetry);
    await setupTestPageWithOpenAIProxy(page);

    await page.waitForFunction(
      () => document.querySelector('[data-testid="component-ready-status"]')?.textContent === 'true',
      { timeout: 25_000 }
    );

    const sampleName = 'hello_extended';
    const hasSample = await page.evaluate(async (name) => {
      try {
        const wav = await fetch(`/audio-samples/${name}.wav`);
        if (wav.ok) return true;
        const json = await fetch(`/audio-samples/sample_${name}.json`);
        return json.ok;
      } catch {
        return false;
      }
    }, sampleName);
    if (!hasSample) {
      test.skip(true, `No audio sample ${sampleName}.wav / sample_${sampleName}.json`);
      return;
    }

    await page.getByTestId('live-entry-button').click();
    await expect(page.getByTestId('live-mode-root')).toBeVisible({ timeout: 120_000 });

    await expect(page.getByTestId('has-sent-settings')).toHaveText('true', { timeout: 60_000 });

    await loadAndSendAudioSample(page, sampleName, { chunkSize: CHUNK_20MS_16K_MONO });

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const nodes = document.querySelectorAll('[data-testid^="live-conversation-message-"]');
            let best = 0;
            nodes.forEach((n) => {
              const t = n.textContent || '';
              if (t.includes('assistant:')) best = Math.max(best, t.length);
            });
            return best;
          }),
        { timeout: 90_000 }
      )
      .toBeGreaterThan(20);
  });
});
