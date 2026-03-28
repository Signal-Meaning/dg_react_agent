#!/usr/bin/env npx tsx
/**
 * Run the OpenAI Realtime proxy (Issue #381).
 *
 * Listens on http://localhost:8080/openai (or OPENAI_PROXY_PORT).
 *
 * **TLS (EPIC-546):** Generic `HTTPS=true` is **not** used for this process. Choose one:
 * - **HTTP** (default): no TLS env.
 * - **PEM files:** `OPENAI_PROXY_TLS_KEY_PATH` + `OPENAI_PROXY_TLS_CERT_PATH` (e.g. mkcert).
 * - **Dev self-signed:** `OPENAI_PROXY_INSECURE_DEV_TLS=1` (disallowed when `NODE_ENV=production`).
 *
 * When spawned from `attachVoiceAgentUpgrade` with `https: true`, the parent sets
 * `OPENAI_PROXY_INSECURE_DEV_TLS` and strips `HTTPS` so host `HTTPS` does not imply proxy TLS alone.
 *
 * Requires OPENAI_API_KEY for upstream authentication.
 *
 * Logging: set LOG_LEVEL (debug | info | warn | error) for verbose proxy logs. If unset,
 * ERROR-level logs still emit (upstream Realtime errors are always visible — Issue #531).
 *
 * Client JSON: unknown message types are rejected by default (Issue #533). Set
 * OPENAI_PROXY_CLIENT_JSON_PASSTHROUGH=1 only to forward arbitrary JSON to upstream (not recommended).
 *
 * Run with cwd = this package directory (voice-agent-backend) or repo root.
 * Loads .env from cwd, parent, or repo root so OPENAI_API_KEY works in monorepo or standalone.
 *
 * Usage (from backend package dir or repo root):
 *   npx tsx scripts/openai-proxy/run.ts
 *   OPENAI_API_KEY=sk-... npx tsx scripts/openai-proxy/run.ts
 *   OPENAI_PROXY_PORT=9090 npx tsx scripts/openai-proxy/run.ts
 */

import path from 'path';
import https from 'https';
import dotenv from 'dotenv';
import { resolveOpenAIProxyListenTls } from './resolve-proxy-tls';

const cwd = process.cwd();
// Load .env from cwd (package dir or repo root), then common alternate locations (monorepo)
dotenv.config({ path: path.resolve(cwd, '.env') });
dotenv.config({ path: path.resolve(cwd, 'test-app', '.env') });
dotenv.config({ path: path.resolve(cwd, '..', '.env') });
dotenv.config({ path: path.resolve(cwd, '..', '..', '.env') });
dotenv.config({ path: path.resolve(cwd, '..', '..', 'test-app', '.env') });

import { createOpenAIProxyServer } from './server';

const apiKey = process.env.OPENAI_API_KEY;
const port = parseInt(process.env.OPENAI_PROXY_PORT ?? '8080', 10);
const upstreamUrl =
  process.env.OPENAI_REALTIME_URL ?? 'wss://api.openai.com/v1/realtime?model=gpt-realtime';

if (!apiKey || apiKey.trim().length === 0) {
  console.error('OPENAI_API_KEY is required. Set it in .env (or pass it in the environment) and run again.');
  process.exit(1);
}

const tlsResolved = resolveOpenAIProxyListenTls(process.env);
if (!tlsResolved.ok) {
  console.error(tlsResolved.exitMessage);
  process.exit(1);
}

/** Issue #437: Prefer LOG_LEVEL; OPENAI_PROXY_DEBUG=1 is alias for LOG_LEVEL=debug. */
const openaiProxyDebug = process.env.OPENAI_PROXY_DEBUG === '1' || process.env.OPENAI_PROXY_DEBUG === 'true';
const logLevel = process.env.LOG_LEVEL ?? (openaiProxyDebug ? 'debug' : undefined);
const greetingTextOnly = process.env.OPENAI_PROXY_GREETING_TEXT_ONLY === '1' || process.env.OPENAI_PROXY_GREETING_TEXT_ONLY === 'true';
/** Issue #533: legacy raw passthrough of unknown client JSON to upstream (discouraged). */
const allowClientJsonPassthrough =
  process.env.OPENAI_PROXY_CLIENT_JSON_PASSTHROUGH === '1' ||
  process.env.OPENAI_PROXY_CLIENT_JSON_PASSTHROUGH === 'true';

const useTls =
  tlsResolved.ok &&
  (tlsResolved.mode === 'https-pem' || tlsResolved.mode === 'https-insecure-selfsigned');

let server: ReturnType<typeof createOpenAIProxyServer>['server'] | undefined = undefined;
if (tlsResolved.ok && tlsResolved.mode === 'https-pem') {
  server = https.createServer(
    { key: tlsResolved.key, cert: tlsResolved.cert },
    (_req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  );
} else if (tlsResolved.ok && tlsResolved.mode === 'https-insecure-selfsigned') {
  const { generate: generateSelfSigned } = require('selfsigned') as {
    generate: (
      attrs: Array<{ name: string; value: string }>,
      options: { keySize: number; days: number }
    ) => { cert: string; private: string };
  };
  const pems = generateSelfSigned([{ name: 'commonName', value: 'localhost' }], { keySize: 2048, days: 365 });
  server = https.createServer(
    { key: pems.private, cert: pems.cert },
    (_req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  );
}

const { server: proxyServer } = createOpenAIProxyServer({
  server,
  path: '/openai',
  upstreamUrl,
  upstreamHeaders: { Authorization: `Bearer ${apiKey.trim()}` },
  logLevel,
  greetingTextOnly,
  allowClientJsonPassthrough,
});

const scheme = useTls ? 'https' : 'http';
const wsScheme = useTls ? 'wss' : 'ws';
proxyServer.listen(port, () => {
  console.log(`OpenAI proxy listening on ${scheme}://localhost:${port}/openai`);
  console.log(`Set VITE_OPENAI_PROXY_ENDPOINT=${wsScheme}://localhost:${port}/openai to run E2E tests.`);
});
