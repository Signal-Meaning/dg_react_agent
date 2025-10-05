const { test, expect } = require('@playwright/test');

test.describe('Text-Only Conversation', () => {
  test.beforeEach(async ({ page }) => {
    // Set up environment variables for testing
    await page.addInitScript(() => {
      // Mock Vite environment variables for the test app
      window.import = {
        meta: {
          env: {
            VITE_DEEPGRAM_API_KEY: 'test-api-key',
            VITE_DEEPGRAM_AGENT_URL: 'wss://agent.deepgram.com/v1/agent/converse',
            VITE_DEEPGRAM_TRANSCRIPTION_URL: 'wss://api.deepgram.com/v1/listen',
          }
        }
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
  });

  test('should allow text input without microphone', async ({ page }) => {
    // Type a message
    await page.fill('[data-testid="text-input"]', 'Hello, I need help with my order');
    await page.click('[data-testid="send-button"]');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Hello, I need help with my order');
    
    // Verify agent response (mock response)
    await expect(page.locator('[data-testid="agent-response"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle multiple text exchanges', async ({ page }) => {
    // First message
    await page.fill('[data-testid="text-input"]', 'What products do you have?');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="agent-response"]')).toBeVisible({ timeout: 5000 });
    
    // Clear input
    await page.fill('[data-testid="text-input"]', '');
    
    // Second message
    await page.fill('[data-testid="text-input"]', 'Tell me about electronics');
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('[data-testid="agent-response"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty text input', async ({ page }) => {
    // Try to send empty message
    await page.click('[data-testid="send-button"]');
    
    // Verify no message was sent
    await expect(page.locator('[data-testid="user-message"]')).not.toBeVisible();
  });

  test('should handle long text input', async ({ page }) => {
    const longMessage = 'This is a very long message that tests the text input handling capabilities of the voice agent component. It should be able to handle messages of various lengths without any issues.';
    
    // Type a long message
    await page.fill('[data-testid="text-input"]', longMessage);
    await page.click('[data-testid="send-button"]');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText(longMessage);
  });

  test('should handle special characters in text input', async ({ page }) => {
    const specialMessage = 'Hello! @#$%^&*()_+-=[]{}|;:,.<>?/~`';
    
    // Type a message with special characters
    await page.fill('[data-testid="text-input"]', specialMessage);
    await page.click('[data-testid="send-button"]');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText(specialMessage);
  });

  test('should handle Enter key for sending messages', async ({ page }) => {
    // Type a message and press Enter
    await page.fill('[data-testid="text-input"]', 'Hello from Enter key');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Hello from Enter key');
  });

  test('should clear input after sending message', async ({ page }) => {
    // Type a message
    await page.fill('[data-testid="text-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');
    
    // Verify input is cleared
    await expect(page.locator('[data-testid="text-input"]')).toHaveValue('');
  });

  test('should handle text input with microphone disabled', async ({ page }) => {
    // Ensure microphone is disabled
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    if (micStatus?.includes('Enabled')) {
      await page.click('[data-testid="microphone-button"]');
    }
    
    // Verify microphone is disabled
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
    
    // Type a message
    await page.fill('[data-testid="text-input"]', 'Text with mic disabled');
    await page.click('[data-testid="send-button"]');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Text with mic disabled');
  });

  test('should handle text input during agent speaking', async ({ page }) => {
    // Wait for agent to start speaking (if greeting is configured)
    await page.waitForTimeout(2000);
    
    // Type a message while agent might be speaking
    await page.fill('[data-testid="text-input"]', 'Interrupting agent speech');
    await page.click('[data-testid="send-button"]');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Interrupting agent speech');
  });

  test('should handle rapid text input', async ({ page }) => {
    // Send multiple messages quickly
    const messages = ['Message 1', 'Message 2', 'Message 3'];
    
    for (const message of messages) {
      await page.fill('[data-testid="text-input"]', message);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(100); // Small delay between messages
    }
    
    // Verify all messages were sent
    for (const message of messages) {
      await expect(page.locator('[data-testid="user-message"]')).toContainText(message);
    }
  });

  test('should handle text input with network issues', async ({ page }) => {
    // Simulate network issues
    await page.context().setOffline(true);
    
    // Try to send a message
    await page.fill('[data-testid="text-input"]', 'Message during network issues');
    await page.click('[data-testid="send-button"]');
    
    // Verify error handling
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible({ timeout: 5000 });
    
    // Restore network
    await page.context().setOffline(false);
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
    
    // Try to send message again
    await page.fill('[data-testid="text-input"]', 'Message after network restored');
    await page.click('[data-testid="send-button"]');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Message after network restored');
  });
});
