const { test, expect } = require('@playwright/test');
const path = require('path');
const { setupVADTestingEnvironment } = require('../utils/audio-stream-mocks');

// Load environment variables from test-app/.env
require('dotenv').config({ path: path.join(__dirname, '../../test-app/.env') });

test.describe('Extended Silence Idle Timeout Test', () => {
  test('should demonstrate connection closure with >10 seconds of silence', async ({ page, context }) => {
    // Grant microphone permissions and setup VAD testing environment
    await context.grantPermissions(['microphone']);
    await setupVADTestingEnvironment(page);
    
    console.log('🧪 Testing connection closure with extended silence (>10 seconds)...');
    
    // Capture console logs for connection and VAD events
    const consoleLogs = [];
    const connectionEvents = [];
    const vadEvents = [];
    
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      
      // Track connection events
      if (text.includes('Connection status:') || 
          text.includes('Connection state:') ||
          text.includes('timeout') ||
          text.includes('closed') ||
          text.includes('disconnected')) {
        console.log(`[BROWSER] ${text}`);
        
        if (text.includes('Connection status:') || text.includes('Connection state:')) {
          const timestamp = Date.now();
          connectionEvents.push({
            timestamp,
            message: text,
            time: new Date(timestamp).toISOString()
          });
        }
      }
      
      // Track VAD events
      if (text.includes('UtteranceEnd') || 
          text.includes('🎤 [AGENT] User stopped speaking') ||
          text.includes('SpeechStarted')) {
        console.log(`[BROWSER] ${text}`);
        
        // Extract timing information from UtteranceEnd events
        if (text.includes('UtteranceEnd message received')) {
          try {
            const match = text.match(/\{type: UtteranceEnd, channel: Array\(2\), last_word_end: ([\d.]+)\}/);
            if (match) {
              const lastWordEnd = parseFloat(match[1]);
              vadEvents.push({
                type: 'UtteranceEnd',
                timestamp: Date.now(),
                lastWordEnd: lastWordEnd,
                channel: [0, 1]
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
    
    // Wait for app to load
    await page.waitForTimeout(3000);
    console.log('✅ Test app loaded');
    
    // Wait for connection to be established
    await page.waitForTimeout(2000);
    console.log('📡 Connection should be established');
    
    // Create a custom audio sample with extended silence
    console.log('🎵 Creating audio sample with extended silence (>10 seconds)...');
    
    await page.evaluate(async () => {
      // Get the DeepgramVoiceInteraction component
      const deepgramComponent = window.deepgramRef?.current;
      if (!deepgramComponent) {
        throw new Error('DeepgramVoiceInteraction component not available');
      }
      
      // Create a simple audio pattern: 1 second of speech + 12 seconds of silence
      const sampleRate = 16000;
      const speechDuration = 1.0; // 1 second of speech
      const silenceDuration = 12.0; // 12 seconds of silence (longer than 10s idle timeout)
      const totalDuration = speechDuration + silenceDuration;
      
      console.log(`📊 Creating audio: ${speechDuration}s speech + ${silenceDuration}s silence = ${totalDuration}s total`);
      
      // Generate a simple sine wave for speech (440Hz)
      const speechSamples = Math.floor(speechDuration * sampleRate);
      const silenceSamples = Math.floor(silenceDuration * sampleRate);
      const totalSamples = speechSamples + silenceSamples;
      
      const audioBuffer = new ArrayBuffer(totalSamples * 2); // 16-bit samples
      const audioView = new Int16Array(audioBuffer);
      
      // Generate speech (sine wave)
      for (let i = 0; i < speechSamples; i++) {
        const t = i / sampleRate;
        audioView[i] = Math.floor(32767 * 0.3 * Math.sin(2 * Math.PI * 440 * t));
      }
      
      // Generate silence (zeros)
      for (let i = speechSamples; i < totalSamples; i++) {
        audioView[i] = 0;
      }
      
      console.log(`🎤 Sending extended silence audio to Deepgram...`);
      console.log(`📊 Expected behavior:`);
      console.log(`  1. Deepgram should detect speech for ~${speechDuration}s`);
      console.log(`  2. UtteranceEnd should fire after ${speechDuration}s`);
      console.log(`  3. Connection should close after 10s idle timeout (not by VAD)`);
      
      // Send the audio data
      deepgramComponent.sendAudioData(audioBuffer);
      
      return {
        speechDuration,
        silenceDuration,
        totalDuration,
        sampleRate
      };
    });
    
    // Wait for the entire audio to be processed plus idle timeout
    console.log('⏳ Waiting for audio processing and idle timeout...');
    console.log('💡 This should take ~13 seconds total (1s speech + 12s silence)');
    console.log('💡 Connection should close at 10s idle timeout, not by VAD');
    
    await page.waitForTimeout(15000); // Wait 15 seconds to capture everything
    
    console.log('\n📊 Event Analysis:');
    
    // Analyze VAD events
    if (vadEvents.length > 0) {
      console.log('\n⏱️ VAD Events:');
      vadEvents.forEach((event, index) => {
        console.log(`  - UtteranceEnd ${index + 1}:`);
        console.log(`    - Last word ended at: ${event.lastWordEnd}s`);
        console.log(`    - Event timestamp: ${new Date(event.timestamp).toISOString()}`);
      });
    }
    
    // Analyze connection events
    const connectionStateLogs = consoleLogs.filter(log => 
      log.includes('Connection status:') || log.includes('Connection state:')
    );
    
    console.log(`\n📈 Connection State Changes: ${connectionStateLogs.length}`);
    connectionStateLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });
    
    // Look for timeout-related messages
    const timeoutLogs = consoleLogs.filter(log => 
      log.toLowerCase().includes('timeout') || 
      log.toLowerCase().includes('idle') ||
      log.toLowerCase().includes('closed')
    );
    
    console.log(`\n⏰ Timeout-Related Events: ${timeoutLogs.length}`);
    timeoutLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });
    
    // Check for UtteranceEnd events
    const utteranceEndLogs = consoleLogs.filter(log => 
      log.includes('UtteranceEnd')
    );
    
    console.log(`\n🎯 UtteranceEnd Events: ${utteranceEndLogs.length}`);
    utteranceEndLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });
    
    // Verify we have timeout events (showing idle timeout working)
    expect(timeoutLogs.length).toBeGreaterThan(0);
    
    // Verify we have UtteranceEnd events (showing VAD working)
    expect(utteranceEndLogs.length).toBeGreaterThan(0);
    
    // The key test: verify that connection closes due to idle timeout, not VAD
    const idleTimeoutLogs = timeoutLogs.filter(log => 
      log.includes('Idle timeout reached')
    );
    
    console.log(`\n🔍 Idle Timeout Events: ${idleTimeoutLogs.length}`);
    idleTimeoutLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });
    
    expect(idleTimeoutLogs.length).toBeGreaterThan(0);
    
    console.log('\n🎉 SUCCESS: Extended silence test completed');
    console.log('💡 This demonstrates that:');
    console.log('  1. VAD detects speech end naturally');
    console.log('  2. Connection closes due to idle timeout (not VAD)');
    console.log('  3. Extended silence (>10s) triggers natural connection closure');
  });
});
