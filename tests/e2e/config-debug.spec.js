const { test, expect } = require('@playwright/test');

test.describe('Configuration Debug', () => {
  test('should check environment variables and configuration', async ({ page }) => {
    console.log('🔍 Checking environment variables and configuration...');
    
    await page.goto('http://localhost:5173?test-mode=true');
    
    // Set up test environment
    await page.evaluate(() => {
      if (typeof window !== 'undefined') {
        window.import = window.import || {};
        window.import.meta = window.import.meta || {};
        window.import.meta.env = {
          VITE_DEEPGRAM_API_KEY: 'a1b2c3d4e5f6789012345678901234567890abcd',
          VITE_DEEPGRAM_PROJECT_ID: 'test-project'
        };
      }
    });
    
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
    
    expect(true).toBe(true);
  });
});
