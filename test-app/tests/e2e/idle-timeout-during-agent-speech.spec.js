/**
 * Idle Timeout Firing During Agent Speech
 * 
 * PROBLEM: The idle timeout mechanism incorrectly fires while the agent is actively speaking,
 * causing the WebSocket connection to be severed mid-sentence. This results in incomplete
 * responses and poor user experience.
 * 
 * EXPECTED BEHAVIOR: The idle timeout should NOT fire when the agent is actively speaking.
 * It should only fire during actual idle periods (no user input, no agent output).
 * 
 * TEST SCENARIO:
 * 1. User asks a question that requires a long response
 * 2. Agent starts speaking and continues for more than 10 seconds
 * 3. Idle timeout should NOT fire during agent speech
 * 4. Connection should remain active until agent finishes speaking
 * 
 * TESTING APPROACH: Monitor UI behavior and connection status for reliable testing
 * 
 * IMPORTANT: This test requires real Deepgram APIs to work properly.
 * The idle timeout fix only triggers with real agent messages, not mock responses.
 * See issue #99 for details on mock vs real API testing limitations.
 */

import { test, expect } from '@playwright/test';
import {
  SELECTORS, waitForConnection, sendTextMessage,
  establishConnectionViaText
} from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks';
import { monitorConnectionStatus } from './fixtures/idle-timeout-helpers';

test.describe('Idle Timeout During Agent Speech', () => {
  
  test('should NOT timeout while agent is actively speaking', async ({ page }) => {
    // Skip test if real APIs are not available
    // This test requires real Deepgram APIs because the idle timeout fix
    // only triggers with real agent messages, not mock responses
    const hasRealAPI = process.env.VITE_DEEPGRAM_API_KEY && 
                      process.env.VITE_DEEPGRAM_API_KEY !== 'your-deepgram-api-key-here' &&
                      process.env.VITE_DEEPGRAM_API_KEY !== 'your_actual_deepgram_api_key_here' &&
                      !process.env.VITE_DEEPGRAM_API_KEY.startsWith('test-') &&
                      process.env.VITE_DEEPGRAM_API_KEY.length >= 20;
    
    if (!hasRealAPI) {
      test.skip('Skipping test - requires real Deepgram API key. See issue #99 for details.');
      return;
    }
    
    console.log('🧪 Testing idle timeout during agent speech...');
    
    // Capture console logs to see timeout-related messages
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Idle timeout') || text.includes('closing') || text.includes('connection')) {
        consoleLogs.push({ timestamp: Date.now(), text });
      }
    });
    
    // Step 1: Setup and establish connection
    console.log('Step 1: Setting up test page and establishing connection...');
    await setupTestPage(page);
    
    // Establish connection via text input (auto-connect)
    await establishConnectionViaText(page);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialStatus}`);
    expect(initialStatus).toBe('connected');
    
    // Step 2: Send a text message that will generate a long response
    console.log('Step 2: Sending text message for long response...');
    
    // Ask for a comprehensive explanation that should generate a very long response (>10 seconds)
    const longResponsePrompt = "Write a comprehensive guide about artificial intelligence, machine learning, deep learning, neural networks, and their applications in various industries. Include detailed explanations, examples, and future trends.";
    
    await sendTextMessage(page, longResponsePrompt);
    console.log('✅ Sent text message requesting long response');
    
    // Step 3: Wait for agent to start responding
    console.log('Step 3: Waiting for agent to start responding...');
    
    // Wait for agent response to appear and start growing
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse?.textContent && agentResponse.textContent.length > 100;
    }, { timeout: 15000 });
    
    console.log('✅ Agent started responding');
    
    // Record the start time of agent response
    const agentResponseStartTime = Date.now();
    console.log(`Agent response started at: ${new Date(agentResponseStartTime).toISOString()}`);
    
    // Step 4: Monitor connection status while agent is responding using shared fixture
    // Monitor for 20 seconds to ensure we catch any premature timeouts (longer than the 10s idle timeout)
    console.log('Step 4: Monitoring connection status during agent response (20 seconds)...');
    const snapshots = await monitorConnectionStatus(page, 20000, 2000);
    
    // Step 5: Check final state
    const finalConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    const finalAgentResponse = await page.locator(SELECTORS.agentResponse).textContent();
    
    console.log(`\nFinal connection status: ${finalConnectionStatus}`);
    console.log(`Final agent response length: ${finalAgentResponse?.length || 0} characters`);
    
    // Step 6: Analyze the behavior
    console.log('\n📊 CONNECTION STATUS HISTORY:');
    snapshots.forEach((snapshot, i) => {
      console.log(`  ${i + 1}. +${snapshot.time}ms: ${snapshot.status}`);
    });
    
    // Log timeout-related console messages
    console.log('\n📊 TIMEOUT-RELATED CONSOLE LOGS:');
    if (consoleLogs.length > 0) {
      consoleLogs.forEach((log, i) => {
        const timeSinceStart = log.timestamp - agentResponseStartTime;
        console.log(`  ${i + 1}. +${timeSinceStart}ms: ${log.text}`);
      });
    } else {
      console.log('  (No timeout-related console logs detected)');
    }
    
    // Step 7: Assert the expected behavior
    console.log('\n🔍 VALIDATING EXPECTED BEHAVIOR:');
    
    // The bug: Connection should NOT close while agent is actively responding
    // Check if connection dropped during the monitoring period (especially within first 12 seconds)
    const connectionDroppedDuringResponse = snapshots.some(snapshot => 
      snapshot.status === 'closed' && snapshot.time < 12000 // Within first 12 seconds
    );
    
    if (connectionDroppedDuringResponse) {
      console.log('❌ BUG CONFIRMED: Connection dropped while agent was responding!');
      console.log('This demonstrates Issue #124 - idle timeout should NOT fire during agent speech');
      
      // This test should FAIL to demonstrate the bug
      expect(connectionDroppedDuringResponse).toBe(false);
    } else {
      console.log('✅ CORRECT BEHAVIOR: Connection remained active during agent response');
      console.log('This indicates the bug has been fixed or not triggered');
    }
    
    // Additional validation: Connection should still be active
    expect(finalConnectionStatus).toBe('connected');
    console.log('✅ Final connection status is correct');
    
    // Step 8: Summary
    console.log('\n📋 TEST SUMMARY:');
    console.log(`- Connection checks performed: ${snapshots.length}`);
    console.log(`- Connection dropped during response: ${connectionDroppedDuringResponse}`);
    console.log(`- Final connection status: ${finalConnectionStatus}`);
    console.log(`- Agent response length: ${finalAgentResponse?.length || 0} characters`);
    
    if (connectionDroppedDuringResponse) {
      console.log('\n🚨 BUG REPRODUCTION SUCCESSFUL:');
      console.log('This test demonstrates Issue #124 - idle timeout firing during agent speech');
      console.log('The idle timeout mechanism needs to be updated to:');
      console.log('1. Check for active agent speech before firing');
      console.log('2. Reset the timeout when receiving agent messages');
      console.log('3. Consider the agent state (listening/speaking) in timeout decisions');
    } else {
      console.log('\n✅ BUG NOT REPRODUCED:');
      console.log('Either the bug has been fixed or the test conditions did not trigger it');
    }
  });
});
