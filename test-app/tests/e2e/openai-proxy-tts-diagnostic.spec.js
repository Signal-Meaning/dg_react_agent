/**
 * OpenAI proxy TTS diagnostic E2E (Issue #414)
 *
 * Connects to the OpenAI proxy, sends a text message, then checks:
 * 1. Whether the client received any binary WebSocket messages (proxy → client PCM).
 * 2. AudioContext state and audio-playing-status (component playback path).
 *
 * Use this to find where TTS fails: no binary → proxy or WebSocket; binary but not playing → component playback.
 *
 * Run: USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-tts-diagnostic
 * (Backend must be running: cd test-app && npm run backend)
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoOpenAIProxy,
  setupTestPageWithOpenAIProxy,
  establishConnectionViaText,
  waitForSettingsApplied,
  sendTextMessage,
  waitForAgentResponseEnhanced,
  installWebSocketCapture,
  getCapturedWebSocketData,
  getAudioDiagnostics,
  getComponentAudioContextState,
  waitForAudioPlaybackStart,
} from './helpers/test-helpers.js';

const AGENT_RESPONSE_TIMEOUT = 25000;
const TTS_PLAYBACK_WAIT_MS = 8000; // Wait for playback to start (audio-playing-status -> true)
const TTS_DELIVERY_WAIT_MS = 4000;

test.describe('OpenAI proxy TTS diagnostic (Issue #414)', () => {
  test.beforeEach(() => {
    skipIfNoOpenAIProxy('Requires VITE_OPENAI_PROXY_ENDPOINT for OpenAI proxy E2E');
  });

  test('diagnose TTS path: binary received and playback status after agent response', async ({ page }) => {
    // Capture WebSocket before any navigation so the agent WebSocket is wrapped
    await installWebSocketCapture(page);
    await setupTestPageWithOpenAIProxy(page);
    await establishConnectionViaText(page, 30000);
    await waitForSettingsApplied(page, 15000);

    await sendTextMessage(page, 'Say hello in one short sentence.');
    await waitForAgentResponseEnhanced(page, { timeout: AGENT_RESPONSE_TIMEOUT });
    // Wait for TTS playback to start (audio-playing-status becomes true); may already have finished
    let playbackStarted = false;
    try {
      await waitForAudioPlaybackStart(page, TTS_PLAYBACK_WAIT_MS);
      playbackStarted = true;
    } catch {
      // Playback may have finished before we checked, or playback path may be failing
    }
    // Allow time for any remaining TTS binary and for diagnostics
    await page.waitForTimeout(TTS_DELIVERY_WAIT_MS);

    const wsData = await getCapturedWebSocketData(page);
    const binaryReceived = (wsData.received || []).filter((m) => m.type === 'binary');
    const binaryCount = binaryReceived.length;
    const totalReceived = (wsData.received || []).length;

    const diagnostics = await getAudioDiagnostics(page);
    const componentCtxState = await getComponentAudioContextState(page);
    const audioPlayingEl = await page.locator('[data-testid="audio-playing-status"]').textContent();

    // Diagnostic output
    console.log('[TTS DIAGNOSTIC] WebSocket received:', totalReceived, 'total,', binaryCount, 'binary');
    console.log('[TTS DIAGNOSTIC] AudioContext (diagnostics):', diagnostics.state, '| playing:', diagnostics.playing);
    console.log('[TTS DIAGNOSTIC] Component AudioContext:', componentCtxState);
    console.log('[TTS DIAGNOSTIC] audio-playing-status element:', audioPlayingEl);
    console.log('[TTS DIAGNOSTIC] playbackStarted (within wait window):', playbackStarted);
    if (binaryReceived.length > 0) {
      const sizes = binaryReceived.slice(0, 5).map((m) => m.size ?? '(no size)').join(', ');
      console.log('[TTS DIAGNOSTIC] First binary chunk sizes (up to 5):', sizes);
      if (!playbackStarted) {
        console.log(
          '[TTS DIAGNOSTIC] Interpretation: binary>=1 → proxy→client OK; playback never became true → defect in component playback (handleAgentAudio/sink/queueAudio)'
        );
      }
    }

    // Assert 1: Client must receive at least one binary message if the proxy sends PCM (proxy fix is deployed)
    expect(
      binaryCount,
      `Expected at least one binary WebSocket message (TTS PCM from proxy). Got ${binaryCount}. ` +
        'If 0: proxy may not be sending PCM (response.output_audio.delta → binary), or backend not running / wrong endpoint.'
    ).toBeGreaterThanOrEqual(1);

    // Assert 2: If we got binary, playback must have started (component playback path)
    expect(
      binaryCount < 1 || playbackStarted,
      `Received ${binaryCount} binary TTS chunks but audio-playing-status never became true. ` +
        'Component playback path (handleAgentAudio → sink/queueAudio) is not running.'
    ).toBeTruthy();

    // Assert 3: AudioContext must be runnable (running, suspended, or not yet created)
    expect(
      [diagnostics.state, componentCtxState].some((s) => s === 'running' || s === 'suspended' || s === 'no-context'),
      `AudioContext state: diagnostics.state=${diagnostics.state}, componentCtx=${componentCtxState}`
    ).toBeTruthy();
  });
});
