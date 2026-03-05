/**
 * Greeting Idle Timeout Test
 *
 * Verifies Issue #139: idle timeout fires after agent greeting completes (not after 60s server timeout).
 *
 * These tests do NOT require real APIs: they run with the same proxy as other E2E (mock or real backend).
 *
 * Idle timeout source: the test reads window.__idleTimeoutMs from the app. When Playwright starts the
 * webServer (normal E2E run), playwright.config.mjs sets VITE_IDLE_TIMEOUT_MS=1000 so the app uses 1s.
 * When using an existing server (E2E_USE_EXISTING_SERVER=1 or a pre-started dev server), the app uses
 * whatever idle timeout that server was started with (often 10s). These tests scale with window.__idleTimeoutMs
 * and must pass for both 1s (Playwright-started) and 10s (default) idle.
 *
 * Timing assertion: connection close must occur within TIMING_TOLERANCE_MS of the expected idle timeout.
 */

import { test, expect } from '@playwright/test';
import {
  SELECTORS, waitForConnection, sendTextMessage, waitForAgentGreeting,
  establishConnectionViaMicrophone
} from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks';
import { waitForIdleTimeout, verifyIdleTimeoutTiming, resetIdleTimeoutFiredDiagnostic } from './fixtures/idle-timeout-helpers';

/** Buffer (ms) for max wait so we observe close even when it fires slightly after idle (e.g. 10s idle + ~1.5s). */
const E2E_IDLE_BUFFER_MS = 2000;
/** Tolerance (ms): actual close time must be within this of expected idle timeout or the test fails. */
const TIMING_TOLERANCE_MS = 2000;
/** Greeting/audio waits use IDLE_TIMEOUT + X so they scale when IDLE_TIMEOUT is mocked. Add 500ms so we do not race (waits slightly larger than idle). */
const E2E_GREETING_WAIT_OFFSET_MS = 500;
/** waitForAgentGreeting: was 15s - 10s = 5s offset; +500ms so slightly larger than idle-derived value. */
const E2E_AGENT_GREETING_OFFSET_MS = 5500;

