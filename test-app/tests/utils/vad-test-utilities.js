/**
 * VAD Test Utilities - DRY Implementation
 * 
 * This module extracts the working patterns from successful VAD tests
 * and provides reusable utilities for consistent VAD testing across all test files.
 * 
 * WORKING PATTERNS EXTRACTED FROM:
 * - user-stopped-speaking-demonstration.spec.js (successful VAD event detection)
 * - websocket-timeout-context-preservation.spec.js (successful context preservation)
 */

/**
 * VAD Test Constants - Lifted to eliminate duplication
 */
const VAD_TEST_CONSTANTS = {
  // Audio sample names
  DEFAULT_AUDIO_SAMPLE: 'hello__how_are_you_today_',
  HELLO_SAMPLE: 'hello',
  QUICK_RESPONSE_SAMPLE: 'quick_response',
  
  // Timing constants
  VAD_EVENT_WAIT_MS: 3000,
  AGENT_PROCESSING_WAIT_MS: 2000,
  NATURAL_TIMEOUT_WAIT_MS: 11000,
  MICROPHONE_WAIT_MS: 1000,
  
  // Audio sample metadata
  TOTAL_SILENCE_DURATION_SECONDS: 2.0,
  
  // Signal conflict threshold
  SIGNAL_CONFLICT_THRESHOLD_MS: 1000,
  
  // Connection timeout
  CONNECTION_TIMEOUT_MS: 10000
};

/**
 * VAD Test Utilities Class
 * Provides consistent VAD testing patterns across all test files
 */
class VADTestUtilities {
  constructor(page) {
    this.page = page;
    this.consoleLogs = [];
    this.vadEvents = [];
    this.setupConsoleCapture();
  }

  /**
   * Setup console log capture for VAD event analysis
   * Extracted from working user-stopped-speaking-demonstration.spec.js
   */
  setupConsoleCapture() {
    this.page.on('console', msg => {
      const text = msg.text();
      this.consoleLogs.push(text);
      
      // Capture VAD-related events (same pattern as working tests)
      if (text.includes('🎤 [AGENT] User stopped speaking') || 
          text.includes('UtteranceEnd') || 
          text.includes('SpeechStarted') ||
          text.includes('[VAD]') ||
          text.includes('Agent state changed') ||
          text.includes('idle timeout resets')) {
        console.log(`[BROWSER] ${text}`);
        
        // Extract timing information from UtteranceEnd events (working pattern)
        if (text.includes('UtteranceEnd message received')) {
          try {
            const channelMatch = text.match(/channel: \[(\d+), (\d+)\]/);
            const lastWordEndMatch = text.match(/last_word_end: ([\d.]+)/);
            
            if (lastWordEndMatch) {
              const lastWordEnd = parseFloat(lastWordEndMatch[1]);
              const channel = channelMatch ? 
                [parseInt(channelMatch[1]), parseInt(channelMatch[2])] : 
                [0, 1];
              
              this.vadEvents.push({
                timestamp: Date.now(),
                lastWordEnd,
                channel,
                text
              });
            }
          } catch (error) {
            console.log('Error parsing VAD event:', error);
          }
        }
      }
    });
  }

