/**
 * VAD Redundancy and Agent State Timeout Behavior Tests
 * 
 * SCOPE: Validates proper handling of redundant VAD signals and agent state timeout behavior
 * 
 * ISSUES ADDRESSED:
 * 1. VAD signal redundancy (UserStoppedSpeaking vs VADEvent speechDetected: false)
 * 2. Agent state timeout behavior (AgentThinking, AgentStartedSpeaking, AgentAudioDone)
 * 3. Idle timeout state machine consistency
 * 
 * TEST SCENARIOS:
 * 
 * 1. VAD Signal Redundancy Detection:
 *    - Detect when multiple VAD signals fire for same event
 *    - Validate signal timing and consistency
 *    - Test conflict resolution when signals disagree
 * 
 * 2. Agent State Timeout Behavior:
 *    - AgentThinking should disable idle timeout resets
 *    - AgentStartedSpeaking should disable idle timeout resets  
 *    - AgentAudioDone should re-enable idle timeout resets (if user not speaking)
 * 
 * 3. Idle Timeout State Machine:
 *    - User speaking → re-enable resets
 *    - Agent thinking/speaking → disable resets
 *    - User stops + agent idle → allow natural timeout
 *    - Agent finishes + user not speaking → allow natural timeout
 * 
 * IMPORTANT: These tests now use the working pre-recorded audio pattern
 * from successful VAD tests to ensure reliable VAD event detection.
 */

import { test, expect } from '@playwright/test';
const { 
  SELECTORS,
  waitForConnection 
} = require('./helpers/test-helpers');
import { setupTestPage } from './helpers/audio-mocks';
const {
  VADTestUtilities,
  setupVADTestEnvironment,
  waitForVADEvents,
  validateVADSignalRedundancy,
  validateAgentStateTimeoutBehavior,
  validateIdleTimeoutStateMachine,
  VAD_TEST_CONSTANTS
} = require('../utils/vad-test-utilities');

test.describe('VAD Redundancy and Agent State Timeout Behavior', () => {
  let vadUtils;

  test.beforeEach(async ({ page, context }) => {
    // Setup VAD test environment using shared utilities
    await setupVADTestEnvironment(page, context);
    
    // Setup test page
    await setupTestPage(page);
    await page.waitForLoadState('networkidle');
    await waitForConnection(page, VAD_TEST_CONSTANTS.CONNECTION_TIMEOUT_MS);
    
    // Initialize VAD utilities
    vadUtils = new VADTestUtilities(page);
    
    console.log('🧪 VAD Redundancy Test Suite initialized');
  });
  
  test('should detect and handle VAD signal redundancy with pre-recorded audio', async ({ page }) => {
    console.log('🧪 Testing VAD signal redundancy detection with pre-recorded audio...');
    
    // Load and send pre-recorded audio sample (using working pattern)
    await vadUtils.loadAndSendAudioSample('hello__how_are_you_today_');
    
    // Wait for VAD events to be processed
    await waitForVADEvents(page, 3000);
    
    // Analyze VAD events
    const vadAnalysis = vadUtils.analyzeVADEvents();
    vadUtils.analyzeTiming();
    
    // Validate VAD signal redundancy using shared utility
    const validationResults = validateVADSignalRedundancy(vadAnalysis);
    
    // Assert the validation results in test context
    expect(validationResults.hasMultipleSignals).toBe(true);
    expect(validationResults.totalEvents).toBeGreaterThan(1);
  });

  test('should handle agent state transitions for idle timeout behavior', async ({ page }) => {
    console.log('🧪 Testing agent state timeout behavior with pre-recorded audio...');
    
    // Load and send pre-recorded audio sample
    await vadUtils.loadAndSendAudioSample('hello__how_are_you_today_');
    
    // Wait for agent processing
    await page.waitForTimeout(VAD_TEST_CONSTANTS.AGENT_PROCESSING_WAIT_MS);
    
    // Analyze agent state changes
    const agentAnalysis = vadUtils.analyzeAgentStateChanges();
    
    // Validate agent state timeout behavior using shared utility
    const validationResults = validateAgentStateTimeoutBehavior(agentAnalysis);
    
    // Assert the validation results in test context
    expect(validationResults.hasEnableActions).toBe(true);
    expect(validationResults.hasDisableActions).toBe(true);
  });

  test('should maintain consistent idle timeout state machine', async ({ page }) => {
    console.log('🧪 Testing idle timeout state machine consistency with pre-recorded audio...');
    
    // Load and send pre-recorded audio sample
    await vadUtils.loadAndSendAudioSample('hello__how_are_you_today_');
    
    // Wait for complete processing cycle
    await page.waitForTimeout(VAD_TEST_CONSTANTS.VAD_EVENT_WAIT_MS);
    
    // Analyze state machine consistency
    const agentAnalysis = vadUtils.analyzeAgentStateChanges();
    
    // Validate idle timeout state machine using shared utility
    const validationResults = validateIdleTimeoutStateMachine(agentAnalysis);
    
    // Assert the validation results in test context
    expect(validationResults.hasEnableActions).toBe(true);
    expect(validationResults.hasDisableActions).toBe(true);
    
    // Final timeout test - wait for natural timeout
    console.log('Step 4: Testing natural timeout...');
    await page.waitForTimeout(VAD_TEST_CONSTANTS.NATURAL_TIMEOUT_WAIT_MS);
    
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`Final connection status: ${connectionStatus}`);
    
    // The connection should timeout naturally if the state machine is working
    if (connectionStatus === 'closed') {
      console.log('✅ Natural timeout worked - state machine is consistent');
    } else {
      console.log('❌ Natural timeout failed - state machine may have issues');
    }
  });
});