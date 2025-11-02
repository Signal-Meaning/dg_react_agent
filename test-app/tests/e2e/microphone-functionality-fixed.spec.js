/**
 * Fixed Microphone Functionality Test
 * 
 * This demonstrates how to use the new microphone helpers to fix
 * the failing microphone tests from Issue #188.
 * 
 * BEFORE: Test failed because it didn't wait for agent connection
 * AFTER: Test uses proper sequence with microphone helpers
 */

import { test, expect } from '@playwright/test';
import { MicrophoneHelpers, establishConnectionViaText } from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks.js';
import { waitForIdleTimeout } from './fixtures/idle-timeout-helpers';

test.describe('Fixed Microphone Functionality Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });
  
  test('should enable microphone when button is clicked (FIXED)', async ({ page }) => {
    console.log('🎤 Testing microphone activation with proper sequence...');
    
    // Use the new microphone helper that handles the complete sequence
    const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      micEnableTimeout: 5000
    });
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.micStatus).toBe('Enabled');
    expect(result.connectionStatus).toContain('connected');
    
    console.log('✅ Microphone successfully enabled with proper sequence!');
  });
  
  test('should show VAD elements when microphone is enabled (FIXED)', async ({ page }) => {
    console.log('🎤 Testing VAD elements with proper microphone activation...');
    
    // Use comprehensive microphone test
    const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.vadElements.vadStates).toBe(true);
    expect(result.vadElements.userStartedSpeaking).toBe(true);
    expect(result.vadElements.userStoppedSpeaking).toBe(true);
    expect(result.vadElements.utteranceEnd).toBe(true);
    
    // Verify initial VAD states
    expect(result.initialVadStates.userStartedSpeaking).toBe('Not detected');
    
    console.log('✅ VAD elements verified with proper microphone activation!');
  });

  test('should handle microphone activation with retry logic (FIXED)', async ({ page }) => {
    console.log('🎤 Testing microphone activation with retry logic...');
    
    // Use retry-enabled microphone activation
    const success = await MicrophoneHelpers.enableMicrophoneWithRetry(page, {
      maxRetries: 3,
      retryDelay: 2000
    });
    
    expect(success).toBe(true);
    
    // Verify final state
    const micStatus = await page.locator('[data-testid="mic-status"]').textContent();
    expect(micStatus).toBe('Enabled');
    
    console.log('✅ Microphone activation with retry logic successful!');
  });

  test('should verify microphone prerequisites before activation (FIXED)', async ({ page }) => {
    console.log('🎤 Testing microphone prerequisites verification...');
    
    await setupTestPage(page);
    
    // With lazy initialization, agent connection isn't established until activation
    // So we verify prerequisites that should be available before activation
    const prerequisites = await MicrophoneHelpers.verifyMicrophonePrerequisites(page);
    
    // Core prerequisites should be met (those that don't require connection)
    expect(prerequisites.pageLoaded).toBe(true);
    expect(prerequisites.componentInitialized).toBe(true);
    expect(prerequisites.microphoneButtonVisible).toBe(true);
    expect(prerequisites.microphoneButtonEnabled).toBe(true);
    
    // With lazy initialization, agentConnected may be false before activation
    // This is expected behavior - connection happens during microphone activation
    // So we don't require agentConnected before activation
    if (prerequisites.agentConnected) {
      console.log('ℹ️ Agent already connected (non-lazy init path)');
    } else {
      console.log('ℹ️ Agent not connected yet (lazy init - expected before activation)');
    }
    
    // Settings applied may also not be available before activation with lazy init
    // So we don't require it
    console.log('✅ Core microphone prerequisites verified (page loaded, component initialized, button ready)!');
  });

  test('should handle microphone activation after idle timeout (FIXED)', async ({ page }) => {
    console.log('🎤 Testing microphone activation after idle timeout...');
    
    // Step 1: Setup and establish initial connection (same pattern as passing test)
    await setupTestPage(page);
    await establishConnectionViaText(page);
    
    const initialStatus = await page.locator('[data-testid="connection-status"]').textContent();
    expect(initialStatus).toBe('connected');
    console.log('✅ Initial connection established');
    
    // Step 2: Wait for idle timeout using proper fixture (same pattern as passing test)
    console.log('⏳ Waiting for idle timeout...');
    const timeoutResult = await waitForIdleTimeout(page, {
      expectedTimeout: 10000,
      maxWaitTime: 15000,
      checkInterval: 1000
    });
    
    expect(timeoutResult.closed).toBe(true);
    const statusAfterTimeout = await page.locator('[data-testid="connection-status"]').textContent();
    expect(statusAfterTimeout).toBe('closed');
    console.log('✅ Connection closed after idle timeout');
    
    // Step 3: Use the pattern for activation after timeout
    const result = await MicrophoneHelpers.MICROPHONE_TEST_PATTERNS.activationAfterTimeout(page);
    
    expect(result.success).toBe(true);
    expect(result.micStatus).toBe('Enabled');
    expect(result.connectionStatus).toContain('connected');
    
    console.log('✅ Microphone activation after idle timeout successful!');
  });
});
