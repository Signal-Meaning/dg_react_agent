/**
 * Auto-Connect Behavior E2E Tests for dg_react_agent
 * 
 * These tests verify that the auto-connect dual mode behavior works correctly
 * in a real browser environment.
 */

const { test, expect } = require('@playwright/test');

test.describe('Auto-Connect Behavior E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test app
    await page.goto('http://localhost:5173');
    
    // Wait for the app to load
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  });

  test('should enable start button when component is ready in auto-connect mode', async ({ page }) => {
    // Wait for the component to become ready
    await page.waitForSelector('[data-testid="start-button"]:not([disabled])', { timeout: 10000 });
    
    // Verify the start button is enabled
    const startButton = page.locator('[data-testid="start-button"]');
    await expect(startButton).toBeEnabled();
    
    // Verify the connection status shows the agent is configured
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await expect(connectionStatus).toBeVisible();
  });

  test('should show auto-connect dual mode status when ready', async ({ page }) => {
    // Wait for the component to become ready
    await page.waitForSelector('[data-testid="start-button"]:not([disabled])', { timeout: 10000 });
    
    // Check that auto-connect states are visible
    const autoConnectStates = page.locator('[data-testid="auto-connect-states"]');
    await expect(autoConnectStates).toBeVisible();
    
    // Check that microphone status is shown
    const micStatus = page.locator('[data-testid="mic-status"]');
    await expect(micStatus).toBeVisible();
    
    // Check that connection ready status is shown
    const connectionReady = page.locator('[data-testid="connection-ready"]');
    await expect(connectionReady).toBeVisible();
  });

  test('should allow text input interaction when ready', async ({ page }) => {
    // Wait for the component to become ready
    await page.waitForSelector('[data-testid="start-button"]:not([disabled])', { timeout: 10000 });
    
    // Check that text input is available
    const textInput = page.locator('[data-testid="text-input"]');
    await expect(textInput).toBeVisible();
    await expect(textInput).toBeEnabled();
    
    // Check that send button is available
    const sendButton = page.locator('[data-testid="send-button"]');
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeEnabled();
  });

  test('should show proper API mode indicator', async ({ page }) => {
    // Wait for the component to become ready
    await page.waitForSelector('[data-testid="start-button"]:not([disabled])', { timeout: 10000 });
    
    // Check that API mode indicator is shown
    const apiModeIndicator = page.locator('text=🟡 MOCK API Mode');
    await expect(apiModeIndicator).toBeVisible();
  });
});
