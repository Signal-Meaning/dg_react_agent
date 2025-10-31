/**
 * Simple test for Idle Timeout During Agent Speech
 * 
 * This test focuses on the core issue: idle timeout should not fire
 * when idle timeout resets are disabled during agent activity.
 * 
 * IMPORTANT: This test requires real Deepgram APIs to work properly.
 * The idle timeout fix only triggers with real agent messages, not mock responses.
 * See issue #99 for details on mock vs real API testing limitations.
 */

import { test, expect } from '@playwright/test';
import {
  SELECTORS, waitForConnection, sendTextMessage
} from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks';

test.describe('Simple Idle Timeout Test', () => {
  
  test('should not timeout during agent response (simplified)', async ({ page }) => {
    // Skip test if real APIs are not available
    // This test requires real Deepgram APIs because the idle timeout fix
    // only triggers with real agent messages, not mock responses
    const hasRealAPI = process.env.VITE_DEEPGRAM_API_KEY && 
                      process.env.VITE_DEEPGRAM_API_KEY !== 'your-deepgram-api-key-here' &&
                      process.env.VITE_DEEPGRAM_API_KEY !== 'your_actual_deepgram_api_key_here' &&
                      !process.env.VITE_DEEPGRAM_API_KEY.startsWith('test-') &&
                      process.env.VITE_DEEPGRAM_API_KEY.length >= 20;
    
    if (!hasRealAPI) {
      test.skip('Skipping test - requires real Deepgram API key. See issue #99 for details.');
      return;
    }
    
    console.log('🧪 Testing simplified idle timeout behavior...');
    
    // Capture console logs to see timeout events
    const timeoutLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Idle timeout reached') || text.includes('closing agent connection')) {
        timeoutLogs.push({ timestamp: Date.now(), text });
      }
    });
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Send a message
    console.log('Sending message...');
    await sendTextMessage(page, "Tell me about machine learning.");
    
    // Wait for response to start
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse?.textContent && agentResponse.textContent.length > 10;
    }, { timeout: 15000 });
    
    console.log('Agent response started, waiting for audio to finish...');
    
    // Wait for audio to finish playing
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]');
      return audioPlaying?.textContent === 'false';
    }, { timeout: 30000 });
    
    console.log('Audio finished playing, monitoring connection for 15 seconds...');
    
    // Monitor connection for 15 seconds
    const startTime = Date.now();
    for (let i = 0; i < 7; i++) {
      await page.waitForTimeout(2000);
      
      const status = await page.locator(SELECTORS.connectionStatus).textContent();
      const timeSinceStart = Date.now() - startTime;
      
      console.log(`+${timeSinceStart}ms: Connection = ${status}`);
      
      if (status === 'closed') {
        console.log(`❌ Connection dropped at +${timeSinceStart}ms!`);
        break;
      }
    }
    
    const finalStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final connection status: ${finalStatus}`);
    
    // Log any timeout events
    console.log('\n📊 TIMEOUT EVENTS:');
    timeoutLogs.forEach((log, i) => {
      const timeSinceStart = log.timestamp - startTime;
      console.log(`  ${i + 1}. +${timeSinceStart}ms: ${log.text}`);
    });
    
    // The connection should remain active
    expect(finalStatus).toBe('connected');
    console.log('✅ Connection remained stable during agent response');
  });
});
