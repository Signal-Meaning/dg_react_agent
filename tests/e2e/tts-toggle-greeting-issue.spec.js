import { test, expect } from '@playwright/test';

test.describe('TTS Toggle Greeting Issue', () => {
  test('should not trigger greeting when TTS is toggled', async ({ page }) => {
    const messagesAfterToggle = [];
    let toggleTime = 0;
    
    // Start capturing messages after toggle
    page.on('console', msg => {
      if (toggleTime > 0) {
        messagesAfterToggle.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for agent connection and greeting
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Wait for greeting to complete
    await page.waitForTimeout(3000);
    
    // Send a text message to establish conversation
    const textInput = await page.locator('input[type="text"]');
    const sendButton = await page.locator('button:has-text("Send")');
    
    await textInput.fill('Hello, please respond briefly');
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Now toggle TTS off and start timing
    const ttsButton = await page.locator('button:has-text("TTS")');
    await ttsButton.click();
    toggleTime = Date.now();
    
    // Wait for any potential greeting
    await page.waitForTimeout(5000);
    
    // Check for greeting messages after toggle
    const greetingMessages = messagesAfterToggle.filter(msg => 
      msg.includes('Hello! How can I assist you today?') ||
      msg.includes('greeting') ||
      msg.includes('New connection - triggering greeting flow')
    );
    
    console.log('Messages after TTS toggle:', messagesAfterToggle.length);
    console.log('Greeting messages after toggle:', greetingMessages);
    
    // Should NOT have greeting messages after TTS toggle
    expect(greetingMessages.length).toBe(0);
    
    console.log('✅ TTS toggle did not trigger greeting');
  });
});
