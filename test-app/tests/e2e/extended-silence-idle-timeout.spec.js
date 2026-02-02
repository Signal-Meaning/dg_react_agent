import { test, expect } from '@playwright/test';
import path from 'path';
import { APP_DEBUG } from './helpers/app-paths.mjs';
import { setupVADTestingEnvironment } from '../utils/audio-stream-mocks';
import { setupAudioSendingPrerequisites, assertConnectionState, waitForAgentGreeting } from './helpers/test-helpers';
import { getIdleState, waitForIdleConditions } from './fixtures/idle-timeout-helpers';

// Load environment variables from test-app/.env
// dotenv config handled by Playwright config

test.describe('Extended Silence Idle Timeout Test', () => {
  test('should demonstrate connection closure with >10 seconds of silence', async ({ page, context }) => {
    console.log('🧪 Testing connection closure with extended silence (>10 seconds)...');
    
    await page.goto(APP_DEBUG);
    await page.waitForLoadState('networkidle');
    
    // Setup all audio sending prerequisites in one call
    // This handles: mic permissions, component ready, mic button click, connection, settings applied
    await setupAudioSendingPrerequisites(page, context);
    
    // Load and send proven audio sample
    console.log('🎵 Loading proven audio sample with extended silence...');
    const audioInfo = await page.evaluate(async () => {
      const deepgramComponent = window.deepgramRef?.current;
      if (!deepgramComponent) {
        throw new Error('DeepgramVoiceInteraction component not available');
      }
      
      try {
        console.log('📁 Loading audio sample: sample_hello_there.json');
        const response = await fetch('/audio-samples/sample_hello_there.json');
        
        if (!response.ok) {
          throw new Error(`Failed to load audio sample: ${response.status}`);
        }
        
        const audioData = await response.json();
        console.log('📊 Audio sample loaded:', {
          phrase: audioData.phrase,
          sampleRate: audioData.metadata.sampleRate,
          totalDuration: audioData.metadata.totalDuration,
          speechDuration: audioData.metadata.speechDuration
        });
        
        // Convert base64 to ArrayBuffer
        const binaryString = atob(audioData.audioData);
        const audioBuffer = new ArrayBuffer(binaryString.length);
        const audioView = new Uint8Array(audioBuffer);
        
        for (let i = 0; i < binaryString.length; i++) {
          audioView[i] = binaryString.charCodeAt(i);
        }
        
        console.log(`🎤 Sending proven audio sample to Deepgram...`);
        deepgramComponent.sendAudioData(audioBuffer);
        
        return {
          phrase: audioData.phrase,
          sampleRate: audioData.metadata.sampleRate,
          totalDuration: audioData.metadata.totalDuration,
          speechDuration: audioData.metadata.speechDuration,
          audioDataLength: binaryString.length
        };
        
      } catch (error) {
        console.error('❌ Error loading/sending audio sample:', error);
        throw error;
      }
    });
    
    console.log('📊 Audio sample info:', audioInfo);
    
    // Wait for audio to be processed and events to fire (pattern from callback-test.spec.js)
    console.log('⏳ Waiting for audio to be processed...');
    await page.waitForTimeout(2000); // Give time for audio to be processed and events to fire
    
    // Test the complete flow using data-testid elements
    
    // 1. Wait for speech detection
    console.log('⏳ Waiting for speech detection...');
    await page.waitForFunction(() => 
      document.querySelector('[data-testid="user-started-speaking"]')?.textContent !== 'Not detected'
    , { timeout: 10000 });
    
    const speechStarted = await page.locator('[data-testid="user-started-speaking"]').textContent();
    expect(speechStarted).not.toBe('Not detected');
    console.log('✅ Speech started detected:', speechStarted);
    
    // 2. Wait for UtteranceEnd detection
    console.log('⏳ Waiting for UtteranceEnd detection...');
    await page.waitForFunction(() => 
      document.querySelector('[data-testid="utterance-end"]')?.textContent !== 'Not detected'
    , { timeout: 10000 });
    
    const utteranceEnd = await page.locator('[data-testid="utterance-end"]').textContent();
    expect(utteranceEnd).not.toBe('Not detected');
    console.log('✅ UtteranceEnd detected:', utteranceEnd);
    
    // 3. Check user stopped speaking callback
    const userStoppedSpeaking = await page.locator('[data-testid="user-stopped-speaking"]').textContent();
    expect(userStoppedSpeaking).not.toBe('Not detected');
    console.log('✅ User stopped speaking callback:', userStoppedSpeaking);
    
    // 4. Wait for agent to finish responding (if any)
    console.log('⏳ Waiting for agent to finish responding...');
    await waitForAgentGreeting(page, 15000);
    console.log('✅ Agent finished responding');
    
    // 5. Wait for idle conditions (agent idle, user idle, audio not playing) and check timeout state
    console.log('⏳ Waiting for idle conditions (agent idle, user idle, audio not playing)...');
    const idleState = await waitForIdleConditions(page, 10000);
    console.log(`📊 Idle state: agentIdle=${idleState.agentIdle}, userIdle=${idleState.userIdle}, audioNotPlaying=${idleState.audioNotPlaying}, timeoutActive=${idleState.timeoutActive}`);
    
    // Issue #244: Verify timeout should be active when all idle conditions are met
    // The idle timeout requires: agent idle, user idle, AND audio not playing
    if (idleState.agentIdle && idleState.userIdle && idleState.audioNotPlaying) {
      if (!idleState.timeoutActive) {
        console.log('❌ ISSUE #244 REPRODUCED: Timeout is NOT active when it should be!');
        console.log('   Expected: timeoutActive=true when agentIdle=true, userIdle=true, audioNotPlaying=true');
        console.log('   Actual: timeoutActive=false');
      } else {
        console.log('✅ Timeout is active as expected');
      }
    } else {
      console.log(`⚠️ Conditions not met for timeout: agentIdle=${idleState.agentIdle}, userIdle=${idleState.userIdle}, audioNotPlaying=${idleState.audioNotPlaying}`);
    }
    
    // 6. Wait for idle timeout to close connection
    console.log('⏳ Waiting for idle timeout (10 seconds)...');
    
    // Track state at key intervals
    const checkpoints = [];
    const startTime = Date.now();
    
    // Check state every 2 seconds
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(2000);
      const elapsed = Date.now() - startTime;
      const currentIdleState = await getIdleState(page);
      const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
      
      const currentState = {
        elapsed,
        ...currentIdleState,
        connectionStatus
      };
      checkpoints.push(currentState);
      
      // Log if state changed
      if (i === 0 || 
          currentState.timeoutActive !== checkpoints[i - 1]?.timeoutActive ||
          currentState.agentIdle !== checkpoints[i - 1]?.agentIdle ||
          currentState.audioNotPlaying !== checkpoints[i - 1]?.audioNotPlaying) {
        console.log(`  +${currentState.elapsed}ms: agentIdle=${currentState.agentIdle}, userIdle=${currentState.userIdle}, audioNotPlaying=${currentState.audioNotPlaying}, timeoutActive=${currentState.timeoutActive}, connection=${currentState.connectionStatus}`);
      }
      
      // If connection closed, break early
      if (currentState.connectionStatus === 'closed') {
        break;
      }
    }
    
    // Use fixture to verify connection state (will timeout if not closed)
    await assertConnectionState(page, expect, 'closed', { timeout: 5000 });
    
    // Log final analysis
    console.log('\n📊 Idle Timeout State Analysis:');
    const timeoutWasActive = checkpoints.some(s => s.timeoutActive);
    if (!timeoutWasActive) {
      console.log('❌ ISSUE #244: Timeout was never active!');
      console.log('   This indicates the idle timeout never started after UtteranceEnd');
      console.log('   Expected: timeoutActive should become true when agentIdle=true and userIdle=true');
    } else {
      console.log('✅ Timeout was active at some point');
      const activeCheckpoint = checkpoints.find(s => s.timeoutActive);
      console.log(`   Timeout became active at +${activeCheckpoint.elapsed}ms`);
    }
    
    // Check final state before connection closed
    const finalState = checkpoints[checkpoints.length - 1];
    console.log(`\n📊 Final state: agentIdle=${finalState.agentIdle}, userIdle=${finalState.userIdle}, audioNotPlaying=${finalState.audioNotPlaying}, timeoutActive=${finalState.timeoutActive}`);
    
    console.log('✅ Connection closed due to idle timeout');
    
    console.log('\n🎉 SUCCESS: Extended silence test completed');
    console.log('💡 This demonstrates that:');
    console.log('  1. Speech detection works via data-testid elements');
    console.log('  2. UtteranceEnd detection works via data-testid elements');
    console.log('  3. onUserStoppedSpeaking callback works via data-testid elements');
    console.log('  4. Idle timeout closes connection after speech completion');
  });
});
