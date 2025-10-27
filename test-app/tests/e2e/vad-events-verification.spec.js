import { test, expect } from '@playwright/test';
import SimpleVADHelpers from '../utils/simple-vad-helpers';

test.describe('VAD Events Verification', () => {
  test('should verify VAD events work with transcription service configured', async ({ page }) => {
    console.log('🔍 Testing VAD events with configured transcription service...');
    
    // Capture browser console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('TRANSCRIPTION') || text.includes('transcription') || text.includes('INIT') || text.includes('Service configuration')) {
        console.log(`[BROWSER] ${text}`);
      }
    });
    
    // Navigate to test app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to be ready
    await page.waitForTimeout(3000);
    
    // Debug mode is enabled in test-app configuration
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Wait for settings to be sent (critical for audio data transmission)
    console.log('⏳ Waiting for settings to be sent...');
    await page.waitForTimeout(2000); // Give time for settings to be sent and processed
    
    // Test with recorded audio to verify VAD events work
    console.log('🎤 Testing VAD events with recorded audio...');
    
    // Simple test to see if page.evaluate works at all
    const testResult = await page.evaluate(() => {
      console.log('🔍 Simple test - page.evaluate is working');
      return 'test-success';
    });
    console.log('📤 page.evaluate result:', testResult);
    
    // Now test component reference
    const componentInfo = await page.evaluate(() => {
      console.log('🔍 Checking component reference...');
      const deepgramComponent = window.deepgramRef?.current;
      return {
        hasRef: !!window.deepgramRef,
        hasCurrent: !!deepgramComponent,
        hasSendAudioData: !!(deepgramComponent?.sendAudioData),
        componentType: typeof deepgramComponent,
        hasStartMethod: !!(deepgramComponent?.start),
        hasToggleMicMethod: !!(deepgramComponent?.toggleMic),
        componentProps: deepgramComponent ? Object.keys(deepgramComponent) : []
      };
    });
    console.log('📤 Component info:', componentInfo);
    
    // Check component initialization logs
    console.log('🔍 Checking browser console for component initialization logs...');
    const consoleLogs = await page.evaluate(() => {
      // Get recent console logs (this is a simplified approach)
      return {
        hasConsoleLogs: typeof console !== 'undefined',
        windowKeys: Object.keys(window).filter(key => key.includes('deepgram') || key.includes('Deepgram'))
      };
    });
    console.log('🔍 Console info:', consoleLogs);
    
    // Now send audio data directly via sendAudioData
    if (componentInfo.hasSendAudioData) {
      console.log('🎤 Sending audio data via sendAudioData method...');
      
      // Load and send audio sample
      await page.evaluate(async () => {
        const deepgramComponent = window.deepgramRef?.current;
        
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
          
          console.log('🎤 Sending audio sample...');
          console.log('📊 Audio buffer details:', {
            bufferSize: audioBuffer.byteLength,
            bufferType: audioBuffer.constructor.name
          });
          
          console.log('📤 Calling sendAudioData...');
          const result = deepgramComponent.sendAudioData(audioBuffer);
          console.log('📤 sendAudioData completed, result:', result);
          
        } catch (error) {
          console.error('❌ Error loading/sending audio sample:', error);
          throw error;
        }
      });
      
      console.log('✅ Audio data sent successfully');
      
      // Check transcription service state after sending audio
      const transcriptionState = await page.evaluate(() => {
        const deepgramComponent = window.deepgramRef?.current;
        return {
          hasTranscriptionManager: !!deepgramComponent?.transcriptionManagerRef?.current,
          transcriptionState: deepgramComponent?.transcriptionManagerRef?.current?.getState?.(),
          transcriptionConnected: deepgramComponent?.transcriptionManagerRef?.current?.isConnected?.()
        };
      });
      console.log('🔧 Transcription service state:', transcriptionState);
      
    } else {
      console.log('❌ Cannot send audio data - sendAudioData method not available');
    }
    
    // Start monitoring transcripts (interim and final)
    console.log('📝 Starting transcript monitoring...');
    const transcriptData = [];
    let lastTranscriptText = '';
    
    const startTranscriptMonitoring = () => {
      return setInterval(async () => {
        try {
          const transcriptElement = page.locator('[data-testid="transcription"]');
          const currentText = await transcriptElement.textContent();
          if (currentText && currentText !== lastTranscriptText && currentText !== '(Waiting for transcript...)') {
            lastTranscriptText = currentText;
            transcriptData.push({
              text: currentText,
              timestamp: Date.now(),
              isInterim: currentText.includes('(interim)') || currentText.includes('(partial)'),
              isFinal: currentText.includes('(final)') || (!currentText.includes('(interim)') && !currentText.includes('(partial)'))
            });
            console.log('📝 [Transcript] Captured:', {
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
    
    // Wait for VAD events
    console.log('⏳ Waiting for VAD events...');
    const detectedVADEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'UserStartedSpeaking'
    ], 15000);
    
    // Wait for any transcript processing
    await page.waitForTimeout(3000);
    
    // Stop transcript monitoring
    clearInterval(transcriptMonitor);
    
    // Check final transcript state
    const finalTranscriptText = await page.locator('[data-testid="transcription"]').textContent();
    console.log('🔍 Final transcript element content:', finalTranscriptText);
    
    // Analyze transcript data
    const interimTranscripts = transcriptData.filter(t => t.isInterim);
    const finalTranscripts = transcriptData.filter(t => t.isFinal);
    
    // Analyze the results
    console.log('\n📊 === VAD EVENTS VERIFICATION RESULTS ===');
    console.log('🎯 VAD Events detected:', detectedVADEvents.length);
    console.log('🎯 VAD events by type:', detectedVADEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {}));
    
    console.log('\n📝 === TRANSCRIPT ANALYSIS ===');
    console.log('📝 Total transcripts captured:', transcriptData.length);
    console.log('📝 Interim transcripts:', interimTranscripts.length);
    console.log('📝 Final transcripts:', finalTranscripts.length);
    console.log('📝 Final transcript text:', finalTranscriptText);
    
    if (transcriptData.length > 0) {
      console.log('📝 Sample transcript data:', transcriptData.slice(0, 3));
    }
    
    // Verify we got at least UserStartedSpeaking
    const hasUserStartedSpeaking = detectedVADEvents.some(event => event.type === 'UserStartedSpeaking');
    const hasUtteranceEnd = detectedVADEvents.some(event => event.type === 'UtteranceEnd');
    const hasInterimTranscripts = interimTranscripts.length > 0;
    const hasFinalTranscripts = finalTranscripts.length > 0;
    
    expect(hasUserStartedSpeaking).toBe(true);
    console.log('\n✅ === VERIFICATION RESULTS ===');
    console.log('✅ UserStartedSpeaking detected:', hasUserStartedSpeaking);
    console.log('✅ UtteranceEnd detected:', hasUtteranceEnd);
    console.log('✅ Interim transcripts received:', hasInterimTranscripts);
    console.log('✅ Final transcripts received:', hasFinalTranscripts);
    
    if (hasUtteranceEnd && hasInterimTranscripts && hasFinalTranscripts) {
      console.log('🎉 SUCCESS: All VAD and transcript functionality working!');
      console.log('✅ Issue #95 RESOLVED: VAD endpointing is now working!');
    } else {
      console.log('⚠️ Partial functionality detected:');
      if (!hasUtteranceEnd) {
        console.log('  ❌ UtteranceEnd not detected - may need more silence in audio sample');
      }
      if (!hasInterimTranscripts) {
        console.log('  ❌ Interim transcripts not received - issue #103 still present');
      }
      if (!hasFinalTranscripts) {
        console.log('  ❌ Final transcripts not received - transcription may not be working');
      }
      console.log('📊 Current utterance_end_ms setting:', 1500);
    }
  });
});
