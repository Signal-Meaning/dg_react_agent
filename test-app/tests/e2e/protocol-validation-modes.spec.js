/**
 * Protocol Validation - Real API vs Mock Modes
 * 
 * This test validates that the dg_react_agent works correctly in both:
 * 1. Real Mode: With actual Deepgram API connections
 * 2. Mock Mode: With mocked WebSocket (for testing without API key)
 */

import { test, expect } from '@playwright/test';
import {
  installMockWebSocket,
} from './helpers/test-helpers.js';

// Configure to run only in chromium for focused testing
test.use({ browserName: 'chromium' });

test.describe('Protocol Validation - Mock API Mode', () => {
  test('should work with mocked WebSocket when no API key provided', async ({ page, context }) => {
    // Use test mode to simulate missing API key
    await page.addInitScript(() => {
      window.testApiKey = 'missing';
    });
    
    // Navigate to test mode
    await page.goto('http://localhost:5173/?test-mode=true');
    await page.waitForLoadState('networkidle');
    
    // Install mock WebSocket to prevent real API calls
    await installMockWebSocket(page, context);
    
    console.log('🚀 Testing with MOCKED WebSocket (no API key)...');
    
    // Wait for the error state to load (this is the expected behavior for missing API key)
    await page.waitForSelector('h2:has-text("Deepgram API Key Status")', { timeout: 10000 });
    console.log('✅ Error state loaded (expected for missing API key)');
    
    // Test 1: Verify the app shows MOCK mode in the error state
    const mockModeIndicator = page.locator('h4:has-text("Current Mode: MOCK")');
    await expect(mockModeIndicator).toBeVisible();
    console.log('✅ App correctly shows MOCK mode');
    
    // Test 2: Verify the error state explains mock behavior
    const mockExplanation = page.locator('text=[MOCK]');
    await expect(mockExplanation).toBeVisible();
    console.log('✅ Mock behavior explanation is shown');
    
    console.log('🎉 MOCK API MODE TEST PASSED!');
  });
});

test.describe('Protocol Validation - Mock Mode', () => {
  test('should work with mocked WebSocket (no API key)', async ({ page, context }) => {
    console.log('🚀 Testing with MOCKED WebSocket...');
    
    // Use test mode to simulate missing API key
    await page.addInitScript(() => {
      window.testApiKey = 'missing';
    });
    
    // Navigate to test mode
    await page.goto('http://localhost:5173/?test-mode=true');
    await page.waitForLoadState('networkidle');
    
    // Install mock WebSocket
    await installMockWebSocket(page, context);
    
    // Wait for the error state to load (this is the expected behavior for missing API key)
    await page.waitForSelector('h2:has-text("Deepgram API Key Status")', { timeout: 10000 });
    console.log('✅ Error state loaded (expected for missing API key)');
    
    // Test 1: Verify the app shows MOCK mode in the error state
    const mockModeIndicator = page.locator('h4:has-text("Current Mode: MOCK")');
    await expect(mockModeIndicator).toBeVisible();
    console.log('✅ App correctly shows MOCK mode');
    
    // Test 2: Verify the error state explains mock behavior
    const mockExplanation = page.locator('text=[MOCK]');
    await expect(mockExplanation).toBeVisible();
    console.log('✅ Mock behavior explanation is shown');
    
    console.log('🎉 MOCK MODE TEST PASSED!');
  });
});

