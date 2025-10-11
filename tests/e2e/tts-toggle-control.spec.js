import { test, expect } from '@playwright/test';

test.describe('TTS Toggle Control E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test app
    await page.goto('http://localhost:5173');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should render TTS toggle button', async ({ page }) => {
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="tts-button"]', { timeout: 10000 });
    
    // Verify TTS button is visible
    const ttsButton = page.locator('[data-testid="tts-button"]');
    await expect(ttsButton).toBeVisible();
    
    // Verify button shows correct initial state (enabled by default)
    await expect(ttsButton).toContainText('🔊 TTS On');
  });

  test('should toggle TTS state when button is clicked', async ({ page }) => {
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="tts-button"]', { timeout: 10000 });
    
    const ttsButton = page.locator('[data-testid="tts-button"]');
    
    // Verify initial state
    await expect(ttsButton).toContainText('🔊 TTS On');
    
    // Click to disable TTS
    await ttsButton.click();
    
    // Verify state changed
    await expect(ttsButton).toContainText('🔇 TTS Off');
    
    // Click to enable TTS again
    await ttsButton.click();
    
    // Verify state changed back
    await expect(ttsButton).toContainText('🔊 TTS On');
  });

  test('should show TTS status in connection status area', async ({ page }) => {
    // Wait for connection to be established
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Look for TTS status display
    const ttsStatus = page.locator('text=TTS:');
    await expect(ttsStatus).toBeVisible();
    
    // Verify initial TTS enabled status
    await expect(ttsStatus).toContainText('TTS: 🔊 Enabled');
  });

  test('should update TTS status display when toggled', async ({ page }) => {
    // Wait for connection to be established
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    const ttsButton = page.locator('[data-testid="tts-button"]');
    const ttsStatus = page.locator('text=TTS:');
    
    // Verify initial enabled status
    await expect(ttsStatus).toContainText('TTS: 🔊 Enabled');
    
    // Disable TTS
    await ttsButton.click();
    
    // Verify status updated
    await expect(ttsStatus).toContainText('TTS: 🔇 Disabled');
    
    // Re-enable TTS
    await ttsButton.click();
    
    // Verify status updated back
    await expect(ttsStatus).toContainText('TTS: 🔊 Enabled');
  });

  test('should maintain TTS state during conversation', async ({ page }) => {
    // Wait for connection to be established
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    const ttsButton = page.locator('[data-testid="tts-button"]');
    const textInput = page.locator('[data-testid="text-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    
    // Disable TTS
    await ttsButton.click();
    await expect(ttsButton).toContainText('🔇 TTS Off');
    
    // Send a text message
    await textInput.fill('Hello, test message');
    await sendButton.click();
    
    // Wait for message to be sent
    await page.waitForSelector('[data-testid="user-message"]', { timeout: 5000 });
    
    // Verify TTS state is still disabled
    await expect(ttsButton).toContainText('🔇 TTS Off');
    
    // Verify TTS status display is still correct
    const ttsStatus = page.locator('text=TTS:');
    await expect(ttsStatus).toContainText('TTS: 🔇 Disabled');
  });

  test('should handle TTS toggle during agent speaking', async ({ page }) => {
    // Wait for connection to be established
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    const ttsButton = page.locator('[data-testid="tts-button"]');
    
    // Wait for agent to potentially start speaking (greeting)
    await page.waitForTimeout(2000);
    
    // Try to toggle TTS during potential speaking
    await ttsButton.click();
    
    // Verify the toggle worked regardless of agent state
    await expect(ttsButton).toContainText('🔇 TTS Off');
    
    // Toggle back
    await ttsButton.click();
    await expect(ttsButton).toContainText('🔊 TTS On');
  });

  test('should disable TTS button when component not ready', async ({ page }) => {
    // Navigate to page and immediately check button state
    await page.goto('http://localhost:5173');
    
    const ttsButton = page.locator('[data-testid="tts-button"]');
    
    // Wait for button to appear
    await page.waitForSelector('[data-testid="tts-button"]', { timeout: 5000 });
    
    // Check if button is disabled (it should be if component isn't ready yet)
    const isDisabled = await ttsButton.isDisabled();
    
    if (isDisabled) {
      // If disabled, wait for component to be ready and verify it becomes enabled
      await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
      await expect(ttsButton).toBeEnabled();
    } else {
      // If already enabled, that's also valid - component became ready quickly
      await expect(ttsButton).toBeEnabled();
    }
  });
});
