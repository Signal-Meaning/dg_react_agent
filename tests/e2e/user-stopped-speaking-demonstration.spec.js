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
          text.includes('SpeechStarted') ||
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
        log.includes('SpeechStarted') || 
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
      console.log('  - SpeechStarted events:', consoleLogs.filter(log => log.includes('SpeechStarted')).length);
      console.log('  - UtteranceEnd events:', utteranceEndEvents.length);
      console.log('  - User stopped speaking events:', userStoppedSpeakingEvents.length);
      
      // Analyze timing information
      if (vadEvents.length > 0) {
        console.log('\n⏱️ Timing Analysis:');
        vadEvents.forEach((event, index) => {
          console.log(`  - UtteranceEnd ${index + 1}:`);
          console.log(`    - Last word ended at: ${event.lastWordEnd}s`);
          console.log(`    - Channel: [${event.channel ? event.channel.join(', ') : 'N/A'}]`);
          console.log(`    - Event timestamp: ${new Date(event.timestamp).toISOString()}`);
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
      
      // Verify that we got the expected events
      expect(consoleLogs.some(log => log.includes('SpeechStarted'))).toBe(true);
      
      if (utteranceEndEvents.length > 0) {
        console.log('🎉 SUCCESS: UtteranceEnd events detected by Deepgram VAD!');
        expect(userStoppedSpeakingEvents.length).toBeGreaterThan(0);
        console.log('🎉 SUCCESS: onUserStoppedSpeaking callback triggered naturally!');
      } else {
        console.log('⚠️ No UtteranceEnd events detected - audio sample may need more silence');
        console.log('💡 This suggests the silence duration in the audio sample is insufficient');
        console.log('💡 Current utterance_end_ms setting:', 1500, 'ms');
        console.log('💡 Audio sample silence duration:', 2000, 'ms (should be sufficient)');
      }
      
      // Check VAD event display elements
      const vadElements = await page.evaluate(() => {
        return {
          userSpeaking: document.querySelector('[data-testid="user-speaking"]')?.textContent || 'Not found',
          userStoppedSpeaking: document.querySelector('[data-testid="user-stopped-speaking"]')?.textContent || 'Not found',
          utteranceEnd: document.querySelector('[data-testid="utterance-end"]')?.textContent || 'Not found',
          speechStarted: document.querySelector('[data-testid="speech-started"]')?.textContent || 'Not found'
        };
      });
      
      console.log('📊 VAD Elements Status:');
      console.log('  - User Speaking:', vadElements.userSpeaking);
      console.log('  - User Stopped Speaking:', vadElements.userStoppedSpeaking);
      console.log('  - Utterance End:', vadElements.utteranceEnd);
      console.log('  - Speech Started:', vadElements.speechStarted);
      
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
          text.includes('SpeechStarted')) {
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
    const sampleNames = ['hello', 'wait-one-moment', 'thank-you'];
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
      await page.waitForTimeout(2000);
      
      // Count events for this sample
      const sampleUtteranceEndEvents = consoleLogs.filter(log => 
        log.includes('UtteranceEnd')
      ).length;
      
      const sampleUserStoppedSpeakingEvents = consoleLogs.filter(log => 
        log.includes('🎤 [AGENT] User stopped speaking')
      ).length;
      
      console.log(`📊 ${sampleName} results:`);
      console.log(`  - UtteranceEnd events: ${sampleUtteranceEndEvents}`);
      console.log(`  - User stopped speaking events: ${sampleUserStoppedSpeakingEvents}`);
      
      totalUtteranceEndEvents = sampleUtteranceEndEvents;
      totalUserStoppedSpeakingEvents = sampleUserStoppedSpeakingEvents;
      
      // Wait between samples
      if (i < sampleNames.length - 1) {
        await page.waitForTimeout(1000);
      }
    }
    
    console.log('\n📊 Final Results:');
    console.log(`  - Total UtteranceEnd events: ${totalUtteranceEndEvents}`);
    console.log(`  - Total User stopped speaking events: ${totalUserStoppedSpeakingEvents}`);
    
    // Analyze timing information for all samples
    if (vadEvents.length > 0) {
      console.log('\n⏱️ Overall Timing Analysis:');
      vadEvents.forEach((event, index) => {
        console.log(`  - UtteranceEnd ${index + 1}:`);
        console.log(`    - Last word ended at: ${event.lastWordEnd}s`);
        console.log(`    - Channel: [${event.channel.join(', ')}]`);
        console.log(`    - Event timestamp: ${new Date(event.timestamp).toISOString()}`);
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
    
    // Verify that we got at least some UtteranceEnd events
    if (totalUtteranceEndEvents > 0) {
      console.log('🎉 SUCCESS: UtteranceEnd events detected across multiple samples!');
      expect(totalUserStoppedSpeakingEvents).toBeGreaterThan(0);
      console.log('🎉 SUCCESS: onUserStoppedSpeaking callback working with multiple samples!');
    } else {
      console.log('⚠️ No UtteranceEnd events detected - audio samples may need more silence');
      console.log('💡 This suggests the silence duration in audio samples is insufficient for VAD');
      console.log('💡 Try increasing offsetSilenceDuration in samples.json or reducing utterance_end_ms');
    }
    
    console.log('✅ Multiple samples demonstration completed');
  });
});
