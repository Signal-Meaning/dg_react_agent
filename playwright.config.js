// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Load environment variables from .env file
require('dotenv').config();

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
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
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',

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
        '--disable-audio-output',
        '--mute-audio'
      ]
    },
    
    /* Provide fake media streams for consistent testing */
    // Note: We'll handle fake media streams in individual tests as needed
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Mobile Chrome tests disabled due to pointer events issues */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    cwd: './test-app',
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
