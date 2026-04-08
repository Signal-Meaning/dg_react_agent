/**
 * Single source of truth for E2E skip policy: which env key values count as "real" vs placeholder/mock.
 * CommonJS so Jest can require(); ESM consumers import this `.cjs` file.
 */

/** Deepgram VITE key values treated as non-real for `hasRealAPIKey` / backend checks. */
const E2E_DEEPGRAM_KEY_REJECT_EXACT = Object.freeze([
  'mock',
  'your-deepgram-api-key-here',
  'your_actual_deepgram_api_key_here',
]);

/** Keys starting with this prefix are rejected (test harness / fake keys). */
const E2E_DEEPGRAM_KEY_REJECT_PREFIX = 'test-';

const E2E_DEEPGRAM_KEY_MIN_LENGTH = 20;

/** OpenAI env key placeholder (docs / template). */
const E2E_OPENAI_KEY_REJECT_EXACT = 'your-openai-api-key-here';

/** OpenAI keys starting with this prefix are treated as non-real (local test keys). */
const E2E_OPENAI_KEY_REJECT_PREFIX = 'sk-test';

const E2E_OPENAI_KEY_MIN_LENGTH = 10;

function isViteDeepgramKeyUsableForRealBackend(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  if (E2E_DEEPGRAM_KEY_REJECT_EXACT.includes(apiKey)) return false;
  if (apiKey.startsWith(E2E_DEEPGRAM_KEY_REJECT_PREFIX)) return false;
  if (apiKey.length < E2E_DEEPGRAM_KEY_MIN_LENGTH) return false;
  return true;
}

function hasRealAPIKeyFromEnv(e = process.env) {
  return isViteDeepgramKeyUsableForRealBackend(e.VITE_DEEPGRAM_API_KEY);
}

function isOpenAiEnvKeyUsableForDiagnostics(trimmed) {
  if (trimmed === E2E_OPENAI_KEY_REJECT_EXACT) return false;
  if (trimmed.startsWith(E2E_OPENAI_KEY_REJECT_PREFIX)) return false;
  return trimmed.length >= E2E_OPENAI_KEY_MIN_LENGTH;
}

function hasOpenAIKeyFromEnv(e = process.env) {
  const key = e.OPENAI_API_KEY || e.VITE_OPENAI_API_KEY;
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed === '') return false;
  return isOpenAiEnvKeyUsableForDiagnostics(trimmed);
}

function hasOpenAIProxyEndpointFromEnv(e = process.env) {
  const endpoint = e.VITE_OPENAI_PROXY_ENDPOINT;
  if (typeof endpoint === 'string' && endpoint.trim().length > 0) return true;
  if (e.USE_PROXY_MODE === 'true' || e.USE_PROXY_MODE === '1') {
    if (e.E2E_BACKEND === 'deepgram') return false;
    return true;
  }
  return false;
}

function hasRealBackendFromEnv(e = process.env) {
  if (isViteDeepgramKeyUsableForRealBackend(e.VITE_DEEPGRAM_API_KEY)) return true;
  if (!hasOpenAIProxyEndpointFromEnv(e)) return false;
  return true;
}

module.exports = {
  E2E_DEEPGRAM_KEY_REJECT_EXACT,
  E2E_DEEPGRAM_KEY_REJECT_PREFIX,
  E2E_DEEPGRAM_KEY_MIN_LENGTH,
  E2E_OPENAI_KEY_REJECT_EXACT,
  E2E_OPENAI_KEY_REJECT_PREFIX,
  E2E_OPENAI_KEY_MIN_LENGTH,
  isViteDeepgramKeyUsableForRealBackend,
  isOpenAiEnvKeyUsableForDiagnostics,
  hasRealAPIKeyFromEnv,
  hasOpenAIKeyFromEnv,
  hasOpenAIProxyEndpointFromEnv,
  hasRealBackendFromEnv,
};
