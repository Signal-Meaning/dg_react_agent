/**
 * Agent State Transitions E2E Tests
 * 
 * Focused tests to verify core agent state transitions during conversation flow.
 * Each test validates a unique state transition sequence.
 * 
 * Core state sequences:
 * 1. idle → speaking → idle (text input) - Note: text input doesn't transition through listening
 * 2. idle → thinking → speaking → idle (tool trigger with text input - requires Issue #212)
 *    Note: Text input never transitions through listening - listening is only for voice input
 * 
 * Note: AgentThinking message handling is validated by:
 * - Unit tests: tests/agent-state-handling.test.ts, tests/event-handling.test.js
 * - Test #2 above (when enabled) will validate E2E with real tool triggers
 * 
 * Note: Voice input state transitions are covered by VAD and audio test suites:
 * - vad-redundancy-and-agent-timeout.spec.js - Comprehensive voice interaction with state validation
 * - Other VAD/audio tests validate state transitions during voice interactions
 * 
 * These tests address Issue #190: Missing Agent State Handlers
 */

import { test, expect } from '@playwright/test';
import { 
  setupTestPage, 
  waitForConnection, 
  sendTextMessage, 
  waitForAgentResponse,
  getAgentState,
  waitForAgentState
} from './helpers/test-helpers.js';

// Constant for message that will trigger tool calls (when Issue #212 is implemented)
// This should be updated when the tool-triggering feature is added to test-app
const TOOL_TRIGGER_MESSAGE = 'Use the weather tool to get current conditions';

test.describe('Agent State Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestPage(page);
    await waitForConnection(page);
  });

  test('should transition: idle → speaking → idle (user types message and clicks send)', async ({ page }) => {
    // User Actions:
    // 1. User types message in text input field
    // 2. User clicks send button  
    // 3. Component sends InjectUserMessage to Deepgram
    // 4. Agent responds with audio (TTS) - TTS is guaranteed unmuted for this test
    // 
    // Expected State Sequence:
    // - idle (initial)
    // - speaking (when agent TTS audio plays)
    // - idle (when audio playback completes)
    //
    // Note: Text input via injectUserMessage does NOT transition to listening state
    
    // Step 1: Verify initial state is idle
    const initialState = await getAgentState(page);
    expect(initialState).toBe('idle');
    
    // Note: TTS is unmuted by default (allowAgentRef defaults to ALLOW_AUDIO=true)
    // The test-app respects button state - if button shows muted, TTS won't play
    // This test assumes default unmuted state, which should be the case after fresh page load
    
    // Step 2: User types and sends message
    await sendTextMessage(page, 'Hello');
    
    // Step 4: Wait for agent to enter speaking state
    // Agent state should transition to 'speaking' when audio playback begins (TTS is unmuted)
    // This validates the idle → speaking transition
    await waitForAgentState(page, 'speaking', 15000);
    
    // Step 5: Wait for agent to finish speaking and return to idle
    // This validates the speaking → idle transition
    await waitForAgentState(page, 'idle', 15000);
    
    // Step 6: Verify we got an agent response
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
  });

  test.skip('should transition: idle → thinking → speaking → idle (tool trigger with text input)', async ({ page }) => {
    // TODO: Requires Issue #212 - tool-triggered conversation feature
    // When tools are triggered, AgentThinking message is sent by Deepgram
    // This test validates the thinking state transition in a real scenario
    // 
    // Once Issue #212 is implemented, this message should trigger a tool call
    // which will cause Deepgram to send an AgentThinking message
    
    await sendTextMessage(page, TOOL_TRIGGER_MESSAGE);
    
    // Wait for thinking state (will occur when tool is triggered)
    await waitForAgentState(page, 'thinking', 10000);
    
    // Wait for speaking state (after thinking)
    await waitForAgentState(page, 'speaking', 10000);
    
    // Wait for final response (null means don't validate response text, just wait for any response)
    await waitForAgentResponse(page, null, 15000);
    
    // Verify final state is idle (final state must be idle)
    const finalState = await getAgentState(page);
    expect(finalState).toBe('idle');
  });
});
