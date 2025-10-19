const { test, expect } = require('@playwright/test');
const SimpleVADHelpers = require('../utils/simple-vad-helpers');

test.describe('VAD Events Verification', () => {
  test('should verify VAD events work with transcription service configured', async ({ page }) => {
    console.log('🔍 Testing VAD events with configured transcription service...');
    
    // Navigate to test app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to be ready
    await page.waitForTimeout(3000);
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Test with recorded audio to verify VAD events work
    console.log('🎤 Testing VAD events with recorded audio...');
    
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
    
    // Wait for VAD events
    console.log('⏳ Waiting for VAD events...');
    const detectedVADEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',
      'UtteranceEnd'
    ], 15000);
    
    // Wait for any transcript processing
    await page.waitForTimeout(3000);
    
    // Check final transcript state
    const finalTranscriptText = await page.locator('[data-testid="transcription"]').textContent();
    console.log('🔍 Final transcript element content:', finalTranscriptText);
    
    // Analyze the results
    console.log('\n📊 === VAD EVENTS VERIFICATION RESULTS ===');
    console.log('🎯 VAD Events detected:', detectedVADEvents.length);
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
    console.log('📝 Final transcript text:', finalTranscriptText);
    
    if (hasUtteranceEnd) {
      console.log('🎉 SUCCESS: Both SpeechStarted and UtteranceEnd events are working!');
      console.log('✅ Issue #95 RESOLVED: VAD endpointing is now working!');
    } else {
      console.log('⚠️ SpeechStarted working but UtteranceEnd still not detected');
      console.log('💡 May need to adjust utterance_end_ms or audio sample silence patterns');
    }
  });
});
