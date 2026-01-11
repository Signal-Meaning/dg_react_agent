/**
 * Component Remount Detection - Customer Scenario (Issue #769)
 * 
 * This test reproduces the EXACT customer scenario where the component remounts
 * 7 times during reconnection, even when props are stable.
 * 
 * Customer reports:
 * - Component remounts 7 times during test (v0.7.8, down from 9 in v0.7.7)
 * - "Options unchanged" log appears, confirming agentOptions is stable
 * - Component still remounts for other reasons
 * - Happens during second reconnection specifically
 * 
 * This test tracks actual React component remounts by monitoring:
 * 1. Component initialization logs (from our component)
 * 2. Parent component mount logs (from customer's App.tsx pattern)
 * 3. Unique mount IDs to detect actual remounts vs re-renders
 */

import { test, expect } from '@playwright/test';
import { 
  BASE_URL,
  buildUrlWithParams
} from './helpers/test-helpers.mjs';

test.describe('Component Remount - Customer Scenario (Issue #769)', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permissions before navigation
    await context.grantPermissions(['microphone']);
  });
  
  test('should not remount during multiple reconnections with stable props', async ({ page }) => {
    console.log('🔧 Testing component remounting behavior - Customer Scenario (Issue #769)...');
    
    // Track ALL mount-related logs to detect remounts
    const mountLogs = [];
    const mountIds = new Set();
    const appMountLogs = [];
    
    page.on('console', msg => {
      const text = msg.text();
      
        // Track component MOUNT logs (actual React remounts)
      if (text.includes('[Component] DeepgramVoiceInteraction component MOUNTED')) {
        mountLogs.push({
          type: 'component_mount',
          text,
          timestamp: Date.now()
        });
        
        // Extract instanceId from log
        try {
          if (text.includes('{')) {
            const jsonMatch = text.match(/\{([^}]+)\}/);
            if (jsonMatch) {
              const jsonStr = '{' + jsonMatch[1] + '}';
              const parsed = JSON.parse(jsonStr);
              if (parsed.instanceId) {
                mountIds.add(parsed.instanceId);
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Track component REMOUNT warnings
      if (text.includes('COMPONENT REMOUNT DETECTED')) {
        mountLogs.push({
          type: 'component_remount_warning',
          text,
          timestamp: Date.now()
        });
      }
      
      // Track component initialization logs (from our component)
      if (text.includes('[Component] DeepgramVoiceInteraction') && 
          (text.includes('initialized') || text.includes('Component initialized'))) {
        mountLogs.push({
          type: 'component_init',
          text,
          timestamp: Date.now()
        });
        
        // Extract mountId from log
        try {
          if (text.includes('{')) {
            const jsonMatch = text.match(/\{([^}]+)\}/);
            if (jsonMatch) {
              const jsonStr = '{' + jsonMatch[1] + '}';
              const parsed = JSON.parse(jsonStr);
              if (parsed.mountId) {
                mountIds.add(parsed.mountId);
              }
            }
          }
          
          const match = text.match(/mountId["\s:]+([^,}\s"']+)/);
          if (match) {
            mountIds.add(match[1]);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Track parent component mount logs (customer's pattern: "🔧 [App.tsx] DeepgramVoiceInteraction component mounted.")
      if (text.includes('[App.tsx]') && text.includes('component mounted')) {
        appMountLogs.push({
          type: 'app_mount',
          text,
          timestamp: Date.now()
        });
      }
      
      // Track "Options unchanged" logs to confirm props are stable
      if (text.includes('Options unchanged') || text.includes('returning cached reference')) {
        mountLogs.push({
          type: 'options_stable',
          text,
          timestamp: Date.now()
        });
      }
    });
    
    // Enable remount debugging
    await page.addInitScript(() => {
      window.__DEEPGRAM_DEBUG_REMOUNTS__ = true;
    });
    
    // Navigate to test app
    await page.goto(buildUrlWithParams(BASE_URL, { 'test-mode': 'true', 'debug': 'true' }));
    
    // Wait for component to mount initially
    await page.waitForTimeout(2000);
    
    const initialMountCount = mountLogs.filter(log => log.type === 'component_mount').length;
    const initialInitCount = mountLogs.filter(log => log.type === 'component_init').length;
    const initialRemountWarnings = mountLogs.filter(log => log.type === 'component_remount_warning').length;
    const initialAppMountCount = appMountLogs.length;
    const initialUniqueMountIds = new Set(mountIds);
    
    console.log(`📊 Initial state:`);
    console.log(`   Component MOUNT logs (actual remounts): ${initialMountCount}`);
    console.log(`   Component INIT logs (initialization): ${initialInitCount}`);
    console.log(`   Remount warnings: ${initialRemountWarnings}`);
    console.log(`   App mount logs: ${initialAppMountCount}`);
    console.log(`   Unique mount IDs: ${initialUniqueMountIds.size}`);
    
    // Step 1: Connect to agent (using text input to avoid microphone complexity)
    console.log('📝 Step 1: Connecting via text input');
    await page.fill('input[type="text"]', 'test');
    await page.click('button:has-text("Send")');
    
    // Wait for connection
    await page.waitForTimeout(3000);
    console.log('✅ Connection established');
    
    const afterConnectionMountCount = mountLogs.filter(log => log.type === 'component_mount').length;
    const afterConnectionInitCount = mountLogs.filter(log => log.type === 'component_init').length;
    const afterConnectionRemountWarnings = mountLogs.filter(log => log.type === 'component_remount_warning').length;
    const afterConnectionAppMountCount = appMountLogs.length;
    console.log(`📊 After connection:`);
    console.log(`   Component MOUNT logs: ${afterConnectionMountCount}`);
    console.log(`   Component INIT logs: ${afterConnectionInitCount}`);
    console.log(`   Remount warnings: ${afterConnectionRemountWarnings}`);
    console.log(`   App mount logs: ${afterConnectionAppMountCount}`);
    
    // Step 2: Send first message
    console.log('📝 Step 2: Sending first message');
    const firstMessage = "Hello, I need help with my project.";
    await page.fill('input[type="text"]', firstMessage);
    await page.click('button:has-text("Send")');
    
    await page.waitForTimeout(3000);
    console.log('✅ First message sent');
    
    const afterFirstMessageMountCount = mountLogs.filter(log => log.type === 'component_mount').length;
    const afterFirstMessageInitCount = mountLogs.filter(log => log.type === 'component_init').length;
    const afterFirstMessageRemountWarnings = mountLogs.filter(log => log.type === 'component_remount_warning').length;
    const afterFirstMessageAppMountCount = appMountLogs.length;
    console.log(`📊 After first message:`);
    console.log(`   Component MOUNT logs: ${afterFirstMessageMountCount}`);
    console.log(`   Component INIT logs: ${afterFirstMessageInitCount}`);
    console.log(`   Remount warnings: ${afterFirstMessageRemountWarnings}`);
    console.log(`   App mount logs: ${afterFirstMessageAppMountCount}`);
    
    // Step 3: First disconnect and reconnect
    console.log('⏸️ Step 3: First disconnect and reconnect');
    
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        window.deepgramRef.current.stop();
      }
    });
    await page.waitForTimeout(2000);
    console.log('✅ Disconnected');
    
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        window.deepgramRef.current.start();
      }
    });
    await page.waitForTimeout(3000);
    console.log('✅ First reconnection completed');
    
    const afterFirstReconnectMountCount = mountLogs.filter(log => log.type === 'component_mount').length;
    const afterFirstReconnectInitCount = mountLogs.filter(log => log.type === 'component_init').length;
    const afterFirstReconnectRemountWarnings = mountLogs.filter(log => log.type === 'component_remount_warning').length;
    const afterFirstReconnectAppMountCount = appMountLogs.length;
    const firstReconnectRemounts = afterFirstReconnectMountCount - afterFirstMessageMountCount;
    console.log(`📊 After first reconnect:`);
    console.log(`   Component MOUNT logs: ${afterFirstReconnectMountCount}`);
    console.log(`   Component INIT logs: ${afterFirstReconnectInitCount}`);
    console.log(`   Remount warnings: ${afterFirstReconnectRemountWarnings}`);
    console.log(`   App mount logs: ${afterFirstReconnectAppMountCount}`);
    console.log(`   Remounts during first reconnect: ${firstReconnectRemounts}`);
    
    // Step 4: Send second message
    console.log('📝 Step 4: Sending second message');
    const secondMessage = "Can you help me further?";
    await page.fill('input[type="text"]', secondMessage);
    await page.click('button:has-text("Send")');
    
    await page.waitForTimeout(3000);
    console.log('✅ Second message sent');
    
    const afterSecondMessageMountCount = mountLogs.filter(log => log.type === 'component_mount').length;
    const afterSecondMessageInitCount = mountLogs.filter(log => log.type === 'component_init').length;
    const afterSecondMessageRemountWarnings = mountLogs.filter(log => log.type === 'component_remount_warning').length;
    const afterSecondMessageAppMountCount = appMountLogs.length;
    console.log(`📊 After second message:`);
    console.log(`   Component MOUNT logs: ${afterSecondMessageMountCount}`);
    console.log(`   Component INIT logs: ${afterSecondMessageInitCount}`);
    console.log(`   Remount warnings: ${afterSecondMessageRemountWarnings}`);
    console.log(`   App mount logs: ${afterSecondMessageAppMountCount}`);
    
    // Step 5: Second disconnect and reconnect (CRITICAL - this is where customer sees remount loop)
    console.log('⏸️ Step 5: Second disconnect and reconnect (CRITICAL POINT)');
    
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        window.deepgramRef.current.stop();
      }
    });
    await page.waitForTimeout(2000);
    console.log('✅ Disconnected again');
    
    // Clear mount tracking before reconnect to catch remounts
    const beforeSecondReconnectMountCount = mountLogs.filter(log => log.type === 'component_mount').length;
    const beforeSecondReconnectInitCount = mountLogs.filter(log => log.type === 'component_init').length;
    const beforeSecondReconnectRemountWarnings = mountLogs.filter(log => log.type === 'component_remount_warning').length;
    const beforeSecondReconnectAppMountCount = appMountLogs.length;
    
    await page.evaluate(() => {
      if (window.deepgramRef?.current) {
        window.deepgramRef.current.start();
      }
    });
    
    // Wait longer to catch remount loop (customer reports remounts happen here)
    await page.waitForTimeout(8000);
    console.log('✅ Second reconnection completed');
    
    const finalMountCount = mountLogs.filter(log => log.type === 'component_mount').length;
    const finalInitCount = mountLogs.filter(log => log.type === 'component_init').length;
    const finalRemountWarnings = mountLogs.filter(log => log.type === 'component_remount_warning').length;
    const finalAppMountCount = appMountLogs.length;
    const secondReconnectRemounts = finalMountCount - beforeSecondReconnectMountCount;
    const secondReconnectAppRemounts = finalAppMountCount - beforeSecondReconnectAppMountCount;
    
    // Count unique mount IDs
    const finalUniqueMountIds = new Set(mountIds);
    const uniqueMountCount = finalUniqueMountIds.size;
    const totalRemounts = finalMountCount - initialMountCount;
    
    console.log(`📊 Final state:`);
    console.log(`   Total component MOUNT logs (actual remounts): ${finalMountCount}`);
    console.log(`   Total component INIT logs (initialization): ${finalInitCount}`);
    console.log(`   Total remount warnings: ${finalRemountWarnings}`);
    console.log(`   Total app mount logs: ${finalAppMountCount}`);
    console.log(`   Unique mount IDs: ${uniqueMountCount}`);
    console.log(`   Total remounts: ${totalRemounts}`);
    console.log(`   Remounts during second reconnect: ${secondReconnectRemounts}`);
    console.log(`   App remounts during second reconnect: ${secondReconnectAppRemounts}`);
    
    // Check for "Options unchanged" logs to confirm props are stable
    const optionsStableLogs = mountLogs.filter(log => log.type === 'options_stable');
    console.log(`📊 Options stable logs: ${optionsStableLogs.length} (confirming props are stable)`);
    
    // Component should mount at most 2 times (initial + StrictMode)
    // Customer reports 7 remounts, so this test should FAIL until we fix it
    expect(uniqueMountCount).toBeLessThanOrEqual(2);
    expect(totalRemounts).toBeLessThanOrEqual(0);
    
    // Component should mount at most 2 times (initial + StrictMode)
    // Customer reports 7 remounts, so this test should FAIL until we fix it
    const maxAllowedMounts = 2;
    const maxAllowedRemounts = 0;
    
    if (uniqueMountCount > maxAllowedMounts || totalRemounts > maxAllowedRemounts || finalRemountWarnings > 0) {
      console.error(`❌ BUG REPRODUCED: Component remounted ${totalRemounts} time(s)`);
      console.error(`   Unique mounts: ${uniqueMountCount} (expected ≤${maxAllowedMounts})`);
      console.error(`   Remount warnings: ${finalRemountWarnings} (actual React remounts detected)`);
      console.error(`   Remounts during first reconnect: ${firstReconnectRemounts}`);
      console.error(`   Remounts during second reconnect: ${secondReconnectRemounts}`);
      console.error(`   App remounts during second reconnect: ${secondReconnectAppRemounts}`);
      console.error(`   Options stable logs: ${optionsStableLogs.length} (props ARE stable)`);
      console.error(`   Mount IDs: ${Array.from(finalUniqueMountIds).join(', ')}`);
      console.error(`   All mount logs:`, mountLogs.map(log => ({
        type: log.type,
        time: new Date(log.timestamp).toISOString(),
        text: log.text.substring(0, 200)
      })));
      
      throw new Error(
        `Component remounted ${totalRemounts} time(s) even with stable props (expected ${maxAllowedRemounts}). ` +
        `Unique mounts: ${uniqueMountCount} (expected ≤${maxAllowedMounts}). ` +
        `Remount warnings: ${finalRemountWarnings} (actual React remounts). ` +
        `Second reconnect remounts: ${secondReconnectRemounts}. ` +
        `This confirms the bug reported in Issue #769.`
      );
    } else {
      console.log('✅ Component remained stable - no excessive remounting detected');
    }
  });
});
