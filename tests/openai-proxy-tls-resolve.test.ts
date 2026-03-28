/**
 * EPIC-546: OpenAI proxy TLS resolution (PEM vs explicit dev self-signed vs HTTP).
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  resolveOpenAIProxyListenTls,
  type FsSync,
} from '../packages/voice-agent-backend/scripts/openai-proxy/resolve-proxy-tls';

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = { ...process.env };
  delete base.OPENAI_PROXY_TLS_KEY_PATH;
  delete base.OPENAI_PROXY_TLS_CERT_PATH;
  delete base.OPENAI_PROXY_INSECURE_DEV_TLS;
  delete base.NODE_ENV;
  return { ...base, ...overrides };
}

describe('resolveOpenAIProxyListenTls (EPIC-546)', () => {
  it('returns http when no TLS env set', () => {
    const r = resolveOpenAIProxyListenTls(env({}));
    expect(r).toEqual({ ok: true, mode: 'http' });
  });

  it('returns https-insecure-selfsigned when OPENAI_PROXY_INSECURE_DEV_TLS=1 and not production', () => {
    const r = resolveOpenAIProxyListenTls(env({ OPENAI_PROXY_INSECURE_DEV_TLS: '1', NODE_ENV: 'development' }));
    expect(r).toEqual({ ok: true, mode: 'https-insecure-selfsigned' });
  });

  it('accepts OPENAI_PROXY_INSECURE_DEV_TLS=true', () => {
    const r = resolveOpenAIProxyListenTls(env({ OPENAI_PROXY_INSECURE_DEV_TLS: 'true' }));
    expect(r).toEqual({ ok: true, mode: 'https-insecure-selfsigned' });
  });

  it('fails when OPENAI_PROXY_INSECURE_DEV_TLS in production', () => {
    const r = resolveOpenAIProxyListenTls(
      env({ OPENAI_PROXY_INSECURE_DEV_TLS: '1', NODE_ENV: 'production' })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.exitMessage).toMatch(/NODE_ENV=production/);
    }
  });

  it('fails when only one PEM path is set', () => {
    const r = resolveOpenAIProxyListenTls(env({ OPENAI_PROXY_TLS_KEY_PATH: '/a' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.exitMessage).toMatch(/both OPENAI_PROXY_TLS/);
    }
  });

  it('returns https-pem when both PEM files exist', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-tls-'));
    const keyPath = path.join(dir, 'key.pem');
    const certPath = path.join(dir, 'cert.pem');
    fs.writeFileSync(keyPath, 'KEY');
    fs.writeFileSync(certPath, 'CERT');
    try {
      const r = resolveOpenAIProxyListenTls(
        env({ OPENAI_PROXY_TLS_KEY_PATH: keyPath, OPENAI_PROXY_TLS_CERT_PATH: certPath })
      );
      expect(r.ok).toBe(true);
      if (r.ok && r.mode === 'https-pem') {
        expect(r.key.toString()).toBe('KEY');
        expect(r.cert.toString()).toBe('CERT');
      } else {
        throw new Error('expected https-pem');
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when PEM path missing on disk', () => {
    const r = resolveOpenAIProxyListenTls(
      env({
        OPENAI_PROXY_TLS_KEY_PATH: '/nonexistent/key.pem',
        OPENAI_PROXY_TLS_CERT_PATH: '/nonexistent/cert.pem',
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.exitMessage).toMatch(/file not found/);
    }
  });

  it('prefers PEM over insecure flag when both set', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-tls-'));
    const keyPath = path.join(dir, 'k.pem');
    const certPath = path.join(dir, 'c.pem');
    fs.writeFileSync(keyPath, 'k');
    fs.writeFileSync(certPath, 'c');
    try {
      const r = resolveOpenAIProxyListenTls(
        env({
          OPENAI_PROXY_TLS_KEY_PATH: keyPath,
          OPENAI_PROXY_TLS_CERT_PATH: certPath,
          OPENAI_PROXY_INSECURE_DEV_TLS: '1',
        })
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.mode).toBe('https-pem');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses injected fs for unit isolation', () => {
    const mockFs: FsSync = {
      existsSync: (p: string) => p === '/x/key.pem' || p === '/x/cert.pem',
      readFileSync: (p: string) => (p === '/x/key.pem' ? Buffer.from('K') : Buffer.from('C')),
    };
    const r = resolveOpenAIProxyListenTls(
      env({ OPENAI_PROXY_TLS_KEY_PATH: '/x/key.pem', OPENAI_PROXY_TLS_CERT_PATH: '/x/cert.pem' }),
      mockFs
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.mode === 'https-pem') {
      expect(r.key.toString()).toBe('K');
      expect(r.cert.toString()).toBe('C');
    }
  });
});
