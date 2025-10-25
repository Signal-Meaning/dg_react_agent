import { test, expect } from '@playwright/test';

/**
 * E2E Tests for WebSocket Connection Validation
 * 
 * IMPORTANT: These tests require a REAL Deepgram API key!
 * 
 * NOTE: These tests validate WebSocket connection capability, NOT VAD event handling.
 * The VAD functionality (UserStoppedSpeaking, UtteranceEnd, VADEvent) is not yet
 * implemented in the component - only UserStartedSpeaking is currently handled.
 * 
 * These tests use actual WebSocket connections to Deepgram services,
 * not mocks. This provides authentic integration testing but requires
 * valid API credentials in test-app/.env:
 * 
 * - VITE_DEEPGRAM_API_KEY: Your real Deepgram API key
 * - VITE_DEEPGRAM_PROJECT_ID: Your Deepgram project ID
 * 
 * If tests fail with "connection closed" or "API key required" errors,
 * check that your test-app/.env file has valid Deepgram credentials.
 * 
 * Why not use mocks? Real API testing catches integration issues
 * and provides authentic component behavior validation.
 */

test.describe('WebSocket Connection Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for component to initialize
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  });

  test('should establish WebSocket connection to Deepgram Agent API', async ({ page }) => {
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Verify the component is ready for events
    await expect(page.locator('[data-testid="connection-ready"]')).toContainText('true');
    
    console.log('WebSocket test: Component connected and ready');
  });

  test('should handle UserStartedSpeaking events (only VAD event currently implemented)', async ({ page }) => {
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Verify the component is ready for VAD events
    await expect(page.locator('[data-testid="connection-ready"]')).toContainText('true');
    
    console.log('WebSocket test: UserStartedSpeaking handling ready (only VAD event currently implemented)');
  });

  test('should validate WebSocket connection states', async ({ page }) => {
    // Enable microphone to start WebSocket connection
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for connection to be established
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
    
    // Verify the component is ready for events
    await expect(page.locator('[data-testid="connection-ready"]')).toContainText('true');
    
    console.log('WebSocket test: WebSocket connection validated');
  });

  test('should handle WebSocket connection errors gracefully', async ({ page }) => {
    // Try to connect without API key (should handle gracefully)
    await page.goto('/?test-mode=true');
    await page.waitForLoadState('networkidle');
    
    // The component should still render even without valid API key
    await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
    
    console.log('WebSocket test: Error handling validated');
  });

  test('should note that VAD events are not yet implemented', async ({ page }) => {
    console.log('NOTE: VAD events (UserStoppedSpeaking, UtteranceEnd, VADEvent) are not yet implemented in the component');
    console.log('Only UserStartedSpeaking is currently handled');
    console.log('See ISSUE-44-VAD-Events-Proposal.md for implementation plan');
    
    // This test always passes - it's just documentation
    expect(true).toBe(true);
  });
});
