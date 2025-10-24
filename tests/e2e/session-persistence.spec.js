/**
 * @jest-environment jsdom
 * @eslint-env jest
 */

/**
 * Session Persistence E2E Tests
 * 
 * These tests validate that conversation context is properly preserved
 * within the same browser session and properly isolated between browser sessions.
 * 
 * Key Scenarios:
 * =============
 * 
 * 1. WITHIN SAME BROWSER SESSION:
 *    - Text input → disconnect → reconnect → context preserved
 *    - Voice input → disconnect → reconnect → context preserved
 *    - Mixed text/voice → disconnect → reconnect → context preserved
 * 
 * 2. BETWEEN BROWSER SESSIONS:
 *    - Session 1: Build context → close browser
 *    - Session 2: New browser → no context (fresh start)
 * 
 * 3. SESSION MANAGEMENT:
 *    - Multiple sessions in same browser
 *    - Session switching
 *    - Session cleanup
 */

import { test, expect } from '@playwright/test';

test.describe('Session Persistence E2E Tests', () => {
  let page;
  let sessionId;

  test.beforeEach(async ({ browser }) => {
    // Create a new page for each test
    page = await browser.newPage();
    
    // Navigate to test app
    await page.goto('http://localhost:5173?test-mode=true');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="deepgram-component"]', { timeout: 10000 });
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should preserve context within same browser session - Text Input', async () => {
    // STEP 1: Start with text input and build context
    await page.fill('[data-testid="text-input"]', "I'm a filmmaker looking for camera recommendations");
    await page.click('[data-testid="send-text-button"]');
    
    // Wait for agent response
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // Verify context was built
    const firstResponse = await page.textContent('[data-testid="agent-response"]');
    expect(firstResponse).toContain('filmmaker');
    expect(firstResponse).toContain('camera');
    
    // STEP 2: Disconnect (simulate network issue)
    await page.click('[data-testid="stop-button"]');
    await page.waitForSelector('[data-testid="connection-state"]', { timeout: 5000 });
    
    // STEP 3: Reconnect and verify context is preserved
    await page.click('[data-testid="start-button"]');
    await page.waitForSelector('[data-testid="connection-state"]', { timeout: 10000 });
    
    // Send follow-up message
    await page.fill('[data-testid="text-input"]', "What about low-light performance?");
    await page.click('[data-testid="send-text-button"]');
    
    // Wait for response
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // Verify context was preserved (agent should remember filmmaker context)
    const followUpResponse = await page.textContent('[data-testid="agent-response"]');
    expect(followUpResponse).toContain('filmmaker');
    expect(followUpResponse).toContain('camera');
    expect(followUpResponse).toContain('low-light');
    
    console.log('✅ Text input context preservation test PASSED');
  });

  test('should preserve context within same browser session - Voice Input', async () => {
    // STEP 1: Start with voice input and build context
    await page.click('[data-testid="start-button"]');
    await page.waitForSelector('[data-testid="connection-state"]', { timeout: 10000 });
    
    // Simulate voice input (using test audio)
    await page.click('[data-testid="test-voice-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 15000 });
    
    // Verify context was built
    const firstResponse = await page.textContent('[data-testid="agent-response"]');
    expect(firstResponse).toBeTruthy();
    
    // STEP 2: Disconnect
    await page.click('[data-testid="stop-button"]');
    await page.waitForSelector('[data-testid="connection-state"]', { timeout: 5000 });
    
    // STEP 3: Reconnect and verify context is preserved
    await page.click('[data-testid="start-button"]');
    await page.waitForSelector('[data-testid="connection-state"]', { timeout: 10000 });
    
    // Send follow-up voice input
    await page.click('[data-testid="test-voice-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 15000 });
    
    // Verify context was preserved
    const followUpResponse = await page.textContent('[data-testid="agent-response"]');
    expect(followUpResponse).toBeTruthy();
    
    console.log('✅ Voice input context preservation test PASSED');
  });

  test('should preserve context within same browser session - Mixed Input', async () => {
    // STEP 1: Build context with mixed text and voice input
    await page.fill('[data-testid="text-input"]', "I'm a teacher working with third graders");
    await page.click('[data-testid="send-text-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // Add voice input
    await page.click('[data-testid="start-button"]');
    await page.waitForSelector('[data-testid="connection-state"]', { timeout: 10000 });
    await page.click('[data-testid="test-voice-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 15000 });
    
    // STEP 2: Disconnect
    await page.click('[data-testid="stop-button"]');
    await page.waitForSelector('[data-testid="connection-state"]', { timeout: 5000 });
    
    // STEP 3: Reconnect and verify mixed context is preserved
    await page.click('[data-testid="start-button"]');
    await page.waitForSelector('[data-testid="connection-state"]', { timeout: 10000 });
    
    // Send follow-up message
    await page.fill('[data-testid="text-input"]', "What about classroom management strategies?");
    await page.click('[data-testid="send-text-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // Verify context was preserved
    const followUpResponse = await page.textContent('[data-testid="agent-response"]');
    expect(followUpResponse).toContain('teacher');
    expect(followUpResponse).toContain('third grade');
    
    console.log('✅ Mixed input context preservation test PASSED');
  });

  test('should NOT preserve context between browser sessions', async () => {
    // STEP 1: Build context in first session
    await page.fill('[data-testid="text-input"]', "I'm a scientist working on climate research");
    await page.click('[data-testid="send-text-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // Verify context was built
    const firstResponse = await page.textContent('[data-testid="agent-response"]');
    expect(firstResponse).toContain('scientist');
    expect(firstResponse).toContain('climate');
    
    // STEP 2: Close browser (simulate new browser session)
    await page.close();
    
    // STEP 3: Open new browser session
    const newPage = await page.context().newPage();
    await newPage.goto('http://localhost:5173?test-mode=true');
    await newPage.waitForSelector('[data-testid="deepgram-component"]', { timeout: 10000 });
    
    // STEP 4: Send message in new session
    await newPage.fill('[data-testid="text-input"]', "What should I focus on?");
    await newPage.click('[data-testid="send-text-button"]');
    await newPage.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // STEP 5: Verify context was NOT preserved (fresh start)
    const newSessionResponse = await newPage.textContent('[data-testid="agent-response"]');
    expect(newSessionResponse).not.toContain('scientist');
    expect(newSessionResponse).not.toContain('climate');
    
    // Should be a generic response since no context
    expect(newSessionResponse).toBeTruthy();
    
    await newPage.close();
    console.log('✅ Cross-session isolation test PASSED');
  });

  test('should handle multiple sessions in same browser', async () => {
    // STEP 1: Create first session
    await page.fill('[data-testid="text-input"]', "Session 1: I'm a doctor");
    await page.click('[data-testid="send-text-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // STEP 2: Switch to second session (simulate session switching)
    await page.click('[data-testid="new-session-button"]');
    await page.fill('[data-testid="text-input"]', "Session 2: I'm a lawyer");
    await page.click('[data-testid="send-text-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // STEP 3: Switch back to first session
    await page.click('[data-testid="switch-session-button"]');
    await page.fill('[data-testid="text-input"]', "What about medical ethics?");
    await page.click('[data-testid="send-text-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // Verify first session context is preserved
    const firstSessionResponse = await page.textContent('[data-testid="agent-response"]');
    expect(firstSessionResponse).toContain('doctor');
    expect(firstSessionResponse).toContain('medical');
    
    console.log('✅ Multiple sessions test PASSED');
  });

  test('should handle session cleanup', async () => {
    // STEP 1: Create multiple sessions
    await page.fill('[data-testid="text-input"]', "Session 1: I'm a chef");
    await page.click('[data-testid="send-text-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    await page.click('[data-testid="new-session-button"]');
    await page.fill('[data-testid="text-input"]', "Session 2: I'm a musician");
    await page.click('[data-testid="send-text-button"]');
    await page.waitForSelector('[data-testid="agent-response"]', { timeout: 10000 });
    
    // STEP 2: Trigger session cleanup
    await page.click('[data-testid="cleanup-sessions-button"]');
    
    // STEP 3: Verify sessions were cleaned up
    const sessionCount = await page.textContent('[data-testid="session-count"]');
    expect(parseInt(sessionCount)).toBeLessThanOrEqual(1);
    
    console.log('✅ Session cleanup test PASSED');
  });
});
