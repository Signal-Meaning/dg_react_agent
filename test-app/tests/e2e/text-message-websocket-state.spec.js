/**
 * Text Message WebSocket State Regression Test
 * 
 * This test reproduces Issue #190 regression where WebSocket is in 'closed' state
 * when trying to send text messages, causing messages to be dropped.
 * 
 * The issue occurs when:
 * 1. Component connects successfully
 * 2. User tries to send text message
 * 3. WebSocket state is 'closed' instead of 'connected'
 * 4. Message fails to send and agent responses never arrive
 * 
 * Expected behavior:
 * - WebSocket should be 'connected' when ready to send messages
 * - Text messages should send successfully to agent
 * - Agent should receive and respond to messages
 */

import { test, expect } from '@playwright/test';
import { setupTestPage, waitForConnection, SELECTORS } from './helpers/test-helpers.js';

test.describe('Text Message WebSocket State', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestPage(page);
    
    // Wait for initial connection to establish
    await waitForConnection(page);
    console.log('✅ Initial connection established');
  });

  test('should verify WebSocket is connected before sending text message', async ({ page }) => {
    // Wait for component to be fully ready
    await page.waitForSelector(SELECTORS.voiceAgent, { timeout: 5000 });
    
    // Check connection status before attempting to send
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('📊 Initial connection status:', connectionStatus);
    
    expect(connectionStatus).toContain('connected');
    
    // Get current agent state
    const agentStateElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    const initialAgentState = await agentStateElement.textContent();
    console.log('📊 Initial agent state:', initialAgentState);
    
    // Type text in the input field
    const textInput = page.locator('input[type="text"]').first();
    await textInput.fill('Hello');
    
    // Focus the input and wait a moment for React to process
    await textInput.focus();
    await page.waitForTimeout(500);
    
    // Send the message by pressing Enter
    await textInput.press('Enter');
    
    // Wait for the message to be processed
    await page.waitForTimeout(1000);
    
    // Check console logs for WebSocket state
    const consoleLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('TEXT_MESSAGE') || text.includes('WebSocket state') || text.includes('Connection state')) {
        consoleLogs.push(text);
      }
    });
    
    // Verify connection is still connected after message attempt
    await page.waitForTimeout(500);
    const finalConnectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('📊 Final connection status:', finalConnectionStatus);
    
    // Get agent state after message
    const finalAgentState = await agentStateElement.textContent();
    console.log('📊 Agent state after message:', finalAgentState);
    
    // The key assertion: connection should still be connected
    // If this fails, it means WebSocket went to 'closed' state prematurely
    expect(finalConnectionStatus).toContain('connected');
    
    // Agent should transition to 'thinking' or 'speaking' when processing the message
    // If it stays at 'idle', that means the message was not received
    console.log('✅ Test completed - checking if agent received message...');
    
    // Wait a bit more to see if agent responds
    await page.waitForTimeout(2000);
    const responseState = await agentStateElement.textContent();
    console.log('📊 Agent state after wait:', responseState);
    
    // If agent received the message, it should have transitioned to thinking/speaking
    if (responseState === 'idle' && initialAgentState === 'idle') {
      console.warn('⚠️ Agent state did not change - message may not have been received');
      console.log('Console logs:', consoleLogs);
      
      // FAIL THE TEST - Agent should have received and responded to the message
      // This is the actual regression we're trying to catch
      throw new Error(`REGRESSION: Agent state did not change from 'idle'. Expected 'thinking' or 'speaking' after receiving message. This indicates the message was not processed or agent never received it. Console logs: ${consoleLogs.join(', ')}`);
    }
    
    // Also verify agent state actually changed to something other than idle
    expect(responseState).not.toBe('idle');
    console.log('✅ Agent state changed successfully:', responseState);
  });

  test('should fail when WebSocket is closed before component ready', async ({ page }) => {
    // This test reproduces the exact regression scenario
    // Where WebSocket is in 'closed' state when trying to send
    
    let websocketStateMessage = '';
    let errorDetected = false;
    
    // Listen for the specific error messages
    page.on('console', (msg) => {
      const text = msg.text();
      
      // Capture the error that indicates WebSocket is closed
      if (text.includes('WebSocket state:')) {
        websocketStateMessage = text;
      }
      
      if (text.includes('Cannot send: WebSocket not connected') || 
          text.includes('Cannot inject user message: WebSocket not connected')) {
        errorDetected = true;
      }
    });
    
    // Try to send a message immediately without waiting for full ready
    // This simulates clicking "Send" before connection is fully established
    const textInput = page.locator('input[type="text"]').first();
    await textInput.fill('Early message');
    await textInput.press('Enter');
    
    await page.waitForTimeout(1000);
    
    // Now wait for connection and try again
    await waitForConnection(page);
    
    await textInput.fill('After connection');
    await textInput.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Check results
    console.log('WebSocket state message:', websocketStateMessage);
    console.log('Error detected:', errorDetected);
    
    // The test should fail if we detect the closed state error
    if (errorDetected || websocketStateMessage.includes('closed')) {
      throw new Error(`REGRESSION DETECTED: ${websocketStateMessage || 'WebSocket closed when attempting to send'}`);
    }
  });

  test('should detect WebSocket closed state regression', async ({ page }) => {
    let websocketClosed = false;
    let connectionStateOnSend = null;
    
    // Listen for console logs to detect WebSocket state
    page.on('console', (msg) => {
      const text = msg.text();
      
      // Detect the error that indicates WebSocket is closed
      if (text.includes('Cannot send: WebSocket not connected') || 
          text.includes("Cannot inject user message: WebSocket not connected")) {
        websocketClosed = true;
        console.error('❌ REGRESSION DETECTED: WebSocket is closed when sending message');
      }
      
      // Capture the actual connection state
      if (text.includes('Connection state:') || text.includes('WebSocket state:')) {
        const match = text.match(/state:\s*["']?(\w+)["']?/);
        if (match) {
          connectionStateOnSend = match[1];
          console.log('📊 Connection state when sending:', connectionStateOnSend);
        }
      }
    });
    
    // Type and send a message
    const textInput = page.locator('input[type="text"]').first();
    await textInput.fill('Test message');
    await textInput.press('Enter');
    
    // Wait for processing - agent should respond
    await page.waitForTimeout(5000);
    
    // Check for the regression
    if (connectionStateOnSend === 'closed') {
      throw new Error(`REGRESSION: WebSocket was in 'closed' state when attempting to send. Connection states should be one of: connecting, connected, reconnecting`);
    }
    
    if (websocketClosed) {
      throw new Error('REGRESSION: WebSocket closed error detected when sending text message');
    }
    
    // Also verify agent received the message by checking state changes
    const agentStateElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    const agentState = await agentStateElement.textContent();
    
    if (agentState === 'idle') {
      throw new Error('REGRESSION: Agent state is still "idle" after sending message. This means the message was not received or processed. Expected "thinking" or "speaking".');
    }
    
    console.log('✅ No regression detected - WebSocket state is correct and agent received message. Agent state:', agentState);
  });

  test('should verify connection remains stable during text message flow', async ({ page }) => {
    // Get initial state
    const initialState = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('📊 Starting connection state:', initialState);
    
    // Send multiple messages
    for (let i = 0; i < 3; i++) {
      const textInput = page.locator('input[type="text"]').first();
      await textInput.fill(`Message ${i + 1}`);
      await textInput.press('Enter');
      
      await page.waitForTimeout(1000);
      
      // Verify connection is still good
      const currentState = await page.locator('[data-testid="connection-status"]').textContent();
      console.log(`📊 Connection state after message ${i + 1}:`, currentState);
      
      expect(currentState).toContain('connected');
    }
    
    console.log('✅ All messages sent successfully without disconnection');
  });
});

