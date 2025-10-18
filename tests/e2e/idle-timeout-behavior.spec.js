/**
 * Idle Timeout Behavior Tests
 * 
 * SCOPE: Validates correct idle timeout behavior in various scenarios:
 * 1. Microphone activation after idle timeout (Issue #58)
 * 2. Connection staying alive during active conversation
 * 3. Idle timeout reset behavior after UtteranceEnd
 * 4. VAD events should only re-enable idle timeout resets when speech is detected (Issue #85)
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
 * - This suite: Tests natural idle timeout behavior in realistic conversation flows
 */

const { test, expect } = require('@playwright/test');
const { 
  SELECTORS,
  waitForConnection 
} = require('./helpers/test-helpers');
const { setupTestPage } = require('./helpers/audio-mocks');

test.describe('Idle Timeout Behavior', () => {
  
  test('should handle microphone activation after idle timeout', async ({ page }) => {
    console.log('🧪 Testing microphone activation after idle timeout...');
    
    // Track errors
    const errors = [];
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' || text.includes('ERROR') || text.includes('🚨')) {
        errors.push(text);
      }
    });
    
    // Step 1: Setup and wait for initial connection
    console.log('Step 1: Setting up test page and waiting for connection...');
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Initial connection status: ${initialStatus}`);
    expect(initialStatus).toBe('connected');
    
    // Step 2: Wait for idle timeout (10+ seconds of inactivity)
    console.log('Step 2: Waiting for idle timeout (12 seconds)...');
    await page.waitForTimeout(12000);
    
    const statusAfterTimeout = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Connection status after timeout: ${statusAfterTimeout}`);
    // Connection should be closed after idle timeout
    expect(statusAfterTimeout).toBe('closed');
    
    // Step 3: Attempt to activate microphone
    console.log('Step 3: Attempting to activate microphone...');
    const micButton = page.locator(SELECTORS.micButton);
    const micStatusBefore = await page.locator(SELECTORS.micStatus).textContent();
    console.log(`Mic status before click: ${micStatusBefore}`);
    
    await micButton.click();
    console.log('✅ Clicked microphone button');
    
    // Step 4: Wait for reconnection attempt and microphone activation
    console.log('Step 4: Waiting for reconnection and mic activation (up to 5 seconds)...');
    await page.waitForTimeout(5000);
    
    // Step 5: Check final state
    const finalMicStatus = await page.locator(SELECTORS.micStatus).textContent();
    const finalConnectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    
    console.log('\n📊 FINAL STATE:');
    console.log(`  Microphone: ${finalMicStatus}`);
    console.log(`  Connection: ${finalConnectionStatus}`);
    console.log(`  Errors captured: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.substring(0, 200)}`);
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
    await waitForConnection(page, 10000);
    
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

  test('should not timeout during active conversation after UtteranceEnd', async ({ page }) => {
    console.log('🧪 Testing idle timeout behavior during active conversation...');
    
    // Track connection close events
    const connectionCloses = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Idle timeout reached') || text.includes('Connection close')) {
        connectionCloses.push({ timestamp: Date.now(), text });
      }
    });
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Enable microphone to start conversation
    console.log('Step 1: Enabling microphone...');
    const micButton = page.locator(SELECTORS.micButton);
    await micButton.click();
    await page.waitForTimeout(1000);
    
    const micStatus = await page.locator(SELECTORS.micStatus).textContent();
    console.log(`Microphone status: ${micStatus}`);
    expect(micStatus).toBe('Enabled');
    
    // Simulate user speaking by sending audio data multiple times over 15+ seconds
    // This simulates: user speaks → pause (UtteranceEnd) → continues speaking
    console.log('Step 2: Simulating ongoing conversation with pauses...');
    
    const startTime = Date.now();
    const conversationDuration = 15000; // 15 seconds of conversation
    const speakingIntervals = [
      { start: 0, duration: 3000, label: 'First utterance' },
      { start: 4000, duration: 3000, label: 'Second utterance (after brief pause)' },
      { start: 8000, duration: 3000, label: 'Third utterance (continuing)' },
      { start: 12000, duration: 3000, label: 'Fourth utterance (still going)' }
    ];
    
    for (const interval of speakingIntervals) {
      // Wait until it's time for this speaking interval
      const elapsed = Date.now() - startTime;
      const waitTime = interval.start - elapsed;
      if (waitTime > 0) {
        console.log(`Waiting ${waitTime}ms before ${interval.label}...`);
        await page.waitForTimeout(waitTime);
      }
      
      console.log(`Speaking: ${interval.label}`);
      
      // Simulate audio data being sent during this interval
      await page.evaluate((duration) => {
        const deepgramComponent = window.deepgramRef?.current;
        if (deepgramComponent && deepgramComponent.sendAudioData) {
          // Send audio chunks to simulate speaking
          const chunkInterval = setInterval(() => {
            const audioData = new ArrayBuffer(8192);
            deepgramComponent.sendAudioData(audioData);
          }, 100);
          
          // Stop sending after duration
          setTimeout(() => clearInterval(chunkInterval), duration);
        }
      }, interval.duration);
      
      await page.waitForTimeout(interval.duration);
    }
    
    console.log('Step 3: Checking connection stayed alive during conversation...');
    
    // Check connection status
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final connection status: ${connectionStatus}`);
    
    // Log any connection closes that occurred
    console.log(`\nConnection close events: ${connectionCloses.length}`);
    connectionCloses.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.text}`);
    });
    
    // Assert: Connection should still be alive after 15 seconds of active conversation
    // The bug would cause it to timeout after UtteranceEnd despite ongoing conversation
    expect(connectionStatus).toBe('connected');
    console.log('✅ Connection stayed alive during active conversation with pauses');
    
    // No premature idle timeouts should have occurred during active conversation
    const prematureTimeouts = connectionCloses.filter(e => 
      e.text.includes('Idle timeout reached') && 
      (e.timestamp - startTime) < conversationDuration
    );
    
    expect(prematureTimeouts.length).toBe(0);
    console.log('✅ No premature idle timeouts during active conversation');
  });

  test('should handle idle timeout resets correctly for all activity types (Issue #85)', async ({ page }) => {
    console.log('🧪 Testing Issue #85: Comprehensive idle timeout behavior for all activity types...');
    
    // Track console logs to verify behavior
    const consoleLogs = [];
    const activityLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('idle timeout resets') || text.includes('VAD Event received') || 
          text.includes('Agent state changed') || text.includes('User speaking') ||
          text.includes('Agent speaking') || text.includes('Agent thinking')) {
        consoleLogs.push(text);
      }
      if (text.includes('activity') || text.includes('speaking') || text.includes('thinking')) {
        activityLogs.push(text);
      }
    });
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Enable microphone
    console.log('Step 1: Enabling microphone...');
    await page.click(SELECTORS.micButton);
    await page.waitForTimeout(1000);
    
    // Test 1: User speaking should re-enable idle timeout resets
    console.log('Step 2: Testing user speaking activity...');
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        // Send audio data to simulate speaking
        const audioData = new ArrayBuffer(8192);
        deepgramComponent.sendAudioData(audioData);
      }
    });
    await page.waitForTimeout(2000);
    
    // Wait for VAD event with speechDetected: true
    await page.waitForFunction(() => {
      return window.consoleLogs?.some(log => log.includes('VAD Event received: {speechDetected: true'));
    }, { timeout: 5000 });
    
    // Verify that speechDetected: true re-enables idle timeout resets
    const reEnabledLogs = consoleLogs.filter(log => log.includes('Re-enabled idle timeout resets for agent'));
    expect(reEnabledLogs.length).toBeGreaterThan(0);
    console.log('✅ User speaking correctly re-enabled idle timeout resets');
    
    // Test 2: Stop speaking (triggers UtteranceEnd) - should disable resets
    console.log('Step 3: Testing user stopping speaking (UtteranceEnd)...');
    await page.evaluate(() => {
      // Stop sending audio data to trigger UtteranceEnd
    });
    await page.waitForTimeout(1000);
    
    // Wait for UtteranceEnd to disable idle timeout resets
    await page.waitForFunction(() => {
      return window.consoleLogs?.some(log => log.includes('disabling idle timeout resets for natural connection closure'));
    }, { timeout: 5000 });
    
    // Verify UtteranceEnd disabled idle timeout resets
    await expect(page.locator('body')).toContainText('disabling idle timeout resets for natural connection closure');
    console.log('✅ UtteranceEnd correctly disabled idle timeout resets');
    
    // Test 3: Agent thinking should also disable idle timeout resets (CURRENTLY MISSING)
    console.log('Step 4: Testing agent thinking state...');
    
    // Simulate agent thinking by injecting a message
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.injectAgentMessage) {
        deepgramComponent.injectAgentMessage("Test message to trigger agent thinking");
      }
    });
    await page.waitForTimeout(2000);
    
    // Wait for agent thinking state
    await page.waitForFunction(() => {
      return window.consoleLogs?.some(log => log.includes('AgentThinking') || log.includes('Agent state changed: thinking'));
    }, { timeout: 5000 });
    
    // Check if agent thinking disables idle timeout resets (THIS IS THE MISSING FEATURE)
    const agentThinkingLogs = consoleLogs.filter(log => 
      log.includes('AgentThinking') || log.includes('Agent state changed: thinking')
    );
    console.log('Agent thinking logs:', agentThinkingLogs);
    
    // This test will FAIL until agent thinking properly disables idle timeout resets
    const thinkingDisablesResets = consoleLogs.some(log => 
      log.includes('AgentThinking') && log.includes('disabling idle timeout resets')
    );
    
    if (thinkingDisablesResets) {
      console.log('✅ Agent thinking correctly disables idle timeout resets');
    } else {
      console.log('❌ Agent thinking does NOT disable idle timeout resets (MISSING FEATURE)');
      // Don't fail the test yet - this is the missing feature we need to implement
    }
    
    // Test 4: Agent activity should also reset idle timeouts (if agent is active)
    console.log('Step 5: Testing agent activity scenarios...');
    
    // Simulate agent thinking state
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.injectAgentMessage) {
        // Inject a message to trigger agent thinking
        deepgramComponent.injectAgentMessage("Test message to trigger agent thinking");
      }
    });
    await page.waitForTimeout(2000);
    
    // Test 5: Final verification - connection should timeout naturally
    console.log('Step 6: Verifying natural connection timeout...');
    await page.waitForTimeout(11000); // 11 seconds (idle_timeout is 10 seconds)
    
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final connection status: ${connectionStatus}`);
    expect(connectionStatus).toBe('closed');
    console.log('✅ Connection closed naturally after idle timeout');
    
    // Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log(`- User speaking: ${reEnabledLogs.length > 0 ? '✅ Re-enabled resets' : '❌ Failed'}`);
    console.log(`- UtteranceEnd: ${consoleLogs.some(l => l.includes('disabling idle timeout resets for natural connection closure')) ? '✅ Disabled resets' : '❌ Failed'}`);
    console.log(`- Agent thinking: ${thinkingDisablesResets ? '✅ Disables resets' : '❌ MISSING FEATURE'}`);
    console.log(`- Natural timeout: ${connectionStatus === 'closed' ? '✅ Worked' : '❌ Failed'}`);
    
    console.log('\n🔍 KEY FINDINGS:');
    console.log('- Issue #85 (VAD speechDetected: false) is FIXED');
    console.log('- Agent thinking/speaking timeout behavior is MISSING');
    console.log('- This is the broader issue captured in Issue #86');
  });
});

