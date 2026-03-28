/**
 * EPIC-546: Resolve how the OpenAI proxy listen socket uses TLS (PEM paths, explicit dev self-signed, or HTTP).
 * Does not read generic HTTPS= — callers must set OPENAI_PROXY_INSECURE_DEV_TLS or PEM paths.
 */

import fs from 'fs';

export type ResolvedProxyListen =
  | { ok: true; mode: 'http' }
  | { ok: true; mode: 'https-pem'; key: Buffer; cert: Buffer }
  | { ok: true; mode: 'https-insecure-selfsigned' }
  | { ok: false; exitMessage: string };

export type FsSync = Pick<typeof fs, 'readFileSync' | 'existsSync'>;

/**
 * Pure resolution from env + fs (inject fs for tests).
 */
export function resolveOpenAIProxyListenTls(
  env: NodeJS.ProcessEnv,
  fsSync: FsSync = fs
): ResolvedProxyListen {
  const isProduction = env.NODE_ENV === 'production';
  const keyPath = (env.OPENAI_PROXY_TLS_KEY_PATH || '').trim();
  const certPath = (env.OPENAI_PROXY_TLS_CERT_PATH || '').trim();
  const insecureFlag =
    env.OPENAI_PROXY_INSECURE_DEV_TLS === '1' || env.OPENAI_PROXY_INSECURE_DEV_TLS === 'true';

  if (keyPath || certPath) {
    if (!keyPath || !certPath) {
      return {
        ok: false,
        exitMessage:
          'Set both OPENAI_PROXY_TLS_KEY_PATH and OPENAI_PROXY_TLS_CERT_PATH for PEM TLS, or neither for HTTP / dev self-signed.',
      };
    }
    if (!fsSync.existsSync(keyPath) || !fsSync.existsSync(certPath)) {
      return {
        ok: false,
        exitMessage: `OPENAI_PROXY_TLS: file not found (key=${keyPath}, cert=${certPath})`,
      };
    }
    try {
      const key = fsSync.readFileSync(keyPath);
      const cert = fsSync.readFileSync(certPath);
      return { ok: true, mode: 'https-pem', key, cert };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, exitMessage: `OPENAI_PROXY_TLS: failed to read PEM files: ${msg}` };
    }
  }

  if (insecureFlag) {
    if (isProduction) {
      return {
        ok: false,
        exitMessage:
          'OPENAI_PROXY_INSECURE_DEV_TLS is not allowed when NODE_ENV=production. Use OPENAI_PROXY_TLS_* PEM paths or HTTP.',
      };
    }
    return { ok: true, mode: 'https-insecure-selfsigned' };
  }

  return { ok: true, mode: 'http' };
}
