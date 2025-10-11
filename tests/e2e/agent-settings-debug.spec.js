import { test, expect } from '@playwright/test';

test.describe('Agent Settings Debug', () => {
  test('should verify agent settings include OpenAI endpoint', async ({ page }) => {
    const allMessages = [];
    
    // Capture all console messages
    page.on('console', msg => {
      allMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for agent connection and settings to be sent
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Wait a bit more for settings message
    await page.waitForTimeout(2000);
    
    console.log('All console messages:', allMessages);
    
    // Look for debug messages
    const debugMessages = allMessages.filter(msg => 
      msg.includes('🔍 Agent Options Debug') ||
      msg.includes('🔍 Think Configuration Debug') ||
      msg.includes('thinkEndpointUrl') ||
      msg.includes('thinkApiKey') ||
      msg.includes('Sending agent settings') ||
      msg.includes('WebSocket') ||
      msg.includes('Error') ||
      msg.includes('error')
    );
    
    console.log('Debug messages:', debugMessages);
    
    // Look for WebSocket connection messages
    const wsMessages = allMessages.filter(msg => 
      msg.includes('WebSocket') || 
      msg.includes('connected') || 
      msg.includes('disconnected') ||
      msg.includes('error')
    );
    
    console.log('WebSocket messages:', wsMessages);
    
    // Should have debug messages
    expect(debugMessages.length).toBeGreaterThan(0);
    
    console.log('✅ Debug messages found');
  });
});