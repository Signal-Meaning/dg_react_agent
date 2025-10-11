import { test, expect } from '@playwright/test';

test.describe('Server-Side TTS Control Test', () => {
  test('should send UpdateSpeak message when TTS is toggled', async ({ page }) => {
    const sentMessages = [];
    
    // Capture WebSocket messages
    await page.addInitScript(() => {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'UpdateSpeak') {
              window.updateSpeakMessages = window.updateSpeakMessages || [];
              window.updateSpeakMessages.push(parsed);
              console.log('📤 UpdateSpeak message sent:', parsed);
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }
        return originalSend.call(this, data);
      };
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Check if we're in REAL API mode
    const apiModeIndicator = await page.locator('text=🟢 REAL API Mode').first();
    await expect(apiModeIndicator).toBeVisible({ timeout: 5000 });
    
    // Wait for agent connection
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Clear any existing messages
    await page.evaluate(() => {
      window.updateSpeakMessages = [];
    });
    
    // Toggle TTS off
    const ttsButton = await page.locator('[data-testid="tts-button"]');
    await ttsButton.click();
    
    // Wait a moment for the message to be sent
    await page.waitForTimeout(1000);
    
    // Check if UpdateSpeak message was sent
    const updateSpeakMessages = await page.evaluate(() => window.updateSpeakMessages || []);
    
    console.log('UpdateSpeak messages sent:', updateSpeakMessages);
    
    // Verify UpdateSpeak message was sent with provider: null (disabled)
    expect(updateSpeakMessages.length).toBeGreaterThan(0);
    
    const disableMessage = updateSpeakMessages.find(msg => msg.provider === null);
    expect(disableMessage).toBeDefined();
    expect(disableMessage.type).toBe('UpdateSpeak');
    expect(disableMessage.provider).toBeNull();
    
    // Toggle TTS back on
    await ttsButton.click();
    
    // Wait for the message to be sent
    await page.waitForTimeout(1000);
    
    // Check for enable message
    const allMessages = await page.evaluate(() => window.updateSpeakMessages || []);
    const enableMessage = allMessages.find(msg => msg.provider && msg.provider.type === 'deepgram');
    
    expect(enableMessage).toBeDefined();
    expect(enableMessage.type).toBe('UpdateSpeak');
    expect(enableMessage.provider.type).toBe('deepgram');
    expect(enableMessage.provider.model).toBeDefined();
    
    console.log('✅ Server-side TTS control working correctly');
    console.log('  - Disable message:', disableMessage);
    console.log('  - Enable message:', enableMessage);
  });
  
  test('should verify UpdateSpeak messages in console logs', async ({ page }) => {
    const consoleMessages = [];
    
    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for agent connection
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Clear console messages
    consoleMessages.length = 0;
    
    // Toggle TTS
    const ttsButton = await page.locator('[data-testid="tts-button"]');
    await ttsButton.click();
    
    // Wait for messages
    await page.waitForTimeout(2000);
    
    // Check for UpdateSpeak protocol messages
    const protocolMessages = consoleMessages.filter(msg => 
      msg.includes('[Protocol] Sending UpdateSpeak') ||
      msg.includes('UpdateSpeak message:')
    );
    
    console.log('Protocol messages:', protocolMessages);
    
    expect(protocolMessages.length).toBeGreaterThan(0);
    
    // Verify the message format
    const updateSpeakLog = protocolMessages.find(msg => msg.includes('UpdateSpeak'));
    expect(updateSpeakLog).toBeDefined();
    
    console.log('✅ UpdateSpeak protocol messages detected in console');
  });
});
