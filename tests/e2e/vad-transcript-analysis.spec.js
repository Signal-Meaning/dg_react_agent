/**
 * VAD Transcript Analysis Test
 * 
 * Tests VAD events and analyzes transcript responses (interim and final) 
 * to understand endpointing behavior with recorded audio samples.
 */

const { test, expect } = require('@playwright/test');
const SimpleVADHelpers = require('../utils/simple-vad-helpers');

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

  test('should analyze transcript responses and VAD events with recorded audio', async ({ page }) => {
    console.log('🧪 Testing VAD events and transcript analysis with recorded audio...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Set up transcript data capture by monitoring DOM changes
    const transcriptData = [];
    let lastTranscriptText = '';
    
    // Monitor the transcript element for changes
    const transcriptElement = page.locator('[data-testid="transcription"]');
    
    // Set up a polling mechanism to capture transcript changes
    const startTranscriptMonitoring = () => {
      return setInterval(async () => {
        try {
          const currentText = await transcriptElement.textContent();
          if (currentText && currentText !== lastTranscriptText && currentText !== '(Waiting for transcript...)') {
            lastTranscriptText = currentText;
            transcriptData.push({
              text: currentText,
              timestamp: Date.now(),
              isInterim: currentText.includes('(interim)') || currentText.includes('(partial)'),
              isFinal: currentText.includes('(final)') || (!currentText.includes('(interim)') && !currentText.includes('(partial)'))
            });
            console.log('📝 [Transcript] Captured from DOM:', {
              text: currentText,
              isInterim: currentText.includes('(interim)') || currentText.includes('(partial)'),
              isFinal: currentText.includes('(final)') || (!currentText.includes('(interim)') && !currentText.includes('(partial)'))
            });
          }
        } catch (error) {
          // Element might not be ready yet
        }
      }, 100); // Check every 100ms
    };
    
    const transcriptMonitor = startTranscriptMonitoring();
    
    // Load and play recorded audio sample
    console.log('🎤 Loading recorded audio sample...');
    await page.evaluate(async () => {
      const deepgramComponent = window.deepgramRef?.current;
      if (!deepgramComponent || !deepgramComponent.sendAudioData) {
        throw new Error('Deepgram component not available');
      }
      
      try {
        // Load the audio sample
        const response = await fetch('/audio-samples/sample_hello.json');
        if (!response.ok) {
          throw new Error(`Failed to load audio sample: ${response.status}`);
        }
        
        const sampleData = await response.json();
        console.log('📊 Sample metadata:', {
          phrase: sampleData.phrase,
          sampleRate: sampleData.metadata.sampleRate,
          totalDuration: sampleData.metadata.totalDuration,
          speechDuration: sampleData.metadata.speechDuration
        });
        
        // Convert base64 to ArrayBuffer
        const binaryString = atob(sampleData.audioData);
        const audioBuffer = new ArrayBuffer(binaryString.length);
        const audioView = new Uint8Array(audioBuffer);
        
        for (let i = 0; i < binaryString.length; i++) {
          audioView[i] = binaryString.charCodeAt(i);
        }
        
        console.log('🎤 Playing recorded audio sample...');
        deepgramComponent.sendAudioData(audioBuffer);
        
      } catch (error) {
        console.error('❌ Error loading audio sample:', error);
        throw error;
      }
    });
    
    // Wait for VAD events and transcripts
    console.log('⏳ Waiting for VAD events and transcripts...');
    const detectedVADEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',    // From transcription service
      'UtteranceEnd'      // From transcription service
    ], 10000);
    
    // Wait a bit more for any final transcripts
    await page.waitForTimeout(2000);
    
    // Stop monitoring
    clearInterval(transcriptMonitor);
    
    // Analyze the results
    console.log('\n📊 === TRANSCRIPT ANALYSIS ===');
    console.log('📝 Total transcripts received:', transcriptData.length);
    
    if (transcriptData.length > 0) {
      console.log('📝 Transcript breakdown:');
      transcriptData.forEach((transcript, index) => {
        console.log(`  ${index + 1}. ${transcript.isFinal ? 'FINAL' : 'INTERIM'} | "${transcript.text}"`);
      });
      
      // Check for final vs interim transcripts
      const finalTranscripts = transcriptData.filter(t => t.isFinal);
      const interimTranscripts = transcriptData.filter(t => t.isInterim);
      
      console.log('📝 Final transcripts:', finalTranscripts.length);
      console.log('📝 Interim transcripts:', interimTranscripts.length);
      
      if (finalTranscripts.length > 0) {
        console.log('✅ Final transcripts detected - these should trigger UtteranceEnd');
      } else {
        console.log('⚠️ No final transcripts detected - only interim results received');
      }
    } else {
      console.log('⚠️ No transcripts received - check transcription service connection');
    }
    
    console.log('\n📊 === VAD EVENT ANALYSIS ===');
    console.log('🎯 Total VAD events:', detectedVADEvents.length);
    console.log('🎯 VAD events by type:', detectedVADEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {}));
    
    // Verify we got at least SpeechStarted
    const hasSpeechStarted = detectedVADEvents.some(event => event.type === 'SpeechStarted');
    const hasUtteranceEnd = detectedVADEvents.some(event => event.type === 'UtteranceEnd');
    
    expect(hasSpeechStarted).toBe(true);
    console.log('✅ SpeechStarted detected:', hasSpeechStarted);
    console.log('✅ UtteranceEnd detected:', hasUtteranceEnd);
    
    if (!hasUtteranceEnd) {
      console.log('💡 Analysis: UtteranceEnd not detected - likely because:');
      console.log('   1. No speech_final transcripts received');
      console.log('   2. Audio sample lacks sufficient silence at the end');
      console.log('   3. utterance_end_ms setting too high for the audio pattern');
    }
  });

  test('should analyze different audio samples for transcript patterns', async ({ page }) => {
    console.log('🧪 Testing transcript patterns with different audio samples...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Test with different samples
    const samples = [
      { file: 'sample_hello.json', name: 'Short Hello' },
      { file: 'sample_hello_there.json', name: 'Medium Hello There' },
      { file: 'sample_long_pause_response.json', name: 'Long Pause Response' }
    ];
    
    for (const sample of samples) {
      console.log(`\n🎤 Testing with: ${sample.name} (${sample.file})`);
      
      // Clear previous data
      const transcriptData = [];
      
      // Set up transcript capture for this sample
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
      
      // Load and play sample
      await page.evaluate(async (sampleFile) => {
        const deepgramComponent = window.deepgramRef?.current;
        if (!deepgramComponent || !deepgramComponent.sendAudioData) {
          throw new Error('Deepgram component not available');
        }
        
        try {
          const response = await fetch(`/audio-samples/${sampleFile}`);
          if (!response.ok) {
            throw new Error(`Failed to load audio sample: ${response.status}`);
          }
          
          const sampleData = await response.json();
          console.log(`📊 ${sampleFile} metadata:`, {
            phrase: sampleData.phrase,
            totalDuration: sampleData.metadata.totalDuration,
            speechDuration: sampleData.metadata.speechDuration
          });
          
          // Convert base64 to ArrayBuffer
          const binaryString = atob(sampleData.audioData);
          const audioBuffer = new ArrayBuffer(binaryString.length);
          const audioView = new Uint8Array(audioBuffer);
          
          for (let i = 0; i < binaryString.length; i++) {
            audioView[i] = binaryString.charCodeAt(i);
          }
          
          deepgramComponent.sendAudioData(audioBuffer);
          
        } catch (error) {
          console.error('❌ Error loading audio sample:', error);
          throw error;
        }
      }, sample.file);
      
      // Wait for VAD events
      const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
        'SpeechStarted',
        'UtteranceEnd'
      ], 8000);
      
      // Wait for any final transcripts
      await page.waitForTimeout(2000);
      
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
      
      // Wait between samples
      await page.waitForTimeout(1000);
    }
    
    console.log('\n✅ Multiple audio samples analyzed successfully');
  });

  test('should test utterance_end_ms configuration impact', async ({ page }) => {
    console.log('🧪 Testing utterance_end_ms configuration impact...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Check current utterance_end_ms setting
    const currentSetting = await page.evaluate(() => {
      // Access the component's transcription options
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.getState) {
        const state = deepgramComponent.getState();
        return state.transcriptionOptions?.utterance_end_ms || 'not found';
      }
      return 'not accessible';
    });
    
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
    
    await page.evaluate(async () => {
      const deepgramComponent = window.deepgramRef?.current;
      if (!deepgramComponent || !deepgramComponent.sendAudioData) {
        throw new Error('Deepgram component not available');
      }
      
      try {
        const response = await fetch('/audio-samples/sample_long_pause_response.json');
        if (!response.ok) {
          throw new Error(`Failed to load audio sample: ${response.status}`);
        }
        
        const sampleData = await response.json();
        console.log('📊 Long pause sample metadata:', {
          phrase: sampleData.phrase,
          totalDuration: sampleData.metadata.totalDuration,
          speechDuration: sampleData.metadata.speechDuration,
          silenceDuration: sampleData.metadata.totalDuration - sampleData.metadata.speechDuration
        });
        
        // Convert base64 to ArrayBuffer
        const binaryString = atob(sampleData.audioData);
        const audioBuffer = new ArrayBuffer(binaryString.length);
        const audioView = new Uint8Array(audioBuffer);
        
        for (let i = 0; i < binaryString.length; i++) {
          audioView[i] = binaryString.charCodeAt(i);
        }
        
        deepgramComponent.sendAudioData(audioBuffer);
        
      } catch (error) {
        console.error('❌ Error loading audio sample:', error);
        throw error;
      }
    });
    
    // Wait longer for UtteranceEnd with long pause sample
    console.log('⏳ Waiting for UtteranceEnd with extended timeout...');
    const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',
      'UtteranceEnd'
    ], 15000);
    
    // Wait for final transcripts
    await page.waitForTimeout(3000);
    
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
