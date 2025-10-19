/**
 * VAD Transcript Simple Test
 * 
 * Simple test to capture transcript responses (interim and final) 
 * to understand endpointing behavior with recorded audio samples.
 */

const { test, expect } = require('@playwright/test');
const SimpleVADHelpers = require('../utils/simple-vad-helpers');

test.describe('VAD Transcript Simple', () => {
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

  test('should capture transcript responses and analyze endpointing', async ({ page }) => {
    console.log('🧪 Testing transcript capture and endpointing analysis...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Check transcription configuration
    console.log('🔍 Checking transcription configuration...');
    const transcriptionConfig = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.getState) {
        const state = deepgramComponent.getState();
        return {
          transcriptionOptions: state.transcriptionOptions,
          agentOptions: state.agentOptions,
          endpointConfig: state.endpointConfig
        };
      }
      return null;
    });
    
    console.log('📊 Transcription configuration:', JSON.stringify(transcriptionConfig, null, 2));
    
    // Check environment variables
    const envVars = await page.evaluate(() => {
      return {
        VITE_DEEPGRAM_API_KEY: import.meta.env.VITE_DEEPGRAM_API_KEY,
        VITE_TRANSCRIPTION_MODEL: import.meta.env.VITE_TRANSCRIPTION_MODEL,
        VITE_TRANSCRIPTION_INTERIM_RESULTS: import.meta.env.VITE_TRANSCRIPTION_INTERIM_RESULTS
      };
    });
    
    console.log('📊 Environment variables:', envVars);
    
    // Check if transcription service is configured
    const isTranscriptionConfigured = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.getState) {
        const state = deepgramComponent.getState();
        return {
          transcriptionOptions: state.transcriptionOptions,
          isTranscriptionConfigured: !!state.transcriptionOptions,
          transcriptionManagerExists: !!deepgramComponent.transcriptionManagerRef?.current
        };
      }
      return null;
    });
    
    console.log('📊 Transcription configuration status:', isTranscriptionConfigured);
    
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
    
    // Also set up console log monitoring to see what's happening
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[TRANSCRIPT]')) {
        console.log('📝 [Console] Transcript log:', text);
      }
    });
    
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
    await page.waitForTimeout(3000);
    
    // Stop monitoring
    clearInterval(transcriptMonitor);
    
    // Debug: Check what's actually in the transcript element
    const finalTranscriptText = await transcriptElement.textContent();
    console.log('🔍 Final transcript element content:', finalTranscriptText);
    
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
      console.log('   1. No final transcripts received (only interim)');
      console.log('   2. Audio sample lacks sufficient silence at the end');
      console.log('   3. utterance_end_ms setting too high for the audio pattern');
    }
  });
});
