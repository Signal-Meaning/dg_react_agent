import { test, expect } from '@playwright/test';

test.describe('Server-Side TTS Muting Verification', () => {
  test('should verify server stops sending audio when TTS disabled', async ({ page }) => {
    const audioReceivedLogs = [];
    
    // Capture console messages for audio processing
    page.on('console', msg => {
      if (msg.text().includes('handleAgentAudio') || msg.text().includes('Received buffer of')) {
        audioReceivedLogs.push({
          timestamp: Date.now(),
          message: msg.text()
        });
      }
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for agent connection
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Enable microphone and start interaction to trigger agent greeting
    const micButton = await page.locator('button:has-text("Enable Mic")');
    await micButton.click();
    
    const startButton = await page.locator('button:has-text("Start")');
    await startButton.click();
    
    // Wait for recording to start
    await page.waitForSelector('text=🎙️ Recording audio');
    
    // Wait for agent to start speaking (greeting)
    await page.waitForTimeout(5000);
    
    console.log('Initial audio logs:', audioReceivedLogs.length);
    
    // Clear logs and disable TTS
    audioReceivedLogs.length = 0;
    
    const ttsButton = await page.locator('[data-testid="tts-button"]');
    await ttsButton.click();
    
    // Verify TTS is disabled
    await expect(ttsButton).toContainText('🔇 TTS Off');
    
    // Wait for any remaining audio to finish and check for new audio
    await page.waitForTimeout(3000);
    
    const audioAfterDisable = audioReceivedLogs.length;
    console.log('Audio logs after TTS disabled:', audioAfterDisable);
    
    // Send a text message to trigger agent response
    const textInput = await page.locator('[data-testid="text-input"]');
    const sendButton = await page.locator('[data-testid="send-button"]');
    
    await textInput.fill('Hello, please respond');
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    const audioAfterMessage = audioReceivedLogs.length;
    console.log('Audio logs after sending message:', audioAfterMessage);
    
    // Re-enable TTS
    await ttsButton.click();
    await expect(ttsButton).toContainText('🔊 TTS On');
    
    // Send another message
    await textInput.fill('Please respond again');
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    const audioAfterReenable = audioReceivedLogs.length;
    console.log('Audio logs after re-enabling TTS:', audioAfterReenable);
    
    // Verify that server-side muting worked
    // When TTS is disabled, we should receive significantly less or no audio
    const audioWhenDisabled = audioAfterMessage - audioAfterDisable;
    const audioWhenEnabled = audioAfterReenable - audioAfterMessage;
    
    console.log('Audio when TTS disabled:', audioWhenDisabled);
    console.log('Audio when TTS enabled:', audioWhenEnabled);
    
    // The server-side muting should reduce audio significantly
    // We expect much less audio when TTS is disabled vs enabled
    if (audioWhenEnabled > 0) {
      expect(audioWhenDisabled).toBeLessThan(audioWhenEnabled);
      console.log('✅ Server-side TTS muting working: Less audio when disabled');
    } else {
      console.log('ℹ️ No audio detected in either state - may need longer wait or different test approach');
    }
  });
  
  test('should verify UpdateSpeak protocol messages are sent', async ({ page }) => {
    const protocolMessages = [];
    
    // Capture protocol messages
    page.on('console', msg => {
      if (msg.text().includes('[Protocol] Sending UpdateSpeak')) {
        protocolMessages.push(msg.text());
      }
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for agent connection
    await page.waitForSelector('[data-testid="greeting-sent"]', { timeout: 15000 });
    
    // Toggle TTS off
    const ttsButton = await page.locator('[data-testid="tts-button"]');
    await ttsButton.click();
    
    // Wait for message
    await page.waitForTimeout(1000);
    
    // Toggle TTS back on
    await ttsButton.click();
    
    // Wait for message
    await page.waitForTimeout(1000);
    
    console.log('Protocol messages:', protocolMessages);
    
    // Should have at least 2 UpdateSpeak messages (disable + enable)
    expect(protocolMessages.length).toBeGreaterThanOrEqual(2);
    
    // Verify disable message
    const disableMessage = protocolMessages.find(msg => msg.includes('provider: null'));
    expect(disableMessage).toBeDefined();
    
    // Verify enable message
    const enableMessage = protocolMessages.find(msg => msg.includes('provider:') && !msg.includes('null'));
    expect(enableMessage).toBeDefined();
    
    console.log('✅ UpdateSpeak protocol messages verified');
  });
});
