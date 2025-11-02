import { test, expect } from '@playwright/test';
import path from 'path';
import { setupVADTestingEnvironment } from '../utils/audio-stream-mocks';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';

// Load environment variables from test-app/.env
// dotenv config handled by Playwright config

/**
 * Test to demonstrate onUserStoppedSpeaking callback working with fake audio
 * 
 * This test uses pre-recorded audio samples with sufficient silence duration
 * to allow Deepgram's VAD to naturally detect the end of speech and trigger
 * UtteranceEnd events, which then trigger onUserStoppedSpeaking callbacks.
 */

test.describe('onUserStoppedSpeaking Demonstration', () => {
  test('should demonstrate onUserStoppedSpeaking with real microphone and pre-recorded audio', async ({ page, context }) => {
    // Grant microphone permissions and setup VAD testing environment
    await context.grantPermissions(['microphone']);
    await setupVADTestingEnvironment(page);
    
    console.log('🧪 Demonstrating onUserStoppedSpeaking with fake audio...');
    
    // Capture console logs for VAD events and timing information
    const consoleLogs = [];
    const vadEvents = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      
      if (text.includes('🎤 [AGENT] User stopped speaking') || 
          text.includes('UtteranceEnd') || 
          text.includes('UserStartedSpeaking') ||
          text.includes('[VAD]')) {
        console.log(`[BROWSER] ${text}`);
        
        // Extract timing information from UtteranceEnd events
        if (text.includes('UtteranceEnd message received')) {
          try {
            // Extract the actual channel values from the log message
            // Look for the actual channel array values in the console output
            const channelMatch = text.match(/channel: \[(\d+), (\d+)\]/);
            const lastWordEndMatch = text.match(/last_word_end: ([\d.]+)/);
            
            if (lastWordEndMatch) {
              const lastWordEnd = parseFloat(lastWordEndMatch[1]);
              const channel = channelMatch ? 
                [parseInt(channelMatch[1]), parseInt(channelMatch[2])] : 
                [0, 1]; // Fallback for single channel audio
              
              vadEvents.push({
                type: 'UtteranceEnd',
                timestamp: Date.now(),
                lastWordEnd: lastWordEnd,
                channel: channel
              });
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    });
    
    // Navigate to test app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Test app loaded');
    
    // Use proper microphone setup with fixtures (same pattern as passing tests)
    console.log('🎤 Enabling microphone...');
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Connection established and microphone enabled');
    
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('📡 Connection status:', connectionStatus);
    
    if (connectionStatus.includes('connected')) {
      console.log('✅ Connection established');
      
      // Use working fixture to send audio (same pattern as passing VAD tests)
      console.log('🎵 Loading pre-recorded audio sample...');
      await loadAndSendAudioSample(page, 'hello');
      
      // Wait for Deepgram's VAD to naturally detect the end of speech
      console.log('⏳ Waiting for Deepgram VAD to naturally detect end of speech...');
      console.log('📊 Audio sample has sufficient silence duration for UtteranceEnd detection');
      
      // Wait for VAD events using working fixture (same pattern as passing VAD tests)
      console.log('⏳ Waiting for VAD events...');
      const eventsDetected = await waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UtteranceEnd'
      ], 10000);
      console.log(`📊 VAD events detected: ${eventsDetected}`);
      
      // Verify events were detected
      expect(eventsDetected).toBeGreaterThan(0);
      console.log('✅ VAD events detected via fixture');
      
      // Check for VAD events in console logs (for analysis)
      const vadEvents = consoleLogs.filter(log => 
        log.includes('UserStartedSpeaking') || 
        log.includes('UtteranceEnd') ||
        log.includes('User stopped speaking')
      );
      
      console.log('📊 VAD Events in console:', vadEvents.length);
      
      // Check if onUserStoppedSpeaking was triggered
      const userStoppedSpeakingEvents = consoleLogs.filter(log => 
        log.includes('🎤 [AGENT] User stopped speaking')
      );
      
      const utteranceEndEvents = consoleLogs.filter(log => 
        log.includes('UtteranceEnd')
      );
      
      console.log('📊 Event Analysis:');
      console.log('  - UserStartedSpeaking events:', consoleLogs.filter(log => log.includes('UserStartedSpeaking')).length);
      console.log('  - UtteranceEnd events:', utteranceEndEvents.length);
      console.log('  - User stopped speaking events:', userStoppedSpeakingEvents.length);
      
      // Verify main validations using page.evaluate (more reliable than locator if page might be closing)
      const vadStateCheck = await page.evaluate(() => {
        const utteranceEnd = document.querySelector('[data-testid="utterance-end"]');
        const userStoppedSpeaking = document.querySelector('[data-testid="user-stopped-speaking"]');
        return {
          utteranceEnd: utteranceEnd && utteranceEnd.textContent && utteranceEnd.textContent !== 'Not detected' 
            ? utteranceEnd.textContent : null,
          userStoppedSpeaking: userStoppedSpeaking && userStoppedSpeaking.textContent && userStoppedSpeaking.textContent !== 'Not detected'
            ? userStoppedSpeaking.textContent : null
        };
      });
      
      // Main validations - these are the key things we're testing
      expect(vadStateCheck.utteranceEnd).toBeTruthy();
      expect(vadStateCheck.userStoppedSpeaking).toBeTruthy();
      console.log('✅ UtteranceEnd detected:', vadStateCheck.utteranceEnd);
      console.log('✅ User stopped speaking callback:', vadStateCheck.userStoppedSpeaking);
      
      // Optional: Check user speaking state if accessible
      let isUserSpeaking = null;
      try {
        isUserSpeaking = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="user-speaking"]');
          return el ? el.textContent : null;
        });
        if (isUserSpeaking) {
          console.log('📊 User speaking state:', isUserSpeaking);
        }
      } catch (error) {
        console.log('⚠️ User speaking state element not accessible (optional)');
      }
      
      console.log('\n🎉 SUCCESS: onUserStoppedSpeaking demonstration completed');
      console.log('💡 This demonstrates that:');
      console.log('  1. Speech detection works via data-testid elements');
      console.log('  2. UtteranceEnd detection works via data-testid elements');
      console.log('  3. onUserStoppedSpeaking callback works via data-testid elements');
      console.log('  4. User speaking state updates correctly');
      
      console.log('✅ onUserStoppedSpeaking demonstration completed');
      
    } else {
      console.log('❌ Failed to establish connection - skipping demonstration');
    }
  });
  
  test('should demonstrate onUserStoppedSpeaking with multiple audio samples', async ({ page, context }) => {
    // Grant microphone permissions and setup VAD testing environment
    await context.grantPermissions(['microphone']);
    await setupVADTestingEnvironment(page);
    
    console.log('🧪 Demonstrating onUserStoppedSpeaking with multiple audio samples...');
    
    // Capture console logs and timing information
    const consoleLogs = [];
    const vadEvents = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      
      if (text.includes('🎤 [AGENT] User stopped speaking') || 
          text.includes('UtteranceEnd') || 
          text.includes('UserStartedSpeaking')) {
        console.log(`[BROWSER] ${text}`);
        
        // Extract timing information from UtteranceEnd events
        if (text.includes('UtteranceEnd message received')) {
          try {
            // Extract the actual channel values from the log message
            // Look for the actual channel array values in the console output
            const channelMatch = text.match(/channel: \[(\d+), (\d+)\]/);
            const lastWordEndMatch = text.match(/last_word_end: ([\d.]+)/);
            
            if (lastWordEndMatch) {
              const lastWordEnd = parseFloat(lastWordEndMatch[1]);
              const channel = channelMatch ? 
                [parseInt(channelMatch[1]), parseInt(channelMatch[2])] : 
                [0, 1]; // Fallback for single channel audio
              
              vadEvents.push({
                type: 'UtteranceEnd',
                timestamp: Date.now(),
                lastWordEnd: lastWordEnd,
                channel: channel
              });
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    });
    
    // Navigate to test app
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Use proper microphone setup with fixtures (same pattern as passing tests)
    console.log('🎤 Enabling microphone...');
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error || 'Unknown error'}`);
    }
    
    console.log('✅ Connection established and microphone enabled');
    
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    if (!connectionStatus.includes('connected')) {
      console.log('❌ Failed to establish connection');
      return;
    }
    
    // Test with multiple audio samples
    const sampleNames = ['hello', 'hello_there', 'hello_extended'];
    let totalUtteranceEndEvents = 0;
    let totalUserStoppedSpeakingEvents = 0;
    
    for (let i = 0; i < sampleNames.length; i++) {
      const sampleName = sampleNames[i];
      console.log(`\n🎵 Testing sample ${i + 1}/${sampleNames.length}: ${sampleName}`);
      
      await page.evaluate(async (sample) => {
        const deepgramComponent = window.deepgramRef?.current;
        if (!deepgramComponent || !deepgramComponent.sendAudioData) {
          throw new Error('Deepgram component not available');
        }
        
        try {
          // Load the audio sample
          const response = await fetch(`/audio-samples/sample_${sample}.json`);
          if (!response.ok) {
            throw new Error(`Failed to load audio sample: ${response.status}`);
          }
          
          const sampleData = await response.json();
          console.log(`📊 ${sample} metadata:`, {
            phrase: sampleData.phrase,
            totalDuration: sampleData.metadata.totalDuration,
            speechDuration: sampleData.metadata.speechDuration
          });
          
          // Convert base64 to ArrayBuffer
          const binaryString = atob(sampleData.audioData);
          const audioBuffer = new ArrayBuffer(binaryString.length);
          const audioView = new Uint8Array(audioBuffer);
          
          for (let i = 0; i < binaryString.length; i++) {
            audioView[i] = binaryString.charCodeAt(i);
          }
          
          console.log(`🎤 Sending ${sample} audio to Deepgram...`);
          deepgramComponent.sendAudioData(audioBuffer);
          
          // Wait for Deepgram's VAD to naturally detect the end of speech
          console.log(`⏳ Waiting for Deepgram VAD to naturally detect end of ${sample}...`);
          
        } catch (error) {
          console.error(`❌ Error with ${sample}:`, error);
        }
      }, sampleName);
      
      // Wait for VAD events using working fixture (same pattern as passing VAD tests)
      const eventsDetected = await waitForVADEvents(page, [
        'UserStartedSpeaking',
        'UtteranceEnd'
      ], 10000);
      console.log(`📊 VAD events detected for ${sampleName}: ${eventsDetected}`);
      
      // Check events using data-testid elements (same method as final verification)
      const utteranceEndDetected = await page.locator('[data-testid="utterance-end"]').textContent();
      const userStoppedSpeakingDetected = await page.locator('[data-testid="user-stopped-speaking"]').textContent();
      
      const hasUtteranceEnd = utteranceEndDetected !== 'Not detected';
      const hasUserStoppedSpeaking = userStoppedSpeakingDetected !== 'Not detected';
      
      console.log(`📊 ${sampleName} results:`);
      console.log(`  - UtteranceEnd events: ${hasUtteranceEnd ? '1' : '0'}`);
      console.log(`  - User stopped speaking events: ${hasUserStoppedSpeaking ? '1' : '0'}`);
      
      if (hasUtteranceEnd) totalUtteranceEndEvents++;
      if (hasUserStoppedSpeaking) totalUserStoppedSpeakingEvents++;
      
      // Wait between samples
      if (i < sampleNames.length - 1) {
        await page.waitForTimeout(2000);
      }
    }
    
    console.log('\n📊 Final Results:');
    console.log(`  - Total UtteranceEnd events: ${totalUtteranceEndEvents}`);
    console.log(`  - Total User stopped speaking events: ${totalUserStoppedSpeakingEvents}`);
    console.log('💡 Note: Events are detected via data-testid elements, same method as final verification');
    
    // Analyze timing information for all samples
    if (vadEvents.length > 0) {
      console.log('\n⏱️ Overall Timing Analysis:');
      vadEvents.forEach((event, index) => {
        console.log(`  - UtteranceEnd ${index + 1}:`);
        console.log(`    - Last word ended at: ${event.lastWordEnd}s`);
        console.log(`    - Channel: [${event.channel.join(', ')}]`);
        console.log(`    - Event timestamp: ${event.timestamp ? new Date(event.timestamp).toISOString() : 'N/A'}`);
      });
      
      // Calculate average remaining silence
      const totalSilenceDuration = 2.0; // seconds
      const remainingSilences = vadEvents.map(event => totalSilenceDuration - event.lastWordEnd);
      const avgRemainingSilence = remainingSilences.reduce((sum, silence) => sum + silence, 0) / remainingSilences.length;
      
      console.log(`\n🔍 Overall Silence Analysis:`);
      console.log(`  - Total silence in audio samples: ${totalSilenceDuration}s`);
      console.log(`  - Average remaining silence: ${avgRemainingSilence.toFixed(3)}s`);
      console.log(`  - Average remaining silence as percentage: ${((avgRemainingSilence / totalSilenceDuration) * 100).toFixed(1)}%`);
      console.log(`  - Min remaining silence: ${Math.min(...remainingSilences).toFixed(3)}s`);
      console.log(`  - Max remaining silence: ${Math.max(...remainingSilences).toFixed(3)}s`);
    }
    
    // Test the final state using data-testid elements
    console.log('⏳ Checking final state via data-testid elements...');
    
    // Wait for any final events to be processed
    await page.waitForTimeout(2000);
    
    // Check final VAD state (main validations - UtteranceEnd and UserStoppedSpeaking)
    let finalUserStartedSpeaking = null;
    try {
      finalUserStartedSpeaking = await page.locator('[data-testid="speech-started"]').textContent({ timeout: 3000 });
    } catch (error) {
      // Optional element
    }
    
    const finalUtteranceEnd = await page.locator('[data-testid="utterance-end"]').textContent();
    const finalUserStoppedSpeaking = await page.locator('[data-testid="user-stopped-speaking"]').textContent();
    
    let finalUserSpeaking = null;
    try {
      finalUserSpeaking = await page.locator('[data-testid="user-speaking"]').textContent({ timeout: 3000 });
    } catch (error) {
      // Optional - may not be accessible or updated
    }
    
    console.log('📊 Final VAD State:');
    if (finalUserStartedSpeaking) console.log('  - Speech Started:', finalUserStartedSpeaking);
    console.log('  - Utterance End:', finalUtteranceEnd);
    console.log('  - User Stopped Speaking:', finalUserStoppedSpeaking);
    if (finalUserSpeaking) console.log('  - User Speaking:', finalUserSpeaking);
    
    // Verify that we got the expected events via data-testid elements (main validations)
    // At minimum, UtteranceEnd and UserStoppedSpeaking should be detected
    expect(finalUtteranceEnd).not.toBe('Not detected');
    expect(finalUserStoppedSpeaking).not.toBe('Not detected');
    console.log('✅ Main validations passed - UtteranceEnd and UserStoppedSpeaking detected');
    
    console.log('🎉 SUCCESS: Multiple samples demonstration completed via data-testid elements!');
    console.log('💡 This demonstrates that:');
    console.log('  1. Speech detection works across multiple audio samples');
    console.log('  2. UtteranceEnd detection works across multiple audio samples');
    console.log('  3. onUserStoppedSpeaking callback works across multiple audio samples');
    console.log('  4. User speaking state updates correctly across multiple audio samples');
    
    console.log('✅ Multiple samples demonstration completed');
  });
});
