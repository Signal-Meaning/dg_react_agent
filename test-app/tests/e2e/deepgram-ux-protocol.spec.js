/**
 * Deepgram Protocol UX Test
 *
 * **Suite status:** Entire describe is skipped — track / restore under GitHub **#556**
 * (Deepgram proxy E2E / connectivity / mic–reconnect flakiness; same bucket as websocket-connectivity opt-in).
 * @see https://github.com/Signal-Meaning/dg_react_agent/issues/556
 * @see docs/issues/ISSUE-556/E2E-SKIPS.md
 *
 * This E2E test validates the Deepgram protocol by:
 * 1. Interacting with the actual UI elements (buttons, inputs)
 * 2. Validating visual state changes match protocol expectations
 * 3. Verifying the complete user experience flow
 * 
 * Protocol Flow Validation:
 * - Auto-connect establishes WebSocket connection
 * - Connection ready state indicates Settings → Welcome handshake
 * - Text input triggers user message send
 * - Agent response appears in UI
 * - Connection remains stable throughout
 */

import { test, expect } from '@playwright/test';
import {
  SELECTORS,
  setupTestPage,
  waitForAgentGreeting,
  sendTextMessage,
  assertConnectionHealthy,
  MicrophoneHelpers,
  verifyAgentResponse,
} from './helpers/test-helpers.js';

// Run only in chromium for focused testing
test.use({ browserName: 'chromium' });

