/**
 * When E2E_USE_EXISTING_SERVER=1 or USE_PROXY_MODE=1, Playwright does not start the dev server.
 * This script checks that the app is reachable before tests run; otherwise
 * every test gets net::ERR_EMPTY_RESPONSE and the cause is unclear.
 * Respects HTTPS=true from .env (Vite serves https when HTTPS=true).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: true });

const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';
// Match playwright.config.mjs: when HTTPS=true, use https baseURL so we check the right URL
const baseURL = useHttps
  ? (process.env.VITE_BASE_URL?.startsWith('https') ? process.env.VITE_BASE_URL : 'https://localhost:5173')
  : (process.env.VITE_BASE_URL || 'http://localhost:5173');

async function probe(url) {
  if (url.startsWith('https://')) {
    const https = await import('https');
    return new Promise((resolve, reject) => {
      const req = https.get(url, { rejectUnauthorized: false }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) resolve();
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }
  const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function check() {
  // Try baseURL, fallback protocol, and 127.0.0.1 (avoids localhost -> IPv6 when server is IPv4-only)
  const fallbackURL = baseURL.startsWith('https://') ? 'http://localhost:5173' : 'https://localhost:5173';
  const urls = [
    baseURL,
    fallbackURL,
    baseURL.replace('localhost', '127.0.0.1'),
    fallbackURL.replace('localhost', '127.0.0.1'),
  ].filter((u, i, a) => a.indexOf(u) === i); // unique

  let lastErr;
  for (const url of urls) {
    try {
      await probe(url);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  const detail = lastErr?.cause?.message || lastErr?.code || lastErr?.message || lastErr;
  console.error('\n[E2E] E2E_USE_EXISTING_SERVER is set but the app is not reachable.');
  console.error('[E2E] Tried:', urls.join(', '));
  console.error('[E2E] Last error:', detail);
  console.error('\n[E2E] Start the dev server first, then run tests:');
  console.error('  Terminal 1: cd test-app && npm run dev');
  console.error('  Terminal 2: cd test-app && npm run test:proxy:server   # if using proxy mode');
  console.error('  Terminal 3: cd test-app && E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e\n');
  process.exit(1);
}

export default async function globalSetup() {
  const useExisting =
    process.env.E2E_USE_EXISTING_SERVER === '1' ||
    process.env.E2E_USE_EXISTING_SERVER === 'true' ||
    process.env.USE_PROXY_MODE === '1' ||
    process.env.USE_PROXY_MODE === 'true';
  if (useExisting) {
    await check();
  }
}
