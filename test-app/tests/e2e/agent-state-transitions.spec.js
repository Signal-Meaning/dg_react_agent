/**
 * Agent State Transitions E2E Tests
 * 
 * Tests to verify proper agent state transitions during conversation flow
 * and ensure idle timeout behavior works correctly during agent responses.
 * 
 * These tests address Issue #190: Missing Agent State Handlers Cause Idle Timeout Regression
 */

import { test, expect } from '@playwright/test';
import { setupTestPage, waitForConnection, sendTextMessage, SELECTORS } from './helpers/test-helpers.js';

test.describe('Agent State Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestPage(page);
    await waitForConnection(page);
  });

  test('should transition through proper agent states during conversation', async ({ page }) => {
    // Send user message
    await sendTextMessage(page, 'Hello');
    
    // Wait for agent to start thinking
    await page.waitForFunction(() => {
      const element = document.querySelector('p');
      if (element && element.textContent?.includes('Core Component State')) {
        const strongElement = element.querySelector('strong');
        return strongElement?.textContent === 'thinking';
      }
      return false;
    }, { timeout: 5000 });
    
    // Verify agent state transitions
    const thinkingElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    await expect(thinkingElement).toHaveText('thinking');
    
    // Wait for agent to start speaking
    await page.waitForFunction(() => {
      const element = document.querySelector('p');
      if (element && element.textContent?.includes('Core Component State')) {
        const strongElement = element.querySelector('strong');
        return strongElement?.textContent === 'speaking';
      }
      return false;
    }, { timeout: 10000 });
    
    const speakingElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    await expect(speakingElement).toHaveText('speaking');
    
    // Wait for agent to finish speaking and return to idle
    await page.waitForFunction(() => {
      const element = document.querySelector('p');
      if (element && element.textContent?.includes('Core Component State')) {
        const strongElement = element.querySelector('strong');
        return strongElement?.textContent === 'idle';
      }
      return false;
    }, { timeout: 15000 });
    
    const idleElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    await expect(idleElement).toHaveText('idle');
  });

  test('should disable idle timeout during agent responses', async ({ page }) => {
    // Send message and verify connection stays open during agent response
    await sendTextMessage(page, 'Hello');
    
    // Wait for agent to start thinking
    await page.waitForFunction(() => {
      const element = document.querySelector('p');
      if (element && element.textContent?.includes('Core Component State')) {
        const strongElement = element.querySelector('strong');
        return strongElement?.textContent === 'thinking';
      }
      return false;
    }, { timeout: 5000 });
    
    // Wait longer than idle timeout (10s) and verify connection still open
    await page.waitForTimeout(12000);
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('connected');
    
    // Verify agent is still responding (not idle)
    const agentStateElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    const agentState = await agentStateElement.textContent();
    expect(['thinking', 'speaking']).toContain(agentState);
  });

  test('should receive agent response within reasonable time', async ({ page }) => {
    await sendTextMessage(page, 'Hello');
    
    // Wait for agent response (not just waiting message)
    await page.waitForFunction(() => {
      const response = document.querySelector('[data-testid="agent-response"]')?.textContent;
      return response && response !== '(Waiting for agent response...)';
    }, { timeout: 15000 });
    
    // Verify we got a meaningful response
    const response = await page.locator('[data-testid="agent-response"]').textContent();
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
    expect(response.length).toBeGreaterThan(10); // Should be a substantial response
  });

  test('should maintain connection stability during agent responses', async ({ page }) => {
    // Send multiple messages to test connection stability
    await sendTextMessage(page, 'Hello');
    
    // Wait for first response
    await page.waitForFunction(() => {
      const response = document.querySelector('[data-testid="agent-response"]')?.textContent;
      return response && response !== '(Waiting for agent response...)';
    }, { timeout: 15000 });
    
    // Send second message
    await sendTextMessage(page, 'How are you?');
    
    // Wait for second response
    await page.waitForFunction(() => {
      const response = document.querySelector('[data-testid="agent-response"]')?.textContent;
      return response && response !== '(Waiting for agent response...)';
    }, { timeout: 15000 });
    
    // Verify connection is still stable
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('connected');
    
    // Verify agent state is properly managed
    const agentStateElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    const agentState = await agentStateElement.textContent();
    expect(['idle', 'listening']).toContain(agentState);
  });

  test('should handle agent state transitions with proper timing', async ({ page }) => {
    // Track state transitions with timestamps
    const stateTransitions = [];
    
    // Monitor agent state changes
    await page.exposeFunction('trackStateChange', (state, timestamp) => {
      stateTransitions.push({ state, timestamp });
    });
    
    await page.addInitScript(() => {
      const originalTextContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(Node.prototype, 'textContent', {
        get: function() {
          const value = originalTextContent.get.call(this);
          if (this.tagName === 'STRONG' && this.parentElement?.textContent?.includes('Core Component State')) {
            window.trackStateChange?.(value, Date.now());
          }
          return value;
        },
        configurable: true
      });
    });
    
    // Send message
    await sendTextMessage(page, 'Hello');
    
    // Wait for complete conversation cycle
    await page.waitForFunction(() => {
      const element = document.querySelector('p');
      if (element && element.textContent?.includes('Core Component State')) {
        const strongElement = element.querySelector('strong');
        return strongElement?.textContent === 'idle';
      }
      return false;
    }, { timeout: 20000 });
    
    // Verify we captured state transitions
    expect(stateTransitions.length).toBeGreaterThan(0);
    
    // Verify proper state sequence
    const states = stateTransitions.map(t => t.state);
    const hasThinking = states.includes('thinking');
    const hasSpeaking = states.includes('speaking');
    const hasIdle = states.includes('idle');
    
    expect(hasThinking).toBe(true);
    expect(hasSpeaking).toBe(true);
    expect(hasIdle).toBe(true);
    
    // Verify timing (thinking should come before speaking, speaking before idle)
    const thinkingIndex = states.indexOf('thinking');
    const speakingIndex = states.indexOf('speaking');
    const idleIndex = states.indexOf('idle');
    
    expect(thinkingIndex).toBeLessThan(speakingIndex);
    expect(speakingIndex).toBeLessThan(idleIndex);
  });

  test('should not timeout during long agent responses', async ({ page }) => {
    // Send a message that might trigger a longer response
    await sendTextMessage(page, 'Tell me a long story');
    
    // Wait for agent to start responding
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="agent-state"]');
      return element?.textContent === 'thinking';
    }, { timeout: 5000 });
    
    // Wait for a long time (20 seconds) to ensure no timeout
    await page.waitForTimeout(20000);
    
    // Verify connection is still open
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('connected');
    
    // Verify we eventually get a response
    await page.waitForFunction(() => {
      const response = document.querySelector('[data-testid="agent-response"]')?.textContent;
      return response && response !== '(Waiting for agent response...)';
    }, { timeout: 10000 });
  });

  test('should handle rapid successive messages correctly', async ({ page }) => {
    // Send multiple messages rapidly
    await sendTextMessage(page, 'First message');
    await page.waitForTimeout(1000);
    await sendTextMessage(page, 'Second message');
    await page.waitForTimeout(1000);
    await sendTextMessage(page, 'Third message');
    
    // Wait for responses
    await page.waitForFunction(() => {
      const response = document.querySelector('[data-testid="agent-response"]')?.textContent;
      return response && response !== '(Waiting for agent response...)';
    }, { timeout: 20000 });
    
    // Verify connection stability
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('connected');
    
    // Verify agent state is properly managed
    const agentStateElement = page.locator('p').filter({ hasText: 'Core Component State' }).locator('strong');
    const agentState = await agentStateElement.textContent();
    expect(['idle', 'listening']).toContain(agentState);
  });
});
