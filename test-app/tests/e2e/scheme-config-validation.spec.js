/**
 * E2E scheme config validation (Issue #383)
 *
 * Asserts that proxy endpoint scheme matches app scheme:
 * - When HTTPS=true, proxy defaults use wss (so browser can connect from https page).
 * - When HTTPS=false, proxy defaults use ws.
 *
 * Run with: HTTPS=true npm run test:e2e -- scheme-config-validation
 * Or: npm run test:e2e -- scheme-config-validation (checks ws when HTTP)
 */

import { test, expect } from '@playwright/test';

test.describe('Scheme config validation', () => {
  test('proxy endpoint scheme matches app scheme (wss when HTTPS, ws when HTTP)', async () => {
    const { getDeepgramProxyParams, getOpenAIProxyParams } = await import('./helpers/test-helpers.mjs');
    const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';
    const expectedScheme = useHttps ? 'wss' : 'ws';

    const dgEndpoint = getDeepgramProxyParams().proxyEndpoint;
    const openaiEndpoint = getOpenAIProxyParams().proxyEndpoint;

    expect(dgEndpoint.startsWith(expectedScheme), `Deepgram proxy endpoint should use ${expectedScheme} when HTTPS=${useHttps}, got: ${dgEndpoint}`).toBe(true);
    expect(openaiEndpoint.startsWith(expectedScheme), `OpenAI proxy endpoint should use ${expectedScheme} when HTTPS=${useHttps}, got: ${openaiEndpoint}`).toBe(true);
  });
});
