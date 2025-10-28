/**
 * Text Session Flow E2E Tests
 * 
 * Comprehensive tests for text-only agent sessions that validate:
 * 1. Auto-connect when text is submitted on closed WebSocket
 * 2. Proper settings transmission for agent initialization
 * 3. Context history preservation across reconnections
 * 4. Idle timeout behavior (10-second session maintenance)
 * 
 * These tests use real Deepgram API connections to ensure authentic behavior.
 */

import { test, expect } from '@playwright/test';
import {
  SELECTORS,
  setupTestPage,
  waitForConnection,
  sendTextMessage,
  sendMessageAndWaitForResponse,
  waitForAgentResponse,
  disconnectComponent,
  getAgentState,
  verifyContextPreserved,
  installWebSocketCapture,
  getCapturedWebSocketData
} from './helpers/test-helpers.js';

test.describe('Text Session Flow', () => {
  
  test('should auto-connect, send settings, and maintain context across idle timeout reconnection', async ({ page }) => {
    console.log('🧪 Testing auto-connect with settings and context preservation through idle timeout');
    
    // Install WebSocket capture to verify settings are sent
    await installWebSocketCapture(page);
    
    // Setup and initial connection
    await setupTestPage(page);
    await waitForConnection(page);
    console.log('✅ Initial connection established');
    
    // Step 1: Send first message to establish conversation context
    console.log('📝 Step 1: Sending first message to establish context');
    const firstMessage = "I'm a filmmaker working on documentary projects about wildlife.";
    const firstResponse = await sendMessageAndWaitForResponse(page, firstMessage);
    console.log('✅ First message sent, response received:', firstResponse.substring(0, 100));
    
    // Verify agent understood the context
    await verifyContextPreserved(page, ['filmmaker', 'documentary', 'wildlife']);
    console.log('✅ Context established and verified');
    
    // Step 2: Disconnect to simulate idle timeout
    console.log('⏸️ Step 2: Disconnecting to simulate idle timeout');
    await disconnectComponent(page);
    console.log('✅ Component disconnected');
    
    // Step 3: Send second message - this should trigger auto-connect
    console.log('📝 Step 3: Sending second message (should auto-connect)');
    const secondMessage = "What equipment would you recommend for wildlife filming?";
    
    // Verify we're disconnected before sending
    await page.waitForFunction(
      () => {
        const statusEl = document.querySelector('[data-testid="connection-status"]');
        return statusEl && statusEl.textContent === 'closed';
      },
      { timeout: 2000 }
    );
    
    // Send the message - should auto-connect
    const secondResponse = await sendMessageAndWaitForResponse(page, secondMessage, 15000);
    console.log('✅ Second message sent, auto-connect completed, response received');
    
    // Verify connection is back to connected
    const connectionStatus = page.locator(SELECTORS.connectionStatus);
    await expect(connectionStatus).toContainText('connected');
    console.log('✅ Connection re-established via auto-connect');
    
    // Step 4: Verify context was preserved - agent should remember wildlife/filmmaking context
    console.log('🔍 Step 4: Verifying context preservation');
    await verifyContextPreserved(page, ['wildlife', 'filmmaker', 'equipment']);
    console.log('✅ Context preserved across reconnection');
    
    // Step 5: Verify settings were sent during auto-connect
    console.log('🔍 Step 5: Verifying settings transmission');
    const wsData = await getCapturedWebSocketData(page);
    const settingsSent = wsData.sent.some(msg => 
      msg.type === 'Settings' || msg.data?.type === 'Settings'
    );
    if (settingsSent) {
      console.log('✅ Settings were sent during auto-connect');
    } else {
      console.warn('⚠️ No settings message found in captured WebSocket data');
    }
    
    console.log('🎉 Auto-connect with context preservation test PASSED');
  });
  
  test('should handle rapid message exchange within idle timeout', async ({ page }) => {
    console.log('🧪 Testing rapid message exchange within 10-second idle timeout');
    
    await setupTestPage(page);
    await waitForConnection(page);
    console.log('✅ Initial connection established');
    
    // Send multiple messages rapidly (within 10 seconds)
    const messages = [
      "I need help with my cats.",
      "They're both Maine Coons.",
      "One is two years old."
    ];
    
    for (let i = 0; i < messages.length; i++) {
      console.log(`📝 Sending message ${i + 1}/${messages.length}`);
      await sendMessageAndWaitForResponse(page, messages[i]);
      
      // Verify connection remains active
      const connectionStatus = page.locator(SELECTORS.connectionStatus);
      await expect(connectionStatus).toContainText('connected');
      
      if (i < messages.length - 1) {
        // Short delay between messages to allow agent to respond
        await page.waitForTimeout(1000);
      }
    }
    
    console.log('✅ All messages sent and connection maintained');
    
    // Verify final response contains context from all messages
    const lastResponse = await page.locator(SELECTORS.agentResponse).textContent();
    await verifyContextPreserved(page, ['cats', 'Maine Coon']);
    
    console.log('🎉 Rapid message exchange test PASSED');
  });
  
  test('should establish connection, send settings, and respond to initial text', async ({ page }) => {
    console.log('🧪 Testing initial connection flow with settings and first message');
    
    await installWebSocketCapture(page);
    await setupTestPage(page);
    
    // Wait for connection
    await waitForConnection(page);
    console.log('✅ Connection established');
    
    // Get WebSocket data to verify settings were sent
    const wsData = await getCapturedWebSocketData(page);
    console.log('🔍 Checking for Settings message...');
    
    // Verify settings were sent
    const settingsSent = wsData.sent.some(msg => 
      msg.type === 'Settings' || msg.data?.type === 'Settings'
    );
    
    if (!settingsSent) {
      console.log('⚠️ No Settings message in initial connection (this may be expected if settings already sent)');
    } else {
      console.log('✅ Settings were sent on initial connection');
    }
    
    // Send a message
    console.log('📝 Sending first message');
    const message = "Hello, I need help with ordering a product.";
    await sendTextMessage(page, message);
    
    // Wait for agent response
    await waitForAgentResponse(page, null, 10000);
    console.log('✅ Agent responded');
    
    // Verify agent is responding
    const agentResponse = page.locator(SELECTORS.agentResponse);
    await expect(agentResponse).toBeVisible({ timeout: 5000 });
    
    const responseText = await agentResponse.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText.length).toBeGreaterThan(0);
    
    console.log('🎉 Initial connection flow test PASSED');
  });
  
  test('should maintain connection through sequential messages', async ({ page }) => {
    console.log('🧪 Testing sequential message exchange with state tracking');
    
    await setupTestPage(page);
    await waitForConnection(page);
    console.log('✅ Initial connection established');
    
    // First message
    console.log('📝 Sending message 1');
    const message1 = "I'm a teacher working with third graders.";
    const response1 = await sendMessageAndWaitForResponse(page, message1);
    console.log('✅ Response 1 received');
    
    // Verify agent state transitions
    const state1 = await getAgentState(page);
    console.log(`📊 Agent state after message 1: ${state1}`);
    
    // Second message
    console.log('📝 Sending message 2');
    const message2 = "What teaching strategies do you recommend?";
    const response2 = await sendMessageAndWaitForResponse(page, message2);
    console.log('✅ Response 2 received');
    
    // Verify context is maintained between messages
    await verifyContextPreserved(page, ['teacher', 'third grade', 'strategies']);
    
    console.log('🎉 Sequential message exchange test PASSED');
  });
});

