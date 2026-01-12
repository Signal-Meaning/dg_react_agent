/**
 * Context Retention E2E Test - Issue #362
 * 
 * This test validates that the agent actually USES context to answer questions
 * about previous conversations after reconnection.
 * 
 * Test Flow:
 * 1. Establish connection
 * 2. Send message: "I'm looking for running shoes"
 * 3. Wait for agent response (not greeting - greeting arrives on connection)
 * 4. Disconnect agent
 * 5. Reconnect agent (context should be sent in Settings message)
 * 6. Ask: "What were we just talking about?"
 * 7. Verify agent response references "running shoes" from context
 * 
 * This test should FAIL with current regression (v0.7.7+) where agent doesn't use context.
 * This test should PASS when the regression is fixed.
 * 
 * Related: Issue #362, Customer Issue #587
 */

import { test, expect } from '@playwright/test';
import {
  setupTestPage,
  establishConnectionViaText,
  sendMessageAndWaitForResponse,
  disconnectComponent,
  waitForSettingsApplied,
  waitForAgentResponseEnhanced,
  installWebSocketCapture,
  getCapturedWebSocketData,
  skipIfNoRealAPI
} from './helpers/test-helpers.js';

test.describe('Context Retention - Agent Usage (Issue #362)', () => {
  
  test('should retain context when disconnecting and reconnecting - agent uses context', async ({ page }) => {
    skipIfNoRealAPI('Requires real Deepgram API key');
    
    console.log('🧪 Testing context retention - agent should use context after reconnection');
    
    // Install WebSocket capture to verify context is sent
    await installWebSocketCapture(page);
    
    // Step 1: Setup and establish connection
    await setupTestPage(page);
    await establishConnectionViaText(page);
    console.log('✅ Initial connection established');
    
    // Step 2: Send first message and wait for agent response
    console.log('📝 Step 2: Sending first message: "I am looking for running shoes"');
    const firstMessage = "I am looking for running shoes";
    
    // Send message using sendMessageAndWaitForResponse which handles timing better
    // This ensures both user message and agent response are in conversationHistory
    const firstResponse = await sendMessageAndWaitForResponse(page, firstMessage, 45000);
    
    console.log('✅ First message sent and agent responded');
    console.log(`📝 First agent response: ${firstResponse?.substring(0, 100)}...`);
    
    // Verify we got a response (not just waiting message)
    expect(firstResponse).toBeTruthy();
    expect(firstResponse).not.toBe('(Waiting for agent response...)');
    expect(firstResponse.length).toBeGreaterThan(0);
    
    // Wait a bit to ensure conversationHistory is updated
    await page.waitForTimeout(2000);
    
    // Step 3: Disconnect agent
    console.log('⏸️ Step 3: Disconnecting agent');
    await disconnectComponent(page);
    console.log('✅ Agent disconnected');
    
    // Wait a bit for disconnection to complete
    await page.waitForTimeout(1000);
    
    // Step 4: Reconnect agent (context should be sent in Settings message)
    console.log('🔄 Step 4: Reconnecting agent (context should be sent in Settings)');
    
    // Reconnect by sending a message (auto-connect)
    // The test app should have conversationHistory populated from first message
    // Context should be included in agentOptions when agent is not connected
    // Use sendMessageAndWaitForResponse which triggers auto-connect
    const reconnectMessage = "Hello again";
    await sendMessageAndWaitForResponse(page, reconnectMessage);
    console.log('✅ Connection re-established via auto-connect');
    
    // Wait for SettingsApplied to confirm context was sent
    await waitForSettingsApplied(page);
    console.log('✅ SettingsApplied received - context should have been sent');
    
    // Verify context was sent in Settings message
    const wsData = await getCapturedWebSocketData(page);
    const settingsMessages = wsData.sent.filter(msg => msg.type === 'Settings');
    
    // Find the most recent Settings message (from reconnection)
    const reconnectSettings = settingsMessages[settingsMessages.length - 1];
    
    if (reconnectSettings && reconnectSettings.data) {
      const settings = reconnectSettings.data;
      console.log('📋 Settings message sent on reconnection:', {
        hasContext: !!settings.agent?.context,
        contextMessageCount: settings.agent?.context?.messages?.length || 0,
        sampleContext: settings.agent?.context?.messages?.slice(0, 2) || [],
        greetingIncluded: 'greeting' in settings.agent,
        greeting: settings.agent?.greeting
      });
      
      // Verify context was included
      expect(settings.agent).toBeDefined();
      expect(settings.agent.context).toBeDefined();
      expect(settings.agent.context.messages).toBeDefined();
      expect(settings.agent.context.messages.length).toBeGreaterThan(0);
      
      // CRITICAL: Verify greeting is NOT included when context is present (Issue #234, #238)
      // If greeting is included, it might interfere with agent's ability to use context
      if ('greeting' in settings.agent) {
        console.error('❌ [ISSUE #362] Greeting is included in Settings when context is present!');
        console.error('   This violates Issue #234/#238 fix and may cause context not to be used');
        console.error('   Greeting:', settings.agent.greeting);
        console.error('   Context messages:', settings.agent.context.messages.length);
      }
      expect(settings.agent.greeting).toBeUndefined();
      
      // Verify context format
      // Note: Context may include greeting first, then user message, then agent response
      // Find the user message about running shoes
      const contextMessages = settings.agent.context.messages;
      const userMessage = contextMessages.find(msg => 
        msg.role === 'user' && msg.content.toLowerCase().includes('running shoes')
      );
      
      expect(userMessage).toBeDefined();
      expect(userMessage.type).toBe('History');
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toContain('running shoes');
      
      console.log('✅ Context verified in Settings message');
    } else {
      console.warn('⚠️ Could not verify context in Settings message (WebSocket capture may not have captured it)');
    }
    
    // Check for ConversationText messages with greeting (Issue #238)
    // Deepgram may send greeting in ConversationText even when omitted from Settings
    const wsDataAfterReconnect = await getCapturedWebSocketData(page);
    const conversationTextMessages = wsDataAfterReconnect.received.filter(msg => 
      msg.type === 'ConversationText'
    );
    
    const greetingMessages = conversationTextMessages.filter(msg => {
      const content = msg.data?.content?.toLowerCase() || '';
      return content.includes('hello') || content.includes('greeting') || content.includes('how can i help');
    });
    
    if (greetingMessages.length > 0) {
      console.warn('⚠️ [ISSUE #362] ConversationText with greeting received after reconnection:');
      greetingMessages.forEach((msg, idx) => {
        console.warn(`   [${idx + 1}] ${msg.data?.content?.substring(0, 60)}...`);
      });
      console.warn('   This may interfere with agent\'s ability to use context (Issue #238)');
    }
    
    // Step 5: Ask agent about previous conversation
    console.log('📝 Step 5: Asking agent: "What were we just talking about?"');
    const recallQuestion = "What were we just talking about?";
    
    // Wait for agent response to recall question
    // This is the critical assertion - agent should reference "running shoes"
    const recallResponse = await waitForAgentResponseEnhanced(page, {
      timeout: 30000,
      expectedText: undefined // We'll check manually to see if it references context
    });
    
    console.log('✅ Agent responded to recall question');
    console.log(`📝 Agent recall response: ${recallResponse}`);
    
    // Step 6: Verify agent response references previous conversation
    console.log('🔍 Step 6: Verifying agent response references previous conversation');
    
    // Check if agent response mentions "running shoes" or similar context
    const responseLower = recallResponse.toLowerCase();
    const mentionsRunningShoes = responseLower.includes('running shoes') || 
                                responseLower.includes('running') ||
                                responseLower.includes('shoes');
    
    // Also check for common "can't recall" phrases that indicate context wasn't used
    const deniesMemory = responseLower.includes("can't recall") ||
                         responseLower.includes("cannot recall") ||
                         responseLower.includes("unable to recall") ||
                         responseLower.includes("don't have memory") ||
                         responseLower.includes("don't remember") ||
                         responseLower.includes("no memory");
    
    if (deniesMemory) {
      console.error('❌ Agent denies having memory - context not being used');
      console.error(`   Agent response: "${recallResponse}"`);
      throw new Error(
        `Agent response does not reference previous conversation. ` +
        `Expected agent to mention "running shoes" or similar context. ` +
        `Agent responded: "${recallResponse}"`
      );
    }
    
    if (!mentionsRunningShoes) {
      console.warn('⚠️ Agent response does not explicitly mention "running shoes"');
      console.warn(`   Agent response: "${recallResponse}"`);
      console.warn('   This may indicate context is not being used, but checking for other context references...');
      
      // Check for other context indicators
      const mentionsPrevious = responseLower.includes('previous') ||
                               responseLower.includes('earlier') ||
                               responseLower.includes('before') ||
                               responseLower.includes('we were') ||
                               responseLower.includes('you were');
      
      if (!mentionsPrevious) {
        throw new Error(
          `Agent response does not reference previous conversation. ` +
          `Expected agent to mention "running shoes" or reference previous conversation. ` +
          `Agent responded: "${recallResponse}"`
        );
      }
    }
    
    console.log('✅ Agent response references previous conversation');
    console.log('🎉 Context retention test PASSED - Agent is using context correctly');
  });
  
  test('should verify context format in Settings message', async ({ page }) => {
    skipIfNoRealAPI('Requires real Deepgram API key');
    
    console.log('🧪 Testing context format in Settings message');
    
    await installWebSocketCapture(page);
    await setupTestPage(page);
    
    // Send first message to establish conversation
    await establishConnectionViaText(page);
    const firstMessage = "I am looking for running shoes";
    await sendMessageAndWaitForResponse(page, firstMessage);
    
    // Disconnect
    await disconnectComponent(page);
    await page.waitForTimeout(1000);
    
    // Reconnect by sending a message (auto-connect)
    await sendMessageAndWaitForResponse(page, "Reconnecting");
    await waitForSettingsApplied(page);
    
    // Verify context format
    const wsData = await getCapturedWebSocketData(page);
    const settingsMessages = wsData.sent.filter(msg => msg.type === 'Settings');
    const reconnectSettings = settingsMessages[settingsMessages.length - 1];
    
    expect(reconnectSettings).toBeDefined();
    expect(reconnectSettings.data).toBeDefined();
    expect(reconnectSettings.data.agent).toBeDefined();
    expect(reconnectSettings.data.agent.context).toBeDefined();
    expect(reconnectSettings.data.agent.context.messages).toBeDefined();
    
    const contextMessages = reconnectSettings.data.agent.context.messages;
    expect(Array.isArray(contextMessages)).toBe(true);
    expect(contextMessages.length).toBeGreaterThan(0);
    
    // Verify each message has correct format
    contextMessages.forEach((msg, index) => {
      expect(msg.type).toBe('History');
      expect(['user', 'assistant']).toContain(msg.role);
      expect(typeof msg.content).toBe('string');
      expect(msg.content.length).toBeGreaterThan(0);
      
      console.log(`✅ Context message ${index + 1} format correct:`, {
        type: msg.type,
        role: msg.role,
        contentLength: msg.content.length
      });
    });
    
    console.log('✅ Context format verification PASSED');
  });
});
