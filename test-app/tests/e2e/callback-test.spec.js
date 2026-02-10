import { test, expect } from '@playwright/test';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';
import { getVADState } from './fixtures/vad-helpers.js';
import { pathWithQuery, getBackendProxyParams } from './helpers/test-helpers.mjs';
import {
  MicrophoneHelpers,
  sendTextMessage,
  waitForAudioPlaybackStart,
  waitForAgentGreeting,
  waitForAgentResponse,
  getAudioPlayingStatus,
  setupAudioSendingPrerequisites,
  assertNoRecoverableAgentErrors,
  hasOpenAIProxyEndpoint
} from './helpers/test-helpers.js';

/**
 * Callback Test Suite
 *
 * This test suite verifies that ALL callbacks are properly implemented and working:
 * - onReady ✅ (has tests)
 * - onConnectionStateChange ✅ (has tests)
 * - onError ✅ (has tests)
 * - onTranscriptUpdate ❌ (needs tests)
 * - onUserStartedSpeaking ❌ (needs tests)
 * - onUserStoppedSpeaking ❌ (needs tests - was restored)
 * - onAgentStateChange ✅ (has tests)
 * - onAgentUtterance ✅ (has tests)
 * - onUserMessage ✅ (has tests)
 * - onPlaybackStateChange ✅ (has tests)
 */

