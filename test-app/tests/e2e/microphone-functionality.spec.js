import { test, expect } from '@playwright/test';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { setupTestPage } from './helpers/audio-mocks';

/**
 * Microphone Functionality Test
 * 
 * This test actually verifies that the microphone button enables recording
 * and that the microphone state changes correctly.
 */

test.describe('Microphone Functionality Tests', () => {
  test('should actually enable microphone when button is clicked', async ({ page }) => {
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
  
  test('should show VAD elements when microphone is enabled', async ({ page }) => {
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

});
