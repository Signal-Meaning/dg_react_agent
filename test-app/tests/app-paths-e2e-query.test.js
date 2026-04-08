/**
 * Keep in sync with test-app/tests/e2e/helpers/app-paths.mjs (defaultQueryForE2E + pathWithQuery).
 *
 * Run: npm test -- app-paths-e2e-query
 */

function defaultQueryForE2E() {
  if (process.env.USE_PROXY_MODE === 'false') {
    return { connectionMode: 'direct' };
  }
  return {};
}

function pathWithQuery(params = {}) {
  const merged = { ...defaultQueryForE2E(), ...params };
  const entries = Object.entries(merged).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '/';
  return '/' + '?' + new URLSearchParams(entries).toString();
}

describe('app-paths pathWithQuery (E2E direct mode)', () => {
  const origUseProxy = process.env.USE_PROXY_MODE;

  afterEach(() => {
    if (origUseProxy === undefined) delete process.env.USE_PROXY_MODE;
    else process.env.USE_PROXY_MODE = origUseProxy;
  });

  it('adds connectionMode=direct when USE_PROXY_MODE=false', () => {
    process.env.USE_PROXY_MODE = 'false';
    const q = pathWithQuery({ 'test-mode': 'true' });
    expect(q).toContain('connectionMode=direct');
    expect(q).toContain('test-mode=true');
  });

  it('caller connectionMode overrides default direct', () => {
    process.env.USE_PROXY_MODE = 'false';
    const q = pathWithQuery({ 'test-mode': 'true', connectionMode: 'proxy' });
    expect(q).toContain('connectionMode=proxy');
    expect(q).not.toContain('connectionMode=direct');
  });

  it('does not add connectionMode when USE_PROXY_MODE is not false', () => {
    delete process.env.USE_PROXY_MODE;
    const q = pathWithQuery({ 'test-mode': 'true' });
    expect(q).toBe('/?test-mode=true');
  });
});
