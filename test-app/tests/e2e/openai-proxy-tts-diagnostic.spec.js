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
  getTtsFirstChunkBase64,
  getTtsFirstLargeChunkBase64,
  getTtsChunksBase64List,
  isFirstBinaryChunkLikelyJson,
  getChunkBoundaryInfo,
  analyzePCMChunkBase64,
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
    const agentAudioChunksReceived = parseInt(await page.locator('[data-testid="agent-audio-chunks-received"]').textContent() || '0', 10);

    // Diagnostic output
    console.log('[TTS DIAGNOSTIC] WebSocket received:', totalReceived, 'total,', binaryCount, 'binary');
    console.log('[TTS DIAGNOSTIC] AudioContext (diagnostics):', diagnostics.state, '| playing:', diagnostics.playing);
    console.log('[TTS DIAGNOSTIC] Component AudioContext:', componentCtxState);
    console.log('[TTS DIAGNOSTIC] audio-playing-status element:', audioPlayingEl);
    console.log('[TTS DIAGNOSTIC] playbackStarted (within wait window):', playbackStarted);
    console.log('[TTS DIAGNOSTIC] agent-audio-chunks-received (handleAgentAudio calls):', agentAudioChunksReceived);
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

    // Assert 2: First binary frame must not be JSON (proxy must send only PCM as binary; Issue #414 integration coverage)
    const chunksBase64 = await getTtsChunksBase64List(page);
    if (chunksBase64.length > 0) {
      const firstBinaryIsJson = isFirstBinaryChunkLikelyJson(chunksBase64[0]);
      expect(
        firstBinaryIsJson,
        'First binary frame must not be JSON (proxy must send only PCM as binary). If true, text/JSON was sent as binary and is being routed to audio.'
      ).toBe(false);
    }

    // Assert 3: Component must receive binary in handleAgentAudio (routing from WebSocketManager)
    expect(
      agentAudioChunksReceived,
      `Expected handleAgentAudio to be called for each binary frame. WebSocket received ${binaryCount} binary; component received ${agentAudioChunksReceived}.`
    ).toBeGreaterThanOrEqual(binaryCount > 0 ? 1 : 0);
    if (binaryCount > 0 && agentAudioChunksReceived < binaryCount) {
      console.log(
        `[TTS DIAGNOSTIC] Note: binary frames ${binaryCount} vs handleAgentAudio calls ${agentAudioChunksReceived} (some binary may be routed as message by WebSocketManager)`
      );
    }

    // Assert 4: If we got binary, playback must have started (component playback path)
    expect(
      binaryCount < 1 || playbackStarted,
      `Received ${binaryCount} binary TTS chunks but audio-playing-status never became true. ` +
        'Component playback path (handleAgentAudio → sink/queueAudio) is not running.'
    ).toBeTruthy();

    // Assert 5: AudioContext must be runnable (running, suspended, or not yet created)
    expect(
      [diagnostics.state, componentCtxState].some((s) => s === 'running' || s === 'suspended' || s === 'no-context'),
      `AudioContext state: diagnostics.state=${diagnostics.state}, componentCtx=${componentCtxState}`
    ).toBeTruthy();

    // Boundary diagnostic (Issue #414): log bytes at chunk boundaries for comparison with CLI (run before Assert 6 so we get output even when test fails)
    const chunksBase64ForBoundary = await getTtsChunksBase64List(page);
    if (chunksBase64ForBoundary.length >= 2) {
      const { chunkLengths, boundaries } = getChunkBoundaryInfo(chunksBase64ForBoundary);
      console.log('[TTS DIAGNOSTIC] Chunk lengths (first ' + chunkLengths.length + '):', chunkLengths.join(', '));
      boundaries.forEach((b) => {
        console.log(
          `[TTS DIAGNOSTIC] Boundary after chunk ${b.afterChunk}: chunk lengths ${b.chunkALen}, ${b.chunkBLen}; ` +
            `last 2 bytes of A: [${b.lastBytesA.join(', ')}] (LE sample: ${b.lastSampleLE ?? 'n/a'}); ` +
            `first 2 bytes of B: [${b.firstBytesB.join(', ')}] (LE sample: ${b.firstSampleLE ?? 'n/a'})` +
            (b.carriedPlusFirst !== undefined ? `; carried+first as LE sample: ${b.carriedPlusFirst}` : '')
        );
      });
    }

    // Assert 6: TTS PCM (first 3 large chunks, >=1000 bytes each) must look like speech (Issue #414: OpenAI sends small deltas first, then large)
    const firstLargeBase64 = await getTtsFirstLargeChunkBase64(page);
    const fallbackBase64 = await getTtsFirstChunkBase64(page);
    const chunkBase64 = firstLargeBase64 || fallbackBase64;
    if (binaryCount > 0 && chunkBase64) {
      const analysis = analyzePCMChunkBase64(chunkBase64);
      console.log('[TTS DIAGNOSTIC] Audio quality:', analysis.message + (firstLargeBase64 ? ' (TTS-sized chunks)' : ' (fallback: first chunks)'));
      expect(
        analysis.speechLike,
        analysis.message + ' (Decoded as 16-bit LE PCM per OpenAI Realtime API; non–speech-like metrics suggest wrong format or endianness.)'
      ).toBeTruthy();
    }
  });
});
