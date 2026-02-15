#!/usr/bin/env npx tsx
/**
 * Run the OpenAI Realtime proxy (Issue #381).
 *
 * Listens on http://localhost:8080/openai (or OPENAI_PROXY_PORT).
 * Set HTTPS=true or HTTPS=1 in .env (or env) to use HTTPS with a self-signed cert.
 * Requires OPENAI_API_KEY for upstream authentication.
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
const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';

if (!apiKey || apiKey.trim().length === 0) {
  console.error('OPENAI_API_KEY is required. Set it in .env (or pass it in the environment) and run again.');
  process.exit(1);
}

const debug = process.env.OPENAI_PROXY_DEBUG === '1' || process.env.OPENAI_PROXY_DEBUG === 'true';
const greetingTextOnly = process.env.OPENAI_PROXY_GREETING_TEXT_ONLY === '1' || process.env.OPENAI_PROXY_GREETING_TEXT_ONLY === 'true';

let server: ReturnType<typeof createOpenAIProxyServer>['server'] | undefined = undefined;
if (useHttps) {
  const { generate: generateSelfSigned } = require('selfsigned') as { generate: (attrs: Array<{ name: string; value: string }>, options: { keySize: number; days: number }) => { cert: string; private: string } };
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
  debug,
  greetingTextOnly,
});

const scheme = useHttps ? 'https' : 'http';
const wsScheme = useHttps ? 'wss' : 'ws';
proxyServer.listen(port, () => {
  console.log(`OpenAI proxy listening on ${scheme}://localhost:${port}/openai`);
  console.log(`Set VITE_OPENAI_PROXY_ENDPOINT=${wsScheme}://localhost:${port}/openai to run E2E tests.`);
});
