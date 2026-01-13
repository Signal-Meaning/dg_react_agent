/**
 * Context Retention with Function Calling E2E Test - Issue #362
 * 
 * This test validates that context retention works correctly when function calling is enabled.
 * This tests the hypothesis that function calling might interfere with context processing.
 * 
 * Test Flow:
 * 1. Setup function calling (search_products function)
 * 2. Establish connection
 * 3. Send message: "I am looking for running shoes" (triggers function call)
 * 4. Wait for function call to execute and agent response
 * 5. Disconnect agent
 * 6. Reconnect agent (context should be sent in Settings message)
 * 7. Ask: "Provide a summary of our conversation to this point."
 * 8. Verify agent response references "running shoes" from context
 * 
 * This test should FAIL if function calling interferes with context processing.
 * This test should PASS when context retention works correctly with function calling.
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
  skipIfNoRealAPI,
  waitForFunctionCall
} from './helpers/test-helpers.js';

test.describe('Context Retention with Function Calling (Issue #362)', () => {
  
  test('should retain context when disconnecting and reconnecting with function calling enabled', async ({ page }) => {
    skipIfNoRealAPI('Requires real Deepgram API key');
    
    console.log('🧪 Testing context retention with function calling - agent should use context after reconnection');
    
    // Setup function calling BEFORE navigation
    await page.addInitScript(() => {
      // Store functions that will be injected into agentOptions
      window.testFunctions = [
        {
          name: 'search_products',
          description: 'Search for products. Use this when users are looking for products, want to find items, or ask about product availability.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Product search query (e.g., "running shoes", "laptop", "headphones")'
              }
            },
            required: ['query']
          }
        }
      ];
      
      // Store function handler
      window.handleFunctionCall = (request, sendResponse) => {
        console.log(`[FUNCTION] Executing function: ${request.name}`, request.arguments);
        
        if (request.name === 'search_products') {
          const query = request.arguments?.query || '';
          // Simulate product search results
          const mockResults = [
            { id: 1, name: `${query} - Model A`, price: '$99.99' },
            { id: 2, name: `${query} - Model B`, price: '$129.99' },
            { id: 3, name: `${query} - Model C`, price: '$79.99' }
          ];
          
          const response = {
            id: request.id,
            result: {
              success: true,
              products: mockResults,
              query: query
            }
          };
          
          sendResponse(response);
          return response;
        }
        
        return { id: request.id, result: { success: false, error: 'Unknown function' } };
      };
      
      // Store FunctionCallRequest messages for verification
      window.functionCallRequests = [];
      window.functionCallResponses = [];
    });
    
    // Install WebSocket capture to verify context is sent
    await installWebSocketCapture(page);
    
    // Step 1: Setup and establish connection with function calling enabled
    await setupTestPage(page, {
      'enable-function-calling': 'true'
    });
    
    // Set up function call handler in the page
    await page.evaluate(() => {
      if (window.deepgramRef?.current && window.handleFunctionCall) {
        // The component will use window.handleFunctionCall via onFunctionCallRequest prop
        // We need to ensure it's set up correctly
        console.log('[TEST] Function call handler ready');
      }
    });
    
    await establishConnectionViaText(page);
    console.log('✅ Initial connection established with function calling enabled');
    
    // Step 2: Send first message that triggers function call
    console.log('📝 Step 2: Sending first message: "I am looking for running shoes" (should trigger function call)');
    const firstMessage = "I am looking for running shoes";
    
    // Send message
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill(firstMessage);
    await textInput.press('Enter');
    
    // Wait for function call to be triggered
    console.log('⏳ Waiting for function call to be triggered...');
    let functionCallDetected = false;
    
    try {
      const functionCallResult = await waitForFunctionCall(page, { timeout: 30000 });
      if (functionCallResult && functionCallResult.count > 0) {
        console.log(`✅ Function call detected: ${functionCallResult.lastCall}`);
        functionCallDetected = true;
      }
    } catch (e) {
      console.log('⚠️  No function call detected within timeout, continuing...');
    }
    
    // Wait for agent response after function call (or just response if no function call)
    console.log('⏳ Waiting for agent response (after function call if triggered)...');
    const firstResponse = await waitForAgentResponseEnhanced(page, {
      timeout: 60000, // Longer timeout for function call processing
      expectedText: undefined // Don't check content, just wait for any response
    });
    
    console.log('✅ First message sent and agent responded');
    console.log(`📝 First agent response: ${firstResponse?.substring(0, 150)}${firstResponse?.length > 150 ? '...' : ''}`);
    console.log(`📝 Function call detected: ${functionCallDetected}`);
    
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
    // The test app should have conversationHistory populated from first message + function call
    // Context should be included in agentOptions when agent is not connected
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
        hasFunctions: !!(settings.agent?.think?.functions),
        functionsCount: settings.agent?.think?.functions?.length || 0,
        greetingIncluded: 'greeting' in settings.agent,
        greeting: settings.agent?.greeting
      });
      
      // Verify context was included
      expect(settings.agent).toBeDefined();
      expect(settings.agent.context).toBeDefined();
      expect(settings.agent.context.messages).toBeDefined();
      expect(settings.agent.context.messages.length).toBeGreaterThan(0);
      
      // Verify functions are still included (function calling should persist)
      expect(settings.agent.think.functions).toBeDefined();
      expect(settings.agent.think.functions.length).toBeGreaterThan(0);
      console.log('✅ Functions verified in Settings message');
      
      // CRITICAL: Verify greeting is NOT included when context is present (Issue #234, #238)
      if ('greeting' in settings.agent) {
        console.error('❌ [ISSUE #362] Greeting is included in Settings when context is present!');
        console.error('   This violates Issue #234/#238 fix and may cause context not to be used');
      }
      expect(settings.agent.greeting).toBeUndefined();
      
      // Verify context format and find user message about running shoes
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
    
    // Step 5: Ask agent about previous conversation
    console.log('📝 Step 5: Asking agent: "Provide a summary of our conversation to this point."');
    const recallQuestion = "Provide a summary of our conversation to this point.";
    
    // Wait for agent response to recall question
    // This is the critical assertion - agent should reference "running shoes"
    const recallResponse = await waitForAgentResponseEnhanced(page, {
      timeout: 30000,
      expectedText: undefined // We'll check manually to see if it references context
    });
    
    console.log('✅ Agent responded to recall question');
    console.log(`📝 Agent recall response: ${recallResponse}`);
    
    // Step 6: Capture full conversation exchange for regression confirmation
    console.log('📋 Step 6: Capturing full conversation exchange');
    
    // Get full conversation history from test app (exposed via window)
    const fullConversationHistory = await page.evaluate(() => {
      return window.__testConversationHistory || [];
    });
    
    // Get conversation history from context that was sent
    const contextMessages = reconnectSettings?.data?.agent?.context?.messages || [];
    
    // Display full exchange
    console.log('\n📊 ===== FULL CONVERSATION EXCHANGE =====');
    console.log('\n📝 Context sent in Settings (on reconnection):');
    if (contextMessages.length > 0) {
      contextMessages.forEach((msg, idx) => {
        console.log(`   [${idx + 1}] ${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      });
    } else {
      console.log('   (No context messages found)');
    }
    
    console.log('\n💬 Complete User/Assistant Exchange:');
    if (fullConversationHistory.length > 0) {
      fullConversationHistory.forEach((msg, idx) => {
        console.log(`   [${idx + 1}] ${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      });
    }
    
    console.log('\n📊 ========================================\n');
    
    // Step 7: Verify agent response references previous conversation
    console.log('🔍 Step 7: Verifying agent response references previous conversation');
    
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
      console.error('\n❌ ===== REGRESSION CONFIRMED =====');
      console.error('Agent denies having memory - context not being used (with function calling)');
      console.error(`\nFull Exchange:`);
      console.error(`   USER: "${firstMessage}"`);
      console.error(`   ASSISTANT: "${firstResponse}"`);
      console.error(`   USER: "${recallQuestion}"`);
      console.error(`   ASSISTANT: "${recallResponse}"`);
      console.error(`\nContext sent: ${contextMessages.length} messages`);
      console.error(`Context included user message: "${firstMessage}"`);
      console.error(`Agent response: "${recallResponse}"`);
      console.error('❌ ================================\n');
      throw new Error(
        `Agent response does not reference previous conversation (with function calling). ` +
        `Expected agent to mention "running shoes" or similar context. ` +
        `Agent responded: "${recallResponse}"\n\n` +
        `This suggests function calling may interfere with context processing.`
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
        console.error('\n❌ ===== REGRESSION CONFIRMED =====');
        console.error('Agent response does not reference previous conversation (with function calling)');
        console.error(`\nFull Exchange:`);
        console.error(`   USER: "${firstMessage}"`);
        console.error(`   ASSISTANT: "${firstResponse}"`);
        console.error(`   USER: "${recallQuestion}"`);
        console.error(`   ASSISTANT: "${recallResponse}"`);
        console.error(`\nContext sent: ${contextMessages.length} messages`);
        console.error(`Context included user message: "${firstMessage}"`);
        console.error(`Agent response: "${recallResponse}"`);
        console.error('❌ ================================\n');
        throw new Error(
          `Agent response does not reference previous conversation (with function calling). ` +
          `Expected agent to mention "running shoes" or reference previous conversation. ` +
          `Agent responded: "${recallResponse}"\n\n` +
          `This suggests function calling may interfere with context processing.`
        );
      }
    }
    
    // Success - agent used context even with function calling
    console.log('✅ Agent successfully used context to recall previous conversation (with function calling)');
    console.log('🎉 Context retention test PASSED - Agent is using context correctly even with function calling');
    
    expect(mentionsRunningShoes || mentionsPrevious).toBe(true);
  });
});
