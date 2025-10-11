import { test, expect } from '@playwright/test';

test.describe('Agent Connection Debug', () => {
  test('should check browser console for agent connection errors', async ({ page }) => {
    const consoleMessages = [];
    
    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Start the test-app server
    await page.goto('http://localhost:5173');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]');
    
    // Wait a bit for any connection attempts
    await page.waitForTimeout(5000);
    
    // Check console messages for errors
    const errorMessages = consoleMessages.filter(msg => msg.includes('[error]') || msg.includes('Error') || msg.includes('Failed'));
    
    console.log('=== CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => console.log(msg));
    
    console.log('=== ERROR MESSAGES ===');
    errorMessages.forEach(msg => console.log(msg));
    
    // Check if we're in REAL API mode
    const apiModeIndicator = await page.locator('text=🟢 REAL API Mode').first();
    await expect(apiModeIndicator).toBeVisible({ timeout: 5000 });
    
    // Check agent connection status
    const agentConnection = await page.locator('text=Agent Connection:').locator('..').locator('strong').first();
    const connectionStatus = await agentConnection.textContent();
    
    console.log(`Agent Connection Status: ${connectionStatus}`);
    
    if (connectionStatus === 'closed') {
      console.log('❌ Agent connection is closed - this explains why TTS is not working');
      console.log('Check the error messages above for connection issues');
    } else if (connectionStatus === 'connected') {
      console.log('✅ Agent connection is working');
    } else {
      console.log(`⚠️ Agent connection status: ${connectionStatus}`);
    }
  });
});
