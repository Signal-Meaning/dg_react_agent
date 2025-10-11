import { test, expect } from '@playwright/test';

test.describe('TTS Audio Control Bug Test', () => {
  test('should stop audio playback when TTS disabled during agent speaking', async ({ page }) => {
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Check if we're in REAL API mode
    const apiModeIndicator = await page.locator('text=🟢 REAL API Mode').first();
    await expect(apiModeIndicator).toBeVisible({ timeout: 5000 });
    
    // Enable microphone
    const micButton = await page.locator('button:has-text("Enable Mic")');
    await micButton.click();
    
    // Wait for microphone to be enabled
    await page.waitForSelector('text=Microphone enabled');
    
    // Start interaction to trigger agent greeting
    const startButton = await page.locator('button:has-text("Start")');
    await startButton.click();
    
    // Wait for recording to start
    await page.waitForSelector('text=🎙️ Recording audio');
    
    // Wait for agent to start speaking (greeting)
    await page.waitForTimeout(3000);
    
    // Check if agent is speaking
    const agentSpeakingIndicator = await page.locator('text=🎤 Agent is speaking');
    const isAgentSpeaking = await agentSpeakingIndicator.isVisible();
    
    if (isAgentSpeaking) {
      console.log('🎤 Agent is speaking - testing TTS disable during playback');
      
      // Disable TTS while agent is speaking
      const ttsButton = await page.locator('[data-testid="tts-button"]');
      await ttsButton.click();
      
      // Verify button shows disabled state
      await expect(ttsButton).toContainText('🔇 TTS Off');
      
      // Wait a moment for audio to stop
      await page.waitForTimeout(2000);
      
      // Check if agent is still speaking (it should be, but audio should be muted)
      const stillSpeaking = await agentSpeakingIndicator.isVisible();
      
      if (stillSpeaking) {
        console.log('⚠️ Agent is still speaking - this is expected, but audio should be muted');
        
        // The bug: Audio should stop playing when TTS is disabled
        // This test will FAIL if audio continues playing after TTS is disabled
        console.log('❌ BUG CONFIRMED: TTS disabled but agent still speaking audio');
        
        // For now, we expect this to fail until the bug is fixed
        expect(stillSpeaking).toBe(false); // This will fail until bug is fixed
      } else {
        console.log('✅ Agent stopped speaking when TTS was disabled');
      }
    } else {
      console.log('ℹ️ Agent is not speaking - cannot test TTS disable during playback');
      
      // Just verify TTS toggle works
      const ttsButton = await page.locator('[data-testid="tts-button"]');
      await ttsButton.click();
      await expect(ttsButton).toContainText('🔇 TTS Off');
    }
  });
  
  test('should verify TTS state affects actual audio playback', async ({ page }) => {
    // This test will monitor console logs to detect audio processing
    const consoleMessages = [];
    
    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Enable microphone and start interaction
    const micButton = await page.locator('button:has-text("Enable Mic")');
    await micButton.click();
    
    const startButton = await page.locator('button:has-text("Start")');
    await startButton.click();
    
    // Wait for agent to start speaking
    await page.waitForTimeout(3000);
    
    // Check if we have audio processing logs
    const audioLogs = consoleMessages.filter(msg => 
      msg.includes('handleAgentAudio') || 
      msg.includes('queueAudio') || 
      msg.includes('AudioManager')
    );
    
    if (audioLogs.length > 0) {
      console.log('🔊 Audio processing detected:', audioLogs.length, 'messages');
      
      // Disable TTS
      const ttsButton = await page.locator('[data-testid="tts-button"]');
      await ttsButton.click();
      await expect(ttsButton).toContainText('🔇 TTS Off');
      
      // Clear previous logs
      consoleMessages.length = 0;
      
      // Wait and check for new audio processing
      await page.waitForTimeout(2000);
      
      const newAudioLogs = consoleMessages.filter(msg => 
        msg.includes('handleAgentAudio') || 
        msg.includes('queueAudio') || 
        msg.includes('AudioManager')
      );
      
      if (newAudioLogs.length > 0) {
        console.log('❌ BUG: Audio still processing after TTS disabled:', newAudioLogs.length, 'new messages');
        console.log('Sample logs:', newAudioLogs.slice(0, 3));
        
        // This test will FAIL until the bug is fixed
        expect(newAudioLogs.length).toBe(0);
      } else {
        console.log('✅ Audio processing stopped when TTS was disabled');
      }
    } else {
      console.log('ℹ️ No audio processing detected - agent may not be speaking');
    }
  });
});
