import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Text-Only Conversation
 * 
 * IMPORTANT: These tests require a REAL Deepgram API key!
 * 
 * These tests use actual WebSocket connections to Deepgram services,
 * not mocks. This provides authentic integration testing but requires
 * valid API credentials in test-app/.env:
 * 
 * - VITE_DEEPGRAM_API_KEY: Your real Deepgram API key
 * - VITE_DEEPGRAM_PROJECT_ID: Your Deepgram project ID
 * 
 * If tests fail with "connection closed" or "API key required" errors,
 * check that your test-app/.env file has valid Deepgram credentials.
 * 
 * Why not use mocks? Real API testing catches integration issues
 * and provides authentic component behavior validation.
 */

test.describe('Text-Only Conversation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Note: Component connects with valid API key from test-app/.env
    // The connection status should be "connected" with proper VITE_ environment variables
  });

  test('should allow text input without microphone', async ({ page }) => {
    // Type a message
    await page.fill('[data-testid="text-input"]', 'Hello, I need help with my order');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Hello, I need help with my order');
    
    // Verify agent response (mock response)
    await expect(page.locator('[data-testid="agent-response"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle multiple text exchanges', async ({ page }) => {
    // First message
    await page.fill('[data-testid="text-input"]', 'What products do you have?');
    await page.press('[data-testid="text-input"]', 'Enter');
    await expect(page.locator('[data-testid="agent-response"]')).toBeVisible({ timeout: 5000 });
    
    // Clear input
    await page.fill('[data-testid="text-input"]', '');
    
    // Second message
    await page.fill('[data-testid="text-input"]', 'Tell me about electronics');
    await page.press('[data-testid="text-input"]', 'Enter');
    await expect(page.locator('[data-testid="agent-response"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty text input', async ({ page }) => {
    // Try to send empty message
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Verify no message was sent (element shows default text)
    await expect(page.locator('[data-testid="user-message"]')).toContainText('No user messages from server yet');
  });

  test('should handle long text input', async ({ page }) => {
    const longMessage = 'This is a very long message that tests the text input handling capabilities of the voice agent component. It should be able to handle messages of various lengths without any issues.';
    
    // Type a long message
    await page.fill('[data-testid="text-input"]', longMessage);
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText(longMessage);
  });

  test('should handle special characters in text input', async ({ page }) => {
    const specialMessage = 'Hello! @#$%^&*()_+-=[]{}|;:,.<>?/~`';
    
    // Type a message with special characters
    await page.fill('[data-testid="text-input"]', specialMessage);
    await page.press('[data-testid="text-input"]', 'Enter');
    
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
    await page.press('[data-testid="text-input"]', 'Enter');
    
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
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Text with mic disabled');
  });

  test.skip('should handle text input with network issues', async ({ page }) => {
    // With lazy initialization, send a message first to establish connection
    await page.fill('[data-testid="text-input"]', 'Initial message');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Wait for message to be sent (this also waits for lazy initialization and connection)
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Initial message', { timeout: 10000 });
    
    // Verify connection is established
    let connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus).toContain('connected');
    
    // Simulate network issues
    await page.context().setOffline(true);
    
    // Wait for connection to close due to network being offline
    await page.waitForFunction(
      () => {
        const statusElement = document.querySelector('[data-testid="connection-status"]');
        const status = statusElement?.textContent || '';
        return status.includes('closed') || status.includes('error');
      },
      { timeout: 10000 }
    );
    
    // Try to send a message while offline
    // Component does NOT queue messages - this should fail silently or error
    await page.fill('[data-testid="text-input"]', 'Message during network issues');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Verify component still renders despite network issues
    await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
    
    // Note: Component does NOT automatically queue/retry messages
    // The message sent while offline is lost (this is expected behavior)
    
    // Restore network
    await page.context().setOffline(false);
    
    // Wait for network to be restored
    await page.waitForFunction(() => navigator.onLine === true, { timeout: 5000 });
    
    // Component does NOT automatically reconnect - manual reconnection required
    // Sending a new message will trigger lazy initialization/reconnection
    await page.fill('[data-testid="text-input"]', 'Message after network restored');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Wait for message to be sent (injectUserMessage creates/connects agent manager lazily)
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Message after network restored', { timeout: 10000 });
    
    // Connection should be re-established
    connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus).toContain('connected');
    
    // Note: The "Message during network issues" was NOT queued/retried
    // This is the current component behavior - no automatic message queuing
  });
});
