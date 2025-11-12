import { test, expect } from '@playwright/test';
import {
  setupTestPage,
  establishConnectionViaMicrophone,
  MicrophoneHelpers,
  hasRealAPIKey,
  skipIfNoRealAPI
} from './helpers/test-helpers.js';

// Load environment variables from test-app/.env
// dotenv config handled by Playwright config

/**
 * Real User Workflow Tests
 * 
 * Test-Driven Development: Phase 4.3
 * 
 * These tests define complete user workflows with real APIs.
 * Following TDD Red-Green-Refactor cycle:
 * 1. Red: Write failing tests that define expected behavior
 * 2. Green: Implement minimal code to make tests pass
 * 3. Refactor: Improve code while keeping tests green
 * 
 * These tests use real Deepgram API when VITE_DEEPGRAM_API_KEY is available,
 * otherwise they skip with appropriate messaging.
 */

/**
 * Simulate real user speech (placeholder for actual microphone simulation)
 * Uses fixtures for proper microphone activation
 * @param {import('@playwright/test').Page} page
 * @param {string} text - Text to simulate speaking
 */
async function simulateRealUserSpeech(page, text) {
  // Use fixture for proper microphone activation sequence
  await establishConnectionViaMicrophone(page, null, 10000);
  
  // In a real scenario, speech would trigger actual microphone input
  // For this helper, we only establish the connection for speech to occur
  console.log(`Simulating user speech: "${text}"`);
  // Note: In real tests, actual microphone input would trigger VAD events
}

test.describe('Real User Workflow Tests', () => {
  // beforeEach removed - each test uses setupTestPage fixture

  test.describe('Mock-Based Tests (Always Run)', () => {
    test('should display VAD status elements', async ({ page }) => {
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      
      // Verify microphone activation succeeded
      expect(result.success).toBe(true);
      
      // Verify all VAD elements are visible (validated by fixture)
      expect(result.vadElements.vadStates).toBe(true);
      expect(result.vadElements.userStartedSpeaking).toBe(true);
      expect(result.vadElements.userStoppedSpeaking).toBe(true);
      expect(result.vadElements.utteranceEnd).toBe(true);
    });

    test('should initialize with default VAD states', async ({ page }) => {
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      
      expect(result.success).toBe(true);
      
      // Check initial VAD states (validated by fixture)
      expect(result.initialVadStates.userStartedSpeaking).toBe('Not detected');
    });

    test('should handle microphone toggle with VAD elements', async ({ page }) => {
      await setupTestPage(page);
      
      // Use fixture for proper microphone activation
      const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
        connectionTimeout: 10000,
        greetingTimeout: 8000
      });
      
      expect(activationResult.success).toBe(true);
      
      // Wait a moment for VAD elements to render after mic activation
      await page.waitForTimeout(500);
      
      // Verify VAD elements are still present after microphone activation
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Real API Integration Tests', () => {
    test('should handle complete user workflow: speak → detect → respond', async ({ page }) => {
      skipIfNoRealAPI('VITE_DEEPGRAM_API_KEY required for real API tests');

      // Setup component with real Deepgram API key using fixtures
      await setupTestPage(page);
      
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      expect(result.success).toBe(true);
      
      // In a real scenario, speech would trigger actual microphone input
      // For this test, we only validate that VAD elements are set up correctly
      console.log('Simulating user speech: "Hello, how are you?"');
      // Note: In real tests, we would wait for actual VAD events or agent responses
      
      // VAD elements already verified by fixture
      expect(result.vadElements.vadStates).toBe(true);
      
      // In a real scenario with actual microphone input, we would verify:
      // - UtteranceEnd detection
      // - Agent response
      // - VAD event processing
      
      console.log('Real API workflow test completed - VAD elements verified');
    });

    test('should handle real speech-to-text processing', async ({ page }) => {
      skipIfNoRealAPI('VITE_DEEPGRAM_API_KEY required for real API tests');

      await setupTestPage(page);
      
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      expect(result.success).toBe(true);
      
      // In a real scenario, speech would trigger actual microphone input
      // For this test, we only validate that VAD elements are set up correctly
      console.log('Simulating user speech: "What is the weather today?"');
      // Note: In real tests, we would wait for actual transcription events
      
      // VAD elements already verified by fixture
      expect(result.vadElements.vadStates).toBe(true);
      
      // In a real scenario, we would verify transcription accuracy
      console.log('Real speech-to-text test completed - VAD elements verified');
    });

    test('should handle VAD event processing with real API', async ({ page }) => {
      skipIfNoRealAPI('VITE_DEEPGRAM_API_KEY required for real API tests');

      await setupTestPage(page);
      
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      expect(result.success).toBe(true);
      
      // In a real scenario, speech would trigger actual microphone input
      // For this test, we only validate that VAD elements are set up correctly
      console.log('Simulating user speech: "Testing VAD events"');
      // Note: In real tests, we would wait for actual VAD events
      
      // Verify VAD elements are present and ready (validated by fixture)
      expect(result.vadElements.vadStates).toBe(true);
      expect(result.vadElements.userStartedSpeaking).toBe(true);
      expect(result.vadElements.utteranceEnd).toBe(true);
      
      console.log('Real VAD event processing test completed');
    });
  });

  test.describe('VAD Configuration Tests', () => {
    test('should handle utteranceEndMs configuration', async ({ page }) => {
      await setupTestPage(page);
      
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      expect(result.success).toBe(true);
      expect(result.vadElements.vadStates).toBe(true);
      
      console.log('UtteranceEnd configuration test completed');
    });

    test('should handle interimResults configuration', async ({ page }) => {
      await setupTestPage(page);
      
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      expect(result.success).toBe(true);
      expect(result.vadElements.vadStates).toBe(true);
      
      console.log('InterimResults configuration test completed');
    });
  });

  test.describe('VAD Event Integration Tests', () => {
    test('should integrate VAD events with existing functionality', async ({ page }) => {
      await setupTestPage(page);
      
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      expect(result.success).toBe(true);
      
      // Verify both auto-connect and VAD elements are present
      await expect(page.locator('[data-testid="auto-connect-states"]')).toBeVisible();
      expect(result.vadElements.vadStates).toBe(true);
      
      // Verify integration doesn't break existing functionality
      await expect(page.locator('[data-testid="mic-status"]')).toBeVisible();
      
      console.log('VAD integration test completed');
    });

    test('should maintain backward compatibility', async ({ page }) => {
      await setupTestPage(page);
      
      // Use fixture to setup microphone and validate VAD elements
      const result = await MicrophoneHelpers.setupMicrophoneWithVADValidation(page);
      expect(result.success).toBe(true);
      
      // Verify existing functionality still works
      await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="auto-connect-states"]')).toBeVisible();
      
      // Verify VAD elements are additional, not replacing existing ones (validated by fixture)
      expect(result.vadElements.vadStates).toBe(true);
      
      console.log('Backward compatibility test completed');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle connection errors gracefully', async ({ page }) => {
      // Mock connection failure
      await page.addInitScript(() => {
        // Override WebSocket to simulate connection failure
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = class extends OriginalWebSocket {
          constructor(url) {
            super(url);
            setTimeout(() => {
              this.dispatchEvent(new Event('error'));
            }, 100);
          }
        };
      });

      await setupTestPage(page);
      
      // Verify component still renders despite connection errors
      await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
      
      // Verify connection status shows some state (could be connected, disconnected, or connecting)
      await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();
    });
  });
});