// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

// Debug: Log the baseURL being used
console.log('Playwright baseURL:', process.env.VITE_BASE_URL || 'http://localhost:5173');
const ENABLE_AUDIO = process.env.PW_ENABLE_AUDIO === 'true';
console.log('PW_ENABLE_AUDIO:', ENABLE_AUDIO);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: '../playwright-report' }],
    ['json', { outputFile: '../test-results/results.json' }],
    ['junit', { outputFile: '../test-results/results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.VITE_BASE_URL || 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Record video on failure - disabled by default */
    video: 'off',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Grant microphone permissions automatically for VAD tests */
    permissions: ['microphone'],
    
    /* Mute microphone for automated tests to prevent ambient noise interference */
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        // Only mute/disable audio when PW_ENABLE_AUDIO is not explicitly enabled
        ...(!ENABLE_AUDIO ? ['--disable-audio-output', '--mute-audio'] : [])
      ]
    },
    
    /* Provide fake media streams for consistent testing */
    // Note: We'll handle fake media streams in individual tests as needed
  },

  /* Configure projects for major browsers */
  /* In CI, only Chromium is used to reduce setup time and dependencies */
  projects: process.env.CI ? [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ] : [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /* Add more browsers locally if needed */
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    cwd: '..', // Go up one level from tests/ to test-app/ directory
    url: 'http://localhost:5173', // Vite default port
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  /* 
   * IMPORTANT: E2E Tests Require Real Deepgram API Key
   * 
   * These tests use REAL Deepgram WebSocket connections, not mocks.
   * This provides authentic integration testing but requires a valid API key.
   * 
   * Required Environment Variables (in test-app/.env):
   * - VITE_DEEPGRAM_API_KEY: Your real Deepgram API key
   * - VITE_DEEPGRAM_PROJECT_ID: Your Deepgram project ID
   * 
   * Why Real API Key Instead of Mocks:
   * - Authentic testing of WebSocket connections
   * - Real component state management (onReady, connection states)
   * - No complex mock maintenance (saves 13-19 hours of development)
   * - Catches actual integration issues
   * 
   * If you need to run tests without a real API key, consider:
   * 1. Using unit tests with mocks instead
   * 2. Setting up a test Deepgram account with free credits
   * 3. Using the existing Jest tests in tests/ directory
   */
});
