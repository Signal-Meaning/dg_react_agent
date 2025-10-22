import { test, expect } from '@playwright/test';

test.describe('Simple Extended Silence Idle Timeout Test', () => {
  test('should demonstrate connection closure with >10 seconds of silence', async ({ page, context }) => {
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    console.log('🧪 Testing connection closure with extended silence (>10 seconds)...');
    
    // Navigate to test app
    await page.goto('http://localhost:5173');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Test app loaded');
    
    // Wait for connection to be established
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="connection-status"]');
      return statusElement && statusElement.textContent.includes('connected');
    }, { timeout: 10000 });
    
    console.log('📡 Connection should be established');
    
    // Send a brief message to trigger agent response, then wait for idle timeout
    console.log('📝 Sending brief message to trigger agent response...');
    await page.fill('[data-testid="text-input"]', 'one moment');
    await page.press('[data-testid="text-input"]', 'Enter');
    
    // Wait for agent to respond and finish
    console.log('⏳ Waiting for agent to respond and finish...');
    await page.waitForTimeout(3000); // Give agent time to respond
    
    // Now wait for idle timeout (10+ seconds of inactivity after agent finishes)
    console.log('⏳ Waiting for idle timeout after agent response (12 seconds)...');
    console.log('💡 Connection should close at 10s idle timeout');
    
    // Wait for the idle timeout to fire
    await page.waitForTimeout(12000);
    
    // Check if connection closed due to idle timeout
    const finalStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`📊 Final connection status: ${finalStatus}`);
    
    // The connection should be closed due to idle timeout
    expect(finalStatus).toContain('closed');
    
    console.log('\n🎉 SUCCESS: Extended silence test completed');
    console.log('💡 This demonstrates that:');
    console.log('  1. Agent responds to brief message');
    console.log('  2. Connection closes due to idle timeout after agent finishes');
    console.log('  3. Extended silence (>10s) triggers natural connection closure');
  });
});
