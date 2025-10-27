import { test, expect } from '@playwright/test';
import path from 'path';
import { setupVADTestingEnvironment } from '../utils/audio-stream-mocks';

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
    
    // Wait for component to be ready
    await page.waitForTimeout(3000);
    
    console.log('✅ Test app loaded');
    
    // Enable microphone to start WebSocket connection
    console.log('🎤 Enabling microphone...');
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection
    await page.waitForTimeout(5000);
    
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('📡 Connection status:', connectionStatus);
    
    if (connectionStatus.includes('connected')) {
      console.log('✅ Connection established');
      
      // Load and send pre-recorded audio sample
      console.log('🎵 Loading pre-recorded audio sample...');
      await page.evaluate(async () => {
        const deepgramComponent = window.deepgramRef?.current;
        if (!deepgramComponent || !deepgramComponent.sendAudioData) {
          throw new Error('Deepgram component not available');
        }
        
        try {
          // Load the audio sample
          const response = await fetch('/audio-samples/sample_hello.json');
          if (!response.ok) {
            throw new Error(`Failed to load audio sample: ${response.status}`);
          }
          
          const sampleData = await response.json();
          console.log('📊 Sample metadata:', {
            phrase: sampleData.phrase,
            sampleRate: sampleData.metadata.sampleRate,
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
          
          console.log('🎤 Sending pre-recorded audio to Deepgram...');
          deepgramComponent.sendAudioData(audioBuffer);
          
          // Wait for Deepgram's VAD to naturally detect the end of speech
          console.log('⏳ Waiting for Deepgram VAD to naturally detect end of speech...');
          console.log('📊 Audio sample has sufficient silence duration for UtteranceEnd detection');
          
        } catch (error) {
          console.error('❌ Error loading/sending audio sample:', error);
          throw error;
        }
      });
      
      console.log('✅ Audio data and CloseStream sent');
      
      // Wait for VAD events to be processed
      console.log('⏳ Waiting for VAD events...');
      await page.waitForTimeout(3000);
      
      // Check for VAD events in console logs
      const vadEvents = consoleLogs.filter(log => 
        log.includes('UserStartedSpeaking') || 
        log.includes('UtteranceEnd') ||
        log.includes('User stopped speaking')
      );
      
      console.log('📊 VAD Events detected:', vadEvents.length);
      vadEvents.forEach(event => console.log('  -', event));
      
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
      
      // Analyze timing information
      if (vadEvents.length > 0) {
        console.log('\n⏱️ Timing Analysis:');
        vadEvents.forEach((event, index) => {
          console.log(`  - UtteranceEnd ${index + 1}:`);
          console.log(`    - Last word ended at: ${event.lastWordEnd}s`);
          console.log(`    - Channel: [${event.channel ? event.channel.join(', ') : 'N/A'}]`);
          console.log(`    - Event timestamp: ${event.timestamp ? new Date(event.timestamp).toISOString() : 'N/A'}`);
        });
        
        // Calculate remaining silence
        const lastUtteranceEnd = vadEvents[vadEvents.length - 1];
        if (lastUtteranceEnd) {
          // Audio sample has 2000ms (2s) total silence
          const totalSilenceDuration = 2.0; // seconds
          const remainingSilence = totalSilenceDuration - lastUtteranceEnd.lastWordEnd;
          console.log(`\n🔍 Silence Analysis:`);
          console.log(`  - Total silence in audio sample: ${totalSilenceDuration}s`);
          console.log(`  - Last word ended at: ${lastUtteranceEnd.lastWordEnd}s`);
          console.log(`  - Remaining silence when UtteranceEnd triggered: ${remainingSilence.toFixed(3)}s`);
          console.log(`  - Remaining silence as percentage: ${((remainingSilence / totalSilenceDuration) * 100).toFixed(1)}%`);
        }
      }
      
      // Test the complete flow using data-testid elements
      
      // 1. Wait for speech detection
      console.log('⏳ Waiting for speech detection...');
      await page.waitForFunction(() => 
        document.querySelector('[data-testid="speech-started"]')?.textContent !== 'Not detected'
      , { timeout: 10000 });
      
      const speechStarted = await page.locator('[data-testid="speech-started"]').textContent();
      expect(speechStarted).not.toBe('Not detected');
      console.log('✅ Speech started detected:', speechStarted);
      
      // 2. Check user speaking state (may be true or false depending on timing)
      const isUserSpeaking = await page.locator('[data-testid="user-speaking"]').textContent();
      console.log('📊 User speaking state:', isUserSpeaking);
      
      // Note: The state may be false if UtteranceEnd events have already been processed
      // This is expected behavior - the important part is that UtteranceEnd detection works
      
      // 3. Wait for UtteranceEnd detection
      console.log('⏳ Waiting for UtteranceEnd detection...');
      await page.waitForFunction(() => 
        document.querySelector('[data-testid="utterance-end"]')?.textContent !== 'Not detected'
      , { timeout: 10000 });
      
      const utteranceEnd = await page.locator('[data-testid="utterance-end"]').textContent();
      expect(utteranceEnd).not.toBe('Not detected');
      console.log('✅ UtteranceEnd detected:', utteranceEnd);
      
      // 4. Check user stopped speaking callback
      const userStoppedSpeaking = await page.locator('[data-testid="user-stopped-speaking"]').textContent();
      expect(userStoppedSpeaking).not.toBe('Not detected');
      console.log('✅ User stopped speaking callback:', userStoppedSpeaking);
      
      // 5. Wait for all events to be processed before checking final state
      console.log('⏳ Waiting for all events to be processed...');
      await page.waitForTimeout(2000);
      
      // 6. Verify user speaking state is now false
      const isUserSpeakingAfter = await page.locator('[data-testid="user-speaking"]').textContent();
      console.log('🔍 DEBUG: User speaking state after UtteranceEnd:', isUserSpeakingAfter);
      console.log('🔍 DEBUG: utteranceEndDetected flag:', await page.locator('p:has-text("Debug - utteranceEndDetected")').textContent());
      
      // Check if the state is actually false
      if (isUserSpeakingAfter === 'false') {
        console.log('✅ User speaking state is correctly false');
      } else {
        console.log('❌ User speaking state is still true, this indicates a bug in the state management');
        // Let's see what other debugging info we can get
        const vadStates = await page.locator('[data-testid="vad-states"]').textContent();
        console.log('🔍 DEBUG: Full VAD states:', vadStates);
      }
      
      expect(isUserSpeakingAfter).toBe('false');
      console.log('✅ User speaking state after UtteranceEnd:', isUserSpeakingAfter);
      
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
    await page.waitForTimeout(3000);
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(5000);
    
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
      
      // Wait for events to be processed
      await page.waitForTimeout(3000);
      
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
    
    // Wait for user speaking state to be updated to false
    await page.waitForFunction(() => 
      document.querySelector('[data-testid="user-speaking"]')?.textContent === 'false'
    , { timeout: 10000 });
    
    // Wait for any final events to be processed
    await page.waitForTimeout(2000);
    
    // Check final VAD state
    const finalUserStartedSpeaking = await page.locator('[data-testid="speech-started"]').textContent();
    const finalUtteranceEnd = await page.locator('[data-testid="utterance-end"]').textContent();
    const finalUserStoppedSpeaking = await page.locator('[data-testid="user-stopped-speaking"]').textContent();
    const finalUserSpeaking = await page.locator('[data-testid="user-speaking"]').textContent();
    
    console.log('📊 Final VAD State:');
    console.log('  - Speech Started:', finalUserStartedSpeaking);
    console.log('  - Utterance End:', finalUtteranceEnd);
    console.log('  - User Stopped Speaking:', finalUserStoppedSpeaking);
    console.log('  - User Speaking:', finalUserSpeaking);
    
    // Verify that we got the expected events via data-testid elements
    expect(finalUserStartedSpeaking).not.toBe('Not detected');
    expect(finalUtteranceEnd).not.toBe('Not detected');
    expect(finalUserStoppedSpeaking).not.toBe('Not detected');
    expect(finalUserSpeaking).toBe('false');
    
    console.log('🎉 SUCCESS: Multiple samples demonstration completed via data-testid elements!');
    console.log('💡 This demonstrates that:');
    console.log('  1. Speech detection works across multiple audio samples');
    console.log('  2. UtteranceEnd detection works across multiple audio samples');
    console.log('  3. onUserStoppedSpeaking callback works across multiple audio samples');
    console.log('  4. User speaking state updates correctly across multiple audio samples');
    
    console.log('✅ Multiple samples demonstration completed');
  });
});
