/**
 * EPIC-546 / #549–#551: OpenAI proxy TLS mode resolution (no generic HTTPS inheritance).
 *
 * @jest-environment node
 */

import { resolveOpenAIProxyListenMode } from '../packages/voice-agent-backend/scripts/openai-proxy/listen-tls';

describe('resolveOpenAIProxyListenMode (EPIC-546)', () => {
  const base = (): NodeJS.ProcessEnv => ({});

  it('returns http when no TLS env is set', () => {
    expect(resolveOpenAIProxyListenMode(base())).toEqual({ kind: 'http' });
  });

  it('returns http when only legacy HTTPS=1 is set (does not inherit host HTTPS)', () => {
    expect(resolveOpenAIProxyListenMode({ ...base(), HTTPS: '1' })).toEqual({ kind: 'http' });
    expect(resolveOpenAIProxyListenMode({ ...base(), HTTPS: 'true' })).toEqual({ kind: 'http' });
  });

  it('returns insecureDevSelfSigned when OPENAI_PROXY_INSECURE_DEV_TLS=1', () => {
    expect(resolveOpenAIProxyListenMode({ ...base(), OPENAI_PROXY_INSECURE_DEV_TLS: '1' })).toEqual({
      kind: 'insecureDevSelfSigned',
    });
    expect(
      resolveOpenAIProxyListenMode({ ...base(), OPENAI_PROXY_INSECURE_DEV_TLS: 'true' })
    ).toEqual({ kind: 'insecureDevSelfSigned' });
  });

  it('returns pem when both TLS path env vars are set', () => {
    expect(
      resolveOpenAIProxyListenMode({
        ...base(),
        OPENAI_PROXY_TLS_KEY_PATH: '/tmp/key.pem',
        OPENAI_PROXY_TLS_CERT_PATH: '/tmp/cert.pem',
      })
    ).toEqual({
      kind: 'pem',
      keyPath: '/tmp/key.pem',
      certPath: '/tmp/cert.pem',
    });
  });

  it('trims whitespace on PEM paths', () => {
    expect(
      resolveOpenAIProxyListenMode({
        ...base(),
        OPENAI_PROXY_TLS_KEY_PATH: '  /k  ',
        OPENAI_PROXY_TLS_CERT_PATH: '  /c  ',
      })
    ).toEqual({ kind: 'pem', keyPath: '/k', certPath: '/c' });
  });

  it('returns fatal when only one PEM path is set', () => {
    const a = resolveOpenAIProxyListenMode({ ...base(), OPENAI_PROXY_TLS_KEY_PATH: '/k' });
    expect(a.kind).toBe('fatal');
    if (a.kind === 'fatal') expect(a.message).toMatch(/both/i);

    const b = resolveOpenAIProxyListenMode({ ...base(), OPENAI_PROXY_TLS_CERT_PATH: '/c' });
    expect(b.kind).toBe('fatal');
  });

  it('returns fatal when OPENAI_PROXY_INSECURE_DEV_TLS is set in production', () => {
    const r = resolveOpenAIProxyListenMode({
      ...base(),
      NODE_ENV: 'production',
      OPENAI_PROXY_INSECURE_DEV_TLS: '1',
    });
    expect(r.kind).toBe('fatal');
    if (r.kind === 'fatal') expect(r.message).toMatch(/production/i);
  });

  it('PEM mode wins over insecure dev when both are set', () => {
    expect(
      resolveOpenAIProxyListenMode({
        ...base(),
        OPENAI_PROXY_TLS_KEY_PATH: '/k',
        OPENAI_PROXY_TLS_CERT_PATH: '/c',
        OPENAI_PROXY_INSECURE_DEV_TLS: '1',
      })
    ).toEqual({ kind: 'pem', keyPath: '/k', certPath: '/c' });
  });
});
