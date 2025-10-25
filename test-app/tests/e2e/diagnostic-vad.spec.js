/**
 * Diagnostic Test for Manual VAD Workflow
 * 
 * This test adds extensive logging to help debug the intermittent
 * microphone behavior in manual testing.
 */

import { test, expect } from '@playwright/test';
import { setupTestPage, simulateSpeech } from './helpers/audio-mocks';

test.describe('Diagnostic VAD Tests', () => {
  
  test('should provide detailed logging for manual debugging', async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
    
    // Capture ALL console logs for analysis
    const allLogs = [];
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      allLogs.push(logEntry);
      console.log(`[${logEntry.type.toUpperCase()}] ${logEntry.text}`);
    });
    
    // Add custom logging to track audio context state
    await page.addInitScript(() => {
      // Override AudioContext to add state logging
      const originalAudioContext = window.AudioContext;
      window.AudioContext = class DiagnosticAudioContext extends originalAudioContext {
        constructor(options) {
          super(options);
          console.log('🎵 [DIAGNOSTIC] AudioContext created, state:', this.state);
          
          // Monitor state changes
          const originalResume = this.resume.bind(this);
          this.resume = async () => {
            console.log('🎵 [DIAGNOSTIC] AudioContext.resume() called, current state:', this.state);
            const result = await originalResume();
            console.log('🎵 [DIAGNOSTIC] AudioContext.resume() completed, new state:', this.state);
            return result;
          };
        }
      };
      
      // Override getUserMedia to add permission logging
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        console.log('🎤 [DIAGNOSTIC] getUserMedia called with constraints:', constraints);
        try {
          const stream = await originalGetUserMedia(constraints);
          console.log('🎤 [DIAGNOSTIC] getUserMedia succeeded, stream tracks:', stream.getTracks().length);
          return stream;
        } catch (error) {
          console.log('🎤 [DIAGNOSTIC] getUserMedia failed:', error.message);
          throw error;
        }
      };
    });
    
    console.log('🔍 Starting diagnostic test...');
    
    // Step 1: Check initial state
    console.log('Step 1: Checking initial component state...');
    const initialConnectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    const initialMicStatus = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Initial connection status:', initialConnectionStatus);
    console.log('Initial mic status:', initialMicStatus);
    
    // Step 2: Click microphone button
    console.log('Step 2: Clicking microphone button...');
    await page.click('[data-testid="microphone-button"]');
    
    // Wait and check status
    await page.waitForTimeout(2000);
    const micStatusAfterClick = await page.locator('[data-testid="mic-status"]').textContent();
    const connectionStatusAfterClick = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('Mic status after click:', micStatusAfterClick);
    console.log('Connection status after click:', connectionStatusAfterClick);
    
    // Step 3: Simulate speech
    console.log('Step 3: Simulating speech...');
    await simulateSpeech(page, 'diagnostic test speech');
    await page.waitForTimeout(1000);
    
    // Step 4: Check for VAD events
    console.log('Step 4: Checking for VAD events...');
    await page.waitForTimeout(2000);
    
    // Analyze logs for key events
    const vadEvents = allLogs.filter(log => 
      log.text.includes('VAD:') || 
      log.text.includes('UserStartedSpeaking') || 
      log.text.includes('UserStoppedSpeaking') || 
      log.text.includes('UtteranceEnd')
    );
    
    const audioContextEvents = allLogs.filter(log => 
      log.text.includes('AudioContext') || 
      log.text.includes('DIAGNOSTIC')
    );
    
    const settingsEvents = allLogs.filter(log => 
      log.text.includes('Settings') || 
      log.text.includes('sendAgentSettings')
    );
    
    console.log('\n📊 DIAGNOSTIC SUMMARY:');
    console.log('VAD Events found:', vadEvents.length);
    vadEvents.forEach(event => console.log('  -', event.text));
    
    console.log('\nAudioContext Events found:', audioContextEvents.length);
    audioContextEvents.forEach(event => console.log('  -', event.text));
    
    console.log('\nSettings Events found:', settingsEvents.length);
    settingsEvents.forEach(event => console.log('  -', event.text));
    
    // Final status check
    const finalMicStatus = await page.locator('[data-testid="mic-status"]').textContent();
    const finalConnectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('\nFinal mic status:', finalMicStatus);
    console.log('Final connection status:', finalConnectionStatus);
    
    // Test passes if we can at least enable the microphone
    expect(micStatusAfterClick).toBe('Enabled');
    
    console.log('✅ Diagnostic test completed');
  });
  
  test('should track WebSocket connection timing', async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
    
    // Capture WebSocket events
    const wsEvents = [];
    page.on('console', msg => {
      if (msg.text().includes('connection') || msg.text().includes('WebSocket') || msg.text().includes('agent connection')) {
        wsEvents.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    console.log('🔍 Starting WebSocket timing test...');
    
    // Click microphone and track timing
    const startTime = Date.now();
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for various states
    await page.waitForTimeout(1000);
    const after1s = await page.locator('[data-testid="mic-status"]').textContent();
    
    await page.waitForTimeout(1000);
    const after2s = await page.locator('[data-testid="mic-status"]').textContent();
    
    await page.waitForTimeout(1000);
    const after3s = await page.locator('[data-testid="mic-status"]').textContent();
    
    console.log('Timing results:');
    console.log('  After 1s:', after1s);
    console.log('  After 2s:', after2s);
    console.log('  After 3s:', after3s);
    
    console.log('\nWebSocket Events:');
    wsEvents.forEach(event => {
      const timeSinceStart = Date.now() - startTime;
      console.log(`  [${timeSinceStart}ms] ${event.text}`);
    });
    
    // Test passes if microphone eventually enables
    expect(after3s).toBe('Enabled');
    
    console.log('✅ WebSocket timing test completed');
  });
});
