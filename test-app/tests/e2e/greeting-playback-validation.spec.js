/**
 * Greeting playback validation E2E (real APIs)
 *
 * Two flows (do not conflate):
 * - "connect only": clear storage, reload, click text input once. Expect the **greeting** (no second
 *   message) in conversation history, no upstream error, **greeting audio** played. This is the
 *   strict greeting path (Issue #414). Fails when upstream errors or greeting/audio is missing.
 * - "connect then send": connect, then send a **non-greeting** message to trigger a normal agent
 *   response with TTS. Validates playback path for **agent responses only**; does not validate
 *   greeting playback. Use a prompt that cannot be mistaken for the greeting (e.g. "What is 2 + 2?").
 *
 * Protocol: Reflects session ordering (SettingsApplied then greeting in UI). See OPENAI-PROTOCOL-E2E.md.
 *
 * Run: USE_PROXY_MODE=true npm run test:e2e -- greeting-playback-validation
 * With audio enabled (optional): USE_PROXY_MODE=true PW_ENABLE_AUDIO=true npm run test:e2e -- greeting-playback-validation --headed
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoOpenAIProxy,
  setupTestPageWithOpenAIProxy,
  establishConnectionViaText,
  waitForSettingsApplied,
  sendTextMessage,
  waitForAgentGreeting,
  assertNoRecoverableAgentErrors,
} from './helpers/test-helpers.js';

const AGENT_PLAYBACK_TIMEOUT_MS = 25000; // Wait for playback start or first chunk after sending message
const AGENT_FINISH_TIMEOUT_MS = 15000;
/** Time to wait for greeting (conversation + audio) after connect-only; no second message */
const GREETING_AFTER_CONNECT_ONLY_MS = 20000;

test.describe('Greeting playback validation (real APIs)', () => {
  test.beforeEach(() => {
    skipIfNoOpenAIProxy('Requires VITE_OPENAI_PROXY_ENDPOINT for real API E2E');
  });

  /**
   * Manual repro (Issue #414): clear storage, reload (fresh load), click text input only.
   * Expect: Conversation History shows greeting, no upstream error, greeting audio played.
   * If upstream errors or greeting/audio is missing, this test fails.
   */
  test('connect only (no second message): greeting in conversation, no error, greeting audio played', async ({ page }) => {
    test.setTimeout(60000);
    // 0. Load app once, clear localStorage, reload so app runs with clean state (like manual "restart browser")
    await setupTestPageWithOpenAIProxy(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    // 1. Click text input only (no sendTextMessage)
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    await expect(page.locator('[data-testid="has-sent-settings"]')).toHaveText('true');

    // Wait for greeting path: conversation history has assistant message, no error, and at least one audio chunk
    let hasAssistantInHistory = false;
    let errorCount = -1;
    let chunks = -1;
    const deadline = Date.now() + GREETING_AFTER_CONNECT_ONLY_MS;
    while (Date.now() < deadline) {
      const err = await page.locator('[data-testid="agent-error-count"]').textContent().catch(() => '0');
      const n = parseInt(err || '0', 10);
      if (n >= 1) {
        await assertNoRecoverableAgentErrors(page); // fail with clear message
        return;
      }
      errorCount = n;
      const ch = await page.locator('[data-testid="agent-audio-chunks-received"]').textContent().catch(() => '0');
      chunks = parseInt(ch || '0', 10);
      const assistantMsg = await page.locator('[data-testid="conversation-history"] [data-role="assistant"]').first().count() > 0;
      if (assistantMsg) hasAssistantInHistory = true;
      if (hasAssistantInHistory && errorCount === 0 && chunks >= 1) break;
      await page.waitForTimeout(500);
    }

    expect(
      errorCount,
      'Upstream must not send an agent error (e.g. "server had an error"). Check proxy and OpenAI API.'
    ).toBe(0);
    expect(
      hasAssistantInHistory,
      'Conversation History must show the greeting (assistant message). Got no assistant message in history.'
    ).toBe(true);
    expect(
      chunks,
      'Greeting audio must play (agent-audio-chunks-received >= 1). No TTS chunks received.'
    ).toBeGreaterThanOrEqual(1);
    await assertNoRecoverableAgentErrors(page);
  });

  /**
   * Validates agent response TTS playback only (not greeting). Uses a non-greeting prompt
   * so we do not rely on a greeting-like response. Does not assert greeting audio.
   */
  test('connect then send non-greeting message: agent response TTS played', async ({ page }) => {
    test.setTimeout(90000); // connect + send + wait for playback + finish
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);

    // Non-greeting prompt so response is clearly an agent reply, not the initial greeting
    await sendTextMessage(page, 'What is 2 plus 2?');

    // Wait for evidence of playback: audio-playing-status true or at least one agent audio chunk
    const playbackOrChunks = await page
      .waitForFunction(
        () => {
          const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]')?.textContent?.trim();
          const chunksEl = document.querySelector('[data-testid="agent-audio-chunks-received"]');
          const chunks = parseInt(chunksEl?.textContent || '0', 10);
          return audioPlaying === 'true' || chunks >= 1;
        },
        { timeout: AGENT_PLAYBACK_TIMEOUT_MS }
      )
      .then(() => true)
      .catch(() => false);

    expect(
      playbackOrChunks,
      'Agent playback must occur after send: audio-playing-status true or agent-audio-chunks-received >= 1 within ' +
        AGENT_PLAYBACK_TIMEOUT_MS + 'ms. DOM text alone is not sufficient.'
    ).toBe(true);

    const chunks = parseInt(
      await page.locator('[data-testid="agent-audio-chunks-received"]').textContent() || '0',
      10
    );
    if (chunks >= 1) {
      console.log('✅ Agent TTS chunks received (handleAgentAudio called):', chunks);
    }
    const audioPlaying = await page.locator('[data-testid="audio-playing-status"]').textContent();
    if (audioPlaying === 'true') {
      console.log('✅ Agent playback started (audio-playing-status true)');
    }

    // Wait for agent to finish (audio-playing-status false / agent idle)
    await waitForAgentGreeting(page, AGENT_FINISH_TIMEOUT_MS);
    console.log('✅ Agent playback finished');

    const history = page.locator('[data-testid="conversation-history"]');
    await expect(history.locator('[data-role="user"]').first()).toBeVisible();
    await expect(history.locator('[data-role="assistant"]').first()).toBeVisible();

    const finalChunks = parseInt(
      await page.locator('[data-testid="agent-audio-chunks-received"]').textContent() || '0',
      10
    );
    expect(
      finalChunks,
      'Agent playback must route PCM to handleAgentAudio (agent-audio-chunks-received >= 1).'
    ).toBeGreaterThanOrEqual(1);

    // Fail if upstream reported an agent error (e.g. "server had an error")
    await assertNoRecoverableAgentErrors(page);

    console.log('✅ Agent response TTS playback validated (playback + chunks)');
  });
});
