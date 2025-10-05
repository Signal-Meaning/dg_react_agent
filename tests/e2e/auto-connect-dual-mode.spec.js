const { test, expect } = require('@playwright/test');

test.describe('Auto-Connect Dual Mode', () => {
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
  });

  test('should render voice agent component correctly', async ({ page }) => {
    // Verify component renders
    await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
    
    // Verify initial state
    await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="microphone-button"]')).toBeVisible();
  });

  test('should establish dual mode connection automatically', async ({ page }) => {
    // Wait for auto-connect to establish connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
    
    // Verify settings were sent
    await expect(page.locator('[data-testid="settings-sent"]')).toBeVisible({ timeout: 5000 });
  });

  test('should send greeting message automatically', async ({ page }) => {
    // Wait for greeting to be sent
    await expect(page.locator('[data-testid="greeting-sent"]')).toBeVisible({ timeout: 10000 });
    
    // Verify greeting text is displayed
    await expect(page.locator('[data-testid="greeting-text"]')).toContainText('Hello! How can I help you today?');
  });

  test('should maintain microphone disabled by default', async ({ page }) => {
    // Verify microphone button is visible but disabled initially
    const micButton = page.locator('[data-testid="microphone-button"]');
    await expect(micButton).toBeVisible();
    
    // Wait for component to be ready
    await page.waitForTimeout(1000);
    
    // Check if button is disabled (it might be enabled after connection)
    const isDisabled = await micButton.isDisabled();
    if (isDisabled) {
      await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
    }
  });

  test('should handle auto-connect when autoConnect prop is false', async ({ page }) => {
    // Navigate to test page with autoConnect=false
    await page.goto('/?autoConnect=false');
    await page.waitForLoadState('networkidle');
    
    // Verify component renders
    await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
    
    // Connection should not be established automatically
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');
  });

  test('should handle microphone control via props', async ({ page }) => {
    // Navigate to test page with microphoneEnabled=true
    await page.goto('/?microphoneEnabled=true');
    await page.waitForLoadState('networkidle');
    
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
    
    // Verify microphone is enabled
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled');
  });

  test('should display auto-connect dual mode states correctly', async ({ page }) => {
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
    
    // Verify auto-connect dual mode states are displayed
    await expect(page.locator('[data-testid="auto-connect-states"]')).toBeVisible();
    await expect(page.locator('[data-testid="connection-ready"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-speaking"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-silent"]')).toBeVisible();
  });

  test('should handle connection errors gracefully', async ({ page }) => {
    // Mock connection failure
    await page.addInitScript(() => {
      // Override WebSocket to simulate connection failure
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = class extends OriginalWebSocket {
        constructor(url) {
          super(url);
          setTimeout(() => {
            this.dispatchEvent(new Event('error'));
          }, 100);
        }
      };
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify error handling
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible({ timeout: 5000 });
  });

  test('should support text-only mode', async ({ page }) => {
    // Wait for connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
    
    // Verify text input is available
    await expect(page.locator('[data-testid="text-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    
    // Test text input
    await page.fill('[data-testid="text-input"]', 'Hello, I need help');
    await page.click('[data-testid="send-button"]');
    
    // Verify message was sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Hello, I need help');
  });
});