test.describe.skip('Deepgram Protocol UX Validation', () => {
  
  test.afterEach(async ({ page }) => {
    // Clean up: Close any open connections and clear state
    try {
      await page.evaluate(() => {
        // Close component if it exists
        if (window.deepgramRef?.current) {
          window.deepgramRef.current.stop?.();
        }
      });
      // Navigate away to ensure clean state for next test
      await page.goto('about:blank');
      await page.waitForTimeout(500); // Give time for cleanup
    } catch (error) {
      // Ignore cleanup errors - test may have already navigated away
    }
  });
  
  test('should complete full protocol flow through UI interactions', async ({ page, context }) => {
    console.log('🧪 Starting Deepgram Protocol UX Test...');
    
    // Step 1: Setup and activate microphone using comprehensive helper
    console.log('\n📡 Step 1: Setup and Activate Connection via Microphone');
    await setupTestPage(page);
    console.log('✅ Voice agent component loaded');
    
    // Use MicrophoneHelpers for reliable microphone activation and connection
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    if (!result.success) {
      throw new Error(`Microphone activation failed: ${result.error}`);
    }
    
    console.log('✅ Connection ready (Settings → Welcome handshake completed)');
    
    const connectionStatus = page.locator(SELECTORS.connectionStatus);
    await expect(connectionStatus).toHaveText('connected');
    console.log('✅ WebSocket connection status: connected');
    
    // Step 2: Verify agent greeting
    console.log('\n💬 Step 2: Verify Agent Greeting (Protocol Welcome)');
    await waitForAgentGreeting(page);
    console.log('✅ Agent greeting received and played');
    
    // Use verifyAgentResponse helper to ensure response text is updated
    const agentResponse = page.locator(SELECTORS.agentResponse);
    const greetingText = await verifyAgentResponse(page, expect);
    expect(greetingText?.length).toBeGreaterThan(0);
    console.log(`✅ Agent greeting displayed: "${greetingText?.substring(0, 50)}..."`);
    
    // Step 3: Send user text message
    console.log('\n📤 Step 3: Send User Text Message via UI');
    const testMessage = 'Hello, this is an E2E protocol test message';
    await sendTextMessage(page, testMessage);
    console.log(`✅ Message sent and input cleared: "${testMessage}"`);
    
    // Step 4: Verify agent responds
    console.log('\n📥 Step 4: Verify Agent Response');
    const initialResponse = await agentResponse.textContent();
    
    // Wait for response to update
    await page.waitForFunction(
      (selector, initial) => {
        const element = document.querySelector(selector);
        const current = element?.textContent || '';
        return current !== initial && !current.includes('Waiting for agent response');
      },
      SELECTORS.agentResponse,
      initialResponse,
      { timeout: 10000 }
    );
    
    const finalResponse = await agentResponse.textContent();
    expect(finalResponse).not.toBe('(Waiting for agent response...)');
    expect(finalResponse?.length).toBeGreaterThan(0);
    console.log(`✅ Agent responded: "${finalResponse?.substring(0, 80)}..."`);
    
    // Step 5: Verify connection stability
    console.log('\n🔗 Step 5: Verify Connection Stability');
    await assertConnectionHealthy(page, expect);
    console.log('✅ Connection remained stable throughout interaction');
    
    // Step 6: User text appears in Conversation History (user-message panel removed; Issue #560)
    console.log('\n🔄 Step 6: Verify user text in Conversation History');
    const userRow = page.locator(SELECTORS.conversationUserRow).first();
    await expect(userRow).toContainText(testMessage.substring(0, 24), { timeout: 15000 });
    console.log(`✅ User message visible in conversation history`);
    
    // Send another message to verify multi-turn capability
    const secondMessage = 'Second test message';
    await sendTextMessage(page, secondMessage);
    console.log(`✅ Sent second message: "${secondMessage}"`);
    
    // Final validation
    await assertConnectionHealthy(page, expect);
    console.log('✅ Connection stable after multiple interactions');
    
    console.log('\n🎉 PROTOCOL UX TEST PASSED!');
    console.log('✅ Auto-connect established (Settings → Welcome)');
    console.log('✅ Agent greeting received');
    console.log('✅ User messages sent via UI');
    console.log('✅ Agent responses received');
    console.log('✅ Multi-turn conversation working');
    console.log('✅ Connection stable throughout');
  });
  
  test('should handle microphone protocol states', async ({ page }) => {
    console.log('🎤 Starting Microphone Protocol State Test...');
    
    // Use MicrophoneHelpers for reliable microphone activation
    // Increased timeouts for full test runs where API may be slower
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 20000,
      greetingTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!result.success) {
      throw new Error(`Microphone activation failed: ${result.error}`);
    }
    
    console.log('✅ Microphone activated successfully');
    
    // Verify microphone is enabled
    const micStatus = page.locator(SELECTORS.micStatus);
    const currentMicStatus = await micStatus.textContent();
    expect(currentMicStatus).toBe('Enabled');
    console.log(`✅ Mic status confirmed: ${currentMicStatus}`);
    
    // Verify microphone button is visible and enabled
    const micButton = page.locator(SELECTORS.micButton);
    await expect(micButton).toBeVisible();
    const isEnabled = await micButton.isEnabled();
    expect(isEnabled).toBe(true);
    console.log('✅ Microphone button is visible and enabled');
    
    // Test microphone disable
    await micButton.click();
    console.log('✅ Clicked microphone button to disable');
    
    await page.waitForTimeout(1000);
    
    // Verify microphone is disabled
    const disabledMicStatus = await micStatus.textContent();
    expect(disabledMicStatus).toBe('Disabled');
    console.log(`✅ Mic status after disable: ${disabledMicStatus}`);
    
    console.log('🎉 MICROPHONE PROTOCOL STATE TEST PASSED!');
  });
  
  test('should maintain protocol during rapid interactions', async ({ page }) => {
    console.log('⚡ Starting Rapid Interaction Protocol Test...');
    
    // Setup and activate microphone using comprehensive helper
    await setupTestPage(page);
    
    // Use MicrophoneHelpers for reliable microphone activation and connection
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    if (!result.success) {
      throw new Error(`Microphone activation failed: ${result.error}`);
    }
    
    console.log('✅ Connection established');
    
    // Send multiple messages rapidly
    const messages = [
      'First rapid message',
      'Second rapid message',
      'Third rapid message'
    ];
    
    console.log('📤 Sending multiple rapid messages...');
    for (const msg of messages) {
      await sendTextMessage(page, msg);
      console.log(`✅ Sent: "${msg}"`);
      
      // Small delay between sends
      await page.waitForTimeout(100);
    }
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Verify connection is still stable
    await assertConnectionHealthy(page, expect);
    console.log('✅ Connection stable after rapid interactions');
    
    // Verify we got a response (protocol didn't break)
    const agentResponse = page.locator(SELECTORS.agentResponse);
    const response = await agentResponse.textContent();
    expect(response).not.toBe('(Waiting for agent response...)');
    console.log('✅ Agent still responding after rapid messages');
    
    console.log('🎉 RAPID INTERACTION PROTOCOL TEST PASSED!');
  });
});
