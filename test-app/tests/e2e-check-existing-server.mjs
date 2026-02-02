/**
 * When E2E_USE_EXISTING_SERVER=1, Playwright does not start the dev server.
 * This script checks that the app is reachable before tests run; otherwise
 * every test gets net::ERR_EMPTY_RESPONSE and the cause is unclear.
 * Respects HTTPS=true from .env (Vite serves https when HTTPS=true).
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';
const baseURL = process.env.VITE_BASE_URL || (useHttps ? 'https://localhost:5173' : 'http://localhost:5173');

async function check() {
  try {
    if (baseURL.startsWith('https://')) {
      const https = await import('https');
      await new Promise((resolve, reject) => {
        const req = https.get(baseURL, { rejectUnauthorized: false }, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) resolve();
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
      });
    } else {
      const res = await fetch(baseURL, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }
    return;
  } catch (err) {
    console.error('\n[E2E] E2E_USE_EXISTING_SERVER is set but the app is not reachable at', baseURL);
    console.error('[E2E] Error:', err.message || err);
    console.error('\n[E2E] Start the dev server first, then run tests:');
    console.error('  Terminal 1: cd test-app && npm run dev');
    console.error('  Terminal 2: cd test-app && npm run test:proxy:server   # if using proxy mode');
    console.error('  Terminal 3: cd test-app && E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e\n');
    process.exit(1);
  }
}

export default async function globalSetup() {
  if (process.env.E2E_USE_EXISTING_SERVER === '1' || process.env.E2E_USE_EXISTING_SERVER === 'true') {
    await check();
  }
}
