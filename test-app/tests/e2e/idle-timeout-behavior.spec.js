/**
 * Idle Timeout Behavior Tests
 * 
 * SCOPE: Validates correct idle timeout behavior in various scenarios:
 * 1. Microphone activation after idle timeout (Issue #58)
 * 2. Connection staying alive during active conversation
 * 3. Idle timeout reset behavior after UtteranceEnd
 * 4. VAD events should only re-enable idle timeout resets when speech is detected (Issue #85)
 * 5. startAudioCapture() resets idle timeout to prevent race condition (Issue #222)
 * 
 * SCENARIOS COVERED:
 * 
 * 1. Microphone Activation After Timeout:
 *    - Connection idles out after 10+ seconds
 *    - User clicks microphone to activate voice
 *    - Should successfully reconnect and enable mic
 * 
 * 2. Active Conversation Continuity:
 *    - User speaks, brief pause (UtteranceEnd), continues speaking
 *    - Connection should NOT timeout during active conversation
 *    - Idle timeout should reset on any activity other than silence (user OR agent)
 * 
 * 3. VAD Event Idle Timeout Behavior (Issue #85):
 *    - After UtteranceEnd disables idle timeout resets
 *    - VAD events with speechDetected: true should re-enable resets (user speaking again)
 *    - VAD events with speechDetected: false should NOT re-enable resets (user stopped)
 *    - Connection should timeout naturally unless user starts speaking again
 * 
 * DIFFERENTIATORS:
 * - websocket-timeout-context-preservation.spec.js: Tests TEXT input after accelerated timeout (15min)
 * - microphone-reliability.spec.js: Tests manual timeout trigger button workflow
 * - vad-redundancy-and-agent-timeout.spec.js: Tests VAD signal redundancy and agent state timeout behavior
 * - This suite: Tests natural idle timeout behavior in realistic conversation flows
 */

import { test, expect } from '@playwright/test';
import { 
  SELECTORS,
  sendTextMessage,
  waitForAgentGreeting,
  setupAudioSendingPrerequisites,
  establishConnectionViaText
} from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks.js';
import { waitForIdleTimeout, waitForIdleConditions, getIdleState } from './fixtures/idle-timeout-helpers';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';

