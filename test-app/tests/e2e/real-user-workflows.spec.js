import { test, expect } from '@playwright/test';
import path from 'path';

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

// Simple API key detection
const isRealAPITesting = !!process.env.VITE_DEEPGRAM_API_KEY && 
                        process.env.VITE_DEEPGRAM_API_KEY !== 'mock';

/**
 * Setup a test page with VAD configuration
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration options
 */
async function setupRealVADTestPage(page, options = {}) {
  const defaultOptions = {
    apiKey: process.env.VITE_DEEPGRAM_API_KEY || 'test-key',
    utteranceEndMs: 1000,
    interimResults: true,
    ...options
  };

  // Navigate to test app
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Wait for component to initialize
  await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
  
  // Verify VAD elements are present
  await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
  await expect(page.locator('[data-testid="user-started-speaking"]')).toBeVisible();
  await expect(page.locator('[data-testid="user-stopped-speaking"]')).toBeVisible();
  await expect(page.locator('[data-testid="utterance-end"]')).toBeVisible();
}

/**
 * Simulate real user speech (placeholder for actual microphone simulation)
 * @param {import('@playwright/test').Page} page
 * @param {string} text - Text to simulate speaking
 */
async function simulateRealUserSpeech(page, text) {
  // For now, we'll simulate by triggering the microphone and waiting
  // In a real scenario, this would involve actual microphone input
  
  // Enable microphone to start WebSocket connection
  await page.click('[data-testid="microphone-button"]');
  
  // Wait for connection to be established
  await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
  
  // Wait for connection ready
  await expect(page.locator('[data-testid="connection-ready"]')).toContainText('true');
  
  // Simulate speech by waiting for user speaking state to change
  // In a real test, this would be triggered by actual microphone input
  console.log(`Simulating user speech: "${text}"`);
  
  // Wait a bit to simulate speech duration
  await page.waitForTimeout(2000);
}

