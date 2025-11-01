/**
 * Diagnostic test for Issue #223 E2E test
 * This helps diagnose why waitForConnectionAndSettings is timing out
 */

import { test, expect } from '@playwright/test';
import { setupTestPage, waitForConnection } from './helpers/test-helpers.js';

test.describe('Diagnostic: Issue #223 E2E Test', () => {
  
  test('diagnose connection and settings flow', async ({ page, context }) => {
    console.log('🔍 Starting diagnostic for Issue #223 E2E test...');
    
    // Grant permissions
    await context.grantPermissions(['microphone', 'camera']);
    await setupTestPage(page);
    
    // Monitor console logs
    page.on('console', msg => {
      if (msg.text().includes('SettingsApplied') || 
          msg.text().includes('connection') || 
          msg.text().includes('Settings')) {
        console.log(`[PAGE LOG] ${msg.text()}`);
      }
    });
    
    // Check initial state
    const initialStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`📊 Initial connection status: ${initialStatus}`);
    
    const initialSettings = await page.locator('[data-testid="has-sent-settings"]').textContent();
    console.log(`📊 Initial settings status: ${initialSettings}`);
    
    // Set up settings callback tracking BEFORE clicking text input
    console.log('🔧 Setting up SettingsApplied callback tracking...');
    await page.evaluate(() => {
      window.testSettingsApplied = false;
      const originalCallback = window.onSettingsApplied;
      window.onSettingsApplied = () => {
        console.log('[DIAGNOSTIC] window.onSettingsApplied called!');
        window.testSettingsApplied = true;
        if (originalCallback) {
          originalCallback();
        }
      };
      console.log('[DIAGNOSTIC] Callback set up. window.onSettingsApplied:', typeof window.onSettingsApplied);
    });
    
    // Click text input to trigger auto-connect
    console.log('👆 Clicking text input to trigger auto-connect...');
    await page.click('[data-testid="text-input"]');
    
    // Wait a bit for connection attempt
    await page.waitForTimeout(2000);
    
    // Check connection status
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`📊 Connection status after click: ${connectionStatus}`);
    
    // Check if callback exists
    const callbackExists = await page.evaluate(() => {
      return typeof window.onSettingsApplied === 'function';
    });
    console.log(`📊 window.onSettingsApplied exists: ${callbackExists}`);
    
    // Check if testSettingsApplied flag was set
    const testSettingsApplied = await page.evaluate(() => {
      return window.testSettingsApplied === true;
    });
    console.log(`📊 window.testSettingsApplied flag: ${testSettingsApplied}`);
    
    // Try waiting for connection
    try {
      await waitForConnection(page, 10000);
      console.log('✅ Connection established');
    } catch (e) {
      console.log(`❌ Connection timeout: ${e.message}`);
    }
    
    // Check settings status
    await page.waitForTimeout(3000);
    const settingsStatus = await page.locator('[data-testid="has-sent-settings"]').textContent();
    console.log(`📊 Settings status after wait: ${settingsStatus}`);
    
    // Check if callback was called
    const callbackCalled = await page.evaluate(() => {
      return window.testSettingsApplied === true;
    });
    console.log(`📊 Callback was called: ${callbackCalled}`);
    
    // Check if component has onSettingsApplied prop set
    const hasCallback = await page.evaluate(() => {
      // Try to access the component's props via React DevTools or window ref
      const deepgramRef = window.deepgramRef;
      if (deepgramRef && deepgramRef.current) {
        return 'Component ref available';
      }
      return 'Component ref not available';
    });
    console.log(`📊 Component ref status: ${hasCallback}`);
    
    // Final diagnostic summary
    console.log('\n📋 DIAGNOSTIC SUMMARY:');
    console.log(`   Connection Status: ${connectionStatus}`);
    console.log(`   Settings Status: ${settingsStatus}`);
    console.log(`   Callback Exists: ${callbackExists}`);
    console.log(`   Callback Called: ${callbackCalled}`);
    console.log(`   Test Flag Set: ${testSettingsApplied}`);
  });
});

