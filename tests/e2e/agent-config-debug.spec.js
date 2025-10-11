import { test, expect } from '@playwright/test';

test.describe('Agent Configuration Debug', () => {
  test('should verify agent configuration and connection', async ({ page }) => {
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Check if we're in REAL API mode
    const apiModeIndicator = await page.locator('text=🟢 REAL API Mode').first();
    await expect(apiModeIndicator).toBeVisible({ timeout: 5000 });
    
    // Check if agent connection is established
    const agentConnection = await page.locator('text=Agent Connection:').locator('..').locator('strong');
    await expect(agentConnection).toContainText('connected', { timeout: 10000 });
    
    // Check if dual mode connection is ready
    const connectionReady = await page.locator('text=Connection Ready:').locator('..').locator('strong');
    await expect(connectionReady).toContainText('true', { timeout: 10000 });
    
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
    
    console.log('🎤 Configuration check complete - agent should be ready to respond');
    
    // Just verify the setup is correct - don't wait for agent to speak
    const recordingIndicator = await page.locator('text=🎙️ Recording audio');
    await expect(recordingIndicator).toBeVisible();
    
    console.log('✅ Agent configuration appears correct');
  });
});
