const { test, expect } = require('@playwright/test');

test.describe('Microphone Control', () => {
  test.beforeEach(async ({ page }) => {
    // Set up environment variables for testing
    await page.addInitScript(() => {
      window.process = {
        env: {
          REACT_APP_DEEPGRAM_API_KEY: 'test-api-key',
          REACT_APP_DEEPGRAM_AGENT_URL: 'wss://api.deepgram.com/v1/listen/stream',
          REACT_APP_DEEPGRAM_TRANSCRIPTION_URL: 'wss://api.deepgram.com/v1/listen/stream',
        }
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
  });

  test('should enable microphone when button clicked', async ({ page }) => {
    // Click microphone button
    await page.click('[data-testid="microphone-button"]');
    
    // Verify microphone is enabled
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
    await expect(page.locator('[data-testid="microphone-button"]')).not.toBeDisabled();
  });

  test('should disable microphone when button clicked again', async ({ page }) => {
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
    
    // Disable microphone
    await page.click('[data-testid="microphone-button"]');
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
  });

  test('should handle microphone permission denied', async ({ page }) => {
    // Mock permission denied
    await page.context().grantPermissions([], { origin: 'http://localhost:3000' });
    
    // Try to enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Verify error handling
    await expect(page.locator('[data-testid="mic-error"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle microphone permission granted', async ({ page }) => {
    // Grant microphone permission
    await page.context().grantPermissions(['microphone'], { origin: 'http://localhost:3000' });
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Verify microphone is enabled
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
  });

  test('should toggle microphone via props', async ({ page }) => {
    // Test with microphoneEnabled=true prop
    await page.goto('/?microphoneEnabled=true');
    await page.waitForLoadState('networkidle');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
    
    // Verify microphone is enabled by default
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
  });

  test('should handle microphone toggle callback', async ({ page }) => {
    // Listen for microphone toggle events
    const toggleEvents = [];
    await page.exposeFunction('onMicToggle', (enabled) => {
      toggleEvents.push(enabled);
    });
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for callback
    await page.waitForTimeout(1000);
    
    // Verify callback was called
    expect(toggleEvents).toContain(true);
    
    // Disable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for callback
    await page.waitForTimeout(1000);
    
    // Verify callback was called again
    expect(toggleEvents).toContain(false);
  });

  test('should maintain microphone state during reconnection', async ({ page }) => {
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
    
    // Simulate network disconnection
    await page.context().setOffline(true);
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');
    
    // Verify microphone state is preserved
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
    
    // Restore network
    await page.context().setOffline(false);
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
    
    // Verify microphone state is still preserved
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
  });

  test('should handle microphone errors gracefully', async ({ page }) => {
    // Mock microphone error
    await page.addInitScript(() => {
      // Override getUserMedia to throw error
      navigator.mediaDevices.getUserMedia = () => {
        return Promise.reject(new Error('Microphone access denied'));
      };
    });
    
    // Try to enable microphone
    await page.click('[data-testid="microphone-button"]');
    
    // Verify error handling
    await expect(page.locator('[data-testid="mic-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Error');
  });
});
