/**
 * E2E Test: TTS Mute Button Functionality
 * 
 * Tests the complete mute button workflow to ensure Issue #121 fix doesn't regress:
 * - Mute button stops currently playing audio immediately
 * - First mute click works reliably (no more "second click" issue)
 * - Unmute allows future audio to play
 * - Playback state detection is accurate
 */

import { test, expect } from '@playwright/test';

test.describe('TTS Mute Button Functionality', () => {
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
    // Start the connection first
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    
    // Send a text message to trigger agent response
    await page.fill('[data-testid="text-input"]', 'Tell me a short story');
    await page.click('[data-testid="send-button"]');
    
    // Wait for agent to start speaking
    await page.waitForFunction(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() === true;
    }, { timeout: 5000 });
    
    // Verify audio is playing
    const isPlayingBefore = await page.evaluate(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() || false;
    });
    expect(isPlayingBefore).toBe(true);
    
    // Click mute button
    await page.click('[data-testid="tts-mute-button"]');
    
    // Wait for audio to stop
    await page.waitForFunction(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() === false;
    }, { timeout: 5000 });
    
    // Verify audio stopped
    const isPlayingAfter = await page.evaluate(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() || false;
    });
    expect(isPlayingAfter).toBe(false);
    
    // Verify mute state is active
    const isMuted = await page.evaluate(() => {
      return window.deepgramRef?.current?.isTtsMuted || false;
    });
    expect(isMuted).toBe(true);
  });

  test('should work on first click (no second click required)', async ({ page }) => {
    // Start the connection first
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    
    // Send a text message to trigger agent response
    await page.fill('[data-testid="text-input"]', 'Count from 1 to 10');
    await page.click('[data-testid="send-button"]');
    
    // Wait for agent to start speaking
    await page.waitForFunction(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() === true;
    }, { timeout: 5000 });
    
    // Click mute button immediately (first click)
    await page.click('[data-testid="tts-mute-button"]');
    
    // Verify audio stopped immediately
    await page.waitForFunction(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() === false;
    }, { timeout: 3000 });
    
    // Verify mute state is active
    const isMuted = await page.evaluate(() => {
      return window.deepgramRef?.current?.isTtsMuted || false;
    });
    expect(isMuted).toBe(true);
  });

  test('should allow audio to play after unmuting', async ({ page }) => {
    // Start the connection first
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    
    // First mute the TTS
    await page.click('[data-testid="tts-mute-button"]');
    
    // Verify muted state
    let isMuted = await page.evaluate(() => {
      return window.deepgramRef?.current?.isTtsMuted || false;
    });
    expect(isMuted).toBe(true);
    
    // Send a text message (should not play audio while muted)
    await page.fill('[data-testid="text-input"]', 'Hello');
    await page.click('[data-testid="send-button"]');
    
    // Wait a moment to ensure no audio plays
    await page.waitForTimeout(2000);
    
    // Verify no audio is playing
    const isPlayingWhileMuted = await page.evaluate(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() || false;
    });
    expect(isPlayingWhileMuted).toBe(false);
    
    // Unmute
    await page.click('[data-testid="tts-mute-button"]');
    
    // Verify unmuted state
    isMuted = await page.evaluate(() => {
      return window.deepgramRef?.current?.isTtsMuted || false;
    });
    expect(isMuted).toBe(false);
    
    // Send another message (should now play audio)
    await page.fill('[data-testid="text-input"]', 'Tell me a joke');
    await page.click('[data-testid="send-button"]');
    
    // Wait for audio to start
    await page.waitForFunction(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() === true;
    }, { timeout: 5000 });
    
    // Verify audio is playing
    const isPlayingAfterUnmute = await page.evaluate(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() || false;
    });
    expect(isPlayingAfterUnmute).toBe(true);
  });

  test('should maintain mute state across multiple interactions', async ({ page }) => {
    // Start the connection first
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    
    // Mute the TTS
    await page.click('[data-testid="tts-mute-button"]');
    
    // Send multiple messages
    for (let i = 0; i < 3; i++) {
      await page.fill('[data-testid="text-input"]', `Message ${i + 1}`);
      await page.click('[data-testid="send-button"]');
      
      // Wait a moment
      await page.waitForTimeout(1000);
      
      // Verify no audio is playing
      const isPlaying = await page.evaluate(() => {
        return window.deepgramRef?.current?.isPlaybackActive?.() || false;
      });
      expect(isPlaying).toBe(false);
      
      // Verify still muted
      const isMuted = await page.evaluate(() => {
        return window.deepgramRef?.current?.isTtsMuted || false;
      });
      expect(isMuted).toBe(true);
    }
  });

  test('should accurately detect playback state during race conditions', async ({ page }) => {
    // Start the connection first
    await page.click('[data-testid="start-button"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 5000 });
    
    // Send a message to trigger audio
    await page.fill('[data-testid="text-input"]', 'Tell me a long story');
    await page.click('[data-testid="send-button"]');
    
    // Wait for audio to start
    await page.waitForFunction(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() === true;
    }, { timeout: 5000 });
    
    // Rapidly check playback state multiple times
    const playbackStates = [];
    for (let i = 0; i < 5; i++) {
      const state = await page.evaluate(() => {
        return window.deepgramRef?.current?.isPlaybackActive?.() || false;
      });
      playbackStates.push(state);
      await page.waitForTimeout(100);
    }
    
    // All states should be consistent (true while playing)
    expect(playbackStates.every(state => state === true)).toBe(true);
    
    // Now mute and check again
    await page.click('[data-testid="tts-mute-button"]');
    
    // Wait for audio to stop
    await page.waitForFunction(() => {
      return window.deepgramRef?.current?.isPlaybackActive?.() === false;
    }, { timeout: 5000 });
    
    // Rapidly check playback state again
    const mutedStates = [];
    for (let i = 0; i < 5; i++) {
      const state = await page.evaluate(() => {
        return window.deepgramRef?.current?.isPlaybackActive?.() || false;
      });
      mutedStates.push(state);
      await page.waitForTimeout(100);
    }
    
    // All states should be consistent (false while muted)
    expect(mutedStates.every(state => state === false)).toBe(true);
  });
});
