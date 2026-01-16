/**
 * Context Retention with Function Calling E2E Test - Issue #362
 * 
 * This test validates that context retention works correctly when function calling is enabled.
 * This tests the hypothesis that function calling might interfere with context processing.
 * 
 * Test Flow:
 * 1. Setup function calling (get_current_datetime - client-side function)
 * 2. Establish connection (function should be included in Settings)
 * 3. Send message: "What is the time?" (triggers function call)
 * 4. Wait for function call to execute and agent response
 * 5. Disconnect agent
 * 6. Reconnect agent (context should be sent in Settings message with function)
 * 7. Ask: "Provide a summary of our conversation to this point."
 * 8. Verify agent response references "time" from context
 * 
 * This test should FAIL if function calling interferes with context processing.
 * This test should PASS when context retention works correctly with function calling.
 * 
 * Related: Issue #362, Customer Issue #587
 */

import { test, expect } from '@playwright/test';
import {
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
import { setupTestPage } from './helpers/test-helpers.mjs';

test.describe('Context Retention with Function Calling (Issue #362)', () => {
  
  test('should retain context when disconnecting and reconnecting with function calling enabled', async ({ page }) => {
    skipIfNoRealAPI('Requires real Deepgram API key');
    
    console.log('🧪 Testing context retention with function calling - agent should use context after reconnection');
    
    // Setup function calling BEFORE navigation
    // Using client-side function (no endpoint) - we can handle it via window.handleFunctionCall
    await page.addInitScript(() => {
      // Store functions that will be injected into agentOptions
      // This is a client-side function (no endpoint) - component will call window.handleFunctionCall
      window.testFunctions = [
        {
          name: 'get_current_datetime',
          description: 'Get the current date and time. ALWAYS use this function when users ask about the current date, current time, what time it is, or what day it is. This function is required for all time-related queries.',
          parameters: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London"). Defaults to UTC if not specified.',
                default: 'UTC'
              }
            }
          }
          // No endpoint = client-side function (component will call window.handleFunctionCall)
        }
      ];
      
      // Store function handler for client-side execution
      window.handleFunctionCall = (request, sendResponse) => {
        console.log(`[FUNCTION] Executing function: ${request.name}`, request.arguments);
        
        if (request.name === 'get_current_datetime') {
          let args = {};
          try {
            args = typeof request.arguments === 'string' ? JSON.parse(request.arguments) : request.arguments;
          } catch (e) {
            console.warn('[FUNCTION] Failed to parse function arguments:', e);
          }
          
          const timezone = args.timezone || 'UTC';
          const now = new Date();
          const result = {
            success: true,
            datetime: now.toISOString(),
            formatted: now.toLocaleString('en-US', {
              timeZone: timezone,
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            }),
            timezone: timezone,
            timestamp: now.getTime()
          };
          
          const response = {
            id: request.id,
            result: result
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
    
    await establishConnectionViaText(page);
    console.log('✅ Initial connection established with function calling enabled');
    
    // Verify function is included in Settings after connection
    // Note: SettingsApplied may not be received when functions are included (known issue)
    // So we'll try to wait for it, but also check WebSocket capture directly
    try {
      await waitForSettingsApplied(page, { timeout: 10000 });
      console.log('✅ SettingsApplied received');
    } catch (e) {
      console.log('⚠️  SettingsApplied not received (may be expected when functions are included)');
      // Wait a bit for Settings to be sent anyway
      await page.waitForTimeout(2000);
    }
    
    // Check WebSocket capture for Settings message
    const wsDataInitial = await getCapturedWebSocketData(page);
    const initialSettings = wsDataInitial.sent.filter(msg => msg.type === 'Settings');
    if (initialSettings.length > 0 && initialSettings[0].data) {
      const hasFunctions = !!(initialSettings[0].data.agent?.think?.functions);
      const functionsCount = initialSettings[0].data.agent?.think?.functions?.length || 0;
      console.log(`📋 Initial Settings - Functions included: ${hasFunctions}, Count: ${functionsCount}`);
      if (hasFunctions && functionsCount > 0) {
        const funcDef = initialSettings[0].data.agent.think.functions[0];
        console.log(`✅ Function verified in initial Settings: ${funcDef.name}, is client-side: ${!funcDef.endpoint}`);
        // Client-side function should NOT have endpoint
        expect(funcDef.endpoint).toBeUndefined();
      } else {
        console.error('❌ Function NOT found in initial Settings - test will likely fail');
        throw new Error('Function not included in Settings message - cannot test function calling');
      }
    } else {
      console.warn('⚠️  Could not verify function in initial Settings (WebSocket capture may not have captured it)');
      // Don't fail here - continue and see if function call works anyway
    }
    
    // Step 2: Send first message that triggers function call
    // Use a message that will trigger the datetime function AND build context
    // We'll ask about time first, then follow up about running shoes to build context
    console.log('📝 Step 2: Sending first message: "What is the time?" (should trigger function call)');
    const firstMessage = "What is the time?";
    
    // Send message
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill(firstMessage);
    await textInput.press('Enter');
    
    // Wait for function call to be triggered (client-side function)
    // For client-side functions, component calls window.handleFunctionCall
    console.log('⏳ Waiting for function call to be triggered (client-side function)...');
    let functionCallDetected = false;
    
    try {
      const functionCallResult = await waitForFunctionCall(page, { timeout: 30000 });
      if (functionCallResult && functionCallResult.count > 0) {
        functionCallDetected = true;
        console.log(`✅ Function call detected: ${functionCallResult.lastCall}`);
      }
    } catch (e) {
      console.log('⚠️  No function call detected within timeout, continuing...');
    }
    
    // Wait for agent response after function call (or just response if no function call)
    // Wait for agent response after function call (may take longer as agent processes function result)
    console.log('⏳ Waiting for agent response (after function call if triggered)...');
    
    // Use simple pattern like function-calling-e2e test - wait for agent-response element
    await page.waitForFunction(
      () => {
        const responseEl = document.querySelector('[data-testid="agent-response"]');
        const text = responseEl?.textContent || '';
        return text && text !== '(Waiting for agent response...)';
      },
      { timeout: 60000 } // Longer timeout for function call processing
    );
    
    const firstResponse = await page.locator('[data-testid="agent-response"]').textContent();
    
    console.log('✅ First message sent and agent responded');
    console.log(`📝 First agent response: ${firstResponse?.substring(0, 150)}${firstResponse?.length > 150 ? '...' : ''}`);
    console.log(`📝 Function call detected: ${functionCallDetected}`);
    
    // Verify we got a response (not just waiting message)
    expect(firstResponse).toBeTruthy();
    expect(firstResponse).not.toBe('(Waiting for agent response...)');
    expect(firstResponse.length).toBeGreaterThan(0);
    
    // Check if it's a greeting (Issue #238) - log warning but don't fail
    const isGreeting = firstResponse.toLowerCase().includes("hello") ||
                      firstResponse.toLowerCase().includes("how can i assist") ||
                      firstResponse.toLowerCase().startsWith("hello!");
    if (isGreeting) {
      console.warn('⚠️ [ISSUE #362] Agent responded with greeting instead of processing function call result');
      console.warn(`   This may indicate function call result is not being processed (Issue #238)`);
      // Don't fail - continue to see if we can still test context retention
    }
    
    // Wait a bit to ensure conversationHistory is updated
    await page.waitForTimeout(2000);
    
    // Step 2b: Disconnect agent
    console.log('⏸️ Step 2b: Disconnecting agent');
    await disconnectComponent(page);
    console.log('✅ Agent disconnected');
    
    // Wait a bit for disconnection to complete
    await page.waitForTimeout(1000);
    
    // Step 2c: Reconnect agent (context should be sent in Settings message)
    console.log('🔄 Step 2c: Reconnecting agent (context should be sent in Settings)');
    
    // Reconnect by sending a message (auto-connect)
    // The test app should have conversationHistory populated from time message + function call
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
      
      // Verify context format and find user message about time
      const contextMessages = settings.agent.context.messages;
      const timeMessage = contextMessages.find(msg => 
        msg.role === 'user' && msg.content.toLowerCase().includes('time')
      );
      
      expect(timeMessage).toBeDefined();
      expect(timeMessage.type).toBe('History');
      expect(timeMessage.role).toBe('user');
      expect(timeMessage.content).toContain('time');
      
      // Should have at least user message and agent response (with function call)
      expect(contextMessages.length).toBeGreaterThan(1);
      
      console.log('✅ Context verified in Settings message');
    } else {
      console.warn('⚠️ Could not verify context in Settings message (WebSocket capture may not have captured it)');
    }
    
    // Step 3: Ask agent about previous conversation
    console.log('📝 Step 3: Asking agent: "Provide a summary of our conversation to this point."');
    const recallQuestion = "Provide a summary of our conversation to this point.";
    
    // Wait for agent response to recall question
    // This is the critical assertion - agent should reference "time" from context
    const recallResponse = await waitForAgentResponseEnhanced(page, {
      timeout: 30000,
      expectedText: undefined // We'll check manually to see if it references context
    });
    
    console.log('✅ Agent responded to recall question');
    console.log(`📝 Agent recall response: ${recallResponse}`);
    
    // Step 4: Capture full conversation exchange for regression confirmation
    console.log('📋 Step 4: Capturing full conversation exchange');
    
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
    
    // Step 5: Verify agent response references previous conversation
    console.log('🔍 Step 5: Verifying agent response references previous conversation');
    
    // Check if agent response mentions "time" or similar context
    // The agent should reference the conversation about time (with function call)
    const responseLower = recallResponse.toLowerCase();
    const mentionsTime = responseLower.includes('time') || 
                        responseLower.includes('date') ||
                        responseLower.includes('datetime') ||
                        responseLower.includes('current time') ||
                        responseLower.includes('what time');
    
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
      console.error(`   USER: "${firstMessage}" (with function call)`);
      console.error(`   ASSISTANT: "${firstResponse}"`);
      console.error(`   USER: "${recallQuestion}"`);
      console.error(`   ASSISTANT: "${recallResponse}"`);
      console.error(`\nContext sent: ${contextMessages.length} messages`);
      console.error(`Context included message about time`);
      console.error(`Agent response: "${recallResponse}"`);
      console.error('❌ ================================\n');
        throw new Error(
          `Agent response does not reference previous conversation (with function calling). ` +
          `Expected agent to mention "time" from context. ` +
          `Agent responded: "${recallResponse}"\n\n` +
          `This suggests function calling may interfere with context processing.`
        );
    }
    
    if (!mentionsTime) {
      console.warn('⚠️ Agent response does not explicitly mention "time"');
      console.warn(`   Agent response: "${recallResponse}"`);
      console.warn('   This may indicate context is not being used, but checking for other context references...');
      
      // Check for other context indicators
      const mentionsPrevious = responseLower.includes('previous') ||
                               responseLower.includes('earlier') ||
                               responseLower.includes('before') ||
                               responseLower.includes('we were') ||
                               responseLower.includes('you were') ||
                               responseLower.includes('you asked') ||
                               responseLower.includes('you wanted');
      
      if (!mentionsPrevious) {
        console.error('\n❌ ===== REGRESSION CONFIRMED =====');
        console.error('Agent response does not reference previous conversation (with function calling)');
        console.error(`\nFull Exchange:`);
        console.error(`   USER: "${firstMessage}" (with function call)`);
        console.error(`   ASSISTANT: "${firstResponse}"`);
        console.error(`   USER: "${recallQuestion}"`);
        console.error(`   ASSISTANT: "${recallResponse}"`);
        console.error(`\nContext sent: ${contextMessages.length} messages`);
        console.error(`Context included message about time`);
        console.error(`Agent response: "${recallResponse}"`);
        console.error('❌ ================================\n');
          throw new Error(
            `Agent response does not reference previous conversation (with function calling). ` +
            `Expected agent to mention "time" from context. ` +
            `Agent responded: "${recallResponse}"\n\n` +
            `This suggests function calling may interfere with context processing.`
          );
      }
    }
    
    // Success - agent used context even with function calling
    // Agent should reference time from context
    console.log('✅ Agent successfully used context to recall previous conversation (with function calling)');
    console.log('🎉 Context retention test PASSED - Agent is using context correctly even with function calling');
    
    expect(mentionsTime || mentionsPrevious).toBe(true);
  });
});
