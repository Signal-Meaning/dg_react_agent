const { test, expect } = require('@playwright/test');
const { setupTestPage, waitForConnection } = require('./helpers/test-helpers');

test.describe('Logging Behavior Tests', () => {
  
  test('should log event log entries to console', async ({ page }) => {
    console.log('🧪 Testing console logging synchronization...');
    
    // Track console logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Setup test page
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Wait for initial logs to appear
    await page.waitForTimeout(2000);
    
    // Check that event log entries are also in console
    const eventLogEntries = await page.evaluate(() => {
      const logs = Array.from(document.querySelectorAll('[data-testid="event-log"] pre'));
      return logs.map(log => log.textContent.split('\n')).flat().filter(line => line.trim());
    });
    
    console.log(`Found ${eventLogEntries.length} event log entries`);
    console.log(`Found ${consoleLogs.length} console log entries`);
    
    // Verify that event log entries appear in console logs
    let synchronizedEntries = 0;
    for (const eventEntry of eventLogEntries) {
      if (eventEntry.includes(' - ')) { // Only check timestamped entries
        const foundInConsole = consoleLogs.some(consoleLog => 
          consoleLog.includes(eventEntry.split(' - ')[1]) // Check the message part
        );
        if (foundInConsole) {
          synchronizedEntries++;
        }
      }
    }
    
    console.log(`Synchronized entries: ${synchronizedEntries}/${eventLogEntries.length}`);
    
    // At least some entries should be synchronized
    expect(synchronizedEntries).toBeGreaterThan(0);
  });
  
  test('should log transcript entries to both console and event log', async ({ page }) => {
    console.log('🧪 Testing transcript logging...');
    
    // Track console logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Setup test page
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Enable microphone to trigger transcription
    const micButton = page.locator('[data-testid="microphone-button"]');
    await micButton.click();
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Enabled', { timeout: 10000 });
    
    // Wait for potential transcription events
    await page.waitForTimeout(3000);
    
    // Check for transcript entries in event log
    const transcriptEntries = await page.evaluate(() => {
      const logs = Array.from(document.querySelectorAll('[data-testid="event-log"] pre'));
      return logs.map(log => log.textContent.split('\n')).flat().filter(line => 
        line.includes('[TRANSCRIPT]')
      );
    });
    
    // Check for transcript entries in console logs
    const consoleTranscriptEntries = consoleLogs.filter(log => 
      log.includes('[TRANSCRIPT]')
    );
    
    console.log(`Found ${transcriptEntries.length} transcript entries in event log`);
    console.log(`Found ${consoleTranscriptEntries.length} transcript entries in console`);
    
    // If there are transcript entries, they should appear in both places
    if (transcriptEntries.length > 0) {
      expect(consoleTranscriptEntries.length).toBeGreaterThan(0);
      console.log('✅ Transcript entries found in both console and event log');
    } else {
      console.log('ℹ️ No transcript entries found (may need actual speech input)');
    }
  });
  
  test('should log user messages to both console and event log', async ({ page }) => {
    console.log('🧪 Testing user message logging...');
    
    // Track console logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Setup test page
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Send a text message to trigger user message logging
    const textInput = page.locator('[data-testid="text-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    
    await textInput.fill('Test message for logging verification');
    await sendButton.click();
    
    // Wait for message processing
    await page.waitForTimeout(3000);
    
    // Check for user message entries in event log
    const userMessageEntries = await page.evaluate(() => {
      const logs = Array.from(document.querySelectorAll('[data-testid="event-log"] pre'));
      return logs.map(log => log.textContent.split('\n')).flat().filter(line => 
        line.includes('User message from server:')
      );
    });
    
    // Check for user message entries in console logs
    const consoleUserMessageEntries = consoleLogs.filter(log => 
      log.includes('User message from server:')
    );
    
    console.log(`Found ${userMessageEntries.length} user message entries in event log`);
    console.log(`Found ${consoleUserMessageEntries.length} user message entries in console`);
    
    // User message entries should appear in both places
    if (userMessageEntries.length > 0) {
      expect(consoleUserMessageEntries.length).toBeGreaterThan(0);
      console.log('✅ User message entries found in both console and event log');
    } else {
      console.log('ℹ️ No user message entries found (may need real API key)');
    }
  });
  
  test('should verify addLog function logs to both places', async ({ page }) => {
    console.log('🧪 Testing addLog function behavior...');
    
    // Track console logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Setup test page
    await setupTestPage(page);
    await waitForConnection(page, 10000);
    
    // Wait for initial logs to be generated
    await page.waitForTimeout(2000);
    
    // Get all event log entries
    const eventLogEntries = await page.evaluate(() => {
      const logs = Array.from(document.querySelectorAll('[data-testid="event-log"] pre'));
      return logs.map(log => log.textContent.split('\n')).flat().filter(line => 
        line.trim() && line.includes(' - ')
      );
    });
    
    // Count how many event log entries have corresponding console entries
    let synchronizedCount = 0;
    for (const eventEntry of eventLogEntries) {
      const messagePart = eventEntry.split(' - ')[1];
      const foundInConsole = consoleLogs.some(consoleLog => 
        consoleLog.includes(messagePart)
      );
      if (foundInConsole) {
        synchronizedCount++;
      }
    }
    
    const synchronizationRate = eventLogEntries.length > 0 ? 
      (synchronizedCount / eventLogEntries.length) * 100 : 0;
    
    console.log(`Synchronization rate: ${synchronizationRate.toFixed(1)}% (${synchronizedCount}/${eventLogEntries.length})`);
    
    // Most entries should be synchronized (allow for some variance due to timing)
    expect(synchronizationRate).toBeGreaterThan(50); // At least 50% should be synchronized
  });
});
