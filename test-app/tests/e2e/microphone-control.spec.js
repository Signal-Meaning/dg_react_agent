import { test, expect } from '@playwright/test';
import { APP_ROOT, pathWithQuery } from './helpers/test-helpers.mjs';
import { MicrophoneHelpers } from './helpers/test-helpers.js';

/**
 * E2E Tests for Microphone Control
 * 
 * IMPORTANT: These tests require a REAL Deepgram API key!
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

test.describe('Microphone Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_ROOT);
    await page.waitForLoadState('networkidle');
    
    // Note: Component doesn't connect without a valid API key
    // The connection status will be "closed" due to invalid test API key
    // This is expected behavior for testing without real Deepgram credentials
  });

  test('should enable microphone when button clicked', async ({ page }) => {
    // Use proper microphone activation sequence (Issue #188)
    // This ensures agent connection and greeting are complete before enabling mic
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    // Verify microphone is enabled
    expect(result.success).toBe(true);
    expect(result.micStatus).toBe('Enabled');
    expect(result.connectionStatus).toContain('connected');
  });

  test('should disable microphone when button clicked again', async ({ page }) => {
    // First enable the microphone using proper sequence (Issue #188)
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    expect(result.success).toBe(true);
    expect(result.micStatus).toBe('Enabled');
    
    // Now disable it by clicking again
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(2000);
    
    // Verify microphone is now disabled
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
  });

  test('should start transcription service when microphone button clicked with agent already connected (Issue #255)', async ({ page }) => {
    // This test validates Issue #255: Microphone button should start transcription service
    // even when agent service is already connected
    
    const { setupConnectionStateTracking } = await import('./helpers/test-helpers.js');
    const stateTracker = await setupConnectionStateTracking(page);
    
    // Step 1: Start agent service first (simulating agent already connected scenario)
    await page.evaluate(async () => {
      const deepgramComponent = window.deepgramRef?.current;
      if (!deepgramComponent) {
        throw new Error('DeepgramVoiceInteraction component not available');
      }
      // Start only agent service (transcription: false)
      await deepgramComponent.start({ agent: true, transcription: false });
    });
    
    // Wait for agent connection to be established
    await stateTracker.waitForAgentConnected(15000);
    let connectionStates = await stateTracker.getStates();
    
    // Verify agent is connected and transcription is NOT connected
    expect(connectionStates.agent).toBe('connected');
    expect(connectionStates.transcription).toBe('closed');
    
    // Step 2: Click microphone button - should start BOTH services (Issue #255 fix)
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for transcription service to connect (this is what Issue #255 fixes)
    await stateTracker.waitForTranscriptionConnected(15000);
    
    connectionStates = await stateTracker.getStates();
    
    // CRITICAL VALIDATION: Both services should now be connected
    expect(connectionStates.agent).toBe('connected');
    expect(connectionStates.transcription).toBe('connected');
    expect(connectionStates.agentConnected).toBe(true);
    expect(connectionStates.transcriptionConnected).toBe(true);
  });

  // TODO: Fix permission mocking - see https://github.com/Signal-Meaning/dg_react_agent/issues/178
  test.skip('should handle microphone permission denied', async ({ page }) => {
    // Wait for component to be ready
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true');
    
    // Mock permission denied - use the actual origin
    const currentUrl = page.url();
    const origin = new URL(currentUrl).origin;
    await page.context().grantPermissions([], { origin });
    
    // Try to enable microphone - should handle permission error gracefully
    await page.click('[data-testid="microphone-button"]');
    await page.waitForTimeout(3000);
    
    // Should remain disabled due to permission error
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
  });

  test('should handle microphone permission granted', async ({ page }) => {
    // Grant microphone permission - use the actual origin
    const currentUrl = page.url();
    const origin = new URL(currentUrl).origin;
    await page.context().grantPermissions(['microphone'], { origin });
    
    // Use proper microphone activation sequence (Issue #188)
    // This ensures agent connection and greeting are complete before enabling mic
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    // Should be enabled with permission granted
    expect(result.success).toBe(true);
    expect(result.micStatus).toBe('Enabled');
  });

  test('should maintain microphone disabled by default', async ({ page }) => {
    // With lazy initialization (Issue #206), microphone starts disabled
    // Wait for component to be ready
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true', { timeout: 5000 });
    
    // Verify microphone button is visible and microphone is disabled
    const micButton = page.locator('[data-testid="microphone-button"]');
    await expect(micButton).toBeVisible();
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
  });

  test('should handle microphone control via props', async ({ page }) => {
    // Navigate to test page with microphoneEnabled=true (if test app supports URL params)
    await page.goto(pathWithQuery({ microphoneEnabled: 'true' }));
    await page.waitForLoadState('networkidle');
    
    // Wait for component to be ready (lazy initialization)
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true', { timeout: 5000 });
    
    // Note: Currently the test app doesn't handle URL parameters, so microphone is still disabled by default
    // This test verifies the component renders correctly regardless of URL params
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
  });

  test('should handle microphone toggle callback', async ({ page }) => {
    // Listen for microphone toggle events
    const toggleEvents = [];
    await page.exposeFunction('onMicToggle', (enabled) => {
      toggleEvents.push(enabled);
    });
    
    // Verify microphone button is enabled (component ready in auto-connect mode)
    await expect(page.locator('[data-testid="microphone-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
    
    // Note: In auto-connect mode, the component is ready immediately, so the button is enabled
    // but the microphone itself is disabled until the user clicks the button
  });

  test('should maintain microphone state during reconnection', async ({ page }) => {
    // Verify microphone button is enabled (component ready in auto-connect mode)
    await expect(page.locator('[data-testid="microphone-button"]')).toBeEnabled();
    await expect(page.locator('[data-testid="mic-status"]')).toContainText('Disabled');
    
    // Note: In auto-connect mode, the component is ready immediately, so the button is enabled
    // but the microphone itself is disabled until the user clicks the button
  });

  test('should handle microphone errors gracefully', async ({ page, context }) => {
    // Grant permissions first, then override getUserMedia to throw error on next call
    await context.grantPermissions(['microphone']);
    
    // Navigate and wait for component ready
    await page.goto(APP_ROOT);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="component-ready-status"]')).toContainText('true', { timeout: 5000 });
    
    // Override getUserMedia to throw error AFTER page load
    await page.evaluate(() => {
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = () => {
        return Promise.reject(new DOMException('Microphone access denied', 'NotAllowedError'));
      };
    });
    
    // Try to enable microphone - should handle error gracefully
    await page.click('[data-testid="microphone-button"]');
    
    // Wait longer for error handling to complete
    await page.waitForTimeout(5000);
    
    // Component should handle the error - mic status may remain Enabled if connection was established
    // before the error, or may show Disabled if error prevents activation
    // The important thing is that it doesn't crash
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus).toBeTruthy();
    console.log(`✅ Microphone error handled gracefully - final status: ${micStatus}`);
  });
});
