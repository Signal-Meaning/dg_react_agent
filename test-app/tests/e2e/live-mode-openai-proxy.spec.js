/**
 * Issue #561 — Live mode + OpenAI proxy: Settings sentinel + audio → assistant in history.
 *
 * `has-sent-settings` must stay in the DOM while Live is open (debug layout is unmounted).
 * This spec enters Live, waits for Settings applied, injects PCM, and asserts the Live
 * conversation list shows a substantive assistant line.
 *
 * **Isolation (Issue #560):** After Settings applied, PCM should send without arbitrary sleeps; we assert
 * `__e2eWsBinarySendCount` increased so failures split “no PCM on socket” vs “no STT”.
 *
 * Run from test-app (dev + backend should match your .env; see PROXY-SERVER.md):
 *   npm run test:e2e -- live-mode-openai-proxy.spec.js
 *
 * With existing servers:
 *   E2E_USE_EXISTING_SERVER=1 npm run test:e2e -- live-mode-openai-proxy.spec.js
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoProxyForBackend,
  setupTestPageWithOpenAIProxy,
  OPENAI_PROXY_E2E_DISTINCTIVE_AUDIO_SAMPLE,
  OPENAI_PROXY_E2E_DISTINCTIVE_TRANSCRIPT_NORMALIZED,
  waitForFinalUserTranscriptNormalized,
  waitForSettingsApplied,
  assertMinimalAgentReplyShape,
} from './helpers/test-helpers.js';
import { loadAndSendAudioSample, CHUNK_20MS_16K_MONO } from './fixtures/audio-helpers.js';
import { installMicE2eTelemetry } from './helpers/mic-e2e-telemetry.js';

/** Timeouts / thresholds for this spec only (avoid magic numbers in the test body). */
const LIVE_OPENAI_E2E_SPEC_TIMEOUT_MS = 120_000;
const LIVE_OPENAI_E2E_COMPONENT_READY_TIMEOUT_MS = 25_000;
const LIVE_OPENAI_E2E_LIVE_ROOT_VISIBLE_TIMEOUT_MS = 120_000;
/** DOM gate: App sets `[data-testid="has-sent-settings"]` to "true" when SettingsApplied fires. */
const LIVE_OPENAI_E2E_SETTINGS_DOM_TIMEOUT_MS = 60_000;
const LIVE_OPENAI_E2E_USER_TRANSCRIPT_TIMEOUT_MS = 90_000;
const LIVE_OPENAI_E2E_ASSISTANT_LINE_POLL_TIMEOUT_MS = 90_000;
const LIVE_OPENAI_E2E_MIN_ASSISTANT_LINE_LENGTH = 20;

/**
 * Long distinctive phrase (not "hello") — matches `sample_*.json` `phrase` and strict STT assertion.
 * @see OPENAI_PROXY_E2E_DISTINCTIVE_AUDIO_SAMPLE in test-helpers.js
 */
const LIVE_OPENAI_E2E_AUDIO_SAMPLE_NAME = OPENAI_PROXY_E2E_DISTINCTIVE_AUDIO_SAMPLE;
const LIVE_OPENAI_E2E_EXPECTED_USER_TRANSCRIPT_NORMALIZED =
  OPENAI_PROXY_E2E_DISTINCTIVE_TRANSCRIPT_NORMALIZED;

test.describe('Live mode + OpenAI proxy (Issue #561)', () => {
  test.beforeEach(async ({ context }) => {
    skipIfNoProxyForBackend('Requires OpenAI proxy (default E2E_BACKEND)');
    await context.grantPermissions(['microphone']);
  });

  test('Live entry: has-sent-settings visible; injected audio → assistant in live conversation', async ({
    page,
  }) => {
    test.setTimeout(LIVE_OPENAI_E2E_SPEC_TIMEOUT_MS);

    await page.addInitScript(installMicE2eTelemetry);
    await setupTestPageWithOpenAIProxy(page);

    await page.waitForFunction(
      () => document.querySelector('[data-testid="component-ready-status"]')?.textContent === 'true',
      { timeout: LIVE_OPENAI_E2E_COMPONENT_READY_TIMEOUT_MS }
    );

    const sampleName = LIVE_OPENAI_E2E_AUDIO_SAMPLE_NAME;
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
    await expect(page.getByTestId('live-mode-root')).toBeVisible({
      timeout: LIVE_OPENAI_E2E_LIVE_ROOT_VISIBLE_TIMEOUT_MS,
    });

    // Settings readiness via DOM (same contract as waitForSettingsApplied elsewhere).
    await waitForSettingsApplied(page, LIVE_OPENAI_E2E_SETTINGS_DOM_TIMEOUT_MS);

    const pcmBefore = await page.evaluate(() => globalThis.__e2eWsBinarySendCount ?? 0);
    await loadAndSendAudioSample(page, sampleName, { chunkSize: CHUNK_20MS_16K_MONO });
    const pcmAfter = await page.evaluate(() => globalThis.__e2eWsBinarySendCount ?? 0);
    expect(
      pcmAfter - pcmBefore,
      'OpenAI Live E2E: PCM must be sent on WebSocket (sendAudioData path); if 0, check sendAudioData gates / connection'
    ).toBeGreaterThan(0);

    await waitForFinalUserTranscriptNormalized(page, LIVE_OPENAI_E2E_EXPECTED_USER_TRANSCRIPT_NORMALIZED, {
      timeout: LIVE_OPENAI_E2E_USER_TRANSCRIPT_TIMEOUT_MS,
    });

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
        { timeout: LIVE_OPENAI_E2E_ASSISTANT_LINE_POLL_TIMEOUT_MS }
      )
      .toBeGreaterThan(LIVE_OPENAI_E2E_MIN_ASSISTANT_LINE_LENGTH);

    const assistantSnapshot = await page.evaluate(() => {
      const nodes = document.querySelectorAll('[data-testid^="live-conversation-message-"]');
      let longest = '';
      nodes.forEach((n) => {
        const t = n.textContent || '';
        if (t.includes('assistant:') && t.length > longest.length) longest = t;
      });
      return longest.replace(/^assistant:\s*/i, '').trim();
    });
    assertMinimalAgentReplyShape(assistantSnapshot, 'Live assistant line after distinctive-phrase audio');
  });
});
