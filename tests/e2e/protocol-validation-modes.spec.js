/**
 * Protocol Validation - Real API vs Mock Modes
 * 
 * This test validates that the dg_react_agent works correctly in both:
 * 1. Real Mode: With actual Deepgram API connections
 * 2. Mock Mode: With mocked WebSocket (for testing without API key)
 */

const { test, expect } = require('@playwright/test');
const {
  SELECTORS,
  setupTestPage,
  waitForConnection,
  sendTextMessage,
  installMockWebSocket,
  assertConnectionHealthy,
} = require('./helpers/test-helpers');

// Configure to run only in chromium for focused testing
test.use({ browserName: 'chromium' });

test.describe('Protocol Validation - Real API Mode', () => {
  test('should work with real Deepgram API connection', async ({ page }) => {
    console.log('🚀 Testing with REAL Deepgram API...');
    
    // Set up console logging to verify real API usage
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('WebSocket') || 
          text.includes('Settings') || 
          text.includes('Welcome') ||
          text.includes('agent.deepgram.com')) {
        console.log('Browser:', text);
      }
    });
    
    // Setup and connect
    await setupTestPage(page);
    console.log('✅ Component loaded');
    
    await waitForConnection(page);
    console.log('✅ Real API connection established');
    
    // Verify we're using the REAL API (not mocked)
    const hasRealConnection = logs.some(log => 
      log.includes('wss://agent.deepgram.com/v1/agent/converse')
    );
    expect(hasRealConnection).toBe(true);
    console.log('✅ Confirmed: Using REAL Deepgram API');
    
    // Verify protocol messages were exchanged
    const hasSettings = logs.some(log => log.includes('Sending agent settings'));
    const hasWelcome = logs.some(log => log.includes('Welcome message received'));
    
    expect(hasSettings).toBe(true);
    expect(hasWelcome).toBe(true);
    console.log('✅ Protocol handshake completed with real API');
    
    // Send a text message through real API
    await sendTextMessage(page, 'Test message for protocol validation');
    console.log('✅ Sent message via real API');
    
    // Wait for real agent response
    await page.waitForTimeout(5000);
    
    // Verify we got audio data (real API sends binary audio)
    const hasAudioData = logs.some(log => 
      log.includes('Blob binary data') || log.includes('ArrayBuffer')
    );
    expect(hasAudioData).toBe(true);
    console.log('✅ Received real audio data from Deepgram');
    
    // Verify agent response
    const agentResponse = page.locator(SELECTORS.agentResponse);
    const response = await agentResponse.textContent();
    expect(response).not.toBe('(Waiting for agent response...)');
    expect(response.length).toBeGreaterThan(0);
    console.log(`✅ Agent responded: "${response.substring(0, 50)}..."`);
    
    // Verify connection stayed stable
    await assertConnectionHealthy(page, expect);
    console.log('✅ Connection remained stable throughout');
    
    console.log('🎉 REAL API MODE TEST PASSED!');
  });
});

test.describe('Protocol Validation - Mock Mode', () => {
  test('should work with mocked WebSocket (no API key)', async ({ page, context }) => {
    console.log('🚀 Testing with MOCKED WebSocket...');
    
    // Install mock WebSocket
    await installMockWebSocket(context);
    
    // Set up console logging
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('Mock') || text.includes('WebSocket') || text.includes('Welcome')) {
        console.log('Browser:', text);
      }
    });
    
    // Setup and connect with mock
    await setupTestPage(page);
    console.log('✅ Component loaded with mock WebSocket');
    
    await waitForConnection(page);
    console.log('✅ Mock connection established');
    
    // Verify we're using the MOCK (not real API)
    const hasMockConnection = logs.some(log => log.includes('MockWebSocket created'));
    expect(hasMockConnection).toBe(true);
    console.log('✅ Confirmed: Using MOCKED WebSocket');
    
    // Verify protocol messages were exchanged
    const hasWelcome = logs.some(log => log.includes('Mock sending Welcome'));
    expect(hasWelcome).toBe(true);
    console.log('✅ Protocol handshake completed with mock');
    
    // Send a text message through mock
    await sendTextMessage(page, 'Mock test message');
    console.log('✅ Sent message via mock WebSocket');
    
    // Wait for mock response
    await page.waitForTimeout(2000);
    
    // Verify we got mock response
    const agentResponse = page.locator(SELECTORS.agentResponse);
    const response = await agentResponse.textContent();
    expect(response).toContain('[MOCK]');
    expect(response).toContain('Mock test message');
    console.log(`✅ Mock agent responded: "${response.substring(0, 50)}..."`);
    
    // Verify connection stayed stable
    await assertConnectionHealthy(page, expect);
    console.log('✅ Mock connection remained stable');
    
    console.log('🎉 MOCK MODE TEST PASSED!');
  });
});

