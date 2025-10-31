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
 * CURRENT BUG: Idle timeout fires at 10 seconds regardless of agent speaking state
 * 
 * TESTING APPROACH: Monitor UI behavior instead of console logs for reliable testing
 * 
 * IMPORTANT: This test requires real Deepgram APIs to work properly.
 * The idle timeout fix only triggers with real agent messages, not mock responses.
 * See issue #99 for details on mock vs real API testing limitations.
 */

import { test, expect } from '@playwright/test';
import {
  SELECTORS, waitForConnection, sendTextMessage
} from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks';

test.describe('Idle Timeout During Agent Speech', () => {
  
  test('should NOT timeout while agent is actively speaking (UI behavior test)', async ({ page }) => {
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
    
    console.log('🧪 Testing idle timeout during agent speech using UI behavior...');
    
    // Step 1: Setup and establish connection
    console.log('Step 1: Setting up test page and establishing connection...');
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialStatus}`);
    expect(initialStatus).toBe('connected');
    
    // Step 2: Send a text message that will generate a long response
    console.log('Step 2: Sending text message for long response...');
    
    // Ask for a detailed explanation that should generate a long response
    const longResponsePrompt = "Please explain in detail how machine learning algorithms work, including supervised learning, unsupervised learning, and deep learning. Provide specific examples and use cases for each type.";
    
    await sendTextMessage(page, longResponsePrompt);
    console.log('✅ Sent text message requesting long response');
    
    // Step 3: Wait for agent to start responding
    console.log('Step 3: Waiting for agent to start responding...');
    
    // Wait for agent response to appear and start growing
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse?.textContent && agentResponse.textContent.length > 50;
    }, { timeout: 15000 });
    
    console.log('✅ Agent started responding');
    
    // Record the start time of agent response
    const agentResponseStartTime = Date.now();
    console.log(`Agent response started at: ${new Date(agentResponseStartTime).toISOString()}`);
    
    // Step 4: Monitor connection status while agent is responding
    console.log('Step 4: Monitoring connection status during agent response...');
    
    // Check connection status every 2 seconds for 15 seconds
    const checkInterval = 2000;
    const monitoringDuration = 15000;
    const checks = Math.floor(monitoringDuration / checkInterval);
    
    const connectionStatusHistory = [];
    
    for (let i = 0; i < checks; i++) {
      await page.waitForTimeout(checkInterval);
      
      const currentStatus = await page.locator(SELECTORS.connectionStatus).textContent();
      const currentTime = Date.now();
      const timeSinceStart = currentTime - agentResponseStartTime;
      
      connectionStatusHistory.push({
        timestamp: currentTime,
        timeSinceStart: timeSinceStart,
        status: currentStatus
      });
      
      console.log(`Check ${i + 1}/${checks}: +${timeSinceStart}ms - Connection: ${currentStatus}`);
      
      // If connection drops during agent response, this indicates the bug
      if (currentStatus === 'closed') {
        console.log(`❌ BUG DETECTED: Connection closed at +${timeSinceStart}ms during agent response!`);
        break;
      }
    }
    
    // Step 5: Check final state
    const finalConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    const finalAgentResponse = await page.locator(SELECTORS.agentResponse).textContent();
    
    console.log(`\nFinal connection status: ${finalConnectionStatus}`);
    console.log(`Final agent response length: ${finalAgentResponse?.length || 0} characters`);
    
    // Step 6: Analyze the behavior
    console.log('\n📊 CONNECTION STATUS HISTORY:');
    connectionStatusHistory.forEach((check, i) => {
      console.log(`  ${i + 1}. +${check.timeSinceStart}ms: ${check.status}`);
    });
    
    // Step 7: Assert the expected behavior
    console.log('\n🔍 VALIDATING EXPECTED BEHAVIOR:');
    
    // The bug: Connection should NOT close while agent is actively responding
    const connectionDroppedDuringResponse = connectionStatusHistory.some(check => 
      check.status === 'closed' && check.timeSinceStart < 12000 // Within first 12 seconds
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
    console.log(`- Connection checks performed: ${connectionStatusHistory.length}`);
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
  
  test('should demonstrate connection stability during long agent response', async ({ page }) => {
    // Skip test if real APIs are not available
    const hasRealAPI = process.env.VITE_DEEPGRAM_API_KEY && 
                      process.env.VITE_DEEPGRAM_API_KEY !== 'your-deepgram-api-key-here' &&
                      process.env.VITE_DEEPGRAM_API_KEY !== 'your_actual_deepgram_api_key_here' &&
                      !process.env.VITE_DEEPGRAM_API_KEY.startsWith('test-') &&
                      process.env.VITE_DEEPGRAM_API_KEY.length >= 20;
    
    if (!hasRealAPI) {
      test.skip('Skipping test - requires real Deepgram API key. See issue #99 for details.');
      return;
    }
    
    console.log('🧪 Testing connection stability during long agent response...');
    
    // Capture console logs to see which service is timing out
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Idle timeout') || text.includes('closing') || text.includes('connection')) {
        consoleLogs.push({ timestamp: Date.now(), text });
      }
    });
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Send a message that should generate a very long response
    console.log('Sending message for very long response...');
    await sendTextMessage(page, "Write a comprehensive guide about artificial intelligence, machine learning, deep learning, neural networks, and their applications in various industries. Include detailed explanations, examples, and future trends.");
    
    // Wait for response to start
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse?.textContent && agentResponse.textContent.length > 100;
    }, { timeout: 15000 });
    
    console.log('Agent response started, monitoring for 20 seconds...');
    
    // Monitor connection status for 20 seconds
    const startTime = Date.now();
    const connectionChecks = [];
    
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      
      const status = await page.locator(SELECTORS.connectionStatus).textContent();
      const timeSinceStart = Date.now() - startTime;
      
      connectionChecks.push({ timeSinceStart, status });
      console.log(`+${timeSinceStart}ms: Connection = ${status}`);
      
      // If connection drops, this indicates the bug
      if (status === 'closed') {
        console.log(`❌ Connection dropped at +${timeSinceStart}ms during agent response!`);
        break;
      }
    }
    
    const finalStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final connection status: ${finalStatus}`);
    
    // Log all console messages related to timeouts
    console.log('\n📊 TIMEOUT-RELATED CONSOLE LOGS:');
    consoleLogs.forEach((log, i) => {
      const timeSinceStart = log.timestamp - startTime;
      console.log(`  ${i + 1}. +${timeSinceStart}ms: ${log.text}`);
    });
    
    // Check if connection dropped during the monitoring period
    const connectionDropped = connectionChecks.some(check => check.status === 'closed');
    
    if (connectionDropped) {
      console.log('❌ BUG CONFIRMED: Connection dropped during long agent response');
      expect(connectionDropped).toBe(false);
    } else {
      console.log('✅ Connection remained stable during long agent response');
    }
    
    // Final connection should be active
    expect(finalStatus).toBe('connected');
  });
  
  test('should handle multiple rapid messages without timeout', async ({ page }) => {
    // Skip test if real APIs are not available
    const hasRealAPI = process.env.VITE_DEEPGRAM_API_KEY && 
                      process.env.VITE_DEEPGRAM_API_KEY !== 'your-deepgram-api-key-here' &&
                      process.env.VITE_DEEPGRAM_API_KEY !== 'your_actual_deepgram_api_key_here' &&
                      !process.env.VITE_DEEPGRAM_API_KEY.startsWith('test-') &&
                      process.env.VITE_DEEPGRAM_API_KEY.length >= 20;
    
    if (!hasRealAPI) {
      test.skip('Skipping test - requires real Deepgram API key. See issue #99 for details.');
      return;
    }
    
    console.log('🧪 Testing multiple rapid messages without timeout...');
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Send multiple messages in quick succession
    const messages = [
      "What is machine learning?",
      "How does deep learning work?",
      "Explain neural networks in detail.",
      "What are the applications of AI?",
      "Tell me about computer vision."
    ];
    
    console.log('Sending multiple messages...');
    for (const message of messages) {
      await sendTextMessage(page, message);
      await page.waitForTimeout(1000); // Brief pause between messages
    }
    
    // Wait for responses to start
    await page.waitForFunction(() => {
      const agentResponse = document.querySelector('[data-testid="agent-response"]');
      return agentResponse?.textContent && agentResponse.textContent.length > 50;
    }, { timeout: 15000 });
    
    console.log('Responses started, monitoring connection for 15 seconds...');
    
    // Monitor connection during response period
    const startTime = Date.now();
    for (let i = 0; i < 7; i++) {
      await page.waitForTimeout(2000);
      
      const status = await page.locator(SELECTORS.connectionStatus).textContent();
      const timeSinceStart = Date.now() - startTime;
      
      console.log(`+${timeSinceStart}ms: Connection = ${status}`);
      
      if (status === 'closed') {
        console.log(`❌ Connection dropped at +${timeSinceStart}ms during responses!`);
        expect(status).toBe('connected');
        break;
      }
    }
    
    const finalStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    expect(finalStatus).toBe('connected');
    console.log('✅ Connection remained stable during multiple message responses');
  });
});
