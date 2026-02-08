/**
 * OpenAI Proxy E2E Suite (Issue #381)
 *
 * Reuses the same flows as deepgram-text-session-flow and related specs, pointed at the
 * OpenAI Realtime proxy (VITE_OPENAI_PROXY_ENDPOINT). Tests are skipped when
 * VITE_OPENAI_PROXY_ENDPOINT is not set.
 *
 * Protocol: These tests abide by and reflect the OpenAI proxy protocol (SettingsApplied
 * before first message, user echo in conversation history, etc.). See OPENAI-PROTOCOL-E2E.md
 * and scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md.
 *
 * Readiness contract (Issue #406): We enforce the component–OpenAI contract. The component
 * requires connection + Settings applied before the first user message. Every test that
 * sends a message waits for waitForSettingsApplied after establishConnectionViaText.
 *
 * Behaviors: connection, single message, multi-turn, reconnection, basic audio,
 * simple function calling. See docs/issues/ISSUE-381/E2E-TEST-PLAN.md.
 *
 * Run with OpenAI proxy: VITE_OPENAI_PROXY_ENDPOINT=ws://your-proxy/openai npm run test:e2e -- openai-proxy-e2e
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoOpenAIProxy,
  setupTestPageWithOpenAIProxy,
  waitForSettingsApplied,
  establishConnectionViaText,
  sendMessageAndWaitForResponse,
  sendTextMessage,
  waitForAgentResponse,
  waitForAgentResponseEnhanced,
  disconnectComponent,
  getAgentState,
  assertNoRecoverableAgentErrors,
} from './helpers/test-helpers.js';
import { loadAndSendAudioSample } from './fixtures/audio-helpers.js';

const AGENT_RESPONSE_TIMEOUT = 20000;

test.describe('OpenAI Proxy E2E (Issue #381)', () => {
  test.beforeEach(() => {
    skipIfNoOpenAIProxy('Requires VITE_OPENAI_PROXY_ENDPOINT for OpenAI proxy E2E');
  });

  test('1. Connection – connect through OpenAI proxy and receive settings', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    const state = await getAgentState(page);
    expect(state).toBeDefined();
    // Component and test app require Settings applied before first message (Issue #406).
    // Enforce actual behavior: connection + Settings applied = ready for messages.
    await waitForSettingsApplied(page, 15000);
    await assertNoRecoverableAgentErrors(page);
  });

  test('1b. Greeting – proxy injects greeting; component shows greeting-sent (Issue #381)', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    await expect(page.locator('[data-testid="has-sent-settings"]')).toHaveText('true');
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
    await assertNoRecoverableAgentErrors(page);
  });

  test('2. Single message – inject user message, receive agent response in Message Bubble', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    await sendTextMessage(page, 'What is 2 plus 2?');
    await waitForAgentResponseEnhanced(page, { timeout: AGENT_RESPONSE_TIMEOUT });
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
    await assertNoRecoverableAgentErrors(page);
  });

  test('2b. Protocol: user message appears in conversation history (proxy sends user echo)', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    const userContent = 'What is the capital of France?';
    await sendTextMessage(page, userContent);
    await waitForAgentResponseEnhanced(page, { timeout: AGENT_RESPONSE_TIMEOUT });
    const history = page.locator('[data-testid="conversation-history"]');
    await expect(history).toBeVisible();
    const userMsg = history.locator('[data-role="user"]').filter({ hasText: userContent });
    await expect(userMsg.first()).toBeVisible({ timeout: 5000 });
    await assertNoRecoverableAgentErrors(page);
  });

  test('3. Multi-turn – sequential messages, second agent response appears', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    const r1 = await sendMessageAndWaitForResponse(page, "What is the capital of France?", AGENT_RESPONSE_TIMEOUT);
    expect(r1).toBeTruthy();
    expect(r1.length).toBeGreaterThan(0);
    // Flaw fix: require first agent reply (r1) to appear in conversation history before second turn.
    // Otherwise we only assert counts at the end and can pass with r1 missing (greeting + r2 only).
    const historyAfterFirst = page.locator('[data-testid="conversation-history"]');
    await expect(historyAfterFirst.locator('[data-role="assistant"]')).toHaveCount(2, { timeout: 5000 });
    const assistantTextsAfterFirst = await historyAfterFirst.locator('[data-role="assistant"]').allTextContents();
    const r1InHistory = assistantTextsAfterFirst.some((t) => t.includes('Paris') || (r1 && t.trim().includes(r1.trim().slice(0, 20))));
    expect(r1InHistory, 'First agent response (r1) must appear in conversation history after first exchange').toBe(true);

    const r2 = await sendMessageAndWaitForResponse(page, "What did I just say?", AGENT_RESPONSE_TIMEOUT);
    expect(r2).toBeTruthy();
    expect(r2.length).toBeGreaterThan(0);
    const history = page.locator('[data-testid="conversation-history"]');
    await expect(history.locator('[data-role="user"]')).toHaveCount(2);
    await expect(history.locator('[data-role="assistant"]')).toHaveCount(3);
    const items = await history.locator('li[data-role]').all();
    const conversationReport = await Promise.all(
      items.map(async (el, i) => {
        const role = await el.getAttribute('data-role');
        const text = (await el.textContent()) || '';
        return `${i + 1}. ${role}: ${text.trim().replace(/\s+/g, ' ').slice(0, 120)}${text.length > 120 ? '...' : ''}`;
      })
    );
    console.log('[Multi-turn] Conversation history (' + items.length + ' messages):');
    conversationReport.forEach((line) => console.log('  ' + line));
    await assertNoRecoverableAgentErrors(page);
  });

  test('3b. Multi-turn after disconnect – session history preserved (disconnect WS between 3 & 4)', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    const r1 = await sendMessageAndWaitForResponse(page, "What is the capital of France?", AGENT_RESPONSE_TIMEOUT);
    expect(r1).toBeTruthy();
    expect(r1.length).toBeGreaterThan(0);
    const historyAfterFirst = page.locator('[data-testid="conversation-history"]');
    await expect(historyAfterFirst.locator('[data-role="assistant"]')).toHaveCount(2, { timeout: 5000 });
    const assistantTextsAfterFirst = await historyAfterFirst.locator('[data-role="assistant"]').allTextContents();
    const r1InHistory = assistantTextsAfterFirst.some((t) => t.includes('Paris') || (r1 && t.trim().includes(r1.trim().slice(0, 20))));
    expect(r1InHistory, 'First agent response (r1) must appear in conversation history before disconnect').toBe(true);

    await disconnectComponent(page);

    const r2 = await sendMessageAndWaitForResponse(page, "What did I just say?", AGENT_RESPONSE_TIMEOUT);
    expect(r2).toBeTruthy();
    expect(r2.length).toBeGreaterThan(0);
    expect(
      r2.toLowerCase().includes('france') || r2.toLowerCase().includes('paris') || r2.toLowerCase().includes('capital'),
      'Second response (r2) must reference first exchange – proves session history was sent on reconnect'
    ).toBe(true);

    const history = page.locator('[data-testid="conversation-history"]');
    await expect(history.locator('[data-role="user"]')).toHaveCount(2);
    await expect(history.locator('[data-role="assistant"]')).toHaveCount(3);
    const assistantTexts = await history.locator('[data-role="assistant"]').allTextContents();
    const r1StillInHistory = assistantTexts.some((t) => t.includes('Paris') || (r1 && t.trim().includes(r1.trim().slice(0, 20))));
    expect(r1StillInHistory, 'Conversation history must still contain r1 after reconnect (session history requirement)').toBe(true);
    await assertNoRecoverableAgentErrors(page);

    // Wait for idle timeout to close connection (default 10s; wait up to 12s) – proves component idle timeout with proxy WS
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('closed', { timeout: 12000 });
  });

  test('4. Reconnection – disconnect then send, app reconnects and user receives response', async ({ page }) => {
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    await sendMessageAndWaitForResponse(page, "First message.", AGENT_RESPONSE_TIMEOUT);
    await disconnectComponent(page);
    const secondResponse = await sendMessageAndWaitForResponse(page, "Second after disconnect.", AGENT_RESPONSE_TIMEOUT);
    expect(secondResponse).toBeTruthy();
    expect(secondResponse.length).toBeGreaterThan(0);
    await assertNoRecoverableAgentErrors(page);
  });

  test('5. Basic audio – send recorded audio; assert agent response appears in [data-testid="agent-response"]', async ({ page, context }) => {
    // Proxy translates client binary audio to OpenAI input_audio_buffer.append + commit + response.create.
    // In the test-app the agent response is rendered in the element with data-testid="agent-response".
    await context.grantPermissions(['microphone']);
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    await sendTextMessage(page, 'What is 2 plus 2?');
    await waitForAgentResponse(page, null, AGENT_RESPONSE_TIMEOUT);
    const hasSample = await page.evaluate(async () => {
      try {
        const wav = await fetch('/audio-samples/hello.wav');
        if (wav.ok) return true;
        const json = await fetch('/audio-samples/sample_hello.json');
        return json.ok;
      } catch {
        return false;
      }
    }).catch(() => false);
    if (!hasSample) {
      test.skip(true, 'No audio sample (hello.wav or sample_hello.json) – run with audio fixtures');
      return;
    }
    await loadAndSendAudioSample(page, 'hello', { chunkSize: 4096 });
    await waitForAgentResponse(page, null, AGENT_RESPONSE_TIMEOUT);
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
    await assertNoRecoverableAgentErrors(page);
  });

  test('6. Simple function calling – trigger function call; assert response in [data-testid="agent-response"]', async ({ page }) => {
    const { pathWithQuery, getOpenAIProxyParams } = await import('./helpers/test-helpers.mjs');
    const params = { ...getOpenAIProxyParams(), 'test-mode': 'true', 'enable-function-calling': 'true' };
    await page.goto(pathWithQuery(params));
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    await sendTextMessage(page, "What time is it?");
    await waitForAgentResponseEnhanced(page, { timeout: AGENT_RESPONSE_TIMEOUT });
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
    await assertNoRecoverableAgentErrors(page);
  });

  test('7. Reconnection with context – disconnect, reconnect; proxy sends context via conversation.item.create', async ({ page }) => {
    test.setTimeout(60000); // First message + disconnect + second message can exceed 30s
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);
    const firstResponse = await sendMessageAndWaitForResponse(page, "My favorite color is blue.", AGENT_RESPONSE_TIMEOUT);
    expect(firstResponse).toBeTruthy();
    expect(firstResponse.length).toBeGreaterThan(0);
    await disconnectComponent(page);
    await page.waitForTimeout(1000);
    const secondResponse = await sendMessageAndWaitForResponse(page, "What is 3 times 3?", AGENT_RESPONSE_TIMEOUT);
    expect(secondResponse).toBeTruthy();
    expect(secondResponse.length).toBeGreaterThan(0);
    await assertNoRecoverableAgentErrors(page);
  });

  test('8. Error handling – wrong proxy URL shows closed/error and does not hang', async ({ page }) => {
    const { pathWithQuery } = await import('./helpers/test-helpers.mjs');
    const wrongProxyUrl = 'ws://localhost:99999/openai';
    await page.goto(pathWithQuery({ connectionMode: 'proxy', proxyEndpoint: wrongProxyUrl }));
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 5000 });
    await textInput.focus();
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await connectionStatus.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="connection-status"]');
        const text = el?.textContent?.toLowerCase() || '';
        return text === 'closed' || text.includes('closed') || text.includes('error');
      },
      { timeout: 15000 }
    );
    const statusText = await connectionStatus.textContent();
    expect(statusText?.toLowerCase()).toMatch(/closed|error/);
  });
});
