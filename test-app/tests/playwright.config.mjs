// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load test-app/.env so HTTPS and proxy settings are available regardless of cwd
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Respect HTTPS=true from .env (Vite and proxy serve https/wss when HTTPS=true)
const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';
// When HTTPS=true, baseURL must be https so webServer readiness and tests hit the right URL
const baseURL = useHttps
  ? (process.env.VITE_BASE_URL?.startsWith('https') ? process.env.VITE_BASE_URL : 'https://localhost:5173')
  : (process.env.VITE_BASE_URL || 'http://localhost:5173');
const wsScheme = useHttps ? 'wss' : 'ws';
const proxyBase = `${wsScheme}://localhost:8080`;
console.log('Playwright baseURL:', baseURL);
console.log('Playwright HTTPS:', useHttps, '| proxy endpoints:', `${proxyBase}/deepgram-proxy`, `${proxyBase}/openai`);
if (useHttps) {
  console.log('Tip: If you see "Port 5173 is already in use", start the dev server and proxy manually in two terminals, then run with E2E_USE_EXISTING_SERVER=1');
}
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
  /* Increase timeout for full test runs where API may be slower */
  timeout: 60000, // 60 seconds default timeout (increased from 30s)
  expect: {
    /* Increase assertion timeout for slower API responses in full test runs */
    timeout: 10000, // 10 seconds for assertions
  },
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
    ['json', { outputFile: '../test-results/results.json' }],
    ['junit', { outputFile: '../test-results/results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. Respects HTTPS=true. */
    baseURL,
    /* Accept self-signed cert when HTTPS=true (Vite and proxy use self-signed) */
    ...(useHttps && { ignoreHTTPSErrors: true }),

    /* Add delay between tests to reduce resource contention in full test runs */
    /* This helps when running all tests together where API may be slower */
    actionTimeout: 30000, // 30 seconds for actions

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

  /* Run your local dev server (and optionally proxy) before starting the tests.
   * When you run the server in advance (outside Playwright), set E2E_USE_EXISTING_SERVER=1
   * or USE_PROXY_MODE=true so Playwright does not start webServer; globalSetup verifies the app is reachable. */
  ...(process.env.E2E_USE_EXISTING_SERVER === '1' ||
    process.env.E2E_USE_EXISTING_SERVER === 'true' ||
    process.env.USE_PROXY_MODE === 'true' ||
    process.env.USE_PROXY_MODE === '1'
    ? { globalSetup: './e2e-check-existing-server.mjs' }
    : {
        webServer: [
          {
            command: 'npm run dev',
            cwd: '.',
            url: baseURL,
            reuseExistingServer: true,
            timeout: 120 * 1000,
            ...(useHttps && { ignoreHTTPSErrors: true }),
            stdout: process.env.CI ? 'pipe' : 'ignore',
            stderr: 'pipe', // always show so "Port 5173 is already in use" etc. is visible without CI=1
            env: {
              ...process.env,
              HTTPS: useHttps ? 'true' : 'false',
              VITE_DEEPGRAM_API_KEY: process.env.VITE_DEEPGRAM_API_KEY || '',
              VITE_DEEPGRAM_PROJECT_ID: process.env.VITE_DEEPGRAM_PROJECT_ID || '',
              VITE_BASE_URL: process.env.VITE_BASE_URL || baseURL,
              VITE_DEEPGRAM_PROXY_ENDPOINT: process.env.VITE_DEEPGRAM_PROXY_ENDPOINT || `${proxyBase}/deepgram-proxy`,
              VITE_OPENAI_PROXY_ENDPOINT: process.env.VITE_OPENAI_PROXY_ENDPOINT || `${proxyBase}/openai`,
            },
          },
          {
            command: 'npm run test:proxy:server',
            cwd: '.',
            port: 8080,
            reuseExistingServer: true,
            timeout: 10000,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
              ...process.env,
              HTTPS: useHttps ? 'true' : 'false',
              DEEPGRAM_API_KEY: process.env.VITE_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY || '',
              VITE_DEEPGRAM_API_KEY: process.env.VITE_DEEPGRAM_API_KEY || '',
              PROXY_PORT: '8080',
              PROXY_PATH: '/deepgram-proxy',
            },
          },
        ],
      }),

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
