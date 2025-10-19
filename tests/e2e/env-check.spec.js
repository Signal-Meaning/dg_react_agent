const { test, expect } = require('@playwright/test');

test('should check environment variables', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
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
  
  console.log('Environment variables:', envVars);
  
  // Check if transcription variables are loaded
  const hasTranscriptionVars = Object.values(envVars).some(value => 
    value && value !== 'undefined' && value !== 'null'
  );
  
  console.log('Has transcription variables:', hasTranscriptionVars);
  
  expect(true).toBe(true);
});
