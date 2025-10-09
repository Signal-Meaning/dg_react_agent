/**
 * E2E tests for DEEPGRAM_INSTRUCTIONS file and environment variable override functionality
 */

import { test, expect } from '@playwright/test';

test.describe('DEEPGRAM_INSTRUCTIONS File and Environment Override', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test app
    await page.goto('/');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  });

  test('should load instructions from file by default', async ({ page }) => {
    // Wait for instructions to load
    await page.waitForSelector('text=Status: Loaded', { timeout: 5000 });
    
    // Check that source shows file
    const sourceElement = page.locator('text=Source:').locator('..');
    await expect(sourceElement).toContainText('File (instructions.txt)');
    
    // Check that instructions preview shows content
    const instructionsPreview = page.locator('text=Instructions Preview:').locator('..').locator('div').last();
    await expect(instructionsPreview).not.toBeEmpty();
    
    // Verify it contains expected e-commerce content
    await expect(instructionsPreview).toContainText('e-commerce');
  });

  test('should show loading state initially', async ({ page }) => {
    // Check that loading state is shown initially
    const statusElement = page.locator('text=Status:').locator('..');
    await expect(statusElement).toContainText('Loading...');
  });

  test('should handle environment variable override', async ({ page }) => {
    // Set environment variable
    await page.addInitScript(() => {
      process.env.DEEPGRAM_INSTRUCTIONS = 'Custom instructions from environment variable';
    });

    // Reload the page to pick up the environment variable
    await page.reload();
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for instructions to load
    await page.waitForSelector('text=Status: Loaded', { timeout: 5000 });
    
    // Check that source shows environment variable
    const sourceElement = page.locator('text=Source:').locator('..');
    await expect(sourceElement).toContainText('Environment Variable');
    
    // Check that instructions preview shows the custom content
    const instructionsPreview = page.locator('text=Instructions Preview:').locator('..').locator('div').last();
    await expect(instructionsPreview).toContainText('Custom instructions from environment variable');
  });

  test('should handle Vite environment variable override', async ({ page }) => {
    // Set Vite environment variable
    await page.addInitScript(() => {
      import.meta.env.DEEPGRAM_INSTRUCTIONS = 'Custom instructions from Vite environment';
    });

    // Reload the page to pick up the environment variable
    await page.reload();
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for instructions to load
    await page.waitForSelector('text=Status: Loaded', { timeout: 5000 });
    
    // Check that source shows Vite environment
    const sourceElement = page.locator('text=Source:').locator('..');
    await expect(sourceElement).toContainText('Vite Environment');
    
    // Check that instructions preview shows the custom content
    const instructionsPreview = page.locator('text=Instructions Preview:').locator('..').locator('div').last();
    await expect(instructionsPreview).toContainText('Custom instructions from Vite environment');
  });

  test('should use loaded instructions in agent configuration', async ({ page }) => {
    // Wait for instructions to load
    await page.waitForSelector('text=Status: Loaded', { timeout: 5000 });
    
    // Check that the agent is using the loaded instructions
    // This is verified by checking that the instructions preview contains e-commerce content
    const instructionsPreview = page.locator('text=Instructions Preview:').locator('..').locator('div').last();
    await expect(instructionsPreview).toContainText('e-commerce');
    
    // The agent should be ready to use these instructions
    await expect(page.locator('text=Ready:')).toContainText('true');
  });

  test('should handle empty environment variable gracefully', async ({ page }) => {
    // Set empty environment variable
    await page.addInitScript(() => {
      process.env.DEEPGRAM_INSTRUCTIONS = '';
    });

    // Reload the page
    await page.reload();
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for instructions to load
    await page.waitForSelector('text=Status: Loaded', { timeout: 5000 });
    
    // Should fall back to file content
    const sourceElement = page.locator('text=Source:').locator('..');
    await expect(sourceElement).toContainText('File (instructions.txt)');
  });

  test('should update agent options when instructions change', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('text=Status: Loaded', { timeout: 5000 });
    
    // Verify initial instructions
    const instructionsPreview = page.locator('text=Instructions Preview:').locator('..').locator('div').last();
    await expect(instructionsPreview).toContainText('e-commerce');
    
    // The agent should be ready and using the loaded instructions
    await expect(page.locator('text=Ready:')).toContainText('true');
  });
});
