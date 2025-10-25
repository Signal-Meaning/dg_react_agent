/**
 * Comprehensive Manual Testing Diagnostic Tool
 * 
 * This tool helps analyze the console traffic during manual testing
 * to understand why audio isn't getting server responses.
 */

import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/audio-mocks';

test.describe('Manual Testing Diagnostics', () => {
  
  test('should capture and analyze all console traffic during manual testing', async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
    
    // Capture ALL console logs with timestamps
    const allLogs = [];
    const logCategories = {
      audio: [],
      websocket: [],
      vad: [],
      settings: [],
      errors: [],
      other: []
    };
    
    page.on('console', msg => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      };
      allLogs.push(logEntry);
      
      // Categorize logs
      const text = msg.text().toLowerCase();
      if (text.includes('audio') || text.includes('🎵') || text.includes('🎤')) {
        logCategories.audio.push(logEntry);
      } else if (text.includes('websocket') || text.includes('connection') || text.includes('🔗')) {
        logCategories.websocket.push(logEntry);
      } else if (text.includes('vad') || text.includes('userstarted') || text.includes('userstopped') || text.includes('utteranceend')) {
        logCategories.vad.push(logEntry);
      } else if (text.includes('settings') || text.includes('🔧') || text.includes('📤')) {
        logCategories.settings.push(logEntry);
      } else if (msg.type() === 'error' || text.includes('error') || text.includes('❌') || text.includes('failed')) {
        logCategories.errors.push(logEntry);
      } else {
        logCategories.other.push(logEntry);
      }
    });
    
    console.log('🔍 Starting comprehensive manual testing diagnostic...');
    console.log('📋 Instructions: Click the microphone button and speak, then stay silent');
    console.log('⏱️  This test will run for 30 seconds to capture all traffic');
    
    // Wait for user to interact (simulate manual testing)
    console.log('Step 1: Waiting for microphone button click...');
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for microphone to enable
    await page.waitForTimeout(3000);
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    console.log('Mic status:', micStatus);
    
    // Simulate speech
    console.log('Step 2: Simulating speech...');
    await page.evaluate(() => {
      const audioData = new ArrayBuffer(8192);
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        console.log('🎤 [MANUAL] Sending audio data to Deepgram');
        deepgramComponent.sendAudioData(audioData);
      }
    });
    
    // Wait for potential responses
    await page.waitForTimeout(2000);
    
    // Simulate more speech
    console.log('Step 3: Simulating more speech...');
    await page.evaluate(() => {
      const audioData = new ArrayBuffer(8192);
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        console.log('🎤 [MANUAL] Sending more audio data to Deepgram');
        deepgramComponent.sendAudioData(audioData);
      }
    });
    
    // Wait for silence period (should trigger UtteranceEnd)
    console.log('Step 4: Waiting for silence period...');
    await page.waitForTimeout(3000);
    
    // Final status check
    const finalMicStatus = await page.locator('[data-testid="mic-status"]').textContent();
    const finalConnectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    
    console.log('\n📊 COMPREHENSIVE DIAGNOSTIC REPORT:');
    console.log('=' .repeat(60));
    
    console.log('\n🎯 FINAL STATUS:');
    console.log(`  Microphone: ${finalMicStatus}`);
    console.log(`  Connection: ${finalConnectionStatus}`);
    console.log(`  Total Logs Captured: ${allLogs.length}`);
    
    console.log('\n🔊 AUDIO TRAFFIC ANALYSIS:');
    console.log(`  Audio-related logs: ${logCategories.audio.length}`);
    if (logCategories.audio.length > 0) {
      console.log('  Recent audio logs:');
      logCategories.audio.slice(-5).forEach(log => {
        console.log(`    [${log.timestamp}] ${log.text}`);
      });
    }
    
    console.log('\n🌐 WEBSOCKET TRAFFIC ANALYSIS:');
    console.log(`  WebSocket-related logs: ${logCategories.websocket.length}`);
    if (logCategories.websocket.length > 0) {
      console.log('  Recent WebSocket logs:');
      logCategories.websocket.slice(-5).forEach(log => {
        console.log(`    [${log.timestamp}] ${log.text}`);
      });
    }
    
    console.log('\n🎙️ VAD EVENTS ANALYSIS:');
    console.log(`  VAD-related logs: ${logCategories.vad.length}`);
    if (logCategories.vad.length > 0) {
      console.log('  VAD events found:');
      logCategories.vad.forEach(log => {
        console.log(`    [${log.timestamp}] ${log.text}`);
      });
    } else {
      console.log('  ❌ No VAD events detected');
    }
    
    console.log('\n⚙️ SETTINGS ANALYSIS:');
    console.log(`  Settings-related logs: ${logCategories.settings.length}`);
    if (logCategories.settings.length > 0) {
      console.log('  Recent settings logs:');
      logCategories.settings.slice(-3).forEach(log => {
        console.log(`    [${log.timestamp}] ${log.text}`);
      });
    }
    
    console.log('\n❌ ERROR ANALYSIS:');
    console.log(`  Error logs: ${logCategories.errors.length}`);
    if (logCategories.errors.length > 0) {
      console.log('  Errors found:');
      logCategories.errors.forEach(log => {
        console.log(`    [${log.timestamp}] ${log.text}`);
      });
    } else {
      console.log('  ✅ No errors detected');
    }
    
    console.log('\n🔍 DIAGNOSTIC RECOMMENDATIONS:');
    
    if (logCategories.vad.length === 0) {
      console.log('  ❌ ISSUE: No VAD events detected');
      console.log('  💡 SOLUTION: Check if VAD configuration is properly set in transcription options');
      console.log('  💡 SOLUTION: Verify that real audio data (not mocks) is being sent to Deepgram');
    }
    
    if (logCategories.websocket.length === 0) {
      console.log('  ❌ ISSUE: No WebSocket traffic detected');
      console.log('  💡 SOLUTION: Check WebSocket connection establishment');
    }
    
    if (logCategories.audio.length === 0) {
      console.log('  ❌ ISSUE: No audio traffic detected');
      console.log('  💡 SOLUTION: Check if sendAudioData is being called');
    }
    
    if (logCategories.errors.length > 0) {
      console.log('  ❌ ISSUE: Errors detected in console');
      console.log('  💡 SOLUTION: Address the errors listed above');
    }
    
    console.log('\n📋 NEXT STEPS:');
    console.log('  1. Share this diagnostic report');
    console.log('  2. Check if VAD configuration includes utteranceEndMs and interimResults');
    console.log('  3. Verify that real audio APIs are working (not mocked)');
    console.log('  4. Check Deepgram API key and project ID');
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Diagnostic completed');
    
    // Test passes if we captured logs (regardless of content)
    expect(allLogs.length).toBeGreaterThan(0);
  });
  
  test('should test VAD configuration specifically', async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
    
    // Check VAD configuration
    const vadConfig = await page.evaluate(() => {
      // Try to access the component's transcription options
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent) {
        // This is a bit hacky, but we need to check the configuration
        return {
          hasComponent: true,
          methods: Object.keys(deepgramComponent)
        };
      }
      return { hasComponent: false };
    });
    
    console.log('🔍 VAD Configuration Check:');
    console.log('  Component available:', vadConfig.hasComponent);
    if (vadConfig.hasComponent) {
      console.log('  Available methods:', vadConfig.methods);
    }
    
    // Check if VAD options are in the test-app
    const transcriptionOptions = await page.evaluate(() => {
      // Look for VAD configuration in the page
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        if (script.textContent && script.textContent.includes('utteranceEndMs')) {
          return 'VAD configuration found in page';
        }
      }
      return 'VAD configuration not found in page';
    });
    
    console.log('  VAD config in page:', transcriptionOptions);
    
    expect(vadConfig.hasComponent).toBe(true);
  });
});
