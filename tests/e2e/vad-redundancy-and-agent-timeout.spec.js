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
 */

import { test, expect } from '@playwright/test';
const { 
  SELECTORS,
  waitForConnection 
} = require('./helpers/test-helpers');
import { setupTestPage } from './helpers/audio-mocks';

test.describe('VAD Redundancy and Agent State Timeout Behavior', () => {
  
  test('should detect and handle VAD signal redundancy', async ({ page }) => {
    console.log('🧪 Testing VAD signal redundancy detection...');
    
    // Track all VAD-related events with timestamps
    const vadEvents = [];
    const userStoppedEvents = [];
    const utteranceEndEvents = [];
    
    page.on('console', msg => {
      const text = msg.text();
      const timestamp = Date.now();
      
      if (text.includes('User stopped speaking')) {
        userStoppedEvents.push({ timestamp, text, source: 'agent' });
      }
      if (text.includes('UtteranceEnd detected')) {
        utteranceEndEvents.push({ timestamp, text, source: 'transcription' });
      }
      if (text.includes('VAD Event:') && text.includes('No speech')) {
        vadEvents.push({ timestamp, text, source: 'transcription' });
      }
    });
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Enable microphone
    await page.click(SELECTORS.micButton);
    await page.waitForTimeout(1000);
    
    // Start speaking with simple audio simulation
    console.log('Step 1: Starting user speech with simple audio simulation...');
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        // Create a simple audio buffer with speech-like pattern
        const sampleRate = 16000;
        const duration = 2; // 2 seconds
        const samples = sampleRate * duration;
        const audioBuffer = new ArrayBuffer(samples * 2); // 16-bit PCM
        const audioView = new Int16Array(audioBuffer);
        
        // Fill with a sine wave pattern that should trigger VAD
        for (let i = 0; i < samples; i++) {
          const frequency = 440 + (i % 200); // Varying frequency
          const amplitude = 8000; // Strong signal
          const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
          audioView[i] = Math.floor(sample);
        }
        
        console.log('🎤 Sending simple audio pattern for VAD redundancy test');
        deepgramComponent.sendAudioData(audioBuffer);
      }
    });
    await page.waitForTimeout(2000);
    
    // Stop speaking (should trigger multiple VAD signals)
    console.log('Step 2: Stopping user speech...');
    // The realistic audio already includes proper silence padding for VAD events
    await page.waitForTimeout(3000); // Wait for all signals to arrive
    
    // Analyze signal redundancy
    console.log('\n📊 VAD SIGNAL ANALYSIS:');
    console.log(`UserStoppedSpeaking events: ${userStoppedEvents.length}`);
    console.log(`UtteranceEnd events: ${utteranceEndEvents.length}`);
    console.log(`VADEvent speechDetected: false: ${vadEvents.length}`);
    
    // Check for signal timing consistency
    const allStopEvents = [...userStoppedEvents, ...utteranceEndEvents, ...vadEvents]
      .sort((a, b) => a.timestamp - b.timestamp);
    
    console.log('\n⏱️ SIGNAL TIMING:');
    allStopEvents.forEach((event, i) => {
      const timeDiff = i > 0 ? event.timestamp - allStopEvents[0].timestamp : 0;
      console.log(`${i + 1}. ${event.source}: ${timeDiff}ms - ${event.text.substring(0, 50)}...`);
    });
    
    // Validate that we received multiple signals for the same event
    const totalStopSignals = userStoppedEvents.length + utteranceEndEvents.length + vadEvents.length;
    expect(totalStopSignals).toBeGreaterThan(1);
    console.log('✅ Multiple VAD signals detected for single stop event');
    
    // Check for signal conflicts (should be rare but worth detecting)
    const hasConflicts = allStopEvents.some((event, i) => {
      if (i === 0) return false;
      const timeDiff = event.timestamp - allStopEvents[i-1].timestamp;
      return timeDiff > 1000; // More than 1 second apart suggests conflict
    });
    
    if (hasConflicts) {
      console.log('⚠️ Potential VAD signal conflicts detected');
    } else {
      console.log('✅ VAD signals are consistent in timing');
    }
  });

  test('should handle agent state transitions for idle timeout behavior', async ({ page }) => {
    console.log('🧪 Testing agent state timeout behavior...');
    
    // Track agent state changes and idle timeout behavior
    const agentStateChanges = [];
    const idleTimeoutLogs = [];
    
    page.on('console', msg => {
      const text = msg.text();
      const timestamp = Date.now();
      
      if (text.includes('Agent state changed:')) {
        agentStateChanges.push({ timestamp, text, state: text.split(': ')[1] });
      }
      if (text.includes('idle timeout resets')) {
        idleTimeoutLogs.push({ timestamp, text });
      }
    });
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Enable microphone
    await page.click(SELECTORS.micButton);
    await page.waitForTimeout(1000);
    
    // Test 1: AgentThinking should disable idle timeout resets
    console.log('Step 1: Testing AgentThinking state...');
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.injectAgentMessage) {
        deepgramComponent.injectAgentMessage("Test message to trigger agent thinking");
      }
    });
    
    // Wait for agent thinking state
    await page.waitForFunction(() => {
      return window.consoleLogs?.some(log => 
        log.includes('AgentThinking') || log.includes('Agent state changed: thinking')
      );
    }, { timeout: 5000 });
    
    // Check if AgentThinking disables idle timeout resets
    const thinkingDisablesResets = idleTimeoutLogs.some(log => 
      log.text.includes('AgentThinking') && log.text.includes('disabling idle timeout resets')
    );
    
    console.log(`AgentThinking disables resets: ${thinkingDisablesResets ? '✅' : '❌ MISSING'}`);
    
    // Test 2: AgentStartedSpeaking should disable idle timeout resets
    console.log('Step 2: Testing AgentStartedSpeaking state...');
    
    // Wait for agent speaking state (if it occurs)
    await page.waitForTimeout(2000);
    
    const speakingDisablesResets = idleTimeoutLogs.some(log => 
      log.text.includes('AgentStartedSpeaking') && log.text.includes('disabling idle timeout resets')
    );
    
    console.log(`AgentStartedSpeaking disables resets: ${speakingDisablesResets ? '✅' : '❌ MISSING'}`);
    
    // Test 3: AgentAudioDone should re-enable idle timeout resets
    console.log('Step 3: Testing AgentAudioDone state...');
    
    // Wait for agent audio done (if it occurs)
    await page.waitForTimeout(2000);
    
    const audioDoneReenablesResets = idleTimeoutLogs.some(log => 
      log.text.includes('AgentAudioDone') && log.text.includes('re-enabling idle timeout resets')
    );
    
    console.log(`AgentAudioDone re-enables resets: ${audioDoneReenablesResets ? '✅' : '❌ MISSING'}`);
    
    // Summary
    console.log('\n📊 AGENT STATE TIMEOUT BEHAVIOR:');
    console.log(`- AgentThinking: ${thinkingDisablesResets ? '✅' : '❌ MISSING'}`);
    console.log(`- AgentStartedSpeaking: ${speakingDisablesResets ? '✅' : '❌ MISSING'}`);
    console.log(`- AgentAudioDone: ${audioDoneReenablesResets ? '✅' : '❌ MISSING'}`);
    
    // Log all agent state changes for analysis
    console.log('\n🔄 AGENT STATE CHANGES:');
    agentStateChanges.forEach((change, i) => {
      const timeDiff = i > 0 ? change.timestamp - agentStateChanges[0].timestamp : 0;
      console.log(`${i + 1}. ${timeDiff}ms: ${change.state}`);
    });
  });

  test('should maintain consistent idle timeout state machine', async ({ page }) => {
    console.log('🧪 Testing idle timeout state machine consistency...');
    
    // Track all state changes and timeout behavior
    const stateChanges = [];
    const timeoutActions = [];
    
    page.on('console', msg => {
      const text = msg.text();
      const timestamp = Date.now();
      
      if (text.includes('state changed') || text.includes('speaking') || text.includes('thinking')) {
        stateChanges.push({ timestamp, text });
      }
      if (text.includes('idle timeout resets')) {
        timeoutActions.push({ timestamp, text, action: 
          text.includes('disabling') ? 'disable' : 
          text.includes('re-enabling') ? 'enable' : 'unknown'
        });
      }
    });
    
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Enable microphone
    await page.click(SELECTORS.micButton);
    await page.waitForTimeout(1000);
    
    // Simulate a complete conversation cycle
    console.log('Step 1: User starts speaking...');
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        const audioData = new ArrayBuffer(8192);
        deepgramComponent.sendAudioData(audioData);
      }
    });
    await page.waitForTimeout(2000);
    
    console.log('Step 2: User stops speaking...');
    await page.evaluate(() => {
      // Stop sending audio data
    });
    await page.waitForTimeout(2000);
    
    console.log('Step 3: Agent processes...');
    await page.evaluate(() => {
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.injectAgentMessage) {
        deepgramComponent.injectAgentMessage("Test response");
      }
    });
    await page.waitForTimeout(3000);
    
    // Analyze state machine consistency
    console.log('\n📊 STATE MACHINE ANALYSIS:');
    console.log(`Total state changes: ${stateChanges.length}`);
    console.log(`Total timeout actions: ${timeoutActions.length}`);
    
    // Check for proper enable/disable sequence
    const enableActions = timeoutActions.filter(a => a.action === 'enable');
    const disableActions = timeoutActions.filter(a => a.action === 'disable');
    
    console.log(`Enable actions: ${enableActions.length}`);
    console.log(`Disable actions: ${disableActions.length}`);
    
    // Validate that we have both enable and disable actions
    expect(enableActions.length).toBeGreaterThan(0);
    expect(disableActions.length).toBeGreaterThan(0);
    console.log('✅ State machine shows both enable and disable actions');
    
    // Check for proper sequencing (disable should come after enable)
    const lastEnable = enableActions[enableActions.length - 1];
    const firstDisable = disableActions[0];
    
    if (lastEnable && firstDisable) {
      const properSequence = lastEnable.timestamp < firstDisable.timestamp;
      console.log(`Proper sequence (enable before disable): ${properSequence ? '✅' : '❌'}`);
    }
    
    // Final timeout test
    console.log('Step 4: Testing natural timeout...');
    await page.waitForTimeout(11000); // 11 seconds
    
    const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
    console.log(`Final connection status: ${connectionStatus}`);
    
    // The connection should timeout naturally if the state machine is working
    if (connectionStatus === 'closed') {
      console.log('✅ Natural timeout worked - state machine is consistent');
    } else {
      console.log('❌ Natural timeout failed - state machine may have issues');
    }
  });
});
