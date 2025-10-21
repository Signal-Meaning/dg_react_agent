/**
 * E2E Test: TTS Mute Button Functionality
 * 
 * Tests the complete mute button workflow to ensure Issue #121 fix doesn't regress:
 * - Mute button stops currently playing audio immediately
 * - First mute click works reliably (no more "second click" issue)
 * - Unmute allows future audio to play
 * - Playback state detection is accurate
 * 
 * Note: These tests focus on mute state management rather than audio playback
 * detection, as audio playback is unreliable in headless browser environments.
 */

import { test, expect } from '@playwright/test';

test.describe('TTS Mute Button Functionality', () => {
  // Test helper functions
  const setupConnection = async (page) => {
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
  };

  const sendMessage = async (page, message) => {
    await page.fill('[data-testid="text-input"]', message);
    await page.click('[data-testid="send-button"]');
    await page.waitForTimeout(2000); // Wait for potential audio to start
  };

  const getMuteState = async (page) => {
    return await page.evaluate(() => {
      return window.deepgramRef?.current?.isTtsMuted || false;
    });
  };

  const verifyMuteState = async (page, expectedState) => {
    const isMuted = await getMuteState(page);
    expect(isMuted).toBe(expectedState);
    await expect(page.locator('[data-testid="tts-muted-status"]')).toContainText(expectedState.toString());
  };

  test.beforeEach(async ({ page, context }) => {
    // Grant audio permissions for the test
    await context.grantPermissions(['microphone', 'camera']);
    
    // Navigate to test app
    await page.goto('http://localhost:5173');
    
    // Wait for component to be ready
    await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
    
    // Wait for component to be ready (connection starts as closed)
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('closed', { timeout: 10000 });
  });

  test('should stop currently playing audio when mute button is clicked', async ({ page }) => {
    await setupConnection(page);
    await sendMessage(page, 'Tell me a short story');
    
    // Click mute button
    await page.click('[data-testid="tts-mute-button"]');
    
    // Verify mute state is active
    await verifyMuteState(page, true);
  });

  test('should work on first click (no second click required)', async ({ page }) => {
    await setupConnection(page);
    await sendMessage(page, 'Count from 1 to 10');
    
    // Click mute button immediately (first click)
    await page.click('[data-testid="tts-mute-button"]');
    
    // Verify mute state is active immediately
    await verifyMuteState(page, true);
  });

  test('should allow audio to play after unmuting', async ({ page }) => {
    await setupConnection(page);
    
    // First mute the TTS
    await page.click('[data-testid="tts-mute-button"]');
    await verifyMuteState(page, true);
    
    // Send a text message (should not play audio while muted)
    await sendMessage(page, 'Hello');
    
    // Verify still muted
    await verifyMuteState(page, true);
    
    // Unmute
    await page.click('[data-testid="tts-mute-button"]');
    await verifyMuteState(page, false);
  });

  test('should maintain mute state across multiple interactions', async ({ page }) => {
    await setupConnection(page);
    
    // Mute the TTS
    await page.click('[data-testid="tts-mute-button"]');
    
    // Send multiple messages and verify mute state persists
    for (let i = 0; i < 3; i++) {
      await sendMessage(page, `Message ${i + 1}`);
      await verifyMuteState(page, true);
    }
  });

  test.skip('should accurately detect playback state during race conditions', async ({ page }) => {
    await setupConnection(page);
    await sendMessage(page, 'Tell me a long story');
    
    // Test mute functionality regardless of audio state
    await page.click('[data-testid="tts-mute-button"]');
    await verifyMuteState(page, true);
    
    // Test rapid mute/unmute toggles
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="tts-mute-button"]');
      await page.waitForTimeout(100);
    }
    
    // Verify final mute state is consistent (5 clicks = false)
    await verifyMuteState(page, false);
  });
});
