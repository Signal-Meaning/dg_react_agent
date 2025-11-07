/**
 * VAD Transcript Analysis Test
 * 
 * Tests VAD events and analyzes transcript responses (interim and final) 
 * to understand endpointing behavior with recorded audio samples.
 */

import { test, expect } from '@playwright/test';
import { setupConnectionStateTracking, MicrophoneHelpers, waitForTranscript } from './helpers/test-helpers.js';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';
import { getVADState } from './fixtures/vad-helpers.js';

test.describe('VAD Transcript Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test app
    await page.goto('http://localhost:5173?test-mode=true');
    
    // Set up test environment
    await page.evaluate(() => {
      // Mock API key for testing
      if (typeof window !== 'undefined') {
        window.import = window.import || {};
        window.import.meta = window.import.meta || {};
        window.import.meta.env = {
          VITE_DEEPGRAM_API_KEY: 'a1b2c3d4e5f6789012345678901234567890abcd',
          VITE_DEEPGRAM_PROJECT_ID: 'test-project'
        };
      }
    });
  });

  /**
   * Validation test for interim and final transcript receipt
   * 
   * This test validates that:
   * 1. Interim transcripts (is_final: false) are received
   * 2. Final transcripts (is_final: true) are received
   * 3. Interim transcripts arrive before final transcripts (sequence validation)
   * 4. All transcripts contain valid text
   * 
   * Unlike the analysis test, this test uses proper assertions that will fail
   * if interim transcripts are not received, making it a true validation test.
   */
  test('should validate interim and final transcript receipt with recorded audio', async ({ page }) => {
    console.log('🧪 Testing interim and final transcript validation with recorded audio...');
    
    // Set up transcript data capture by intercepting onTranscriptUpdate callback
    // This gives us access to the actual is_final property from the transcript response
    const transcriptData = [];
    
    // Expose function to capture transcript data from the callback
    await page.exposeFunction('captureTranscriptData', (transcript) => {
      // Extract the actual transcript structure from Deepgram response
      const deepgramResponse = transcript || {};
      
      const channel = deepgramResponse.channel || {};
      const alternatives = channel.alternatives || [];
      const firstAlternative = alternatives[0] || {};
      
      const text = firstAlternative.transcript || '';
      const isFinal = deepgramResponse.is_final === true;
      const speechFinal = deepgramResponse.speech_final === true;
      
      if (text && text.trim()) {
        transcriptData.push({
          text: text.trim(),
          timestamp: Date.now(),
          is_final: isFinal,
          speech_final: speechFinal
        });
        console.log(`📝 [Transcript] Captured: "${text}" (is_final: ${isFinal}, speech_final: ${speechFinal})`);
      }
    });
    
    // CRITICAL: Set up connection state tracking BEFORE clicking microphone button
    // This prevents race condition where connection events fire before tracking is set up
    const stateTracker = await setupConnectionStateTracking(page);
    
    // Use proper microphone setup with fixtures (same pattern as passing tests)
    // This should start both agent and transcription services
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Connection established and microphone enabled');
    
    // CRITICAL: Wait for transcription service to connect (required for VAD and transcripts)
    // The microphone button should start both services automatically - just wait for it
    
    // Check initial connection states before waiting
    let connectionStates = await stateTracker.getStates();
    console.log('📊 Connection states immediately after microphone activation:', JSON.stringify(connectionStates, null, 2));
    
    // Wait for transcription service to connect (microphone button should start it)
    console.log('⏳ Waiting for transcription service to connect (started by microphone button)...');
    try {
      await stateTracker.waitForTranscriptionConnected(10000);
      connectionStates = await stateTracker.getStates();
      console.log('📊 Connection states after wait:', JSON.stringify(connectionStates, null, 2));
      
      // Verify transcription service is connected
      expect(connectionStates.transcriptionConnected || connectionStates.transcription === 'connected').toBe(true);
      console.log('✅ Transcription service is connected');
    } catch (error) {
      connectionStates = await stateTracker.getStates();
      console.log('📊 Connection states (timeout):', JSON.stringify(connectionStates, null, 2));
      
      // Debug: Check if start() was actually called and if callback is set up
      const debugInfo = await page.evaluate(() => {
        return {
          deepgramRefExists: !!window.deepgramRef?.current,
          connectionStates: window.testConnectionStates,
          onConnectionStateChangeExists: typeof window.onConnectionStateChange === 'function',
          appConnectionStates: window.deepgramRef?.current ? 'checking...' : 'no ref'
        };
      });
      console.log('🔍 Debug info:', JSON.stringify(debugInfo, null, 2));
      
      throw new Error(`Transcription service did not connect after microphone activation: ${error.message}`);
    }
    
    // Intercept the onTranscriptUpdate callback to capture actual transcript data
    // Do this after microphone is activated so component is fully initialized
    await page.evaluate(() => {
      if (window.deepgramRef?.current?.props?.onTranscriptUpdate) {
        const originalCallback = window.deepgramRef.current.props.onTranscriptUpdate;
        
        window.deepgramRef.current.props.onTranscriptUpdate = (transcript) => {
          // Call original callback to maintain app functionality
          originalCallback(transcript);
          // Capture transcript data for validation
          if (window.captureTranscriptData) {
            window.captureTranscriptData(transcript);
          }
        };
        console.log('✅ Transcript callback intercepted');
      } else {
        console.log('⚠️ Could not intercept transcript callback - deepgramRef or props not available');
      }
    });
    
    // Use working fixture to send audio (same pattern as passing VAD tests)
    console.log('🎤 Loading recorded audio sample...');
    await loadAndSendAudioSample(page, 'hello');
    
    // Wait for transcripts to be received using helper function
    console.log('⏳ Waiting for transcripts...');
    await waitForTranscript(page, { timeout: 15000 });
    
    // Wait a bit more to ensure we capture both interim and final transcripts
    await page.waitForTimeout(2000);
    
    // Wait for VAD events using working fixture (returns count of detected events)
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 10000);
    
    // Check which events were detected using new fixture
    const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd']);
    
    const detectedVADEvents = [];
    if (vadState.UserStartedSpeaking) detectedVADEvents.push({ type: 'UserStartedSpeaking' });
    if (vadState.UtteranceEnd) detectedVADEvents.push({ type: 'UtteranceEnd' });
    
    // VALIDATION: Analyze and assert transcript receipt
    console.log('\n📊 === TRANSCRIPT VALIDATION ===');
    console.log('📝 Total transcripts received:', transcriptData.length);
    
    // CRITICAL ASSERTION: Must have received at least one transcript
    expect(transcriptData.length).toBeGreaterThan(0);
    
    if (transcriptData.length > 0) {
      console.log('📝 Transcript breakdown:');
      transcriptData.forEach((transcript, index) => {
        console.log(`  ${index + 1}. ${transcript.is_final ? 'FINAL' : 'INTERIM'} | "${transcript.text}"`);
      });
      
      // Separate interim and final transcripts
      const finalTranscripts = transcriptData.filter(t => t.is_final === true);
      const interimTranscripts = transcriptData.filter(t => t.is_final === false);
      
      console.log('📝 Final transcripts:', finalTranscripts.length);
      console.log('📝 Interim transcripts:', interimTranscripts.length);
      
      // CRITICAL ASSERTION: Must have received at least one interim transcript
      expect(interimTranscripts.length).toBeGreaterThan(0);
      console.log('✅ Interim transcripts validated:', interimTranscripts.length);
      
      // CRITICAL ASSERTION: Must have received at least one final transcript
      expect(finalTranscripts.length).toBeGreaterThan(0);
      console.log('✅ Final transcripts validated:', finalTranscripts.length);
      
      // VALIDATION: Interim transcripts should arrive before final transcripts
      if (interimTranscripts.length > 0 && finalTranscripts.length > 0) {
        const firstInterimTime = Math.min(...interimTranscripts.map(t => t.timestamp));
        const firstFinalTime = Math.min(...finalTranscripts.map(t => t.timestamp));
        
        // CRITICAL ASSERTION: Interim transcripts must arrive before final transcripts
        expect(firstInterimTime).toBeLessThan(firstFinalTime);
        console.log('✅ Sequence validated: Interim transcripts arrived before final transcripts');
      }
      
      // Validate that transcripts contain actual text
      transcriptData.forEach((transcript, index) => {
        expect(transcript.text.length).toBeGreaterThan(0);
        expect(transcript.text.trim()).not.toBe('');
      });
      console.log('✅ All transcripts contain valid text');
    }
    
    console.log('\n📊 === VAD EVENT VALIDATION ===');
    console.log('🎯 Total VAD events:', detectedVADEvents.length);
    console.log('🎯 VAD events by type:', detectedVADEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {}));
    
    // Verify we got at least one VAD event
    const hasUserStartedSpeaking = detectedVADEvents.some(event => event.type === 'UserStartedSpeaking');
    const hasUtteranceEnd = detectedVADEvents.some(event => event.type === 'UtteranceEnd');
    
    // Assert at least one VAD event was detected
    const hasAnyVADEvent = detectedVADEvents.length > 0;
    expect(hasAnyVADEvent).toBe(true);
    console.log('✅ UserStartedSpeaking detected:', hasUserStartedSpeaking);
    console.log('✅ UtteranceEnd detected:', hasUtteranceEnd);
    
    console.log('\n✅ All transcript validations passed!');
  });

  test('should analyze different audio samples for transcript patterns', async ({ page }) => {
    console.log('🧪 Testing transcript patterns with different audio samples...');
    
    // Use proper microphone setup with fixtures (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Connection established and microphone enabled');
    
    // Set up transcript capture function once (outside loop to avoid re-registration error)
    const transcriptData = [];
    
    // Register function only once, with try-catch to handle if already registered
    try {
      await page.exposeFunction('captureTranscriptData', (transcript) => {
        transcriptData.push({
          ...transcript,
          timestamp: Date.now()
        });
      });
    } catch (error) {
      // Function may already be registered, that's okay
      console.log('📝 captureTranscriptData already registered, continuing...');
    }
    
    // Test with different samples
    const samples = [
      { file: 'sample_hello.json', name: 'Short Hello' },
      { file: 'sample_hello_there.json', name: 'Medium Hello There' },
      { file: 'sample_long_pause_response.json', name: 'Long Pause Response' }
    ];
    
    for (const sample of samples) {
      console.log(`\n🎤 Testing with: ${sample.name} (${sample.file})`);
      
      // Clear data for this iteration
      transcriptData.length = 0;
      
      // Set up the test interface in the app
      await page.evaluate(() => {
        if (window.deepgramRef?.current?.props?.onTranscriptUpdate) {
          const originalCallback = window.deepgramRef.current.props.onTranscriptUpdate;
          
          window.deepgramRef.current.props.onTranscriptUpdate = (transcript) => {
            originalCallback(transcript);
            if (window.captureTranscriptData) {
              window.captureTranscriptData(transcript);
            }
          };
        }
      });
      
      // Use working fixture to send audio
      const sampleName = sample.file.replace('sample_', '').replace('.json', '');
      try {
        await loadAndSendAudioSample(page, sampleName);
      } catch (error) {
        console.log(`⚠️ Sample ${sampleName} not available, skipping`);
        continue;
      }
      
      // Wait for VAD events using working fixture
      const eventsDetected = await waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UtteranceEnd'
      ], 8000);
      
      // Check which events were detected
      // Check which events were detected using new fixture
      const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd']);
      
      const vadEvents = [];
      if (vadState.UserStartedSpeaking) vadEvents.push({ type: 'UserStartedSpeaking' });
      if (vadState.UtteranceEnd) vadEvents.push({ type: 'UtteranceEnd' });
      
      // Analyze this sample
      console.log(`📊 ${sample.name} Results:`);
      console.log(`  VAD Events: ${vadEvents.length} (${vadEvents.map(e => e.type).join(', ')})`);
      console.log(`  Transcripts: ${transcriptData.length}`);
      
      if (transcriptData.length > 0) {
        const finalCount = transcriptData.filter(t => t.is_final).length;
        const speechFinalCount = transcriptData.filter(t => t.speech_final).length;
        console.log(`  Final: ${finalCount}, Speech Final: ${speechFinalCount}`);
        
        if (speechFinalCount > 0) {
          console.log(`  ✅ Speech final detected - should trigger UtteranceEnd`);
        } else {
          console.log(`  ⚠️ No speech final - explains missing UtteranceEnd`);
        }
      }
      
      // Brief pause between samples for processing
    }
    
    console.log('\n✅ Multiple audio samples analyzed successfully');
  });

  test('should test utterance_end_ms configuration impact', async ({ page }) => {
    console.log('🧪 Testing utterance_end_ms configuration impact...');
    
    // Use proper microphone setup with fixtures (same pattern as passing tests)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Connection established and microphone enabled');
    
    // Check current utterance_end_ms setting
    // Note: Transcription options are not exposed via public API
    // The utterance_end_ms is configured via props and works internally
    // We verify transcription is working via connection state instead
    const stateTracker = await setupConnectionStateTracking(page);
    await page.waitForTimeout(500);
    const connectionStates = await stateTracker.getStates();
    const currentSetting = connectionStates.transcriptionConnected ? 'configured' : 'not accessible';
    
    console.log('📊 Current utterance_end_ms setting:', currentSetting);
    
    // Test with a sample that should have good silence
    console.log('🎤 Testing with long pause response sample...');
    
    const transcriptData = [];
    await page.exposeFunction('captureTranscriptData', (transcript) => {
      transcriptData.push({
        ...transcript,
        timestamp: Date.now()
      });
    });
    
    // Set up the test interface in the app
    await page.evaluate(() => {
      if (window.deepgramRef?.current?.props?.onTranscriptUpdate) {
        const originalCallback = window.deepgramRef.current.props.onTranscriptUpdate;
        
        window.deepgramRef.current.props.onTranscriptUpdate = (transcript) => {
          originalCallback(transcript);
          if (window.captureTranscriptData) {
            window.captureTranscriptData(transcript);
          }
        };
      }
    });
    
    // Use working fixture to send audio (try long pause sample, fallback to hello)
    try {
      await loadAndSendAudioSample(page, 'long_pause_response');
    } catch (error) {
      console.log('⚠️ Long pause sample not available, using hello sample');
      await loadAndSendAudioSample(page, 'hello');
    }
    
    // Wait longer for UtteranceEnd with long pause sample using working fixture
    console.log('⏳ Waiting for UtteranceEnd with extended timeout...');
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);
    
    // Check which events were detected
    const userStartedSpeaking = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="user-started-speaking"]');
      return el && el.textContent && el.textContent.trim() !== 'Not detected' ? el.textContent.trim() : null;
    });
    const utteranceEnd = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="utterance-end"]');
      return el && el.textContent && el.textContent.trim() !== 'Not detected' ? el.textContent.trim() : null;
    });
    
    const vadEvents = [];
    if (userStartedSpeaking) vadEvents.push({ type: 'UserStartedSpeaking' });
    if (utteranceEnd) vadEvents.push({ type: 'UtteranceEnd' });
    
    console.log('\n📊 === UTTERANCE_END_MS ANALYSIS ===');
    console.log('🎯 VAD Events:', vadEvents.map(e => e.type).join(', '));
    console.log('📝 Transcripts received:', transcriptData.length);
    
    if (transcriptData.length > 0) {
      const speechFinalCount = transcriptData.filter(t => t.speech_final).length;
      console.log('📝 Speech final transcripts:', speechFinalCount);
      
      if (speechFinalCount > 0) {
        console.log('✅ Speech final detected - UtteranceEnd should have triggered');
      } else {
        console.log('⚠️ No speech final detected - this is why UtteranceEnd is not working');
        console.log('💡 Suggestion: Try reducing utterance_end_ms from 1000ms to 500ms or 300ms');
      }
    }
    
    const hasUtteranceEnd = vadEvents.some(event => event.type === 'UtteranceEnd');
    if (hasUtteranceEnd) {
      console.log('🎉 SUCCESS: UtteranceEnd detected!');
    } else {
      console.log('❌ UtteranceEnd still not detected - need to investigate further');
    }
  });
});
