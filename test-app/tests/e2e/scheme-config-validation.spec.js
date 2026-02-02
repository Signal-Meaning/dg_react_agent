/**
 * E2E scheme config validation (Issue #383)
 *
 * Asserts that the proxy endpoint URL built by test helpers matches app scheme:
 * - When HTTPS=true, getDeepgramProxyParams() and getOpenAIProxyParams() use wss.
 * - When HTTPS=false, they use ws.
 *
 * This validates only the **test helper** side. The **proxy server** must be started
 * with the same HTTPS (e.g. HTTPS=true in test-app/.env when starting from test-app)
 * so it serves wss when the app is https. See test-app/tests/e2e/README.md
 * "Scheme best practices" and mock-proxy-server-integration.test.js
 * ("prints wss:// in startup when HTTPS=true").
 *
 * Run: HTTPS=true npm run test:e2e -- scheme-config-validation
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
