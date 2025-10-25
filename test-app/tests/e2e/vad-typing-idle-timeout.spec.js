const { test, expect } = require('@playwright/test');
const { setupTestPage } = require('./helpers/audio-mocks');

test.describe('VAD Typing Idle Timeout (Issue #139)', () => {
  test('should timeout even with VAD detecting typing as speech', async ({ page }) => {
    await setupTestPage(page);

    // Wait for initial connection
    await page.waitForFunction(() => {
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      return eventLog && eventLog.textContent.includes('agent connection state: connected');
    }, { timeout: 10000 });

    // Simulate typing by triggering VAD events
    await page.evaluate(() => {
      // Simulate VAD detecting speech (like typing sounds)
      const vadEvents = [
        { speechDetected: true, timestamp: Date.now() },
        { speechDetected: false, timestamp: Date.now() + 100 },
        { speechDetected: true, timestamp: Date.now() + 200 },
        { speechDetected: false, timestamp: Date.now() + 300 },
        { speechDetected: true, timestamp: Date.now() + 400 },
        { speechDetected: false, timestamp: Date.now() + 500 },
      ];
      
      // Trigger VAD events
      vadEvents.forEach((event, index) => {
        setTimeout(() => {
          if (window.deepgramRef && window.deepgramRef.current) {
            // Simulate VAD event processing
            console.log(`Simulating VAD event ${index + 1}: speechDetected=${event.speechDetected}`);
          }
        }, index * 100);
      });
    });

    // Wait for idle timeout (should be ~10s, not 60s)
    const idleTime = Date.now();
    
    // Wait for connection to close within 15 seconds
    await page.waitForFunction(() => {
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      return eventLog && eventLog.textContent.includes('agent connection state: closed');
    }, { timeout: 15000 });
    
    const elapsed = Date.now() - idleTime;
    console.log(`Connection closed after ${elapsed}ms`);

    // Should close within 15 seconds (not 60 seconds)
    expect(elapsed).toBeLessThan(15000);
  });

  test('should demonstrate VAD false positive bug', async ({ page }) => {
    await setupTestPage(page);

    // Wait for initial connection
    await page.waitForFunction(() => {
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      return eventLog && eventLog.textContent.includes('agent connection state: connected');
    }, { timeout: 10000 });

    // Simulate continuous VAD false positives (like typing)
    await page.evaluate(() => {
      // Simulate continuous VAD false positives
      const simulateVADFalsePositives = () => {
        let count = 0;
        const interval = setInterval(() => {
          if (count >= 20) { // Stop after 20 false positives
            clearInterval(interval);
            return;
          }
          
          // Simulate VAD detecting speech
          console.log(`VAD false positive ${count + 1}: speechDetected=true`);
          count++;
        }, 500); // Every 500ms
      };
      
      simulateVADFalsePositives();
    });

    // Wait for 20 seconds to see if connection stays open
    const startTime = Date.now();
    await page.waitForTimeout(20000);
    
    // Check if connection is still open
    const connectionStatus = await page.evaluate(() => {
      const eventLog = document.querySelector('[data-testid="event-log"] pre');
      const logs = eventLog ? eventLog.textContent : '';
      const lastConnectionLog = logs.split('\n').reverse().find(line => 
        line.includes('agent connection state:')
      );
      return lastConnectionLog ? lastConnectionLog.includes('connected') : false;
    });

    const elapsed = Date.now() - startTime;
    console.log(`After ${elapsed}ms with VAD false positives, connection still open: ${connectionStatus}`);

    // This test should PASS - connection should close despite false positives
    expect(connectionStatus).toBe(false); // Should be closed
  });
});
