/**
 * Jest Setup File
 * 
 * This file runs before all tests and ensures that:
 * 1. CI environment forces mock mode (no real API calls)
 * 2. Console warnings are suppressed during tests
 * 3. Test environment is properly configured
 */

// Force mock mode in CI environment
if (process.env.CI === 'true') {
  console.log('🧪 CI Environment detected - forcing mock mode for all tests');
  process.env.NODE_ENV = 'test';
  process.env.DEEPGRAM_API_KEY = 'mock';
  process.env.VITE_DEEPGRAM_API_KEY = 'mock';
  process.env.RUN_REAL_API_TESTS = 'false';
}

// Suppress console warnings during tests to reduce noise
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress specific warnings that are expected in test environment
  console.warn = (...args) => {
    const message = args[0];
    if (typeof message === 'string') {
      // Suppress AudioWorklet warnings (expected in test environment)
      if (message.includes('AudioWorklet') || 
          message.includes('Failed to initialize audio') ||
          message.includes('not supported in this environment')) {
        return;
      }
    }
    originalConsoleWarn.apply(console, args);
  };

  console.error = (...args) => {
    const message = args[0];
    if (typeof message === 'string') {
      // Suppress AudioWorklet errors (expected in test environment)
      if (message.includes('AudioWorklet') || 
          message.includes('Failed to initialize audio') ||
          message.includes('not supported in this environment')) {
        return;
      }
    }
    originalConsoleError.apply(console, args);
  };
});

afterAll(() => {
  // Restore original console methods
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});
