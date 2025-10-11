import { test, expect } from '@playwright/test';

test.describe('Server-Side TTS Control Test', () => {
  test('should verify UpdateSpeak messages are sent correctly', async ({ page }) => {
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
    
    // Toggle TTS off
    const ttsButton = await page.locator('[data-testid="tts-button"]');
    await ttsButton.click();
    
    // Wait for messages
    await page.waitForTimeout(1000);
    
    // Check for UpdateSpeak protocol messages
    const updateSpeakMessages = consoleMessages.filter(msg => 
      msg.includes('[Protocol] Sending UpdateSpeak') ||
      msg.includes('UpdateSpeak message:')
    );
    
    console.log('UpdateSpeak messages:', updateSpeakMessages);
    
    // Should have at least one UpdateSpeak message
    expect(updateSpeakMessages.length).toBeGreaterThan(0);
    
    // Verify the disable message format
    const disableMessage = updateSpeakMessages.find(msg => msg.includes('provider: null'));
    expect(disableMessage).toBeDefined();
    
    console.log('✅ Server-side TTS disable message sent correctly');
    
    // Clear messages and toggle back on
    consoleMessages.length = 0;
    await ttsButton.click();
    await page.waitForTimeout(1000);
    
    // Check for enable message
    const enableMessages = consoleMessages.filter(msg => 
      msg.includes('[Protocol] Sending UpdateSpeak') ||
      msg.includes('UpdateSpeak message:')
    );
    
    console.log('Enable messages:', enableMessages);
    
    // Should have enable message with provider
    expect(enableMessages.length).toBeGreaterThan(0);
    
    const enableMessage = enableMessages.find(msg => msg.includes('provider:') && !msg.includes('null'));
    expect(enableMessage).toBeDefined();
    
    console.log('✅ Server-side TTS enable message sent correctly');
  });
  
  test('should verify TTS control works during conversation', async ({ page }) => {
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for agent connection
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Enable microphone and start interaction
    const micButton = await page.locator('button:has-text("Enable Mic")');
    await micButton.click();
    
    const startButton = await page.locator('button:has-text("Start")');
    await startButton.click();
    
    // Wait for recording to start
    await page.waitForSelector('text=🎙️ Recording audio');
    
    // Wait for agent to potentially start speaking
    await page.waitForTimeout(3000);
    
    // Disable TTS during potential conversation
    const ttsButton = await page.locator('[data-testid="tts-button"]');
    await ttsButton.click();
    
    // Verify button shows disabled state
    await expect(ttsButton).toContainText('🔇 TTS Off');
    
    // Wait a moment
    await page.waitForTimeout(2000);
    
    // Re-enable TTS
    await ttsButton.click();
    
    // Verify button shows enabled state
    await expect(ttsButton).toContainText('🔊 TTS On');
    
    console.log('✅ TTS toggle works during conversation');
  });
});
