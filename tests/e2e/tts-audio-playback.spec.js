import { test, expect } from '@playwright/test';

test.describe('TTS Audio Playback E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait for the component to be ready
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="connection-status"]');
      return statusElement && statusElement.textContent?.includes('connected');
    }, { timeout: 10000 });
  });

  test('should play TTS audio when agent speaks', async ({ page }) => {
    // Check if we're in REAL API mode (not MOCK)
    const apiModeIndicator = await page.locator('text=🟢 REAL API Mode').first();
    await expect(apiModeIndicator).toBeVisible({ timeout: 5000 });
    
    // Verify TTS is enabled
    const ttsStatus = await page.locator('text=TTS: 🔊 Enabled').first();
    await expect(ttsStatus).toBeVisible();
    
    // Enable microphone
    const micButton = await page.locator('button:has-text("Enable Mic")');
    await micButton.click();
    
    // Wait for microphone to be enabled
    await page.waitForSelector('text=Microphone enabled');
    
    // Start interaction
    const startButton = await page.locator('button:has-text("Start")');
    await startButton.click();
    
    // Wait for recording to start
    await page.waitForSelector('text=🎙️ Recording audio');
    
    // Speak something to trigger agent response
    console.log('🎤 Please speak something to trigger agent response...');
    
    // Wait for agent to start speaking (this should trigger TTS)
    await page.waitForSelector('text=🎤 Agent is speaking', { timeout: 30000 });
    
    // At this point, TTS audio should be playing
    // We can't directly test audio playback, but we can verify the state
    const agentSpeakingIndicator = await page.locator('text=🎤 Agent is speaking');
    await expect(agentSpeakingIndicator).toBeVisible();
    
    // Wait for agent to finish speaking
    await page.waitForSelector('text=✅ Agent finished speaking', { timeout: 30000 });
    
    // Verify the agent response was received
    const agentResponse = await page.locator('text=Agent Response').locator('..').locator('p');
    const responseText = await agentResponse.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText?.length).toBeGreaterThan(0);
    
    console.log('✅ TTS test completed - agent spoke:', responseText);
  });

  test('should disable TTS audio when TTS toggle is off', async ({ page }) => {
    // Check if we're in REAL API mode
    const apiModeIndicator = await page.locator('text=🟢 REAL API Mode').first();
    await expect(apiModeIndicator).toBeVisible({ timeout: 5000 });
    
    // Disable TTS
    const ttsButton = await page.locator('button:has-text("🔊 TTS On")');
    await ttsButton.click();
    
    // Verify TTS is disabled
    const ttsStatus = await page.locator('text=TTS: 🔇 Disabled').first();
    await expect(ttsStatus).toBeVisible();
    
    // Enable microphone
    const micButton = await page.locator('button:has-text("Enable Mic")');
    await micButton.click();
    
    // Start interaction
    const startButton = await page.locator('button:has-text("Start")');
    await startButton.click();
    
    // Wait for recording to start
    await page.waitForSelector('text=🎙️ Recording audio');
    
    console.log('🎤 Please speak something to trigger agent response...');
    
    // Wait for agent to start speaking
    await page.waitForSelector('text=🎤 Agent is speaking', { timeout: 30000 });
    
    // Verify agent is speaking but TTS is disabled
    const agentSpeakingIndicator = await page.locator('text=🎤 Agent is speaking');
    await expect(agentSpeakingIndicator).toBeVisible();
    
    const ttsDisabledStatus = await page.locator('text=TTS: 🔇 Disabled');
    await expect(ttsDisabledStatus).toBeVisible();
    
    console.log('✅ TTS disabled test completed - agent spoke but TTS was off');
  });

  test('should show TTS toggle button and status', async ({ page }) => {
    // Check TTS button is visible
    const ttsButton = await page.locator('button:has-text("🔊 TTS On")');
    await expect(ttsButton).toBeVisible();
    
    // Check TTS status is shown
    const ttsStatus = await page.locator('text=TTS: 🔊 Enabled').first();
    await expect(ttsStatus).toBeVisible();
    
    // Toggle TTS off
    await ttsButton.click();
    
    // Check status updated
    const ttsDisabledStatus = await page.locator('text=TTS: 🔇 Disabled').first();
    await expect(ttsDisabledStatus).toBeVisible();
    
    // Toggle back on
    const ttsOffButton = await page.locator('button:has-text("🔇 TTS Off")');
    await ttsOffButton.click();
    
    // Check status updated back
    const ttsEnabledStatus = await page.locator('text=TTS: 🔊 Enabled').first();
    await expect(ttsEnabledStatus).toBeVisible();
  });
});