test.describe('Callback Test Suite', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permissions before navigation (80% case - most VAD tests need this)
    await context.grantPermissions(['microphone']);

    // Navigate with backend selected by E2E_BACKEND (openai or deepgram) so tests run for both proxies
    await page.goto(pathWithQuery({ ...getBackendProxyParams(), 'test-mode': 'true' }));
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });

    // Capture console logs for debugging (simplified approach)
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.text()}`);
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up: Close any open connections and clear state
    try {
      await page.evaluate(() => {
        // Close component if it exists
        if (window.deepgramRef?.current) {
          window.deepgramRef.current.stop?.();
        }
      });
      // Navigate away to ensure clean state for next test
      await page.goto('about:blank');
      await page.waitForTimeout(500); // Give time for cleanup
    } catch (error) {
      // Ignore cleanup errors - test may have already navigated away
    }
  });

  test('should test onTranscriptUpdate callback with existing audio sample', async ({ page, context }) => {
    const useOpenAI = hasOpenAIProxyEndpoint();
    console.log('🧪 Testing onTranscriptUpdate callback with existing audio sample...', useOpenAI ? '(OpenAI proxy)' : '(Deepgram)');

    await setupAudioSendingPrerequisites(page, context, {
      componentReadyTimeout: 5000,
      connectionTimeout: 10000,
      settingsTimeout: 10000,
      settingsProcessingDelay: 600
    });

    console.log('✅ Connection established and settings applied');

    await loadAndSendAudioSample(page, 'hello');

    if (useOpenAI) {
      // OpenAI proxy: no Deepgram-style transcript events; assert agent response and no error
      await waitForAgentResponse(page, null, 20000);
      await assertNoRecoverableAgentErrors(page);
      console.log('✅ onTranscriptUpdate path (OpenAI): agent response received, no error');
      return;
    }

    // Deepgram: assert transcript appears in UI
    await page.waitForSelector('[data-testid="transcription"]', { timeout: 5000 });
    await page.waitForFunction(() => {
      const transcriptElement = document.querySelector('[data-testid="transcription"]');
      if (!transcriptElement) return false;
      const text = transcriptElement.textContent?.trim() || '';
      return text.length > 0 && text !== '(Waiting for transcript...)';
    }, { timeout: 20000 });

    const transcriptText = await page.locator('[data-testid="transcription"]').textContent();
    expect(transcriptText).toBeTruthy();
    expect(transcriptText?.trim()).not.toBe('');
    expect(transcriptText).not.toBe('(Waiting for transcript...)');
    console.log('✅ onTranscriptUpdate callback working - transcript displayed:', transcriptText);
  });

  test('should test onUserStartedSpeaking callback with existing audio sample', async ({ page, context }) => {
    const useOpenAI = hasOpenAIProxyEndpoint();
    console.log('🧪 Testing onUserStartedSpeaking callback with existing audio sample...', useOpenAI ? '(OpenAI proxy)' : '(Deepgram)');

    await setupAudioSendingPrerequisites(page, context, {
      componentReadyTimeout: 5000,
      connectionTimeout: 10000,
      settingsTimeout: 10000,
      settingsProcessingDelay: 600
    });

    console.log('✅ Connection established and settings applied');

    await page.waitForSelector('[data-testid="user-started-speaking"]', { timeout: 5000 });

    console.log('🎤 Using audio sample to trigger VAD / agent response...');
    await loadAndSendAudioSample(page, 'hello');

    if (useOpenAI) {
      // OpenAI proxy: Server VAD may be disabled so VAD events are optional; assert agent response and no error
      await waitForAgentResponse(page, null, 20000);
      await assertNoRecoverableAgentErrors(page);
      console.log('✅ onUserStartedSpeaking path (OpenAI): agent response, no error; VAD optional');
      return;
    }

    const eventsDetected = await waitForVADEvents(page, ['UserStartedSpeaking'], 10000);
    const vadState = await getVADState(page, ['UserStartedSpeaking']);
    expect(vadState.UserStartedSpeaking).toBeTruthy();
    expect(vadState.UserStartedSpeaking).toMatch(/^\d{2}:\d{2}:\d{2}/);
    console.log('✅ onUserStartedSpeaking callback working - UserStartedSpeaking detected:', vadState.UserStartedSpeaking);
    console.log('📊 Events detected count:', eventsDetected);
  });

  test('should test onUserStoppedSpeaking callback with existing audio sample', async ({ page, context }) => {
    const useOpenAI = hasOpenAIProxyEndpoint();
    console.log('🧪 Testing onUserStoppedSpeaking callback with existing audio sample...', useOpenAI ? '(OpenAI proxy)' : '(Deepgram)');

    await setupAudioSendingPrerequisites(page, context, {
      componentReadyTimeout: 5000,
      connectionTimeout: 10000,
      settingsTimeout: 10000,
      settingsProcessingDelay: 600
    });

    console.log('✅ Connection established and settings applied');

    await loadAndSendAudioSample(page, 'hello');

    if (useOpenAI) {
      // OpenAI proxy: VAD/UtteranceEnd optional when Server VAD disabled; assert agent response and no error
      await waitForAgentResponse(page, null, 20000);
      await assertNoRecoverableAgentErrors(page);
      console.log('✅ onUserStoppedSpeaking path (OpenAI): agent response, no error; VAD optional');
      return;
    }

    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);

    await page.waitForFunction(() => {
      const utteranceEndEl = document.querySelector('[data-testid="utterance-end"]');
      return utteranceEndEl && utteranceEndEl.textContent && utteranceEndEl.textContent.trim() !== 'Not detected';
    }, { timeout: 15000 });

    const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd', 'UserStoppedSpeaking']);

    if (!vadState.UtteranceEnd && !vadState.UserStoppedSpeaking) {
      if (!vadState.UserStoppedSpeaking) {
        throw new Error('Neither UtteranceEnd nor UserStoppedSpeaking was detected');
      }
    }

    expect(vadState.UtteranceEnd || vadState.UserStoppedSpeaking).toBeTruthy();
    console.log('✅ onUserStoppedSpeaking callback working - UtteranceEnd detected:', vadState.UtteranceEnd);
    console.log('✅ User stopped speaking detected:', vadState.UserStoppedSpeaking);
    console.log('📊 Events detected count:', eventsDetected);
  });

  test('should test onPlaybackStateChange callback with agent response', async ({ page }) => {
    console.log('🧪 Testing onPlaybackStateChange callback...');

    // Use MicrophoneHelpers for reliable microphone activation and connection
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });

    if (!result.success) {
      throw new Error(`Microphone activation failed: ${result.error}`);
    }

    console.log('✅ Connection established');

    // Send text message using helper
    const testMessage = 'Hello, can you help me?';
    await sendTextMessage(page, testMessage);

    // Wait for audio playback to start using helper
    // Increased timeout for full test runs where API may be slower
    await waitForAudioPlaybackStart(page, 30000);

    // Verify audio playing status is true
    const audioPlayingStatus = await getAudioPlayingStatus(page);
    expect(audioPlayingStatus).toBe('true');

    // Wait for agent response audio to finish (waitForAgentGreeting waits for audio to finish)
    // This helper waits for audio-playing-status to be 'false' or agent-state to be 'idle'
    await waitForAgentGreeting(page, 20000);

    // Verify audio playing status is false
    const finalAudioStatus = await getAudioPlayingStatus(page);
    expect(finalAudioStatus).toBe('false');

    console.log('✅ onPlaybackStateChange callback working - audio status changed from true to false');
  });

  test('should test all callbacks integration with comprehensive workflow', async ({ page }) => {
    console.log('🧪 Testing comprehensive callback integration...');

    // Use MicrophoneHelpers for reliable microphone activation and connection
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });

    if (!result.success) {
      throw new Error(`Microphone activation failed: ${result.error}`);
    }

    console.log('✅ Connection established');

    // Send text message using helper
    const testMessage = 'Hello, this is a comprehensive test message';
    await sendTextMessage(page, testMessage);

    // Wait for agent response using helper
    await page.waitForFunction(() => {
      const agentResponseElement = document.querySelector('[data-testid="agent-response"]');
      return agentResponseElement && agentResponseElement.textContent &&
             agentResponseElement.textContent !== '(Waiting for agent response...)';
    }, { timeout: 15000 });

    // Wait for component to be ready (onReady callback)
    await page.waitForSelector('[data-testid="component-ready-status"]', { timeout: 5000 });

    // Check which callbacks were triggered by examining UI state
    const componentReady = await page.locator('[data-testid="component-ready-status"]').textContent();
    const agentResponse = await page.locator('[data-testid="agent-response"]').textContent();
    const audioPlayingStatus = await getAudioPlayingStatus(page);

    // Verify key callbacks were triggered
    expect(componentReady).toBe('true'); // onReady
    expect(agentResponse).not.toBe('(Waiting for agent response...)'); // onAgentUtterance
    expect(audioPlayingStatus).toBeDefined(); // onPlaybackStateChange

    console.log('✅ Comprehensive callback integration test completed');
    console.log('📊 Callback Status:');
    console.log(`  - onReady: ${componentReady === 'true' ? '✅' : '❌'}`);
    console.log(`  - onAgentUtterance: ${agentResponse !== '(Waiting for agent response...)' ? '✅' : '❌'}`);
    console.log(`  - onPlaybackStateChange: ${audioPlayingStatus ? '✅' : '❌'}`);
  });
});
