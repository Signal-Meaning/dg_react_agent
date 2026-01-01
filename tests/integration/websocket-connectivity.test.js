/**
 * @jest-environment node
 * 
 * WebSocket Connectivity Tests
 * 
 * These tests validate actual Deepgram API WebSocket connections.
 * Uses Node.js environment (not jsdom) to avoid WebSocket wrapper interference.
 * 
 * ⚠️ REQUIRES REAL API KEY: These tests make actual WebSocket connections to Deepgram.
 * - Skipped in CI (requires real API key, see .github/workflows/test-and-publish.yml)
 * - Run locally with DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY in test-app/.env
 * 
 * Best Practice: Test WebSocket connectivity separately from React component tests.
 * See docs/issues/ISSUE-341/JEST-WEBSOCKET-BEST-PRACTICES.md for details.
 */

const WebSocket = require('ws');
const path = require('path');
// Load from same location as standalone validation script (which works)
// IMPORTANT: Use override: true to override root .env loaded by tests/setup.js
// Root .env may have a different API key that causes 401 errors
require('dotenv').config({ 
  path: path.join(__dirname, '../../test-app/.env'),
  override: true // Override any values loaded from root .env by tests/setup.js
});

// Skip in CI or when RUN_REAL_API_TESTS is false (consistent with other real-API tests)
// Pattern matches: start-stop-methods.test.js, duplicate-settings.test.js
// Note: process.env values are strings, so 'false' is truthy - need explicit check
const shouldSkipInCI = process.env.CI === 'true' && 
                       (process.env.RUN_REAL_API_TESTS === 'false' || !process.env.RUN_REAL_API_TESTS);

// Get API key and clean it (trim whitespace/newlines)
const rawApiKey = process.env.DEEPGRAM_API_KEY || process.env.VITE_DEEPGRAM_API_KEY;
const apiKey = rawApiKey ? rawApiKey.trim() : null;
const url = 'wss://agent.deepgram.com/v1/agent/converse';

// Use consistent pattern with other real-API tests: (shouldSkipInCI ? describe.skip : describe)
(shouldSkipInCI ? describe.skip : describe)('Deepgram WebSocket Connectivity', () => {
  beforeAll(() => {
    if (shouldSkipInCI) {
      console.warn('⚠️  Skipping real API tests in CI (requires real API key)');
      return;
    }
    
    if (!apiKey) {
      console.warn('⚠️  DEEPGRAM_API_KEY not set - skipping real API tests');
      console.warn('   Set DEEPGRAM_API_KEY or VITE_DEEPGRAM_API_KEY in test-app/.env');
    } else {
      // Validate API key format
      if (apiKey.length < 20) {
        console.warn(`⚠️  API key appears invalid (length: ${apiKey.length}) - skipping real API tests`);
      } else {
        console.log(`✅ Using API key: ${apiKey.substring(0, 8)}...`);
        console.log(`   Key length: ${apiKey.length}`);
        // Debug: Check for hidden characters
        if (rawApiKey !== apiKey) {
          console.log(`   ⚠️  API key had whitespace (trimmed)`);
        }
      }
    }
  });

  describe('Connection Lifecycle', () => {
    it('should connect to Deepgram API successfully', async () => {
      if (shouldSkipInCI || !apiKey) {
        return; // Skip in CI or if no API key
      }

      // Include headers like the standalone validation script
      const ws = new WebSocket(url, ['token', apiKey], {
        headers: {
          'Origin': 'http://localhost:5173',
          'User-Agent': 'Node.js WebSocket Test (Jest)'
        }
      });

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve({ opened: true, closed: false });
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          if (code === 1005 || code === 1000) {
            // 1005 = No Status Code (we closed it manually)
            // 1000 = Normal Closure
            resolve({ opened: true, closed: true, code });
          } else {
            reject(new Error(`Unexpected close code: ${code}, reason: ${reason}`));
          }
        });
      });

      expect(result.opened).toBe(true);
      // Connection should open successfully
      // Close code 1005 is expected (we closed it manually)
    });

    it('should handle connection errors gracefully', async () => {
      if (shouldSkipInCI || !apiKey) {
        return; // Skip in CI or if no API key
      }

      // Test with invalid API key
      const invalidKey = 'invalid-key-12345';
      const ws = new WebSocket(url, ['token', invalidKey], {
        headers: {
          'Origin': 'http://localhost:5173',
          'User-Agent': 'Node.js WebSocket Test (Jest)'
        }
      });

      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ error: true, timeout: true });
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve({ opened: true, error: false });
        });

        ws.on('error', () => {
          clearTimeout(timeout);
          resolve({ error: true, opened: false });
        });

        ws.on('close', (code) => {
          clearTimeout(timeout);
          resolve({ error: code !== 1000 && code !== 1005, code, closed: true });
        });
      });

      // Should fail with invalid key
      expect(result.error || result.code !== 1000).toBe(true);
    });
  });

  describe('Protocol Handling', () => {
    it('should accept token protocol', async () => {
      if (shouldSkipInCI || !apiKey) {
        return; // Skip in CI or if no API key
      }

      // Include headers like the standalone validation script
      const ws = new WebSocket(url, ['token', apiKey], {
        headers: {
          'Origin': 'http://localhost:5173',
          'User-Agent': 'Node.js WebSocket Test (Jest)'
        }
      });

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          expect(ws.protocol).toBe('token');
          ws.close();
          resolve({ protocol: ws.protocol });
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        ws.on('close', () => {
          clearTimeout(timeout);
        });
      });

      expect(result.protocol).toBe('token');
    });
  });

  describe('Connection State', () => {
    it('should transition through connection states', async () => {
      if (shouldSkipInCI || !apiKey) {
        return; // Skip in CI or if no API key
      }

      // Include headers like the standalone validation script
      const ws = new WebSocket(url, ['token', apiKey], {
        headers: {
          'Origin': 'http://localhost:5173',
          'User-Agent': 'Node.js WebSocket Test (Jest)'
        }
      });
      const states = [];

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 10000);

        // Initial state should be CONNECTING
        states.push(ws.readyState); // Should be 0 (CONNECTING)

        ws.on('open', () => {
          states.push(ws.readyState); // Should be 1 (OPEN)
          clearTimeout(timeout);
          ws.close();
        });

        ws.on('close', () => {
          states.push(ws.readyState); // Should be 3 (CLOSED)
          clearTimeout(timeout);
          resolve({ states });
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Should transition: CONNECTING -> OPEN -> CLOSED
      expect(states).toContain(0); // CONNECTING
      expect(states).toContain(1); // OPEN
      expect(result.states).toContain(3); // CLOSED
    });
  });
});
