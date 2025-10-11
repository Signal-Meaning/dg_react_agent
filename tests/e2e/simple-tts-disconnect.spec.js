import { test, expect } from '@playwright/test';

test.describe('Simple TTS Disconnect', () => {
  test('should disconnect agent when TTS is turned off', async ({ page }) => {
    const allMessages = [];
    
    // Capture all console messages
    page.on('console', msg => {
      allMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for agent connection
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Wait for greeting to complete
    await page.waitForTimeout(3000);
    
    // Check initial connection state
    const agentConnection = await page.locator('[data-testid="connection-status"]');
    const initialConnectionState = await agentConnection.textContent();
    console.log('Initial agent connection state:', initialConnectionState);
    
    // Toggle TTS off
    const ttsButton = await page.locator('button:has-text("TTS")');
    await ttsButton.click();
    
    // Wait for disconnection
    await page.waitForTimeout(2000);
    
    // Check connection state after toggle
    const finalConnectionState = await agentConnection.textContent();
    console.log('Final agent connection state:', finalConnectionState);
    
    // Look for disconnect messages
    const disconnectMessages = allMessages.filter(msg => 
      msg.includes('Disabling TTS: disconnecting agent WebSocket') ||
      msg.includes('Agent WebSocket disconnected') ||
      msg.includes('Agent state: disconnected')
    );
    
    console.log('Disconnect messages:', disconnectMessages);
    
    // Should have disconnect messages
    expect(disconnectMessages.length).toBeGreaterThan(0);
    
    // Agent connection should be disconnected
    expect(finalConnectionState).toBe('closed');
    
    console.log('✅ TTS toggle successfully disconnected agent');
  });
});
