/**
 * Microphone Reliability Diagnostic Test
 * 
 * This test specifically addresses the unreliable microphone enabling
 * and tracks the exact workflow: refresh → mic → timeout → mic off → mic on
 */

const { test, expect } = require('@playwright/test');
const { setupTestPage } = require('./helpers/audio-mocks');

test.describe('Microphone Reliability Diagnostics', () => {
  
  test('should track microphone enable/disable reliability', async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
    
    // Capture specific logs for microphone and connection state
    const micLogs = [];
    const connectionLogs = [];
    const vadLogs = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🎤') || text.includes('microphone') || text.includes('mic')) {
        micLogs.push({ timestamp: new Date().toISOString(), text, type: msg.type() });
      } else if (text.includes('connection') || text.includes('🔗') || text.includes('WebSocket')) {
        connectionLogs.push({ timestamp: new Date().toISOString(), text, type: msg.type() });
      } else if (text.includes('VAD') || text.includes('UserStarted') || text.includes('UserStopped') || text.includes('UtteranceEnd')) {
        vadLogs.push({ timestamp: new Date().toISOString(), text, type: msg.type() });
      }
    });
    
    console.log('🔍 Starting microphone reliability test...');
    
    // Step 1: Initial microphone enable
    console.log('Step 1: Enabling microphone...');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000);
    
    const micStatus1 = await page.locator('[data-testid="mic-status"]').textContent();
    const connectionStatus1 = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`After first enable - Mic: ${micStatus1}, Connection: ${connectionStatus1}`);
    
    // Step 2: Trigger timeout
    console.log('Step 2: Triggering timeout...');
    await page.click('button:has-text("Trigger Timeout")');
    await page.waitForTimeout(3000);
    
    const micStatus2 = await page.locator('[data-testid="mic-status"]').textContent();
    const connectionStatus2 = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`After timeout - Mic: ${micStatus2}, Connection: ${connectionStatus2}`);
    
    // Step 3: Disable microphone
    console.log('Step 3: Disabling microphone...');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(1000);
    
    const micStatus3 = await page.locator('[data-testid="mic-status"]').textContent();
    const connectionStatus3 = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`After disable - Mic: ${micStatus3}, Connection: ${connectionStatus3}`);
    
    // Step 4: Re-enable microphone
    console.log('Step 4: Re-enabling microphone...');
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    const micStatus4 = await page.locator('[data-testid="mic-status"]').textContent();
    const connectionStatus4 = await page.locator('[data-testid="connection-status"]').textContent();
    console.log(`After re-enable - Mic: ${micStatus4}, Connection: ${connectionStatus4}`);
    
    // Step 5: Simulate speech
    console.log('Step 5: Simulating speech...');
    await page.evaluate(() => {
      const audioData = new ArrayBuffer(8192);
      const deepgramComponent = window.deepgramRef?.current;
      if (deepgramComponent && deepgramComponent.sendAudioData) {
        console.log('🎤 [RELIABILITY] Sending audio data after re-enable');
        deepgramComponent.sendAudioData(audioData);
      }
    });
    await page.waitForTimeout(2000);
    
    // Analyze results
    console.log('\n📊 MICROPHONE RELIABILITY REPORT:');
    console.log('=' .repeat(60));
    
    console.log('\n🎯 STATUS PROGRESSION:');
    console.log(`  1. First enable:    Mic=${micStatus1}, Connection=${connectionStatus1}`);
    console.log(`  2. After timeout:  Mic=${micStatus2}, Connection=${connectionStatus2}`);
    console.log(`  3. After disable:  Mic=${micStatus3}, Connection=${connectionStatus3}`);
    console.log(`  4. After re-enable: Mic=${micStatus4}, Connection=${connectionStatus4}`);
    
    console.log('\n🎤 MICROPHONE LOGS:');
    micLogs.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });
    
    console.log('\n🔗 CONNECTION LOGS:');
    connectionLogs.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.text}`);
    });
    
    console.log('\n🎙️ VAD LOGS:');
    if (vadLogs.length > 0) {
      vadLogs.forEach(log => {
        console.log(`  [${log.timestamp}] ${log.text}`);
      });
    } else {
      console.log('  ❌ No VAD events detected');
    }
    
    console.log('\n🔍 RELIABILITY ANALYSIS:');
    
    // Check if microphone properly disabled after timeout
    if (micStatus2 === 'Disabled') {
      console.log('  ✅ Microphone properly disabled after timeout');
    } else {
      console.log('  ❌ ISSUE: Microphone not disabled after timeout');
    }
    
    // Check if microphone can be re-enabled
    if (micStatus4 === 'Enabled') {
      console.log('  ✅ Microphone successfully re-enabled');
    } else {
      console.log('  ❌ ISSUE: Microphone failed to re-enable');
    }
    
    // Check connection state
    if (connectionStatus4 === 'connected') {
      console.log('  ✅ Connection established after re-enable');
    } else {
      console.log('  ❌ ISSUE: Connection not established after re-enable');
    }
    
    console.log('\n📋 RECOMMENDATIONS:');
    if (micStatus2 !== 'Disabled') {
      console.log('  💡 Fix: Ensure microphone disables when connection closes');
    }
    if (micStatus4 !== 'Enabled') {
      console.log('  💡 Fix: Debug microphone re-enable logic');
    }
    if (connectionStatus4 !== 'connected') {
      console.log('  💡 Fix: Debug connection re-establishment');
    }
    if (vadLogs.length === 0) {
      console.log('  💡 Fix: Check VAD configuration and real audio flow');
    }
    
    console.log('\n' + '=' .repeat(60));
    
    // Test passes if microphone can be re-enabled
    expect(micStatus4).toBe('Enabled');
  });
  
  test('should test connection state consistency', async ({ page }) => {
    // Set up test page with audio mocks
    await setupTestPage(page);
    
    // Monitor connection state changes
    const stateChanges = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('connection state') || text.includes('Connection') || text.includes('🔗')) {
        stateChanges.push({ timestamp: new Date().toISOString(), text });
      }
    });
    
    console.log('🔍 Testing connection state consistency...');
    
    // Enable microphone
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000);
    
    // Check connection state
    const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('Connection status:', connectionStatus);
    
    // Trigger timeout
    await page.click('button:has-text("Trigger Timeout")');
    await page.waitForTimeout(2000);
    
    // Check connection state after timeout
    const connectionStatusAfter = await page.locator('[data-testid="connection-status"]').textContent();
    console.log('Connection status after timeout:', connectionStatusAfter);
    
    console.log('\n📊 CONNECTION STATE CHANGES:');
    stateChanges.forEach(change => {
      console.log(`  [${change.timestamp}] ${change.text}`);
    });
    
    // Test passes if we can track state changes
    expect(stateChanges.length).toBeGreaterThan(0);
  });
});