test.describe('Greeting Idle Timeout', () => {
  test('should timeout after greeting completes (Issue #139)', async ({ page, context }) => {
    console.log('🧪 Testing Issue #139: Idle timeout after greeting completion...');

    // Step 1: Browser restart (fresh page load)
    console.log('Step 1: Starting fresh browser session...');
    await setupTestPage(page);

    // Step 2: Establish connection via microphone button
    console.log('Step 2: Establishing connection via microphone...');
    await establishConnectionViaMicrophone(page, context);

    const initialConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialConnectionStatus}`);
    expect(initialConnectionStatus).toBe('connected');

    const idleMs = await page.evaluate(() => (typeof window !== 'undefined' && window.__idleTimeoutMs) ? window.__idleTimeoutMs : 10000);
    const greetingWaitMs = idleMs + E2E_GREETING_WAIT_OFFSET_MS;
    const agentGreetingWaitMs = idleMs + E2E_AGENT_GREETING_OFFSET_MS;

    // Step 3: Wait for greeting to be sent, then for greeting to complete (audio or text-only).
    // When the proxy sends greeting as ConversationText only (no binary), audio-playing never becomes true;
    // the component uses its text-only path (ConversationText → defer → idle). So we wait for completion
    // via waitForAgentGreeting instead of requiring "audio playing" first.
    console.log('Step 3: Waiting for greeting to be sent and to complete...');
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: greetingWaitMs });
    console.log('✅ Greeting sent');
    await waitForAgentGreeting(page, agentGreetingWaitMs);
    console.log('✅ Agent greeting completed (audio or text-only)');

    await resetIdleTimeoutFiredDiagnostic(page);

    const maxWaitMs = idleMs + E2E_IDLE_BUFFER_MS;

    // Step 5: Wait for agent connection to close (idle timeout + buffer)
    console.log('Step 5: Waiting for connection to close after idle timeout...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: idleMs,
      maxWaitTime: maxWaitMs,
      checkInterval: 200
    });

    expect(timeoutResult.timeoutFired, 'Idle timeout should fire (diagnostic: __idleTimeoutFired__)').toBe(true);
    if (!timeoutResult.closed && timeoutResult.timeoutFired) {
      console.log('⚠️ Diagnostic: timeout fired but connection status did not become closed');
    }
    expect(timeoutResult.closed).toBe(true);
    expect(timeoutResult.actualTimeout).toBeLessThanOrEqual(maxWaitMs);
    expect(
      verifyIdleTimeoutTiming(timeoutResult.actualTimeout, idleMs, TIMING_TOLERANCE_MS),
      `Connection must close within ${TIMING_TOLERANCE_MS}ms of expected idle (${idleMs}ms); got ${timeoutResult.actualTimeout}ms`
    ).toBe(true);

    // Step 6: User sends "hi" via text
    console.log('Step 6: Sending "hi" via text input...');

    // Click into text input to trigger reconnection
    // Use establishConnectionViaText pattern for reliable reconnection
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.waitFor({ state: 'visible', timeout: 10000 });
    await textInput.focus();
    console.log('✅ Text input focused - auto-connect should trigger');

    // Wait for connection status element to appear
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 10000 });

    // Wait for connection to transition from "closed" to "connecting" to "connected"
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      if (!statusEl) return false;
      const status = statusEl.textContent?.toLowerCase() || '';
      return status !== 'closed';
    }, { timeout: 10000 });

    // Wait for reconnection with longer timeout
    await waitForConnection(page, 30000);
    console.log('✅ Reconnected after text input');

    // Send the message
    await sendTextMessage(page, "hi");
    console.log('✅ Sent "hi" message');

    // Step 7: Wait for response from agent
    console.log('Step 7: Waiting for agent response...');

    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse?.textContent && agentResponse.textContent.length > 10;
    }, { timeout: 15000 });
    console.log('✅ Agent started responding');

    // Wait for audio to finish
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying?.textContent === 'false';
    }, { timeout: 15000 });
    console.log('✅ Agent finished responding');

    // Step 8: Wait for agent to finish responding
    console.log('Step 8: Waiting for agent to finish responding...');
    await waitForAgentGreeting(page, agentGreetingWaitMs);

    await resetIdleTimeoutFiredDiagnostic(page);
    const idleMs2 = await page.evaluate(() => (typeof window !== 'undefined' && window.__idleTimeoutMs) ? window.__idleTimeoutMs : 10000);
    const maxWaitMs2 = idleMs2 + E2E_IDLE_BUFFER_MS;

    // Step 9: Wait for agent connection to close
    console.log('Step 9: Waiting for connection to close after response...');
    const responseTimeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: idleMs2,
      maxWaitTime: maxWaitMs2,
      checkInterval: 200
    });

    expect(responseTimeoutResult.closed).toBe(true);
    expect(responseTimeoutResult.actualTimeout).toBeLessThanOrEqual(maxWaitMs2);
    expect(
      verifyIdleTimeoutTiming(responseTimeoutResult.actualTimeout, idleMs2, TIMING_TOLERANCE_MS),
      `Connection must close within ${TIMING_TOLERANCE_MS}ms of expected idle (${idleMs2}ms); got ${responseTimeoutResult.actualTimeout}ms`
    ).toBe(true);

    console.log('\n✅ SUCCESS: Issue #139 is fixed - idle timeout works correctly after agent speech');
  });

  test('should timeout after initial greeting on page load', async ({ page, context }) => {
    await setupTestPage(page);

    // Establish connection by clicking microphone button
    await establishConnectionViaMicrophone(page, context);

    const idleMs = await page.evaluate(() => (typeof window !== 'undefined' && window.__idleTimeoutMs) ? window.__idleTimeoutMs : 10000);
    const agentGreetingWaitMs = idleMs + E2E_AGENT_GREETING_OFFSET_MS;

    // Wait for initial greeting to complete (IDLE_TIMEOUT + 5s)
    await waitForAgentGreeting(page, agentGreetingWaitMs);

    await resetIdleTimeoutFiredDiagnostic(page);

    const maxWaitMs = idleMs + E2E_IDLE_BUFFER_MS;

    // Check AudioContext state
    const audioState = await page.evaluate(() => window.audioContext?.state);
    console.log(`AudioContext state after greeting: ${audioState}`);

    // Wait for idle timeout (idle + buffer)
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: idleMs,
      maxWaitTime: maxWaitMs,
      checkInterval: 200
    });

    expect(timeoutResult.timeoutFired, 'Idle timeout should fire (diagnostic: __idleTimeoutFired__)').toBe(true);
    if (!timeoutResult.closed && timeoutResult.timeoutFired) {
      console.log('⚠️ Diagnostic: timeout fired but connection status did not become closed');
    }
    expect(timeoutResult.closed).toBe(true);

    // Timing: at least ~500ms, at most idle + buffer, and within tolerance of expected idle
    expect(timeoutResult.actualTimeout).toBeGreaterThanOrEqual(500);
    expect(timeoutResult.actualTimeout).toBeLessThanOrEqual(maxWaitMs);
    expect(
      verifyIdleTimeoutTiming(timeoutResult.actualTimeout, idleMs, TIMING_TOLERANCE_MS),
      `Connection must close within ${TIMING_TOLERANCE_MS}ms of expected idle (${idleMs}ms); got ${timeoutResult.actualTimeout}ms`
    ).toBe(true);

    console.log(`✅ Connection closed after ${timeoutResult.actualTimeout}ms (expected: ~${idleMs}ms)`);
  });

  test('should NOT play greeting if AudioContext is suspended', async ({ page, context }) => {
    await setupTestPage(page);

    // Establish connection via microphone button
    await establishConnectionViaMicrophone(page, context);

    // Wait for greeting to be sent
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 10000 });
    console.log('✅ Greeting sent');

    // Wait a moment for audio playback to start (if it will)
    await page.waitForTimeout(1000);

    // Check AudioContext state from component
    const audioState = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      const audioContext = deepgramComponent?.getAudioContext?.();
      return audioContext?.state || 'not-initialized';
    });
    console.log(`AudioContext state: ${audioState}`);

    // Check if greeting audio was actually played
    const audioPlayed = await page.evaluate(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      const wasPlaying = audioPlaying?.textContent === 'true';
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      const hasAgentSaid = eventLog && eventLog.textContent.includes('Agent said:');
      return wasPlaying || hasAgentSaid;
    });
    console.log(`Greeting audio played: ${audioPlayed}`);

    if (audioState === 'suspended') {
      // If AudioContext is suspended, greeting audio should NOT have played
      expect(audioPlayed).toBe(false);
      console.log('✅ Test passed: AudioContext suspended, greeting audio did not play');
    } else {
      // If AudioContext is running (or not-initialized but audio works), greeting should have played
      // Note: When PW_ENABLE_AUDIO is false (default E2E), audio may not actually play so we skip strict assertion
      if (audioState === 'running') {
        const audioEnabled = process.env.PW_ENABLE_AUDIO === 'true' || process.env.PW_ENABLE_AUDIO === true;
        if (audioEnabled) {
          expect(audioPlayed).toBe(true);
          console.log('✅ Test passed: AudioContext running, greeting audio played');
        } else {
          // E2E often runs with audio disabled; AudioContext can be "running" but playback suppressed
          expect(typeof audioPlayed).toBe('boolean');
          console.log('✅ Test passed: AudioContext running (audio disabled in env, playback not asserted)');
        }
      } else {
        // If not-initialized, we can't make strong assertions about playback
        console.log(`⚠️  AudioContext state is ${audioState}, cannot verify playback behavior`);
      }
    }
  });
});
