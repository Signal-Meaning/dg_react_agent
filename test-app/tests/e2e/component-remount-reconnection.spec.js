/**
 * Component Remount Detection During Reconnection Test
 * 
 * This test reproduces Issue #357/#769: Component remounting during reconnection scenarios
 * 
 * The component should remain stable (≤2 mounts: initial + StrictMode) during
 * multiple disconnect/reconnect cycles, even when callbacks trigger parent re-renders.
 * 
 * This test specifically targets the scenario where the component remounts
 * multiple times during the second reconnection, causing page crashes.
 */

import { test, expect } from '@playwright/test';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { 
  BASE_URL,
  buildUrlWithParams
} from './helpers/test-helpers.mjs';

test.describe('Component Remount Detection During Reconnection (Issue #357)', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permissions before navigation
    await context.grantPermissions(['microphone']);
  });
  
  test('should not remount during multiple reconnection cycles', async ({ page }) => {
    console.log('🔧 Testing component remounting behavior during multiple reconnection cycles...');
    
    // Capture console logs to track component initialization
    const initLogs = [];
    const mountIds = [];
    
    page.on('console', msg => {
      const text = msg.text();
      
      // Capture component initialization logs
      if (text.includes('[Component] DeepgramVoiceInteraction') && 
          (text.includes('initialized') || text.includes('Component initialized'))) {
        initLogs.push({
          text,
          timestamp: Date.now()
        });
        
        // Extract mountId from log (handle both old and new log formats)
        try {
          // Try to parse as JSON first (new format)
          if (text.includes('{')) {
            const jsonMatch = text.match(/\{([^}]+)\}/);
            if (jsonMatch) {
              const jsonStr = '{' + jsonMatch[1] + '}';
              const parsed = JSON.parse(jsonStr);
              if (parsed.mountId) {
                mountIds.push(parsed.mountId);
              }
            }
          }
          
          // Fallback: regex extraction
          const match = text.match(/mountId["\s:]+([^,}\s"']+)/);
          if (match && !mountIds.includes(match[1])) {
            mountIds.push(match[1]);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    
    // Navigate to test app
    await page.goto(buildUrlWithParams(BASE_URL, { 'test-mode': 'true' }));
    
    // Use MicrophoneHelpers for reliable microphone activation and connection
    const micResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    if (!micResult.success) {
      throw new Error(`Microphone activation failed: ${micResult.error}`);
    }
    
    console.log('✅ Initial connection established and settings applied');
    
    // Wait for initial mounts to settle (component + StrictMode if in dev)
    await page.waitForTimeout(1000);
    
    const initialMountCount = initLogs.length;
    const initialMountIds = [...mountIds];
    
    console.log(`📊 Initial mounts detected: ${initialMountCount}`);
    console.log(`📊 Initial mount IDs: ${initialMountIds.join(', ')}`);
    
    // Step 1: Send first message
    console.log('📝 Step 1: Sending first message');
    const firstMessage = "Hello, I need help with my project.";
    await page.fill('input[type="text"]', firstMessage);
    await page.click('button:has-text("Send")');
    
    // Wait for agent response
    await page.waitForTimeout(3000);
    console.log('✅ First message sent and agent responded');
    
    // Check mount count after first message
    const afterFirstMessageMountCount = initLogs.length;
    const afterFirstMessageMountIds = [...mountIds];
    console.log(`📊 Mounts after first message: ${afterFirstMessageMountCount}`);
    
    // Step 2: First disconnect and reconnect
    console.log('⏸️ Step 2: First disconnect and reconnect');
    
    // Disconnect
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        window.deepgramRef.current.stop();
      }
    });
    await page.waitForTimeout(1000);
    console.log('✅ Component disconnected');
    
    // Reconnect
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        window.deepgramRef.current.start();
      }
    });
    
    // Wait for reconnection
    await page.waitForTimeout(3000);
    console.log('✅ First reconnection completed');
    
    // Check mount count after first reconnection
    const afterFirstReconnectMountCount = initLogs.length;
    const afterFirstReconnectMountIds = [...mountIds];
    const firstReconnectRemounts = afterFirstReconnectMountCount - afterFirstMessageMountCount;
    console.log(`📊 Mounts after first reconnect: ${afterFirstReconnectMountCount}`);
    console.log(`📊 Remounts during first reconnect: ${firstReconnectRemounts}`);
    
    // Step 3: Send second message
    console.log('📝 Step 3: Sending second message');
    const secondMessage = "Can you help me further?";
    await page.fill('input[type="text"]', secondMessage);
    await page.click('button:has-text("Send")');
    
    // Wait for agent response
    await page.waitForTimeout(3000);
    console.log('✅ Second message sent and agent responded');
    
    // Check mount count after second message
    const afterSecondMessageMountCount = initLogs.length;
    const afterSecondMessageMountIds = [...mountIds];
    console.log(`📊 Mounts after second message: ${afterSecondMessageMountCount}`);
    
    // Step 4: Second disconnect and reconnect (this is where the remount loop happens)
    console.log('⏸️ Step 4: Second disconnect and reconnect (critical point)');
    
    // Disconnect
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        window.deepgramRef.current.stop();
      }
    });
    await page.waitForTimeout(1000);
    console.log('✅ Component disconnected again');
    
    // Reconnect - this is where the remount loop occurs according to customer report
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        window.deepgramRef.current.start();
      }
    });
    
    // Wait for reconnection and any remounts to occur
    await page.waitForTimeout(5000); // Longer wait to catch remount loop
    console.log('✅ Second reconnection completed');
    
    // Final mount count
    const finalMountCount = initLogs.length;
    const finalMountIds = [...mountIds];
    const secondReconnectRemounts = finalMountCount - afterSecondMessageMountCount;
    
    console.log(`📊 Final mounts detected: ${finalMountCount}`);
    console.log(`📊 All mount IDs: ${Array.from(new Set(finalMountIds)).join(', ')}`);
    console.log(`📊 Remounts during second reconnect: ${secondReconnectRemounts}`);
    
    // Count unique mount IDs
    const uniqueMountIds = new Set(finalMountIds);
    const uniqueMountCount = uniqueMountIds.size;
    const totalRemounts = finalMountCount - initialMountCount;
    
    console.log(`📊 Unique mount IDs: ${uniqueMountCount}`);
    console.log(`📊 Total remounts during test: ${totalRemounts}`);
    
    // Component should mount at most 2 times:
    // 1. Initial mount
    // 2. StrictMode re-mount (in development)
    // Any additional mounts indicate the remounting bug
    expect(uniqueMountCount).toBeLessThanOrEqual(2);
    
    if (uniqueMountCount > 2 || totalRemounts > 0) {
      console.error(`❌ BUG REPRODUCED: Component remounted ${totalRemounts} time(s) during reconnection cycles`);
      console.error(`   Total unique mounts: ${uniqueMountCount} (expected ≤2)`);
      console.error(`   Remounts during first reconnect: ${firstReconnectRemounts}`);
      console.error(`   Remounts during second reconnect: ${secondReconnectRemounts}`);
      console.error(`   Mount IDs: ${Array.from(uniqueMountIds).join(', ')}`);
      console.error(`   Mount logs:`, initLogs.map(log => ({
        time: new Date(log.timestamp).toISOString(),
        text: log.text.substring(0, 150)
      })));
      throw new Error(`Component remounted ${totalRemounts} time(s) during reconnection cycles (expected 0). First reconnect: ${firstReconnectRemounts}, Second reconnect: ${secondReconnectRemounts}`);
    } else {
      console.log('✅ Component remained stable - no excessive remounting detected during reconnection cycles');
    }
  });
});
