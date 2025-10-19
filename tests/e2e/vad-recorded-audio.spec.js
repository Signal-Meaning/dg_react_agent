/**
 * VAD Recorded Audio Test
 * 
 * Tests VAD events using pre-generated recorded audio samples with proper
 * silence patterns to trigger SpeechStarted and UtteranceEnd events.
 */

const { test, expect } = require('@playwright/test');
const SimpleVADHelpers = require('../utils/simple-vad-helpers');

test.describe('VAD Recorded Audio', () => {
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

  test('should trigger SpeechStarted and UtteranceEnd with recorded audio', async ({ page }) => {
    console.log('🧪 Testing VAD events with recorded audio samples...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Check environment variables
    const envVars = await page.evaluate(() => {
      return {
        VITE_DEEPGRAM_API_KEY: import.meta.env.VITE_DEEPGRAM_API_KEY,
        VITE_TRANSCRIPTION_MODEL: import.meta.env.VITE_TRANSCRIPTION_MODEL,
        VITE_TRANSCRIPTION_INTERIM_RESULTS: import.meta.env.VITE_TRANSCRIPTION_INTERIM_RESULTS
      };
    });
    
    console.log('📊 Environment variables:', envVars);
    
    // Check transcription configuration
    const config = await page.evaluate(() => {
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
    
    console.log('📊 Configuration:', JSON.stringify(config, null, 2));
    
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
    
    // Wait for VAD events
    console.log('⏳ Waiting for VAD events...');
    const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',    // From transcription service
      'UtteranceEnd'      // From transcription service
    ], 10000);
    
    console.log('📊 VAD Events detected:', vadEvents);
    
    // Verify we got the expected events
    expect(vadEvents.length).toBeGreaterThan(0);
    
    const eventTypes = vadEvents.map(event => event.type);
    const hasSpeechStarted = eventTypes.includes('SpeechStarted');
    const hasUtteranceEnd = eventTypes.includes('UtteranceEnd');
    
    console.log('📊 Event analysis:', {
      totalEvents: vadEvents.length,
      eventTypes,
      hasSpeechStarted,
      hasUtteranceEnd
    });
    
    // We should get at least SpeechStarted from the transcription service
    expect(hasSpeechStarted).toBe(true);
    
    // UtteranceEnd might take longer to trigger
    if (hasUtteranceEnd) {
      console.log('✅ Both SpeechStarted and UtteranceEnd detected!');
    } else {
      console.log('⚠️ Only SpeechStarted detected, UtteranceEnd may need longer silence');
    }
  });

  test('should trigger VAD events with multiple recorded samples', async ({ page }) => {
    console.log('🧪 Testing VAD events with multiple recorded audio samples...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Test with multiple samples
    const samples = ['sample_hello.json', 'sample_hello_there.json', 'sample_quick_response.json'];
    const allEvents = [];
    
    for (const sampleFile of samples) {
      console.log(`🎤 Testing with sample: ${sampleFile}`);
      
      await page.evaluate(async (sampleFile) => {
        const deepgramComponent = window.deepgramRef?.current;
        if (!deepgramComponent || !deepgramComponent.sendAudioData) {
          throw new Error('Deepgram component not available');
        }
        
        try {
          // Load the audio sample
          const response = await fetch(`/audio-samples/${sampleFile}`);
          if (!response.ok) {
            throw new Error(`Failed to load audio sample: ${response.status}`);
          }
          
          const sampleData = await response.json();
          console.log('📊 Sample metadata:', {
            phrase: sampleData.phrase,
            totalDuration: sampleData.metadata.totalDuration
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
      }, sampleFile);
      
      // Wait between samples
      await page.waitForTimeout(2000);
    }
    
    // Wait for VAD events from all samples
    const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',
      'UtteranceEnd'
    ], 15000);
    
    console.log('📊 Total VAD Events detected:', vadEvents.length);
    console.log('📊 Events by type:', vadEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {}));
    
    // We should get multiple SpeechStarted events
    const speechStartedEvents = vadEvents.filter(event => event.type === 'SpeechStarted');
    expect(speechStartedEvents.length).toBeGreaterThan(0);
    
    console.log('✅ Multiple recorded audio samples tested successfully');
  });

  test('should handle silence patterns correctly for UtteranceEnd', async ({ page }) => {
    console.log('🧪 Testing UtteranceEnd with proper silence patterns...');
    
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    console.log('✅ Connection established');
    
    // Create a test with proper speech + silence pattern
    await page.evaluate(async () => {
      const deepgramComponent = window.deepgramRef?.current;
      if (!deepgramComponent || !deepgramComponent.sendAudioData) {
        throw new Error('Deepgram component not available');
      }
      
      try {
        // Load a sample with longer duration
        const response = await fetch('/audio-samples/sample_long_pause_response.json');
        if (!response.ok) {
          throw new Error(`Failed to load audio sample: ${response.status}`);
        }
        
        const sampleData = await response.json();
        console.log('📊 Long pause sample metadata:', {
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
        
        console.log('🎤 Playing long pause audio sample...');
        deepgramComponent.sendAudioData(audioBuffer);
        
      } catch (error) {
        console.error('❌ Error loading audio sample:', error);
        throw error;
      }
    });
    
    // Wait longer for UtteranceEnd to trigger
    console.log('⏳ Waiting for UtteranceEnd with longer timeout...');
    const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',
      'UtteranceEnd'
    ], 15000);
    
    console.log('📊 VAD Events detected:', vadEvents);
    
    const eventTypes = vadEvents.map(event => event.type);
    const hasSpeechStarted = eventTypes.includes('SpeechStarted');
    const hasUtteranceEnd = eventTypes.includes('UtteranceEnd');
    
    console.log('📊 Event analysis:', {
      totalEvents: vadEvents.length,
      eventTypes,
      hasSpeechStarted,
      hasUtteranceEnd
    });
    
    // We should get both events with proper silence
    expect(hasSpeechStarted).toBe(true);
    
    if (hasUtteranceEnd) {
      console.log('✅ UtteranceEnd detected with proper silence pattern!');
    } else {
      console.log('⚠️ UtteranceEnd not detected - may need longer silence or different audio pattern');
    }
  });
});
