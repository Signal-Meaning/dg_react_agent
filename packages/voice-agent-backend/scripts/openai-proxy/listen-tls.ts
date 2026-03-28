/**
 * EPIC-546: Resolve how the OpenAI proxy listen socket is secured (HTTP vs TLS).
 * Pure function for TDD — no fs or network.
 */

export type OpenAIProxyListenMode =
  | { kind: 'http' }
  | { kind: 'pem'; keyPath: string; certPath: string }
  | { kind: 'insecureDevSelfSigned' }
  | { kind: 'fatal'; message: string };

function isTruthyFlag(v: string | undefined): boolean {
  return v === '1' || v === 'true';
}

/**
 * Decide listen TLS mode from environment.
 * - Does **not** use generic `HTTPS` / `HTTPS=1` (Issue #550: avoid silent inheritance from host).
 * - PEM paths: both OPENAI_PROXY_TLS_KEY_PATH and OPENAI_PROXY_TLS_CERT_PATH required together.
 * - Dev self-signed: OPENAI_PROXY_INSECURE_DEV_TLS=1 (or true), forbidden when NODE_ENV=production.
 */
export function resolveOpenAIProxyListenMode(env: NodeJS.ProcessEnv): OpenAIProxyListenMode {
  const nodeEnv = (env.NODE_ENV || '').toLowerCase();
  const insecureDev = isTruthyFlag(env.OPENAI_PROXY_INSECURE_DEV_TLS);

  if (nodeEnv === 'production' && insecureDev) {
    return {
      kind: 'fatal',
      message:
        'OPENAI_PROXY_INSECURE_DEV_TLS must not be set when NODE_ENV=production. Use OPENAI_PROXY_TLS_KEY_PATH + OPENAI_PROXY_TLS_CERT_PATH or HTTP.',
    };
  }

  const keyPath = (env.OPENAI_PROXY_TLS_KEY_PATH || '').trim();
  const certPath = (env.OPENAI_PROXY_TLS_CERT_PATH || '').trim();

  if (keyPath && certPath) {
    return { kind: 'pem', keyPath, certPath };
  }
  if (keyPath || certPath) {
    return {
      kind: 'fatal',
      message:
        'Both OPENAI_PROXY_TLS_KEY_PATH and OPENAI_PROXY_TLS_CERT_PATH must be set together for TLS from files.',
    };
  }

  if (insecureDev) {
    return { kind: 'insecureDevSelfSigned' };
  }

  return { kind: 'http' };
}
