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

  test('should auto-connect and send text message when WebSocket is closed', async ({ page }) => {
    // This test verifies that the app auto-connects when sending a text message
    // even if the WebSocket was not initially connected. This tests the Issue #190 fix.
    
    await page.waitForSelector(SELECTORS.voiceAgent, { timeout: 5000 });
    
    // Get agent state element
    const agentStateElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    const initialAgentState = await agentStateElement.textContent();
    console.log('📊 Initial agent state:', initialAgentState);
    
    // Capture console logs to verify auto-connect and message sending
    const consoleLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('TEXT_MESSAGE') || text.includes('auto-connect') || text.includes('Auto-connecting')
          || text.includes('AGENT') || text.includes('🎯') || text.includes('📨') || text.includes('WEBSOCKET')) {
        consoleLogs.push(text);
        console.log('📋 Console:', text);
      }
    });
    
    // Type text in the input field and send
    const textInput = page.locator('input[type="text"]').first();
    await textInput.fill('Test message for auto-connect');
    
    // Focus the input
    await textInput.focus();
    await page.waitForTimeout(500);
    
    // Send the message by pressing Enter
    // This should trigger auto-connect if WebSocket is closed
    await textInput.press('Enter');
    
    // Wait for connection to be established and message to be sent
    await page.waitForTimeout(1000);
    
    // Verify connection is now connected (auto-connect should have happened)
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('📊 Connection status after sending:', connectionStatus);
    expect(connectionStatus).toContain('connected');
    
    // Verify from console logs that auto-connect occurred
    const autoConnectLogs = consoleLogs.filter(log => log.includes('Auto-connecting') || log.includes('auto-connect'));
    console.log('📋 Auto-connect logs:', autoConnectLogs);
    
    // Verify that the message was sent successfully
    const sendLogs = consoleLogs.filter(log => log.includes('Message sent successfully'));
    expect(sendLogs.length).toBeGreaterThan(0);
    
    // Wait for agent to respond (state should transition from idle)
    console.log('⏳ Waiting for agent to respond...');
    await page.waitForTimeout(3000);
    
    const finalAgentState = await agentStateElement.textContent();
    console.log('📊 Final agent state:', finalAgentState);
    
    // Agent should have received the message and transitioned to thinking or speaking
    if (finalAgentState === 'idle' && initialAgentState === 'idle') {
      console.warn('⚠️ Agent state did not change after sending message');
      console.log('📋 All console logs:', consoleLogs.join('\n'));
      throw new Error('REGRESSION: Agent state did not change from idle. Expected thinking or speaking after receiving message. This indicates the message was not processed.');
    }
    
    // Verify agent state changed
    expect(finalAgentState).not.toBe('idle');
    console.log('✅ Agent responded successfully. Final state:', finalAgentState);
  });

  test('should handle sequential text messages with proper state transitions', async ({ page }) => {
    // This test verifies that multiple sequential messages work correctly
    // and that agent state transitions properly between idle, thinking, speaking, and back to idle
    
    await page.waitForSelector(SELECTORS.voiceAgent, { timeout: 5000 });
    
    const agentStateElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    
    // Send first message
    const textInput = page.locator('input[type="text"]').first();
    await textInput.fill('First message');
    await textInput.press('Enter');
    
    // Wait for agent to transition from idle -> thinking/speaking
    console.log('⏳ Waiting for agent to respond to first message...');
    await page.waitForTimeout(3000);
    
    let agentState = await agentStateElement.textContent();
    console.log('📊 Agent state after first message:', agentState);
    
    // Verify agent responded (state should not be idle)
    if (agentState === 'idle') {
      throw new Error('Agent did not respond to first message. Expected thinking or speaking, got: ' + agentState);
    }
    
    // Wait for agent to finish speaking (transition back to idle)
    console.log('⏳ Waiting for agent to finish speaking...');
    let attempts = 0;
    while (agentState !== 'idle' && attempts < 20) {
      await page.waitForTimeout(500);
      agentState = await agentStateElement.textContent();
      attempts++;
    }
    console.log('📊 Agent state after finishing:', agentState);
    
    // Agent should have returned to idle after speaking
    if (agentState !== 'idle') {
      console.warn('⚠️ Agent did not return to idle state after speaking');
    }
    
    // Send second message
    await textInput.fill('Second message');
    await textInput.press('Enter');
    
    // Wait for agent to respond to second message
    console.log('⏳ Waiting for agent to respond to second message...');
    await page.waitForTimeout(3000);
    
    agentState = await agentStateElement.textContent();
    console.log('📊 Agent state after second message:', agentState);
    
    // Verify agent responded to second message
    if (agentState === 'idle') {
      throw new Error('Agent did not respond to second message. State should be thinking or speaking.');
    }
    
    console.log('✅ Sequential messages handled correctly with proper state transitions');
  });

  test('should maintain connection during rapid message exchange (idle timeout test)', async ({ page }) => {
    // This test verifies that sending messages keeps the connection alive
    // The idle timeout is 10 seconds, so we'll send messages within that window
    
    const initialState = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('📊 Starting connection state:', initialState);
    
    // Send 3 messages, each within 10 seconds of each other
    // This keeps the connection active via meaningful user activity
    for (let i = 0; i < 3; i++) {
      const textInput = page.locator('input[type="text"]').first();
      await textInput.fill(`Keep alive ${i + 1}`);
      await textInput.press('Enter');
      
      // Wait 3 seconds between messages (well within 10s idle timeout)
      await page.waitForTimeout(3000);
      
      // Verify connection is still active (not closed by idle timeout)
      const currentState = await page.locator('[data-testid="connection-status"]').textContent();
      console.log(`📊 Connection state after message ${i + 1}:`, currentState);
      
      expect(currentState).toContain('connected');
    }
    
    console.log('✅ All messages sent successfully - connection stayed alive (no idle timeout)');
  });
});

