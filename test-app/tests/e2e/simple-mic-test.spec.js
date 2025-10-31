/**
 * Simple Microphone State Test - FIXED
 * 
 * This test focuses on the specific issues:
 * 1. Closed connection should disable mic
 * 2. Microphone enabling reliability
 * 
 * FIXED: Now uses MicrophoneHelpers for proper sequence
 */

import { test, expect } from '@playwright/test';
import { MicrophoneHelpers } from './helpers/test-helpers.js';

test.describe('Simple Microphone State Tests', () => {
  
  test('should test basic microphone functionality', async ({ page }) => {
    console.log('🎤 Testing basic microphone functionality with proper sequence...');
    
    // Capture console logs to see debug output
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🔧') || text.includes('Component') || text.includes('WebSocketManager') || text.includes('cleanup') || text.includes('close()')) {
        consoleMessages.push(`[${msg.type()}] ${text}`);
      }
    });
    
    page.on('pageerror', error => {
      consoleMessages.push(`[ERROR] ${error.message}`);
    });
    
    // Use the microphone helper for proper activation
    let result;
    try {
      result = await MicrophoneHelpers.waitForMicrophoneReady(page);
    
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.micStatus).toBe('Enabled');
      expect(result.connectionStatus).toContain('connected');
      
      // Verify microphone button is visible and clickable
      const micButton = page.locator('[data-testid="microphone-button"]');
      await expect(micButton).toBeVisible();
      await expect(micButton).toBeEnabled();
      
      console.log('✅ Basic microphone functionality verified!');
    } catch (error) {
      // Log console messages to help debug
      console.log('\n📋 Browser console messages related to cleanup/close:');
      consoleMessages.forEach(msg => console.log(`  ${msg}`));
      throw error;
    }
  });
  
});
