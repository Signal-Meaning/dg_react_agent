/**
 * Issue #222: Test idle timeout race condition fix
 * 
 * Tests that startAudioCapture() resets idle timeout before first transcript arrives.
 * This prevents the race condition where timeout fires immediately after recording starts.
 */
import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/audio-mocks.js';
import { SELECTORS, establishConnectionViaText } from './helpers/test-helpers.js';

test('should reset idle timeout when startAudioCapture() is called (Issue #222)', async ({ page, context }) => {
  console.log('🧪 Testing Issue #222: startAudioCapture() should reset idle timeout...');
  
  // Setup
  await setupTestPage(page);
  await establishConnectionViaText(page);
  
  const initialStatus = await page.locator(SELECTORS.connectionStatus).textContent();
  expect(initialStatus).toBe('connected');
  console.log('✅ Connection established');
  
  // Wait for agent to finish (puts us in idle state where timeout can start)
  await page.waitForTimeout(2000);
  
  // Wait until timeout is close to firing (~9 seconds into 10s timeout)
  console.log('⏳ Waiting ~9 seconds to get close to idle timeout...');
  await page.waitForTimeout(9000);
  
  // Monitor connection closes
  const connectionCloses = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Idle timeout reached') || text.includes('closing agent connection')) {
      connectionCloses.push({ timestamp: Date.now(), text });
    }
  });
  
  // NOW call startAudioCapture() - this should reset the timeout
  console.log('🎤 Calling startAudioCapture() - should reset idle timeout...');
  const startTime = Date.now();
  
  await page.evaluate(async () => {
    const component = window.deepgramRef?.current;
    if (component && typeof component.startAudioCapture === 'function') {
      await component.startAudioCapture();
    } else {
      throw new Error('startAudioCapture() method not available');
    }
  });
  
  // Wait a bit - connection should NOT close if fix works
  await page.waitForTimeout(3000);
  
  const connectionStatus = await page.locator(SELECTORS.connectionStatus).textContent();
  const elapsed = Date.now() - startTime;
  
  console.log(`\n📊 RESULTS:`);
  console.log(`  Connection status after startAudioCapture(): ${connectionStatus}`);
  console.log(`  Time elapsed: ${elapsed}ms`);
  console.log(`  Connection closes captured: ${connectionCloses.length}`);
  
  if (connectionCloses.length > 0) {
    console.log('\n🔍 Connection close events:');
    connectionCloses.forEach((c, i) => {
      const timeSinceStart = c.timestamp - startTime;
      console.log(`  ${i + 1}. ${timeSinceStart}ms after startAudioCapture(): ${c.text}`);
    });
  }
  
  // Verify connection did NOT close immediately after startAudioCapture()
  // If fix works, timeout should reset and connection should stay open
  expect(connectionStatus).toBe('connected');
  
  // If timeout fired immediately, connectionCloses would have entries
  // We expect 0 closes in the 3 seconds after startAudioCapture()
  const immediateCloses = connectionCloses.filter(c => 
    c.timestamp - startTime < 3000
  );
  
  expect(immediateCloses.length).toBe(0);
  console.log('✅ Test passed: startAudioCapture() reset idle timeout correctly!');
  console.log('✅ Connection did NOT close immediately after startAudioCapture()');
});

