/**
 * Unit tests for E2E helper getOpenAIProxyParams() – scheme must match HTTPS env.
 * Ensures the URL passed to the app (and thus to the component) uses wss when HTTPS=true
 * and ws when HTTPS=false, reducing E2E "connection-status closed" failures from scheme mismatch.
 *
 * Run: npm test -- e2e-helpers-scheme
 */

describe('E2E helpers – getOpenAIProxyParams scheme', () => {
  it('returns wss and localhost:8080/openai when HTTPS=true', async () => {
    process.env.HTTPS = 'true';
    const { getOpenAIProxyParams } = await import('./e2e/helpers/test-helpers.mjs');
    const params = getOpenAIProxyParams();
    expect(params.proxyEndpoint).toMatch(/^wss:\/\//);
    expect(params.proxyEndpoint).toContain('localhost:8080/openai');
    expect(params.connectionMode).toBe('proxy');
  });

  it('returns ws and localhost:8080/openai when HTTPS=false', async () => {
    jest.resetModules();
    process.env.HTTPS = 'false';
    const { getOpenAIProxyParams } = await import('./e2e/helpers/test-helpers.mjs');
    const params = getOpenAIProxyParams();
    expect(params.proxyEndpoint).toMatch(/^ws:\/\//);
    expect(params.proxyEndpoint).toContain('localhost:8080/openai');
  });
});
