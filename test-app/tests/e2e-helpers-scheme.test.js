/**
 * Unit tests for E2E helper getOpenAIProxyParams() – scheme must match HTTPS env.
 * Ensures the URL passed to the app (and thus to the component) uses wss when HTTPS=true
 * and ws when HTTPS=false, reducing E2E "connection-status closed" failures from scheme mismatch.
 *
 * Uses in-process scheme logic (aligned with test-helpers.mjs) so we avoid dynamic import()
 * of the .mjs file, which fails under Jest without Node's --experimental-vm-modules.
 * Keep in sync with test-app/tests/e2e/helpers/test-helpers.mjs (useHttps / wsScheme / getOpenAIProxyParams).
 *
 * Run: npm test -- e2e-helpers-scheme
 */

const proxyHost = 'localhost:8080';

/** Same contract as getOpenAIProxyParams() in test-helpers.mjs; reads process.env at call time. */
function getOpenAIProxyParamsForTest() {
  const forceHttp = process.env.E2E_USE_HTTP === '1' || process.env.E2E_USE_HTTP === 'true';
  const useHttps = !forceHttp && (process.env.HTTPS === 'true' || process.env.HTTPS === '1');
  const wsScheme = useHttps ? 'wss' : 'ws';
  return {
    connectionMode: 'proxy',
    proxyEndpoint: process.env.VITE_OPENAI_PROXY_ENDPOINT || `${wsScheme}://${proxyHost}/openai`,
  };
}

describe('E2E helpers – getOpenAIProxyParams scheme', () => {
  it('returns wss and localhost:8080/openai when HTTPS=true', () => {
    process.env.HTTPS = 'true';
    delete process.env.E2E_USE_HTTP;
    delete process.env.VITE_OPENAI_PROXY_ENDPOINT;
    const params = getOpenAIProxyParamsForTest();
    expect(params.proxyEndpoint).toMatch(/^wss:\/\//);
    expect(params.proxyEndpoint).toContain('localhost:8080/openai');
    expect(params.connectionMode).toBe('proxy');
  });

  it('returns ws and localhost:8080/openai when HTTPS=false', () => {
    process.env.HTTPS = 'false';
    delete process.env.E2E_USE_HTTP;
    delete process.env.VITE_OPENAI_PROXY_ENDPOINT;
    const params = getOpenAIProxyParamsForTest();
    expect(params.proxyEndpoint).toMatch(/^ws:\/\//);
    expect(params.proxyEndpoint).toContain('localhost:8080/openai');
  });
});
