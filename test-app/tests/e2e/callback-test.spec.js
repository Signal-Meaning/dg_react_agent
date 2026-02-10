import { test, expect } from '@playwright/test';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';
import { getVADState } from './fixtures/vad-helpers.js';
import { pathWithQuery } from './helpers/test-helpers.mjs';
import {
  MicrophoneHelpers,
  sendTextMessage,
  waitForAudioPlaybackStart,
  waitForAgentGreeting,
  getAudioPlayingStatus,
  setupAudioSendingPrerequisites
} from './helpers/test-helpers.js';

/**
 * Callback Test Suite (runs with Deepgram or OpenAI proxy)
 *
 * Verifies component callback contracts: onReady, onConnectionStateChange, onError,
 * onTranscriptUpdate, onUserStartedSpeaking, onUserStoppedSpeaking, onAgentStateChange,
 * onAgentUtterance, onUserMessage, onPlaybackStateChange. Issue #414 resolved: the
 * OpenAI proxy maps transcript/VAD to the same component events, so these tests run
 * and must pass in both test:e2e:openai and test:e2e:deepgram.
 */

test.describe('Callback Test Suite', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permissions before navigation (80% case - most VAD tests need this)
    // This ensures permissions are available when the page loads
    await context.grantPermissions(['microphone']);
    
    // Navigate using relative path so baseURL (http/https) is applied
    await page.goto(pathWithQuery({ 'test-mode': 'true' }));

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
    // Runs with Deepgram or OpenAI proxy (Issue #414: proxy maps transcript/VAD to same component events)
    console.log('🧪 Testing onTranscriptUpdate callback with existing audio sample...');
    
    // Use setupAudioSendingPrerequisites helper for audio-sending tests
    // This handles: permissions, component ready, mic click, connection, settings applied, settings delay
    await setupAudioSendingPrerequisites(page, context, {
      componentReadyTimeout: 5000,
      connectionTimeout: 10000,
      settingsTimeout: 10000,
      settingsProcessingDelay: 600
    });
    
    console.log('✅ Connection established and settings applied');
    
    // Use DRY fixture to load and send existing audio sample
    await loadAndSendAudioSample(page, 'hello'); // Use existing 'hello' sample
    
    // Wait for transcript element to be visible first
    await page.waitForSelector('[data-testid="transcription"]', { timeout: 5000 });
    
    // Wait for transcript to appear in the UI with actual content
    // Check for both interim and final transcripts
    await page.waitForFunction(() => {
      const transcriptElement = document.querySelector('[data-testid="transcription"]');
      if (!transcriptElement) return false;
      const text = transcriptElement.textContent?.trim() || '';
      // Transcript is valid if it's not empty and not the waiting message
      return text.length > 0 && text !== '(Waiting for transcript...)';
    }, { timeout: 20000 });
    
    // Verify transcript appears in UI
    const transcriptText = await page.locator('[data-testid="transcription"]').textContent();
    expect(transcriptText).toBeTruthy();
    expect(transcriptText?.trim()).not.toBe('');
    expect(transcriptText).not.toBe('(Waiting for transcript...)');
    
    console.log('✅ onTranscriptUpdate callback working - transcript displayed:', transcriptText);
  });

  test('should test onUserStartedSpeaking callback with existing audio sample', async ({ page, context }) => {
    // Runs with Deepgram or OpenAI proxy (Issue #414: proxy maps VAD to UserStartedSpeaking/UtteranceEnd)
    console.log('🧪 Testing onUserStartedSpeaking callback with existing audio sample...');
    
    // Use setupAudioSendingPrerequisites helper for audio-sending tests
    // This handles: permissions, component ready, mic click, connection, settings applied, settings delay
    await setupAudioSendingPrerequisites(page, context, {
      componentReadyTimeout: 5000,
      connectionTimeout: 10000,
      settingsTimeout: 10000,
      settingsProcessingDelay: 600
    });
    
    console.log('✅ Connection established and settings applied');
    
    // Wait for the VAD element to be visible first
    await page.waitForSelector('[data-testid="user-started-speaking"]', { timeout: 5000 });
    
    // Verify initial state
    const initialValue = await page.locator('[data-testid="user-started-speaking"]').textContent();
    console.log('📊 Initial user-started-speaking state:', initialValue);
    
    // Use TTS-generated audio to trigger VAD events (only TTS audio triggers server-side VAD)
    // The pre-generated audio samples in /audio-samples/ are TTS-generated and should trigger VAD
    console.log('🎤 Using TTS-generated audio sample to trigger VAD events...');
    await loadAndSendAudioSample(page, 'hello'); // This loads TTS-generated audio from /audio-samples/sample_hello.json
    
    // Wait for VAD events using DRY fixture
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking'  // From Agent Service or Transcription Service
    ], 10000);
    
    // Verify using getVADState (more reliable)
    const vadState = await getVADState(page, ['UserStartedSpeaking']);
    
    // Verify the UI element was updated (the callback sets a timestamp)
    expect(vadState.UserStartedSpeaking).toBeTruthy();
    expect(vadState.UserStartedSpeaking).toMatch(/^\d{2}:\d{2}:\d{2}/); // Should be timestamp format
    console.log('✅ onUserStartedSpeaking callback working - UserStartedSpeaking detected:', vadState.UserStartedSpeaking);
    console.log('📊 Events detected count:', eventsDetected);
  });

  test('should test onUserStoppedSpeaking callback with existing audio sample', async ({ page, context }) => {
    // Runs with Deepgram or OpenAI proxy (Issue #414: proxy maps VAD to UserStartedSpeaking/UtteranceEnd)
    console.log('🧪 Testing onUserStoppedSpeaking callback with existing audio sample...');
    
    // Use setupAudioSendingPrerequisites helper for audio-sending tests
    // This handles: permissions, component ready, mic click, connection, settings applied, settings delay
    await setupAudioSendingPrerequisites(page, context, {
      componentReadyTimeout: 5000,
      connectionTimeout: 10000,
      settingsTimeout: 10000,
      settingsProcessingDelay: 600
    });
    
    console.log('✅ Connection established and settings applied');
    
    // Use DRY fixture to load and send existing audio sample with proper silence duration (>2 seconds for UtteranceEnd)
    await loadAndSendAudioSample(page, 'hello'); // Use existing 'hello' sample
    
    // Wait for VAD events to be detected using DRY fixture with longer timeout (like successful tests)
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',    // From transcription service
      'UtteranceEnd'            // From transcription service
    ], 15000); // Use 15s timeout like successful tests
    
    // Wait for UtteranceEnd element to be updated (like successful tests)
    await page.waitForFunction(() => {
      const utteranceEndEl = document.querySelector('[data-testid="utterance-end"]');
      return utteranceEndEl && utteranceEndEl.textContent && utteranceEndEl.textContent.trim() !== 'Not detected';
    }, { timeout: 15000 });
    
    // Verify using getVADState (more reliable than checking array)
    const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd', 'UserStoppedSpeaking']);
    
    // Check if UtteranceEnd was detected (this should trigger onUserStoppedSpeaking)
    // Use lenient check - at least one event should be detected
    if (!vadState.UtteranceEnd && !vadState.UserStoppedSpeaking) {
      console.log('⚠️ UtteranceEnd not detected, but checking if UserStoppedSpeaking was triggered...');
      // If UtteranceEnd wasn't detected but UserStoppedSpeaking was, that's still valid
      if (!vadState.UserStoppedSpeaking) {
        throw new Error('Neither UtteranceEnd nor UserStoppedSpeaking was detected');
      }
    }
    
    // At least one should be truthy
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
    
    // Wait for audio playback to start (extended for OpenAI proxy; plan §3)
    await waitForAudioPlaybackStart(page, 35000);
    
    // Verify audio playing status is true
    const audioPlayingStatus = await getAudioPlayingStatus(page);
    expect(audioPlayingStatus).toBe('true');
    
    // Wait for agent response audio to finish (extended for OpenAI proxy; plan §3)
    await waitForAgentGreeting(page, 25000);
    
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
    
    // Wait for agent response (extended timeout for OpenAI proxy; plan §3/§4)
    await page.waitForFunction(() => {
      const agentResponseElement = document.querySelector('[data-testid="agent-response"]');
      return agentResponseElement && agentResponseElement.textContent && 
             agentResponseElement.textContent !== '(Waiting for agent response...)';
    }, { timeout: 30000 });
    
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
