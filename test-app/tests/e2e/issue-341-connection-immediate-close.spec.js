/**
 * E2E Test: Issue #341 - Connection Closes Immediately After Being Reported as Connected
 * 
 * This test demonstrates the defect where connections are reported as "connected"
 * via onConnectionStateChange callback, but the WebSocket connection closes
 * immediately after (within 100-200ms).
 * 
 * Expected Behavior (After Fix):
 * - Connection should remain stable after being reported as "connected"
 * - onConnectionStateChange('agent', 'connected') should indicate a stable connection
 * - Connection should not close immediately after being reported as connected
 * - Connection should only close due to explicit errors or user actions
 * 
 * Current Behavior (Demonstrating Defect):
 * - onConnectionStateChange('agent', 'connected') is called
 * - Connection closes immediately after (within 100-200ms)
 * - Connection state transitions: connecting -> connected -> closed
 * 
 * Test Approach:
 * - Uses real Deepgram API connection
 * - Monitors connection state changes with precise timing
 * - Verifies connection remains stable after being reported as connected
 */

import { test, expect } from '@playwright/test';
import {
  skipIfNoRealAPI,
  setupTestPage,
  waitForConnection,
  setupConnectionStateTracking,
} from './helpers/test-helpers.js';

test.describe('Issue #341: Connection Closes Immediately After Connected', () => {
  test.beforeEach(async ({ page, context }) => {
    skipIfNoRealAPI('Requires real Deepgram API key to test connection stability');
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
  });

  test('should maintain stable connection after being reported as connected (FAILS when defect is present)', async ({ page }) => {
    console.log('🧪 Testing Issue #341: Connection stability after being reported as connected');
    
    // Capture console logs to see detailed error information
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('ISSUE #341') || text.includes('error') || text.includes('Error') || text.includes('close') || text.includes('Close')) {
        consoleMessages.push(text);
        console.log(`[Browser Console] ${text}`);
      }
    });
    
    // Step 1: Set up page with debug mode enabled to trace API key
    await page.goto('http://localhost:5173?debug=true');
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Step 2: Set up connection state tracking with precise timing
    const stateTracking = await setupConnectionStateTracking(page);
    
    // Step 3: Trigger connection by clicking text input (lazy initialization requires explicit trigger)
    console.log('📤 Triggering connection by clicking text input...');
    await page.click('[data-testid="text-input"]');
    await page.waitForTimeout(200); // Brief delay for connection to start
    
    // Step 4: Monitor connection state changes with timestamps
    const stateChanges = [];
    let connectedTimestamp = null;
    let closedTimestamp = null;
    
    // Poll connection state with high frequency to catch immediate closes
    const startTime = Date.now();
    const checkInterval = 50; // Check every 50ms
    const maxWaitTime = 5000; // Maximum 5 seconds
    
    console.log('⏳ Waiting for connection...');
    
    // Wait for connection to be reported as "connected" OR detect immediate close
    // If connection closes immediately (the defect), it may never reach "connected"
    try {
      await waitForConnection(page, 30000);
      connectedTimestamp = Date.now();
    } catch (error) {
      // Connection might have closed immediately - check current state
      const currentStates = await stateTracking.getStates();
      console.log('⚠️ Connection wait timed out. Current state:', currentStates);
      
      // If we see "closed" state, this demonstrates the defect
      if (currentStates.agent === 'closed') {
        console.log('❌ Connection closed immediately (defect detected)');
        connectedTimestamp = Date.now(); // Use current time as reference
        closedTimestamp = Date.now();
      } else {
        // Re-throw if it's a different issue
        throw error;
      }
    }
    
    const timeToConnect = connectedTimestamp - startTime;
    console.log(`✅ Connection reported as "connected" at ${timeToConnect}ms`);
    
    // Step 4: Immediately start monitoring for connection close
    // Check connection state every 50ms for the next 500ms
    // This catches the immediate close (100-200ms) reported in the defect
    const monitoringDuration = 500; // Monitor for 500ms after connection
    const monitoringEndTime = connectedTimestamp + monitoringDuration;
    
    console.log(`🔍 Monitoring connection stability for ${monitoringDuration}ms after connection...`);
    
    while (Date.now() < monitoringEndTime) {
      const currentStates = await stateTracking.getStates();
      const currentTime = Date.now();
      const timeSinceConnected = currentTime - connectedTimestamp;
      
      stateChanges.push({
        time: currentTime,
        timeSinceConnected,
        state: currentStates.agent,
        isConnected: currentStates.agentConnected,
      });
      
      // If connection closed, record the timestamp
      if (!currentStates.agentConnected && currentStates.agent === 'closed' && !closedTimestamp) {
        closedTimestamp = currentTime;
        const timeToClose = closedTimestamp - connectedTimestamp;
        console.log(`❌ Connection closed at ${timeToClose}ms after being reported as connected`);
        break; // Stop monitoring if connection closed
      }
      
      // Wait before next check
      await page.waitForTimeout(checkInterval);
    }
    
    // Step 5: Verify connection remained stable
    const finalStates = await stateTracking.getStates();
    const finalTimeSinceConnected = Date.now() - connectedTimestamp;
    
    console.log('📊 Connection state monitoring results:', {
      connectedAt: connectedTimestamp,
      closedAt: closedTimestamp,
      timeToClose: closedTimestamp ? (closedTimestamp - connectedTimestamp) : null,
      finalState: finalStates.agent,
      finalIsConnected: finalStates.agentConnected,
      totalMonitoringTime: finalTimeSinceConnected,
      stateChanges: stateChanges.length,
    });
    
    // Log captured console messages for debugging
    if (consoleMessages.length > 0) {
      console.log('📋 Captured browser console messages:', consoleMessages);
    }
    
    // Assert: Connection should remain stable (correct behavior)
    // This test FAILS when defect is present (connection closes within 100-200ms)
    // This test PASSES when defect is fixed (connection remains stable)
    expect(finalStates.agentConnected).toBe(true);
    expect(finalStates.agent).toBe('connected');
    
    // Assert: Connection should NOT have closed immediately
    // If it closed, it should have taken longer than the defect window (200ms)
    if (closedTimestamp) {
      const timeToClose = closedTimestamp - connectedTimestamp;
      console.log(`⚠️ Connection closed after ${timeToClose}ms (defect window: 100-200ms)`);
      
      // This assertion will fail when defect is present (closes within 200ms)
      // This assertion will pass when defect is fixed (doesn't close or closes much later)
      expect(timeToClose).toBeGreaterThan(200);
    } else {
      console.log('✅ Connection remained stable throughout monitoring period');
    }
  });

  test('should not transition to closed state immediately after connected (FAILS when defect is present)', async ({ page }) => {
    console.log('🧪 Testing Issue #341: Connection state transitions');
    
    // Step 1: Set up page
    await setupTestPage(page);
    
    // Step 2: Track all connection state transitions
    const stateTransitions = [];
    
    // Set up state tracking
    const stateTracking = await setupConnectionStateTracking(page);
    
    // Step 3: Trigger connection by clicking text input (lazy initialization requires explicit trigger)
    console.log('📤 Triggering connection by clicking text input...');
    await page.click('[data-testid="text-input"]');
    await page.waitForTimeout(200); // Brief delay for connection to start
    
    // Poll state with high frequency
    const startTime = Date.now();
    const checkInterval = 25; // Check every 25ms for better precision
    const monitoringDuration = 1000; // Monitor for 1 second
    
    console.log('⏳ Waiting for connection and monitoring state transitions...');
    
    // Wait for connection OR detect immediate close
    let connectedTime = null;
    try {
      await waitForConnection(page, 30000);
      connectedTime = Date.now();
    } catch (error) {
      // Connection might have closed immediately - check current state
      const currentStates = await stateTracking.getStates();
      console.log('⚠️ Connection wait timed out. Current state:', currentStates);
      
      // If we see "closed" state, this demonstrates the defect
      if (currentStates.agent === 'closed') {
        console.log('❌ Connection closed immediately (defect detected)');
        connectedTime = Date.now(); // Use current time as reference
        stateTransitions.push({
          from: 'connecting',
          to: 'closed',
          time: Date.now(),
          timeSinceConnected: 0,
        });
      } else {
        // Re-throw if it's a different issue
        throw error;
      }
    }
    console.log(`✅ Connection reported as "connected" at ${connectedTime - startTime}ms`);
    
    // Monitor state transitions after connection
    const monitoringEndTime = connectedTime + monitoringDuration;
    let lastState = 'connected';
    
    while (Date.now() < monitoringEndTime) {
      const currentStates = await stateTracking.getStates();
      const currentTime = Date.now();
      const timeSinceConnected = currentTime - connectedTime;
      const currentState = currentStates.agent;
      
      // Record state change if it changed
      if (currentState !== lastState) {
        stateTransitions.push({
          from: lastState,
          to: currentState,
          time: currentTime,
          timeSinceConnected,
        });
        lastState = currentState;
        console.log(`🔄 State transition: ${stateTransitions[stateTransitions.length - 1].from} -> ${stateTransitions[stateTransitions.length - 1].to} at ${timeSinceConnected}ms`);
      }
      
      await page.waitForTimeout(checkInterval);
    }
    
    console.log('📊 State transition summary:', {
      totalTransitions: stateTransitions.length,
      transitions: stateTransitions,
      finalState: lastState,
    });
    
    // Assert: Should NOT transition to closed immediately after connected
    // This test FAILS when defect is present (transitions to closed within 200ms)
    // This test PASSES when defect is fixed (remains connected)
    const closedTransitions = stateTransitions.filter(t => t.to === 'closed');
    
    if (closedTransitions.length > 0) {
      const firstClose = closedTransitions[0];
      console.log(`⚠️ Connection transitioned to closed at ${firstClose.timeSinceConnected}ms`);
      
      // If it closed, it should have taken longer than the defect window
      // This assertion will fail when defect is present (closes within 200ms)
      expect(firstClose.timeSinceConnected).toBeGreaterThan(200);
    } else {
      console.log('✅ Connection remained in connected state (no transitions to closed)');
    }
    
    // Final state check
    const finalStates = await stateTracking.getStates();
    expect(finalStates.agent).toBe('connected');
    expect(finalStates.agentConnected).toBe(true);
  });
});

