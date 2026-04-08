/**
 * OpenAI proxy + USE_REAL_APIS: Playwright must not require OPENAI_API_KEY / VITE_OPENAI_API_KEY
 * (keys belong in packages/voice-agent-backend/.env only).
 *
 * Policy implementation: `tests/e2e/helpers/e2e-skip-env-policy.cjs`.
 */

const {
  hasOpenAIKeyFromEnv,
  hasRealBackendFromEnv,
  hasRealAPIKeyFromEnv,
  E2E_DEEPGRAM_KEY_REJECT_EXACT,
  E2E_DEEPGRAM_KEY_REJECT_PREFIX,
} = require('./e2e/helpers/e2e-skip-env-policy.cjs');

describe('E2E skip policy — OpenAI key backend-only', () => {
  it('hasRealBackendFromEnv true with USE_PROXY_MODE + USE_REAL_APIS and no OpenAI key (Deepgram key cleared)', () => {
    const env = {
      USE_PROXY_MODE: 'true',
      USE_REAL_APIS: '1',
    };
    expect(hasOpenAIKeyFromEnv(env)).toBe(false);
    expect(hasRealBackendFromEnv(env)).toBe(true);
  });

  it('hasRealAPIKeyFromEnv rejects placeholder Deepgram values from shared policy only', () => {
    for (const v of E2E_DEEPGRAM_KEY_REJECT_EXACT) {
      expect(hasRealAPIKeyFromEnv({ VITE_DEEPGRAM_API_KEY: v })).toBe(false);
    }
    expect(
      hasRealAPIKeyFromEnv({ VITE_DEEPGRAM_API_KEY: `${E2E_DEEPGRAM_KEY_REJECT_PREFIX}anything` })
    ).toBe(false);
  });
});
