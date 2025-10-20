/**
 * VAD Fresh Initialization Test
 * 
 * This test forces a fresh component initialization to see
 * if the VAD configuration is properly set up.
 */

import { test, expect } from '@playwright/test';
import { setupTestPage, simulateUserGesture } from './helpers/audio-mocks';

test.describe('VAD Fresh Initialization Test', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.CI) {
      test.skip(true, 'VAD tests require real Deepgram API connections - skipped in CI.');
      return;
    }
    
    await setupTestPage(page);
    
    // Enable test mode and set test API key
    await page.evaluate(() => {
      window.testMode = true;
      window.testApiKey = 'test-key';
      window.testProjectId = 'test-project';
      
      if (window.import && window.import.meta) {
        window.import.meta.env = {
          ...window.import.meta.env,
          VITE_DEEPGRAM_API_KEY: 'a1b2c3d4e5f6789012345678901234567890abcd',
          VITE_DEEPGRAM_PROJECT_ID: 'test-project'
        };
      }
    });
  });

  test('should show component initialization logs on fresh page load', async ({ page }) => {
    console.log('🔍 [FRESH] Starting fresh initialization test...');
    
    // Capture all console logs from the very beginning
    const consoleLogs = [];
    page.on('console', msg => {
      const logText = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(logText);
      // Log all console messages to see what's happening
      console.log('🔍 [CONSOLE]', logText);
    });
    
    // Navigate to a fresh page to force component initialization
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait a bit more for initialization to complete
    await page.waitForTimeout(3000);
    
    // Check for initialization logs
    const initLogs = consoleLogs.filter(log => 
      log.includes('INIT') || 
      log.includes('Initializing in') ||
      log.includes('Service configuration check') ||
      log.includes('VAD configuration check') ||
      log.includes('Creating WebSocketManager')
    );
    
    console.log('🔍 [FRESH] Initialization logs found:', initLogs.length);
    initLogs.forEach(log => console.log('  -', log));
    
    // Check if VAD events are enabled
    const vadConfigLogs = consoleLogs.filter(log => 
      log.includes('vad_events') ||
      log.includes('VAD params') ||
      log.includes('queryParams contains vad_events')
    );
    
    console.log('🔍 [FRESH] VAD configuration logs found:', vadConfigLogs.length);
    vadConfigLogs.forEach(log => console.log('  -', log));
    
    // The test passes if we can see any initialization logs
    expect(initLogs.length).toBeGreaterThan(0);
    
    console.log('🔍 [FRESH] Test completed - check logs above for initialization details');
  });
});
