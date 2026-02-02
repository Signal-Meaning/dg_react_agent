/**
 * When E2E_USE_EXISTING_SERVER=1, Playwright does not start the dev server or proxy.
 * This script checks that the app is reachable before tests run; otherwise
 * every test gets net::ERR_EMPTY_RESPONSE and the cause is unclear.
 * When USE_PROXY_MODE is set, also checks that the proxy is reachable (port + WebSocket /openai).
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

/** Check that the proxy is listening on PROXY_PORT (default 8080). Uses TCP connect; works for both ws and wss. */
async function checkProxyPort() {
  const net = await import('net');
  const port = parseInt(process.env.PROXY_PORT || '8080', 10);
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', reject);
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
  });
}

/** Check that the proxy /openai path is reachable (accepts connections).
 * A full handshake may not succeed because the Realtime API expects specific subprotocols;
 * "Unexpected server response: 400" means the proxy is up and responding (it rejected our bare client). */
async function checkProxyWebSocket() {
  const port = process.env.PROXY_PORT || '8080';
  const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';
  const scheme = useHttps ? 'wss' : 'ws';
  const url = `${scheme}://127.0.0.1:${port}/openai`;
  const WebSocket = (await import('ws')).default;
  return new Promise((resolve, reject) => {
    const opts = useHttps ? { rejectUnauthorized: false } : {};
    const ws = new WebSocket(url, opts);
    const t = setTimeout(() => {
      ws.removeAllListeners();
      ws.terminate();
      reject(new Error('WebSocket handshake timeout (proxy may be listening but /openai not ready or TLS mismatch)'));
    }, 5000);
    ws.on('open', () => {
      clearTimeout(t);
      ws.close();
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(t);
      const msg = err?.message || String(err);
      // 400 = server responded but rejected our handshake (we don't send Realtime subprotocols); proxy is up
      if (msg.includes('400') || msg.includes('Unexpected server response')) {
        resolve();
        return;
      }
      reject(err);
    });
  });
}

async function checkProxy() {
  const port = process.env.PROXY_PORT || '8080';
  const useHttps = process.env.HTTPS === 'true' || process.env.HTTPS === '1';

  try {
    await checkProxyPort();
  } catch (err) {
    const detail = err?.code || err?.message || err;
    console.error('\n[E2E] USE_PROXY_MODE is set but the proxy is not reachable on port', port + '.');
    console.error('[E2E] Error:', detail);
    console.error('\n[E2E] Start the proxy in a separate terminal (same HTTPS as app):');
    console.error('  cd test-app && npm run test:proxy:server');
    if (useHttps) {
      console.error('  Ensure test-app/.env has HTTPS=true so the proxy serves wss:// (required when app uses https).');
    }
    console.error('  Then re-run: E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e\n');
    process.exit(1);
  }

  try {
    await checkProxyWebSocket();
  } catch (err) {
    const detail = err?.code || err?.message || err;
    console.error('\n[E2E] Proxy is listening on port', port, 'but WebSocket to /openai failed.');
    console.error('[E2E] Error:', detail);
    console.error('\n[E2E] This usually means:');
    if (useHttps) {
      console.error('  - Scheme mismatch: app uses https/wss but proxy is serving ws (set HTTPS=true in test-app/.env and restart proxy), or');
    }
    console.error('  - OpenAI subprocess not ready (proxy starts an OpenAI proxy on port 8081; ensure OPENAI_API_KEY is set and no port conflict).');
    console.error('  - Browser will see the same failure; connection status will never become "connected".');
    console.error('\n[E2E] Fix the proxy/OpenAI setup, then re-run: E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true npm run test:e2e\n');
    process.exit(1);
  }
}

export default async function globalSetup() {
  const useExisting =
    process.env.E2E_USE_EXISTING_SERVER === '1' ||
    process.env.E2E_USE_EXISTING_SERVER === 'true';
  if (useExisting) {
    await check();
    if (process.env.USE_PROXY_MODE === '1' || process.env.USE_PROXY_MODE === 'true') {
      await checkProxy();
    }
  }
}
