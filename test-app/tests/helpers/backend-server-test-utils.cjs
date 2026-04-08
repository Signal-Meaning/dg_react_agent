/**
 * Shared helpers + fixtures for `backend-server.js` integration tests (Jest, no Playwright).
 */

const http = require('http');

/** Meets backend length check for synthetic Deepgram keys in tests (40+ chars). */
const SYNTHETIC_DEEPGRAM_API_KEY = 'test-key-at-least-40-characters-long-for-deepgram';

/** Synthetic OpenAI key for “server starts” probes (not a real API call). */
const SYNTHETIC_OPENAI_API_KEY = 'sk-test-openai-key';

/**
 * @param {number} port
 * @param {string} pathname
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
function httpGetJson(port, pathname) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}${pathname}`, (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c.toString();
        });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Poll until GET /health returns 200 and `{ status: 'ok' }` or timeout.
 * @param {number} port
 * @param {number} timeoutMs
 */
async function waitForBackendHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (Date.now() > deadline) {
      throw new Error(`timeout waiting for GET /health on port ${port}`);
    }
    try {
      const r = await httpGetJson(port, '/health');
      if (r.statusCode === 200 && r.body && r.body.status === 'ok') {
        return;
      }
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * Env base for spawning `backend-server.js` with dotenv disabled and keys cleared; merge overrides.
 * @param {Record<string, string>} [overrides]
 */
function backendServerTestEnv(overrides = {}) {
  return {
    ...process.env,
    SKIP_DOTENV: '1',
    DEEPGRAM_API_KEY: '',
    VITE_DEEPGRAM_API_KEY: '',
    OPENAI_API_KEY: '',
    VITE_OPENAI_API_KEY: '',
    ...overrides,
  };
}

module.exports = {
  SYNTHETIC_DEEPGRAM_API_KEY,
  SYNTHETIC_OPENAI_API_KEY,
  httpGetJson,
  waitForBackendHealth,
  backendServerTestEnv,
};
