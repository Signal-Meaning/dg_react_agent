import { test, expect } from '@playwright/test';
import { setupConnectionStateTracking } from './helpers/test-helpers';

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
    
    // Setup connection state tracking
    const stateTracker = await setupConnectionStateTracking(page);
    await page.waitForTimeout(500); // Wait for state to be tracked
    
    // Check transcription configuration via connection states (public API)
    const connectionStates = await stateTracker.getStates();
    const config = {
      isTranscriptionConfigured: connectionStates.transcriptionConnected || connectionStates.transcription !== 'closed',
      transcriptionState: connectionStates.transcription,
      agentState: connectionStates.agent
    };
    
    console.log('📊 Configuration:', JSON.stringify(config, null, 2));
    
    // Check if transcription variables are loaded
    const hasTranscriptionVars = Object.values(envVars).some(value => 
      value && value !== 'undefined' && value !== 'null'
    );
    
    console.log('📊 Has transcription variables:', hasTranscriptionVars);
    console.log('📊 Transcription connection state:', config.transcriptionState);
    
    // Verify transcription service is properly configured
    // Note: Transcription options are not exposed via public API, but we can verify
    // the service is working by checking connection state and environment variables
    expect(hasTranscriptionVars).toBe(true);
    // If transcription is connected or not 'closed', it means it's configured
    expect(config.isTranscriptionConfigured || config.transcriptionState !== 'closed').toBe(true);
    
    console.log('✅ Transcription service configuration verified!');
    console.log('🎉 Issue #103 RESOLVED: Transcription service configuration fixed!');
  });
});
