import { test, expect } from '@playwright/test';
import path from 'path';
import { setupVADTestingEnvironment } from '../utils/audio-stream-mocks';

// Load environment variables from test-app/.env
// dotenv config handled by Playwright config

test.describe('Extended Silence Idle Timeout Test', () => {
  test('should demonstrate connection closure with >10 seconds of silence', async ({ page, context }) => {
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    console.log('🧪 Testing connection closure with extended silence (>10 seconds)...');
    
    // Navigate to test app with debug mode enabled
    await page.goto('http://localhost:5173?debug=true');
    await page.waitForLoadState('networkidle');
    
    // Wait for the component to be ready
    await page.waitForSelector('[data-testid="component-ready-status"]');
    const isReady = await page.locator('[data-testid="component-ready-status"]').textContent();
    expect(isReady).toBe('true');
    console.log('✅ Component is ready');
    
    // Wait for microphone button to be available and click it
    await page.waitForSelector('[data-testid="microphone-button"]');
    console.log('🎤 Enabling microphone...');
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await page.waitForSelector('[data-testid="connection-status"]');
    await page.waitForFunction(() => 
      document.querySelector('[data-testid="connection-status"]')?.textContent === 'connected'
    , { timeout: 10000 });
    
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(connectionStatus).toBe('connected');
    console.log('✅ Connection established');
    
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
    
    // Test the complete flow using data-testid elements
    
    // 1. Wait for speech detection
    console.log('⏳ Waiting for speech detection...');
    await page.waitForFunction(() => 
      document.querySelector('[data-testid="speech-started"]')?.textContent !== 'Not detected'
    , { timeout: 10000 });
    
    const speechStarted = await page.locator('[data-testid="speech-started"]').textContent();
    expect(speechStarted).not.toBe('Not detected');
    console.log('✅ Speech started detected:', speechStarted);
    
    // 2. Check user speaking state (may be false initially with hierarchical approach)
    const isUserSpeaking = await page.locator('[data-testid="user-speaking"]').textContent();
    console.log('📊 User speaking state after speech detection:', isUserSpeaking);
    
    // Note: With hierarchical approach, isUserSpeaking is only set to true when we receive
    // interim results (is_final=false), not just on UserStartedSpeaking events
    // This is the correct behavior - we shouldn't assume user is speaking just from UserStartedSpeaking
    
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
    
    // 5. Verify user speaking state is now false
    const isUserSpeakingAfter = await page.locator('[data-testid="user-speaking"]').textContent();
    expect(isUserSpeakingAfter).toBe('false');
    console.log('✅ User speaking state after UtteranceEnd:', isUserSpeakingAfter);
    
    // 6. Wait for agent response (if any)
    console.log('⏳ Waiting for agent response...');
    await page.waitForTimeout(2000); // Give agent time to respond
    
    // 7. Wait for idle timeout (connection should close)
    console.log('⏳ Waiting for idle timeout (10 seconds)...');
    await page.waitForFunction(() => 
      document.querySelector('[data-testid="connection-status"]')?.textContent === 'closed'
    , { timeout: 15000 });
    
    const finalConnectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(finalConnectionStatus).toBe('closed');
    console.log('✅ Connection closed due to idle timeout:', finalConnectionStatus);
    
    console.log('\n🎉 SUCCESS: Extended silence test completed');
    console.log('💡 This demonstrates that:');
    console.log('  1. Speech detection works via data-testid elements');
    console.log('  2. UtteranceEnd detection works via data-testid elements');
    console.log('  3. onUserStoppedSpeaking callback works via data-testid elements');
    console.log('  4. Idle timeout closes connection after speech completion');
  });
});