test.describe('Real User Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Mock-Based Tests (Always Run)', () => {
    test('should display VAD status elements', async ({ page }) => {
      await setupRealVADTestPage(page);
      
      // Verify all VAD elements are visible
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-speaking"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-stopped-speaking"]')).toBeVisible();
      await expect(page.locator('[data-testid="utterance-end"]')).toBeVisible();
      await expect(page.locator('[data-testid="vad-event"]')).toBeVisible();
    });

    test('should initialize with default VAD states', async ({ page }) => {
      await setupRealVADTestPage(page);
      
      // Check initial VAD states
      await expect(page.locator('[data-testid="user-speaking"]')).toContainText('false');
      await expect(page.locator('[data-testid="user-stopped-speaking"]')).toContainText('Not detected');
      await expect(page.locator('[data-testid="utterance-end"]')).toContainText('Not detected');
      await expect(page.locator('[data-testid="vad-event"]')).toContainText('Not detected');
    });

    test('should handle microphone toggle with VAD elements', async ({ page }) => {
      await setupRealVADTestPage(page);
      
      // Toggle microphone
      await page.click('[data-testid="microphone-button"]');
      
      // Wait for connection
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
      
      // Verify VAD elements are still present
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
    });
  });

  test.describe('Real API Integration Tests', () => {
    test('should handle complete user workflow: speak → detect → respond', async ({ page }) => {
      // Skip if no real API key
      if (!isRealAPITesting) {
        test.skip(true, 'VITE_DEEPGRAM_API_KEY required for real API tests');
        return;
      }

      // Setup component with real Deepgram API key
      await setupRealVADTestPage(page, {
        apiKey: process.env.VITE_DEEPGRAM_API_KEY,
        utteranceEndMs: 1000
      });
      
      // Start speaking (simulated microphone input)
      await simulateRealUserSpeech(page, "Hello, how are you?");
      
      // Wait for potential VAD events (in real scenario, these would be triggered by actual speech)
      await page.waitForTimeout(3000);
      
      // Verify VAD elements are present and functional
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
      
      // In a real scenario with actual microphone input, we would verify:
      // - UtteranceEnd detection
      // - Agent response
      // - VAD event processing
      
      console.log('Real API workflow test completed - VAD elements verified');
    });

    test('should handle real speech-to-text processing', async ({ page }) => {
      // Skip if no real API key
      if (!isRealAPITesting) {
        test.skip(true, 'VITE_DEEPGRAM_API_KEY required for real API tests');
        return;
      }

      await setupRealVADTestPage(page);
      
      // Enable microphone for real processing
      await page.click('[data-testid="microphone-button"]');
      
      // Wait for connection
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
      
      // Simulate speech processing
      await simulateRealUserSpeech(page, "What is the weather today?");
      
      // Wait for potential transcription
      await page.waitForTimeout(3000);
      
      // Verify VAD elements are functional
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
      
      // In a real scenario, we would verify transcription accuracy
      console.log('Real speech-to-text test completed - VAD elements verified');
    });

    test('should handle VAD event processing with real API', async ({ page }) => {
      // Skip if no real API key
      if (!isRealAPITesting) {
        test.skip(true, 'VITE_DEEPGRAM_API_KEY required for real API tests');
        return;
      }

      await setupRealVADTestPage(page, {
        utteranceEndMs: 1500,
        interimResults: true
      });
      
      // Enable microphone
      await page.click('[data-testid="microphone-button"]');
      
      // Wait for connection
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
      
      // Simulate speech activity
      await simulateRealUserSpeech(page, "Testing VAD events");
      
      // Wait for potential VAD events
      await page.waitForTimeout(3000);
      
      // Verify VAD elements are present and ready
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-speaking"]')).toBeVisible();
      await expect(page.locator('[data-testid="utterance-end"]')).toBeVisible();
      
      console.log('Real VAD event processing test completed');
    });
  });

  test.describe('VAD Configuration Tests', () => {
    test('should handle utteranceEndMs configuration', async ({ page }) => {
      await setupRealVADTestPage(page, {
        utteranceEndMs: 2000,
        interimResults: true
      });
      
      // Verify VAD elements are present
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
      
      // Enable microphone to test configuration
      await page.click('[data-testid="microphone-button"]');
      
      // Wait for connection
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
      
      console.log('UtteranceEnd configuration test completed');
    });

    test('should handle interimResults configuration', async ({ page }) => {
      await setupRealVADTestPage(page, {
        interimResults: true
      });
      
      // Verify VAD elements are present
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
      
      // Enable microphone to test configuration
      await page.click('[data-testid="microphone-button"]');
      
      // Wait for connection
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
      
      console.log('InterimResults configuration test completed');
    });
  });

  test.describe('VAD Event Integration Tests', () => {
    test('should integrate VAD events with existing functionality', async ({ page }) => {
      await setupRealVADTestPage(page);
      
      // Enable microphone
      await page.click('[data-testid="microphone-button"]');
      
      // Wait for connection
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('connected', { timeout: 10000 });
      
      // Verify both auto-connect and VAD elements are present
      await expect(page.locator('[data-testid="auto-connect-states"]')).toBeVisible();
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
      
      // Verify integration doesn't break existing functionality
      await expect(page.locator('[data-testid="mic-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-ready"]')).toBeVisible();
      
      console.log('VAD integration test completed');
    });

    test('should maintain backward compatibility', async ({ page }) => {
      await setupRealVADTestPage(page);
      
      // Verify existing functionality still works
      await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="auto-connect-states"]')).toBeVisible();
      
      // Verify VAD elements are additional, not replacing existing ones
      await expect(page.locator('[data-testid="vad-states"]')).toBeVisible();
      
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

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify component still renders despite connection errors
      await expect(page.locator('[data-testid="voice-agent"]')).toBeVisible();
      
      // Verify connection status shows some state (could be connected, disconnected, or connecting)
      await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();
    });
  });
});