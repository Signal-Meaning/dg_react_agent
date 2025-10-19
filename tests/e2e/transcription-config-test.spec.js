const { test, expect } = require('@playwright/test');

test.describe('Transcription Configuration Test', () => {
  test('should verify transcription service is properly configured', async ({ page }) => {
    console.log('🔍 Testing transcription service configuration...');
    
    // Navigate to test app
    await page.goto('http://localhost:5173');
    
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
        VITE_TRANSCRIPTION_INTERIM_RESULTS: import.meta.env.VITE_TRANSCRIPTION_INTERIM_RESULTS,
        VITE_TRANSCRIPTION_VAD_EVENTS: import.meta.env.VITE_TRANSCRIPTION_VAD_EVENTS,
        VITE_TRANSCRIPTION_UTTERANCE_END_MS: import.meta.env.VITE_TRANSCRIPTION_UTTERANCE_END_MS
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
          transcriptionManagerExists: !!deepgramComponent.transcriptionManagerRef?.current,
          connectionStates: deepgramComponent.getConnectionStates ? deepgramComponent.getConnectionStates() : null
        };
      }
      return null;
    });
    
    console.log('📊 Configuration:', JSON.stringify(config, null, 2));
    
    // Check if transcription variables are loaded
    const hasTranscriptionVars = Object.values(envVars).some(value => 
      value && value !== 'undefined' && value !== 'null'
    );
    
    console.log('📊 Has transcription variables:', hasTranscriptionVars);
    console.log('📊 isTranscriptionConfigured:', config?.isTranscriptionConfigured);
    
    // Verify transcription service is properly configured
    expect(hasTranscriptionVars).toBe(true);
    expect(config.isTranscriptionConfigured).toBe(true);
    expect(config.transcriptionManagerExists).toBe(true);
    expect(config.transcriptionOptions).toBeDefined();
    expect(config.transcriptionOptions.interim_results).toBe(true);
    expect(config.transcriptionOptions.vad_events).toBe(true);
    expect(config.transcriptionOptions.utterance_end_ms).toBe(1000);
    
    console.log('✅ Transcription service configuration verified!');
    console.log('🎉 Issue #103 RESOLVED: Transcription service configuration fixed!');
  });
});
