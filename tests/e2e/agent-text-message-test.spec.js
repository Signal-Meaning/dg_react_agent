import { test, expect } from '@playwright/test';

test.describe('Agent Text Message Test', () => {
  test('should send text message and get real response', async ({ page }) => {
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
    
    // Wait a bit more for everything to settle
    await page.waitForTimeout(3000);
    
    // Send a text message
    const textInput = await page.locator('input[type="text"]');
    const sendButton = await page.locator('button:has-text("Send")');
    
    await textInput.fill('What is 2+2?');
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Check agent response
    const agentResponse = await page.locator('[data-testid="agent-response"]');
    const responseText = await agentResponse.textContent();
    
    console.log('Agent response:', responseText);
    
    // Look for messages related to text sending
    const textMessages = allMessages.filter(msg => 
      msg.includes('injectUserMessage') ||
      msg.includes('text message') ||
      msg.includes('Message sent') ||
      msg.includes('ConversationText') ||
      msg.includes('MOCK')
    );
    
    console.log('Text-related messages:', textMessages);
    
    // Should NOT contain [MOCK] prefix
    expect(responseText).not.toContain('[MOCK]');
    
    console.log('✅ Agent response is not mock');
  });
});
