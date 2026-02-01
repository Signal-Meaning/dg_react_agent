#!/usr/bin/env npx tsx
/**
 * Run the OpenAI Realtime proxy (Issue #381).
 *
 * Listens on http://localhost:8080/openai (or OPENAI_PROXY_PORT).
 * Requires OPENAI_API_KEY for upstream authentication (set in .env or test-app/.env).
 *
 * Run from the project root (repo root where package.json and node_modules are).
 *
 * Usage:
 *   npm run openai-proxy   (loads OPENAI_API_KEY from .env or test-app/.env)
 *   OPENAI_API_KEY=sk-... npm run openai-proxy
 *   OPENAI_PROXY_PORT=9090 npm run openai-proxy
 *
 * Then run E2E with:
 *   VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai npm run test:e2e -- openai-proxy-e2e
 */

import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root, then test-app/.env (so OPENAI_API_KEY in either file works)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'test-app', '.env') });

import { createOpenAIProxyServer } from './server';

const apiKey = process.env.OPENAI_API_KEY;
const port = parseInt(process.env.OPENAI_PROXY_PORT ?? '8080', 10);
const upstreamUrl =
  process.env.OPENAI_REALTIME_URL ?? 'wss://api.openai.com/v1/realtime?model=gpt-realtime';

if (!apiKey || apiKey.trim().length === 0) {
  console.error('OPENAI_API_KEY is required. Set it in .env or test-app/.env (or pass it in the environment) and run again.');
  process.exit(1);
}

const debug = process.env.OPENAI_PROXY_DEBUG === '1' || process.env.OPENAI_PROXY_DEBUG === 'true';

const { server } = createOpenAIProxyServer({
  path: '/openai',
  upstreamUrl,
  upstreamHeaders: { Authorization: `Bearer ${apiKey.trim()}` },
  debug,
});

server.listen(port, () => {
  console.log(`OpenAI proxy listening on http://localhost:${port}/openai`);
  console.log('Set VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:' + port + '/openai to run E2E tests.');
});
