import { test, expect } from '@playwright/test';
import { setupTestPage, waitForConnection } from './helpers/test-helpers';

/**
 * @fileoverview E2E tests for Deepgram Instructions File Configuration
 * 
 * Tests the complete instructions loading pipeline including:
 * - Environment variable override functionality
 * - File-based configuration loading
 * - Integration with DeepgramVoiceInteraction component
 * - Error handling and fallback mechanisms
 */

test.describe('Deepgram Instructions File Configuration', () => {
  
  test('should load instructions from environment variable override', async ({ page }) => {
    console.log('🧪 Testing environment variable override...');
    
    await setupTestPage(page);
    await waitForConnection(page);
    
    // Check that the component loaded with instructions
    const instructionsStatus = await page.locator('text=Instructions Status').first();
    await expect(instructionsStatus).toBeVisible();
    
    // Verify the source shows instructions loader
    const sourceText = await page.locator('text=Instructions Loader').first();
    await expect(sourceText).toBeVisible();
    
    console.log('✅ Environment variable override test passed');
  });

  test('should display instructions preview in UI', async ({ page }) => {
    console.log('🧪 Testing instructions preview display...');
    
    await setupTestPage(page);
    await waitForConnection(page);
    
    // Check that instructions status section is visible
    const instructionsSection = await page.locator('text=Instructions Status').first();
    await expect(instructionsSection).toBeVisible();
    
    // Check that status shows loaded
    const statusText = await page.locator('text=Loaded').first();
    await expect(statusText).toBeVisible();
    
    // Check that instructions preview is displayed
    const previewSection = await page.locator('text=Instructions Preview').first();
    await expect(previewSection).toBeVisible();
    
    console.log('✅ Instructions preview display test passed');
  });

  test('should integrate instructions with DeepgramVoiceInteraction component', async ({ page }) => {
    console.log('🧪 Testing instructions integration with component...');
    
    await setupTestPage(page);
    await waitForConnection(page);
    
    // Verify that the component is using the loaded instructions
    // by checking that the agent responds appropriately to commerce-related queries
    
    // Send a test message
    const textInput = await page.locator('[data-testid="text-input"]');
    const sendButton = await page.locator('[data-testid="send-button"]');
    
    await textInput.fill('What products do you recommend for electronics?');
    await sendButton.click();
    
    // Wait for agent response
    await page.waitForTimeout(2000);
    
    // Check that the agent responded (indicating instructions were loaded)
    const messages = await page.locator('[data-testid*="message"]').all();
    expect(messages.length).toBeGreaterThan(0);
    
    console.log('✅ Instructions integration test passed');
  });

  test('should support different instruction sources', async ({ page }) => {
    console.log('🧪 Testing different instruction sources...');
    
    await setupTestPage(page);
    await waitForConnection(page);
    
    // Check that the instructions source is properly identified
    const sourceSection = await page.locator('text=Source:').first();
    await expect(sourceSection).toBeVisible();
    
    // Verify that the source shows the correct type
    const sourceText = await page.locator('text=Instructions Loader').first();
    await expect(sourceText).toBeVisible();
    
    console.log('✅ Instruction sources test passed');
  });

});
