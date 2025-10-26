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
import { MicrophoneHelpers } from './helpers/test-helpers.js';

test.describe('Fixed Microphone Functionality Tests', () => {
  
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
    const result = await MicrophoneHelpers.testMicrophoneFunctionality(page);
    
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
    
    // Verify prerequisites without enabling microphone
    const prerequisites = await MicrophoneHelpers.verifyMicrophonePrerequisites(page);
    
    // All prerequisites should be met
    expect(prerequisites.allPrerequisitesMet).toBe(true);
    expect(prerequisites.pageLoaded).toBe(true);
    expect(prerequisites.componentInitialized).toBe(true);
    expect(prerequisites.agentConnected).toBe(true);
    expect(prerequisites.settingsApplied).toBe(true);
    expect(prerequisites.microphoneButtonVisible).toBe(true);
    expect(prerequisites.microphoneButtonEnabled).toBe(true);
    
    console.log('✅ All microphone prerequisites verified!');
  });

  test('should handle microphone activation after idle timeout (FIXED)', async ({ page }) => {
    console.log('🎤 Testing microphone activation after idle timeout...');
    
    // Use the pattern for activation after timeout
    const result = await MicrophoneHelpers.MICROPHONE_TEST_PATTERNS.activationAfterTimeout(page);
    
    expect(result.success).toBe(true);
    expect(result.micStatus).toBe('Enabled');
    
    console.log('✅ Microphone activation after idle timeout successful!');
  });
});