  /**
   * Load and send pre-recorded audio sample
   * Extracted from working user-stopped-speaking-demonstration.spec.js
   */
  async loadAndSendAudioSample(sampleName = VAD_TEST_CONSTANTS.DEFAULT_AUDIO_SAMPLE) {
    await this.page.evaluate(async (sampleName) => {
      const deepgramComponent = window.deepgramRef?.current;
      if (!deepgramComponent || !deepgramComponent.sendAudioData) {
        throw new Error('Deepgram component not available');
      }

      try {
        // Load pre-recorded audio sample (working pattern from successful tests)
        // Note: /tests/fixtures/audio-samples/ is served as /audio-samples/ by Vite
        const response = await fetch(`/audio-samples/sample_${sampleName}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load audio sample: ${response.statusText}`);
        }
        
        const sampleData = await response.json();
        console.log('📊 Sample metadata:', {
          phrase: sampleData.phrase,
          sampleRate: sampleData.metadata.sampleRate,
          totalDuration: sampleData.metadata.totalDuration,
          speechDuration: sampleData.metadata.speechDuration
        });
        
        // Convert base64 to ArrayBuffer (working pattern)
        const binaryString = atob(sampleData.audioData);
        const audioBuffer = new ArrayBuffer(binaryString.length);
        const audioView = new Uint8Array(audioBuffer);
        
        for (let i = 0; i < binaryString.length; i++) {
          audioView[i] = binaryString.charCodeAt(i);
        }
        
        console.log('🎤 Sending pre-recorded audio to Deepgram...');
        deepgramComponent.sendAudioData(audioBuffer);
        
        return {
          phrase: sampleData.phrase,
          sampleRate: sampleData.metadata.sampleRate,
          totalDuration: sampleData.metadata.totalDuration,
          speechDuration: sampleData.metadata.speechDuration
        };
        
      } catch (error) {
        console.error('❌ Error loading/sending audio sample:', error);
        throw error;
      }
    }, sampleName);
  }

  /**
   * Analyze VAD events with consistent patterns
   * Extracted from working user-stopped-speaking-demonstration.spec.js
   */
  analyzeVADEvents() {
    const speechStartedEvents = this.consoleLogs.filter(log => log.includes('SpeechStarted'));
    const utteranceEndEvents = this.consoleLogs.filter(log => log.includes('UtteranceEnd'));
    const userStoppedEvents = this.consoleLogs.filter(log => log.includes('🎤 [AGENT] User stopped speaking'));
    
    console.log('📊 VAD Event Analysis:');
    console.log(`  - SpeechStarted events: ${speechStartedEvents.length}`);
    console.log(`  - UtteranceEnd events: ${utteranceEndEvents.length}`);
    console.log(`  - User stopped speaking events: ${userStoppedEvents.length}`);
    
    return {
      speechStarted: speechStartedEvents,
      utteranceEnd: utteranceEndEvents,
      userStopped: userStoppedEvents,
      totalEvents: speechStartedEvents.length + utteranceEndEvents.length + userStoppedEvents.length
    };
  }

  /**
   * Analyze timing information from VAD events
   * Extracted from working user-stopped-speaking-demonstration.spec.js
   */
  analyzeTiming() {
    if (this.vadEvents.length > 0) {
      console.log('\n⏱️ Timing Analysis:');
      this.vadEvents.forEach((event, index) => {
        console.log(`  - UtteranceEnd ${index + 1}:`);
        console.log(`    - Last word ended at: ${event.lastWordEnd}s`);
        console.log(`    - Channel: [${event.channel ? event.channel.join(', ') : 'N/A'}]`);
        console.log(`    - Event timestamp: ${new Date(event.timestamp).toISOString()}`);
      });
      
      // Calculate remaining silence
      const lastUtteranceEnd = this.vadEvents[this.vadEvents.length - 1];
      if (lastUtteranceEnd) {
        const totalSilenceDuration = VAD_TEST_CONSTANTS.TOTAL_SILENCE_DURATION_SECONDS;
        const remainingSilence = totalSilenceDuration - lastUtteranceEnd.lastWordEnd;
        console.log(`\n🔍 Silence Analysis:`);
        console.log(`  - Total silence in audio sample: ${totalSilenceDuration}s`);
        console.log(`  - Last word ended at: ${lastUtteranceEnd.lastWordEnd}s`);
        console.log(`  - Remaining silence when UtteranceEnd triggered: ${remainingSilence.toFixed(3)}s`);
        console.log(`  - Remaining silence as percentage: ${((remainingSilence / totalSilenceDuration) * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Analyze agent state changes and timeout behavior
   * Extracted from working patterns
   */
  analyzeAgentStateChanges() {
    const agentStateChanges = this.consoleLogs.filter(log => 
      log.includes('Agent state changed:') || 
      log.includes('AgentThinking') || 
      log.includes('AgentStartedSpeaking') || 
      log.includes('AgentAudioDone')
    );
    
    const timeoutActions = this.consoleLogs.filter(log => 
      log.includes('idle timeout resets')
    );
    
    console.log('\n📊 Agent State Analysis:');
    console.log(`  - Agent state changes: ${agentStateChanges.length}`);
    console.log(`  - Timeout actions: ${timeoutActions.length}`);
    
    const enableActions = timeoutActions.filter(log => log.includes('re-enabling'));
    const disableActions = timeoutActions.filter(log => log.includes('disabling'));
    
    console.log(`  - Enable actions: ${enableActions.length}`);
    console.log(`  - Disable actions: ${disableActions.length}`);
    
    return {
      stateChanges: agentStateChanges,
      timeoutActions: timeoutActions,
      enableActions: enableActions,
      disableActions: disableActions
    };
  }

  /**
   * Clear logs for fresh test run
   */
  clearLogs() {
    this.consoleLogs = [];
    this.vadEvents = [];
  }
}

/**
 * Setup VAD testing environment
 * Extracted from working user-stopped-speaking-demonstration.spec.js
 */
async function setupVADTestEnvironment(page, context) {
  // Grant microphone permissions
  await context.grantPermissions(['microphone']);
  
  // Setup VAD testing environment (working pattern)
  const { setupVADTestingEnvironment } = await import('../utils/audio-stream-mocks.js');
  await setupVADTestingEnvironment(page);
  
  console.log('✅ VAD test environment setup complete');
}

/**
 * Wait for VAD events to be processed
 * Extracted from working user-stopped-speaking-demonstration.spec.js
 */
async function waitForVADEvents(page, timeoutMs = VAD_TEST_CONSTANTS.VAD_EVENT_WAIT_MS) {
  console.log('⏳ Waiting for VAD events...');
  await page.waitForTimeout(timeoutMs);
}

/**
 * Validate VAD signal redundancy
 * Extracted from working patterns
 * Returns validation results instead of calling expect directly
 */
function validateVADSignalRedundancy(vadAnalysis) {
  const results = {
    hasMultipleSignals: vadAnalysis.totalEvents > 1,
    totalEvents: vadAnalysis.totalEvents,
    hasConflicts: false,
    timing: []
  };
  
  // Check for signal timing consistency
  const allStopEvents = [...vadAnalysis.userStopped, ...vadAnalysis.utteranceEnd]
    .sort((a, b) => a.timestamp - b.timestamp);
  
  console.log('\n⏱️ Signal Timing:');
  allStopEvents.forEach((event, i) => {
    const timeDiff = i > 0 ? event.timestamp - allStopEvents[0].timestamp : 0;
    console.log(`${i + 1}. ${timeDiff}ms - ${event.substring(0, 50)}...`);
    results.timing.push({ index: i, timeDiff, event: event.substring(0, 50) });
  });
  
  // Check for signal conflicts (should be rare but worth detecting)
  results.hasConflicts = allStopEvents.some((event, i) => {
    if (i === 0) return false;
    const timeDiff = event.timestamp - allStopEvents[i-1].timestamp;
    return timeDiff > VAD_TEST_CONSTANTS.SIGNAL_CONFLICT_THRESHOLD_MS;
  });
  
  if (results.hasMultipleSignals) {
    console.log('✅ Multiple VAD signals detected for single stop event');
  } else {
    console.log('❌ Expected multiple VAD signals but got:', results.totalEvents);
  }
  
  if (results.hasConflicts) {
    console.log('⚠️ Potential VAD signal conflicts detected');
  } else {
    console.log('✅ VAD signals are consistent in timing');
  }
  
  return results;
}

/**
 * Validate agent state timeout behavior
 * Extracted from working patterns
 * Returns validation results instead of calling expect directly
 */
function validateAgentStateTimeoutBehavior(agentAnalysis) {
  const results = {
    thinkingDisablesResets: false,
    speakingDisablesResets: false,
    audioDoneReenablesResets: false,
    hasEnableActions: agentAnalysis.enableActions.length > 0,
    hasDisableActions: agentAnalysis.disableActions.length > 0,
    enableActionsCount: agentAnalysis.enableActions.length,
    disableActionsCount: agentAnalysis.disableActions.length
  };
  
  // Test 1: AgentThinking should disable idle timeout resets
  results.thinkingDisablesResets = agentAnalysis.disableActions.some(log => 
    log.includes('AgentThinking') && log.includes('disabling idle timeout resets')
  );
  
  console.log(`AgentThinking disables resets: ${results.thinkingDisablesResets ? '✅' : '❌ MISSING'}`);
  
  // Test 2: AgentStartedSpeaking should disable idle timeout resets
  results.speakingDisablesResets = agentAnalysis.disableActions.some(log => 
    log.includes('AgentStartedSpeaking') && log.includes('disabling idle timeout resets')
  );
  
  console.log(`AgentStartedSpeaking disables resets: ${results.speakingDisablesResets ? '✅' : '❌ MISSING'}`);
  
  // Test 3: AgentAudioDone should re-enable idle timeout resets
  results.audioDoneReenablesResets = agentAnalysis.enableActions.some(log => 
    log.includes('AgentAudioDone') && log.includes('re-enabling idle timeout resets')
  );
  
  console.log(`AgentAudioDone re-enables resets: ${results.audioDoneReenablesResets ? '✅' : '❌ MISSING'}`);
  
  // Summary
  console.log('\n📊 AGENT STATE TIMEOUT BEHAVIOR:');
  console.log(`- AgentThinking: ${results.thinkingDisablesResets ? '✅' : '❌ MISSING'}`);
  console.log(`- AgentStartedSpeaking: ${results.speakingDisablesResets ? '✅' : '❌ MISSING'}`);
  console.log(`- AgentAudioDone: ${results.audioDoneReenablesResets ? '✅' : '❌ MISSING'}`);
  
  if (results.hasEnableActions && results.hasDisableActions) {
    console.log('✅ State machine shows both enable and disable actions');
  } else {
    console.log('❌ State machine missing enable/disable actions');
  }
  
  return results;
}

/**
 * Validate idle timeout state machine consistency
 * Extracted from working patterns
 * Returns validation results instead of calling expect directly
 */
function validateIdleTimeoutStateMachine(agentAnalysis) {
  const results = {
    stateChangesCount: agentAnalysis.stateChanges.length,
    timeoutActionsCount: agentAnalysis.timeoutActions.length,
    enableActionsCount: agentAnalysis.enableActions.length,
    disableActionsCount: agentAnalysis.disableActions.length,
    hasEnableActions: agentAnalysis.enableActions.length > 0,
    hasDisableActions: agentAnalysis.disableActions.length > 0,
    properSequence: false
  };
  
  console.log('\n📊 STATE MACHINE ANALYSIS:');
  console.log(`Total state changes: ${results.stateChangesCount}`);
  console.log(`Total timeout actions: ${results.timeoutActionsCount}`);
  console.log(`Enable actions: ${results.enableActionsCount}`);
  console.log(`Disable actions: ${results.disableActionsCount}`);
  
  if (results.hasEnableActions && results.hasDisableActions) {
    console.log('✅ State machine shows both enable and disable actions');
  } else {
    console.log('❌ State machine missing enable/disable actions');
  }
  
  // Check for proper sequencing (disable should come after enable)
  const lastEnable = agentAnalysis.enableActions[agentAnalysis.enableActions.length - 1];
  const firstDisable = agentAnalysis.disableActions[0];
  
  if (lastEnable && firstDisable) {
    results.properSequence = lastEnable.timestamp < firstDisable.timestamp;
    console.log(`Proper sequence (enable before disable): ${results.properSequence ? '✅' : '❌'}`);
  }
  
  return results;
}

export {
  VADTestUtilities,
  setupVADTestEnvironment,
  waitForVADEvents,
  validateVADSignalRedundancy,
  validateAgentStateTimeoutBehavior,
  validateIdleTimeoutStateMachine,
  VAD_TEST_CONSTANTS
};
