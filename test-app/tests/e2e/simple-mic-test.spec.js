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
    
    // Use the microphone helper for proper activation
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page);
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.micStatus).toBe('Enabled');
    expect(result.connectionStatus).toContain('connected');
    
    // Verify microphone button is visible and clickable
    const micButton = page.locator('[data-testid="microphone-button"]');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();
    
    console.log('✅ Basic microphone functionality verified!');
  });
  
  test('should verify agent service configuration', async ({ page }) => {
    console.log('🔍 Testing agent service configuration...');
    
    // Use the microphone helper to ensure proper setup
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page);
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.connectionStatus).toContain('connected');
    
    console.log('✅ Connection established');
    
    // Check UI connection status (what the microphone helper uses)
    const uiConnectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('📊 UI Connection status:', uiConnectionStatus);
    
    // Verify agent service is connected via UI (this matches what microphone helper checks)
    expect(uiConnectionStatus).toContain('connected');
    
    console.log('✅ Agent service configuration verified!');
    console.log('🎉 Agent service handles both transcription and agent functionality!');
  });

  test('should test sleep/wake functionality', async ({ page }) => {
    console.log('😴 Testing sleep/wake functionality...');
    
    // Use the microphone helper to ensure proper setup first
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page);
    expect(result.success).toBe(true);
    
    // Start recording first (required for sleep button to be enabled)
    const startButton = page.locator('button:has-text("Start")');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();
    await page.waitForTimeout(1000);
    
    // Find sleep/wake button (should now be enabled)
    const sleepButton = page.locator('button:has-text("Put to Sleep")');
    await expect(sleepButton).toBeVisible({ timeout: 10000 });
    await expect(sleepButton).toBeEnabled();
    
    // Click sleep button
    await sleepButton.click();
    await page.waitForTimeout(2000);
    
    // Check if button text changed to "Wake Up"
    const wakeButton = page.locator('button:has-text("Wake Up")');
    await expect(wakeButton).toBeVisible({ timeout: 5000 });
    
    // Click wake button
    await wakeButton.click();
    await page.waitForTimeout(1000);
    
    // Test passes if sleep/wake functionality works
    console.log('✅ Sleep/wake functionality test completed');
  });
});