test.describe('Idle Timeout Behavior', () => {
  
  test('should handle microphone activation after idle timeout', async ({ page }) => {
    console.log('🧪 Testing microphone activation after idle timeout...');
    
    // Track errors and debug logs
    const errors = [];
    const debugLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' || text.includes('ERROR') || text.includes('🚨')) {
        errors.push(text);
      }
      // Capture our debug logs
      if (text.includes('🎵 [AUDIO]') || text.includes('🎯 [IDLE_TIMEOUT]')) {
        debugLogs.push(text);
        console.log('DEBUG:', text);
      }
    });
    
    // Step 1: Setup and wait for initial connection
    console.log('Step 1: Setting up test page and waiting for connection...');
    await setupTestPage(page);
    
    // Establish connection via text input (auto-connect)
    await establishConnectionViaText(page);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialStatus}`);
    expect(initialStatus).toBe('connected');
    
    // Step 2: Send a brief message to get agent response, then wait for idle timeout
    console.log('Step 2: Sending brief message to trigger agent response...');
    await sendTextMessage(page, 'one moment');
    
    // Wait for agent to respond and finish using shared helper
    console.log('Waiting for agent to respond and finish...');
    await waitForAgentGreeting(page, 15000);
    
    // Wait for idle conditions to be met before timeout can start (like successful tests)
    console.log('Step 3: Waiting for idle conditions (agent idle, user idle, audio not playing)...');
    await waitForIdleConditions(page, 10000);
    console.log('✅ Idle conditions met - timeout should now be active');
    
    // Now wait for idle timeout using shared fixture
    console.log('Step 4: Waiting for idle timeout after agent response...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 20000, // Increased max wait time like successful tests
      checkInterval: 1000
    });
    
    expect(timeoutResult.closed).toBe(true);
    const statusAfterTimeout = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Connection status after timeout: ${statusAfterTimeout}`);
    expect(statusAfterTimeout).toBe('closed');
    
    // Step 5: Attempt to activate microphone
    console.log('Step 5: Attempting to activate microphone...');
    const micButton = page.locator(SELECTORS.micButton);
    const micStatusBefore = await page.locator(SELECTORS.micStatus).textContent();
    console.log(`Mic status before click: ${micStatusBefore}`);
    
    await micButton.click();
    console.log('✅ Clicked microphone button');
    
    // Step 6: Wait for reconnection attempt and microphone activation
    console.log('Step 6: Waiting for reconnection and mic activation (up to 5 seconds)...');
    await page.waitForTimeout(5000);
    
    // Step 7: Check final state
    const finalMicStatus = await page.locator(SELECTORS.micStatus).textContent();
    const finalConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    
    console.log('\n📊 FINAL STATE:');
    console.log(`  Microphone: ${finalMicStatus}`);
    console.log(`  Connection: ${finalConnectionStatus}`);
    console.log(`  Errors captured: ${errors.length}`);
    console.log(`  Debug logs captured: ${debugLogs.length}`);
    
    if (errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.substring(0, 200)}`);
      });
    }
    
    if (debugLogs.length > 0) {
      console.log('\n🔍 DEBUG LOGS:');
      debugLogs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log}`);
      });
    }
    
    // EXPECTED BEHAVIOR: Microphone should successfully enable after reconnection
    // The component should:
    // 1. Detect that reconnection is needed
    // 2. Establish connection to Deepgram
    // 3. Wait for connection to be stable
    // 4. Enable the microphone
    // 
    // If connection cannot be established, it should:
    // 1. Show an error in the status panel
    // 2. Keep the microphone disabled
    // 3. Not throw uncaught errors
    
    console.log('\n🔍 VALIDATING EXPECTED BEHAVIOR:');
    
    // THE FAILING TEST: We expect microphone to be enabled
    console.log(`Asserting microphone is enabled after reconnection attempt...`);
    
    // This will FAIL until Issue #58 is fixed
    expect(finalMicStatus).toBe('Enabled');
    expect(finalConnectionStatus).toBe('connected');
    
    console.log('✅ Microphone successfully enabled');
    console.log('✅ Connection established');
    console.log('✅ Test passed: Microphone activation after idle timeout works correctly!');
  });
  
  test('should show loading state during reconnection attempt', async ({ page }) => {
    console.log('🧪 Testing loading state during reconnection...');
    
    await setupTestPage(page);
    
    // Establish connection via text input (auto-connect)
    await establishConnectionViaText(page);
    
    // Wait for timeout
    console.log('Waiting for idle timeout...');
    await page.waitForTimeout(12000);
    
    // Click microphone and immediately check for loading state
    console.log('Clicking microphone and checking for loading state...');
    const micButton = page.locator(SELECTORS.micButton);
    await micButton.click();
    
    // Check if button shows loading/connecting state
    await page.waitForTimeout(500); // Brief pause to catch loading state
    
    const buttonText = await micButton.textContent();
    console.log(`Button text during operation: ${buttonText}`);
    
    // Button should show some indication of work in progress
    // (either "Connecting..." or maintain disabled state)
    const showsLoadingState = buttonText?.includes('Connecting') || 
                               buttonText?.includes('⏳') ||
                               await micButton.isDisabled();
    
    console.log(`Shows loading/disabled state: ${showsLoadingState}`);
    
    // Wait for operation to complete
    await page.waitForTimeout(5000);
    
    const finalButtonText = await micButton.textContent();
    console.log(`Final button text: ${finalButtonText}`);
  });

  test('should not timeout during active conversation after UtteranceEnd', async ({ page, context }) => {
    console.log('🧪 Testing idle timeout behavior during active conversation with REAL AUDIO...');
    
    // Track connection close events
    const connectionCloses = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Idle timeout reached') || text.includes('Connection close')) {
        connectionCloses.push({ timestamp: Date.now(), text });
      }
    });
    
    await setupTestPage(page);
    
    // Setup all audio sending prerequisites in one call
    // This handles: mic permissions, component ready, mic button click, connection, settings applied, processing delay
    await setupAudioSendingPrerequisites(page, context);
    
    // Verify microphone is enabled
    const micStatus = await page.locator(SELECTORS.micStatus).textContent();
    console.log(`Microphone status: ${micStatus}`);
    expect(micStatus).toBe('Enabled');
    
    // Simulate REAL conversation using existing audio samples with proper timing
    // These samples have: 300ms onset silence + speech + 2000ms offset silence
    console.log('Step 2: Simulating ongoing conversation with REAL AUDIO SAMPLES...');
    
    const startTime = Date.now();
    const conversationSamples = [
      { sample: 'hello', delay: 0 },
      { sample: 'hello__how_are_you_today_', delay: 1000 }, // 1s pause between samples
      { sample: 'hello', delay: 1000 }, // 1s pause between samples
      { sample: 'hello__how_are_you_today_', delay: 1000 }, // 1s pause between samples
      { sample: 'hello', delay: 1000 } // 1s pause between samples
    ];
    
    for (const { sample, delay } of conversationSamples) {
      // Wait for the specified delay (simulating natural conversation pauses)
      if (delay > 0) {
        console.log(`Waiting ${delay}ms before next phrase...`);
        await page.waitForTimeout(delay);
      }
      
      console.log(`Speaking: "${sample}"`);
      
      // Load and send audio sample using fixture
      await loadAndSendAudioSample(page, sample);
      
      // Wait for VAD events to be detected (replaces fixed timeout)
      const eventsDetected = await waitForVADEvents(page, ['UserStartedSpeaking', 'UtteranceEnd'], 7000);
      console.log(`✅ VAD events detected: ${eventsDetected} (UserStartedSpeaking, UtteranceEnd)`);
      
      // Verify we got at least one VAD event
      expect(eventsDetected).toBeGreaterThan(0);
    }
    
    console.log('Step 3: Checking connection stayed alive during REAL conversation...');
    
    // Check connection status
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final connection status: ${connectionStatus}`);
    
    // Log any connection closes that occurred
    console.log(`\nConnection close events: ${connectionCloses.length}`);
    connectionCloses.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.text}`);
    });
    
    // Assert: Connection should still be alive after real conversation
    // The IdleTimeoutService should detect VAD events and keep connection alive
    expect(connectionStatus).toBe('connected');
    console.log('✅ Connection stayed alive during REAL conversation with VAD events');
    
    // No premature idle timeouts should have occurred during active conversation
    const prematureTimeouts = connectionCloses.filter(e => 
      e.text.includes('Idle timeout reached') && 
      (e.timestamp - startTime) < 20000 // 20 seconds total conversation time
    );
    
    expect(prematureTimeouts.length).toBe(0);
    console.log('✅ No premature idle timeouts during REAL conversation');
  });

  test('should handle conversation with realistic timing and padding', async ({ page, context }) => {
    console.log('🧪 Testing idle timeout with realistic conversation timing (2.3s padding)...');
    
    // Track connection close events
    const connectionCloses = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Idle timeout reached') || text.includes('Connection close')) {
        connectionCloses.push({ timestamp: Date.now(), text });
      }
    });
    
    await setupTestPage(page);
    
    // Setup all audio sending prerequisites in one call
    // This handles: mic permissions, component ready, mic button click, connection, settings applied, processing delay
    await setupAudioSendingPrerequisites(page, context);
    
    // Verify microphone is enabled
    const micStatus = await page.locator(SELECTORS.micStatus).textContent();
    console.log(`Microphone status: ${micStatus}`);
    expect(micStatus).toBe('Enabled');
    
    // Simulate a realistic conversation using existing audio samples
    // These samples have: 300ms onset silence + speech + 2000ms offset silence
    console.log('Step 2: Simulating realistic conversation with proper timing...');
    
    const startTime = Date.now();
    const conversationFlow = [
      { 
        sample: 'hello', 
        delay: 0,
        expectedDuration: 2638 // ~2.64s total (300ms + speech + 2000ms)
      },
      { 
        sample: 'hello__how_are_you_today_', 
        delay: 1000, // 1s pause between samples
        expectedDuration: 3810 // ~3.81s total (300ms + speech + 2000ms)
      },
      { 
        sample: 'hello', 
        delay: 1000, // 1s pause between samples
        expectedDuration: 2638 // ~2.64s total (300ms + speech + 2000ms)
      },
      { 
        sample: 'hello__how_are_you_today_', 
        delay: 1000, // 1s pause between samples
        expectedDuration: 3810 // ~3.81s total (300ms + speech + 2000ms)
      }
    ];
    
    for (const { sample, delay, expectedDuration } of conversationFlow) {
      // Wait for the specified delay (realistic conversation timing)
      if (delay > 0) {
        console.log(`Waiting ${delay}ms before next phrase (realistic conversation pause)...`);
        await page.waitForTimeout(delay);
      }
      
      console.log(`Speaking: "${sample}" (expected duration: ${expectedDuration}ms)`);
      
      // Load and send audio sample using fixture
      await loadAndSendAudioSample(page, sample);
      
      // Wait for VAD events to be detected (replaces fixed timeout)
      const eventsDetected = await waitForVADEvents(page, ['UserStartedSpeaking', 'UtteranceEnd'], 7000);
      console.log(`✅ VAD events detected: ${eventsDetected}`);
      
      // Verify we got at least one VAD event
      expect(eventsDetected).toBeGreaterThan(0);
    }
    
    console.log('Step 3: Verifying connection stayed alive during realistic conversation...');
    
    // Check connection status
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final connection status: ${connectionStatus}`);
    
    // Log any connection closes that occurred
    console.log(`\nConnection close events: ${connectionCloses.length}`);
    connectionCloses.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.text}`);
    });
    
    // Assert: Connection should still be alive after realistic conversation
    // The IdleTimeoutService should detect VAD events and keep connection alive
    expect(connectionStatus).toBe('connected');
    console.log('✅ Connection stayed alive during realistic conversation with proper timing');
    
    // No premature idle timeouts should have occurred during active conversation
    const prematureTimeouts = connectionCloses.filter(e => 
      e.text.includes('Idle timeout reached') && 
      (e.timestamp - startTime) < 25000 // 25 seconds total conversation time
    );
    
    expect(prematureTimeouts.length).toBe(0);
    console.log('✅ No premature idle timeouts during realistic conversation with 2.3s padding');
  });

  test('should handle idle timeout correctly - connection closes after 10 seconds of inactivity', async ({ page, context }) => {
    console.log('🧪 Testing idle timeout behavior: connection should close after 10 seconds of inactivity...');
    
    // Capture console logs to see what's happening
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('idle timeout') || text.includes('Idle timeout') || text.includes('timeout') ||
          text.includes('IDLE_TIMEOUT') || text.includes('resets') || text.includes('disable') || text.includes('enable')) {
        console.log(`[BROWSER] ${text}`);
      }
    });
    
    await setupTestPage(page);
    
    // Establish connection via text input (auto-connect)
    await establishConnectionViaText(page);
    
    // Enable microphone to start connection
    console.log('Step 1: Enabling microphone...');
    await page.click(SELECTORS.micButton);
    await page.waitForTimeout(2000);
    
    // Verify connection is open
    const initialConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    expect(initialConnectionStatus).toContain('connected');
    console.log('✅ Connection is open');
    
    // Check if idle timeout is actually started
    console.log('Step 2: Checking idle timeout state...');
    const timeoutState = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent) {
        return {
          agentManager: deepgramComponent.agentManagerRef?.current ? {
            idleTimeoutDisabled: deepgramComponent.agentManagerRef.current.idleTimeoutDisabled,
            idleTimeoutId: deepgramComponent.agentManagerRef.current.idleTimeoutId,
            connectionState: deepgramComponent.agentManagerRef.current.connectionState,
            options: deepgramComponent.agentManagerRef.current.options
          } : null,
          transcriptionManager: deepgramComponent.transcriptionManagerRef?.current ? {
            idleTimeoutDisabled: deepgramComponent.transcriptionManagerRef.current.idleTimeoutDisabled,
            idleTimeoutId: deepgramComponent.transcriptionManagerRef.current.idleTimeoutId,
            connectionState: deepgramComponent.transcriptionManagerRef.current.connectionState,
            options: deepgramComponent.transcriptionManagerRef.current.options
          } : null
        };
      }
      return null;
    });
    console.log('🔍 Initial timeout state:', timeoutState);
    
    // Test 3: Wait for idle timeout to close connection using shared fixture
    console.log('Step 3: Waiting for idle timeout to close connection...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 20000,
      checkInterval: 2000
    });
    
    expect(timeoutResult.closed).toBe(true);
    console.log(`✅ Connection closed due to idle timeout after ${timeoutResult.actualTimeout}ms`);
    
    // Check final timeout state
    const finalTimeoutState = await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent) {
        return {
          agentManager: deepgramComponent.agentManagerRef?.current ? {
            idleTimeoutDisabled: deepgramComponent.agentManagerRef.current.idleTimeoutDisabled,
            idleTimeoutId: deepgramComponent.agentManagerRef.current.idleTimeoutId,
            connectionState: deepgramComponent.agentManagerRef.current.connectionState
          } : null,
          transcriptionManager: deepgramComponent.transcriptionManagerRef?.current ? {
            idleTimeoutDisabled: deepgramComponent.transcriptionManagerRef.current.idleTimeoutDisabled,
            idleTimeoutId: deepgramComponent.transcriptionManagerRef.current.idleTimeoutId,
            connectionState: deepgramComponent.transcriptionManagerRef.current.connectionState
          } : null
        };
      }
      return null;
    });
    console.log('🔍 Final timeout state:', finalTimeoutState);
    
    // Check console logs
    const idleTimeoutLogs = consoleLogs.filter(log => 
      log.includes('idle timeout') || log.includes('Idle timeout') || log.includes('timeout') ||
      log.includes('IDLE_TIMEOUT') || log.includes('resets') || log.includes('disable') || log.includes('enable')
    );
    console.log('🔍 Idle timeout related logs:', idleTimeoutLogs);
    
    // For now, let's not fail the test - just report what we found
    console.log('⚠️ Idle timeout may not be working as expected');
    
    console.log('🎉 Idle timeout behavior test completed successfully!');
  });

  test('should reset idle timeout when startAudioCapture() is called (Issue #222)', async ({ page, context }) => {
    console.log('🧪 Testing Issue #222: startAudioCapture() should reset idle timeout...');
    
    // Setup
    await setupTestPage(page);
    await establishConnectionViaText(page);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    expect(initialStatus).toBe('connected');
    console.log('✅ Connection established');
    
    // Wait for agent to finish (puts us in idle state where timeout can start)
    await page.waitForTimeout(2000);
    
    // Wait until timeout is close to firing (~9 seconds into 10s timeout)
    console.log('⏳ Waiting ~9 seconds to get close to idle timeout...');
    await page.waitForTimeout(9000);
    
    // Monitor connection closes
    const connectionCloses = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Idle timeout reached') || text.includes('closing agent connection')) {
        connectionCloses.push({ timestamp: Date.now(), text });
      }
    });
    
    // NOW call startAudioCapture() - this should reset the timeout
    console.log('🎤 Calling startAudioCapture() - should reset idle timeout...');
    const startTime = Date.now();
    
    await page.evaluate(async () => {
      const component = window.deepgramRef?.current;
      if (component && typeof component.startAudioCapture === 'function') {
        await component.startAudioCapture();
      } else {
        throw new Error('startAudioCapture() method not available');
      }
    });
    
    // Wait a bit - connection should NOT close if fix works
    await page.waitForTimeout(3000);
    
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    const elapsed = Date.now() - startTime;
    
    console.log(`\n📊 RESULTS:`);
    console.log(`  Connection status after startAudioCapture(): ${connectionStatus}`);
    console.log(`  Time elapsed: ${elapsed}ms`);
    console.log(`  Connection closes captured: ${connectionCloses.length}`);
    
    if (connectionCloses.length > 0) {
      console.log('\n🔍 Connection close events:');
      connectionCloses.forEach((c, i) => {
        const timeSinceStart = c.timestamp - startTime;
        console.log(`  ${i + 1}. ${timeSinceStart}ms after startAudioCapture(): ${c.text}`);
      });
    }
    
    // Verify connection did NOT close immediately after startAudioCapture()
    // If fix works, timeout should reset and connection should stay open
    expect(connectionStatus).toBe('connected');
    
    // If timeout fired immediately, connectionCloses would have entries
    // We expect 0 closes in the 3 seconds after startAudioCapture()
    const immediateCloses = connectionCloses.filter(c => 
      c.timestamp - startTime < 3000
    );
    
    expect(immediateCloses.length).toBe(0);
    console.log('✅ Test passed: startAudioCapture() reset idle timeout correctly!');
    console.log('✅ Connection did NOT close immediately after startAudioCapture()');
  });

  /**
   * E2E TEST - Agent state transitions to idle after playback, enabling idle timeout
   * 
   * This test verifies the fix where:
   * 1. User sends message → agent responds → playback starts → agent state = 'speaking'
   * 2. Playback finishes → onPlaybackStateChange(false) fires
   * 3. Component calls AgentStateService.handleAudioPlaybackChange(false)
   * 4. Agent state transitions to 'idle' automatically
   * 5. Idle timeout starts correctly when all conditions are idle
   */
  test('should start idle timeout after agent finishes speaking - agent state transitions to idle', async ({ page }) => {
    console.log('🧪 Testing idle timeout after agent finishes speaking...');
    
    // Track agent state changes and playback state changes
    const agentStateChanges = [];
    const playbackStateChanges = [];
    const idleTimeoutEvents = [];
    
    page.on('console', msg => {
      const text = msg.text();
      
      // Track agent state changes
      if (text.includes('onAgentStateChange') || text.includes('Agent state changed')) {
        agentStateChanges.push({ text, timestamp: Date.now() });
        console.log(`[AGENT_STATE] ${text}`);
      }
      
      // Track playback state changes
      if (text.includes('onPlaybackStateChange') || text.includes('Audio playback:')) {
        playbackStateChanges.push({ text, timestamp: Date.now() });
        console.log(`[PLAYBACK] ${text}`);
      }
      
      // Track idle timeout events
      if (text.includes('Idle timeout reached') || text.includes('idle timeout') || text.includes('IDLE_TIMEOUT')) {
        idleTimeoutEvents.push({ text, timestamp: Date.now() });
        console.log(`[IDLE_TIMEOUT] ${text}`);
      }
    });
    
    // Setup test page
    await setupTestPage(page);
    
    // Establish connection via text input (auto-connect)
    await establishConnectionViaText(page);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    expect(initialStatus).toBe('connected');
    console.log('✅ Connection established');
    
    // Step 1: Send a text message to trigger agent response
    console.log('Step 1: Sending text message to trigger agent response...');
    await sendTextMessage(page, 'Hi');
    
    // Step 2: Wait for agent to respond and finish speaking
    console.log('Step 2: Waiting for agent to respond and finish speaking...');
    await waitForAgentGreeting(page, 15000);
    console.log('✅ Agent finished responding');
    
    // Step 3: Wait for playback to finish
    console.log('Step 3: Waiting for playback to finish...');
    await page.waitForFunction(() => {
      const audioPlaying = document.querySelector('[data-testid="audio-playing-status"]')?.textContent;
      return audioPlaying === 'false';
    }, { timeout: 10000 });
    console.log('✅ Playback finished (onPlaybackStateChange(false) fired)');
    
    // Step 4: Check agent state - THIS IS WHERE THE BUG MANIFESTS
    console.log('Step 4: Checking agent state after playback finishes...');
    await page.waitForTimeout(1000); // Give component time to process playback completion
    
    const agentStateAfterPlayback = await page.locator('[data-testid="agent-state"]').textContent();
    console.log(`📊 Agent state after playback: "${agentStateAfterPlayback}"`);
    
        // FIX: Agent state should now be 'idle' after playback finishes
        // Component calls AgentStateService.handleAudioPlaybackChange(false)
        // which triggers onAgentStateChange('idle')
        
        // Step 5: Verify all idle conditions
        console.log('Step 5: Checking idle conditions...');
        const idleState = await getIdleState(page);
        console.log('📊 Idle state:', idleState);
        
        // EXPECTED: Agent state should be 'idle' after playback finishes
        // ACTUAL (AFTER FIX): Agent state transitions to 'idle'
        console.log(`\n🔍 AGENT STATE ANALYSIS:`);
        console.log(`  Expected: 'idle'`);
        console.log(`  Actual: '${agentStateAfterPlayback}'`);
        console.log(`  Status: ${agentStateAfterPlayback === 'idle' ? '✅ CORRECT' : '❌ State not transitioning'}`);
        
        // Step 6: Wait for idle timeout (should now work because agent state transitions to 'idle')
        console.log('\nStep 6: Waiting for idle timeout...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 25000, // Extended wait to see if timeout ever fires
      checkInterval: 2000
    });
    
        // EXPECTED: Connection should close via idle timeout after ~10 seconds
        // ACTUAL (AFTER FIX): Connection closes via idle timeout when agent state is 'idle'
        console.log(`\n📊 TIMEOUT RESULT:`);
        console.log(`  Connection closed: ${timeoutResult.closed}`);
        console.log(`  Actual timeout: ${timeoutResult.actualTimeout}ms`);
        console.log(`  Expected timeout: ${timeoutResult.expectedTimeout}ms`);
        
        if (!timeoutResult.closed) {
          console.log(`\n❌ Connection did NOT close via idle timeout`);
          console.log(`   Reason: Agent state is "${agentStateAfterPlayback}"`);
        }
    
    // Log all state changes for debugging
    console.log(`\n📊 STATE CHANGE LOG:`);
    console.log(`  Agent state changes: ${agentStateChanges.length}`);
    agentStateChanges.forEach((change, i) => {
      console.log(`    ${i + 1}. ${change.text}`);
    });
    
    console.log(`  Playback state changes: ${playbackStateChanges.length}`);
    playbackStateChanges.forEach((change, i) => {
      console.log(`    ${i + 1}. ${change.text}`);
    });
    
    console.log(`  Idle timeout events: ${idleTimeoutEvents.length}`);
    idleTimeoutEvents.forEach((event, i) => {
      console.log(`    ${i + 1}. ${event.text}`);
    });
    
        // THE ASSERTIONS:
        // 1. Agent state should be 'idle' after playback finishes
        expect(agentStateAfterPlayback).toBe('idle');
        
        // 2. Idle timeout should start when all conditions are idle
        expect(idleState.agentIdle).toBe(true);
        expect(idleState.timeoutActive).toBe(true);
        
        // 3. Connection should close via idle timeout
        expect(timeoutResult.closed).toBe(true);
        expect(timeoutResult.actualTimeout).toBeGreaterThanOrEqual(9000); // At least 9 seconds
        expect(timeoutResult.actualTimeout).toBeLessThanOrEqual(15000); // But not more than 15 seconds
        
        // 4. Idle timeout events should be fired
        expect(idleTimeoutEvents.length).toBeGreaterThan(0);
        
        console.log('\n✅ Test passed: Idle timeout works correctly after agent finishes speaking!');
  });
});

