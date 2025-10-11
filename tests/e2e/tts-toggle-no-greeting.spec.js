import { test, expect } from '@playwright/test';

test.describe('TTS Toggle Without Greeting', () => {
  test('should toggle TTS without triggering greeting', async ({ page }) => {
    const allMessages = [];
    
    // Capture all console messages
    page.on('console', msg => {
      allMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for agent connection and greeting
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Wait for greeting to complete
    await page.waitForTimeout(3000);
    
    // Check initial TTS state
    const ttsButton = await page.locator('button:has-text("TTS")');
    const ttsButtonText = await ttsButton.textContent();
    console.log('Initial TTS button text:', ttsButtonText);
    
    // Send a text message to establish conversation
    const textInput = await page.locator('input[type="text"]');
    const sendButton = await page.locator('button:has-text("Send")');
    
    await textInput.fill('Hello, please respond briefly');
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Now toggle TTS off
    await ttsButton.click();
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Check TTS button state
    const ttsButtonTextAfter = await ttsButton.textContent();
    console.log('TTS button text after toggle:', ttsButtonTextAfter);
    
    // Look for UpdateSpeak messages
    const updateSpeakMessages = allMessages.filter(msg => 
      msg.includes('UpdateSpeak') || 
      msg.includes('Sending UpdateSpeak')
    );
    
    console.log('UpdateSpeak messages:', updateSpeakMessages);
    
    // Look for greeting messages after TTS toggle
    const greetingMessages = allMessages.filter(msg => 
      msg.includes('greeting') || 
      msg.includes('Hello! How can I assist you today?')
    );
    
    console.log('Greeting messages:', greetingMessages);
    
    // Count greeting messages before and after TTS toggle
    const messagesBeforeToggle = allMessages.slice(0, Math.floor(allMessages.length / 2));
    const messagesAfterToggle = allMessages.slice(Math.floor(allMessages.length / 2));
    
    const greetingsBefore = messagesBeforeToggle.filter(msg => 
      msg.includes('Hello! How can I assist you today?')
    ).length;
    
    const greetingsAfter = messagesAfterToggle.filter(msg => 
      msg.includes('Hello! How can I assist you today?')
    ).length;
    
    console.log('Greetings before TTS toggle:', greetingsBefore);
    console.log('Greetings after TTS toggle:', greetingsAfter);
    
    // Should have UpdateSpeak messages
    expect(updateSpeakMessages.length).toBeGreaterThan(0);
    
    // Should NOT have additional greetings after TTS toggle
    expect(greetingsAfter).toBe(0);
    
    console.log('✅ TTS toggle did not trigger greeting');
  });
});
