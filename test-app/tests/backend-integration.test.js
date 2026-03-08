/**
 * Backend integration tests (Issue #489).
 *
 * Exercises the real test-app backend (backend-server.js) as a single process that serves
 * both the proxy WebSocket(s) and POST /function-call with CORS. Fills the gap between
 * function-call-endpoint-integration.test.js (same backend code but isolated port, no CORS
 * or proxy assertions) and E2E (browser → backend), so misconfigurations (e.g. CORS
 * missing on /function-call) are caught by integration tests instead of only E2E.
 *
 * Run: npm test -- backend-integration
 * (from test-app)
 *
 * Spawns backend-server.js on a dedicated port (18408) so it does not clash with
 * function-call-endpoint-integration (18407) or a manually started backend (8080).
 * Uses DEEPGRAM_API_KEY so the server attaches the Deepgram proxy; POST /function-call
 * is always served. Same backend code path as E2E (proxy + /function-call + CORS).
 *
 * @jest-environment node
 */

const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'backend-server.js');
const testAppDir = path.resolve(__dirname, '..');
const BACKEND_PORT = 18408;
const BASE_URL = `http://localhost:${BACKEND_PORT}`;

function spawnBackendServer() {
  return spawn('node', [scriptPath], {
    cwd: testAppDir,
    env: {
      ...process.env,
      SKIP_DOTENV: '1',
      PROXY_PORT: String(BACKEND_PORT),
      DEEPGRAM_API_KEY: 'test-key-at-least-40-characters-long-for-deepgram',
      VITE_DEEPGRAM_API_KEY: '',
      OPENAI_API_KEY: '',
      VITE_OPENAI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const { method = 'GET', headers = {}, body } = options;
    const reqHeaders = { ...headers };
    if (body !== undefined) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (ch) => chunks.push(ch));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          let parsedBody = rawBody;
          try {
            if (rawBody && res.headers['content-type']?.includes('application/json')) {
              parsedBody = JSON.parse(rawBody);
            }
          } catch {
            // leave as string
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody,
            rawBody,
          });
        });
      }
    );
    req.on('error', reject);
    if (body !== undefined) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(data);
    }
    req.end();
  });
}

function httpGet(url) {
  return httpRequest(url, { method: 'GET' });
}

function httpPost(url, body, extraHeaders = {}) {
  return httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body,
  });
}

function httpOptions(url, extraHeaders = {}) {
  return httpRequest(url, { method: 'OPTIONS', headers: extraHeaders });
}

function waitForServerReady(maxWaitMs = 15000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxWaitMs;
    const check = () => {
      httpGet(`${BASE_URL}/`)
        .then((res) => {
          if (res.statusCode === 404 || res.statusCode === 200) {
            resolve();
            return;
          }
          if (Date.now() > deadline) {
            reject(new Error('Timeout waiting for server (GET / did not return 404/200)'));
            return;
          }
          setTimeout(check, 200);
        })
        .catch(() => {
          if (Date.now() > deadline) {
            reject(new Error('Timeout waiting for server'));
            return;
          }
          setTimeout(check, 200);
        });
    };
    setTimeout(check, 500);
  });
}

/** TCP connect to port; used to assert server is listening. */
function tcpConnect(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', reject);
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
  });
}

/**
 * Probe WebSocket path: attempt WS connection; consider "reachable" if we get open or
 * 400/Unexpected (server responded, e.g. missing token). Matches E2E probe semantics.
 */
async function probeProxyWebSocket(port, wsPath) {
  try {
    await tcpConnect(port);
  } catch {
    return false;
  }
  const wsUrl = `ws://127.0.0.1:${port}${wsPath}`;
  const WebSocket = require('ws');
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      ws.removeAllListeners();
      ws.terminate();
      resolve(false);
    }, 5000);
    ws.on('open', () => {
      clearTimeout(t);
      ws.close();
      resolve(true);
    });
    ws.on('error', (err) => {
      clearTimeout(t);
      const msg = err?.message || String(err);
      if (msg.includes('400') || msg.includes('Unexpected server response')) resolve(true);
      else resolve(false);
    });
  });
}

describe('Backend integration (Issue #489)', () => {
  let child;

  beforeAll(async () => {
    child = spawnBackendServer();
    await waitForServerReady();
  }, 20000);

  afterAll(() => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  });

  describe('1. Server and proxy', () => {
    it('responds to GET / with 404 (server up)', async () => {
      const res = await httpGet(`${BASE_URL}/`);
      expect(res.statusCode).toBe(404);
    });

    it('accepts TCP connections on backend port', async () => {
      await expect(tcpConnect(BACKEND_PORT)).resolves.toBe(true);
    });

    it('exposes Deepgram proxy WebSocket path (/deepgram-proxy) as reachable', async () => {
      const reachable = await probeProxyWebSocket(BACKEND_PORT, '/deepgram-proxy');
      expect(reachable).toBe(true);
    });
  });

  describe('2. POST /function-call contract', () => {
    it('returns 200 and { content } for get_current_time', async () => {
      const res = await httpPost(`${BASE_URL}/function-call`, {
        id: 'int_test_1',
        name: 'get_current_time',
        arguments: '{}',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('content');
      expect(typeof res.body.content).toBe('string');
      expect(res.body.content.length).toBeGreaterThan(0);
      const parsed = JSON.parse(res.body.content);
      expect(parsed).toHaveProperty('time');
    });

    it('returns 200 and { content } for get_current_time with timezone', async () => {
      const res = await httpPost(`${BASE_URL}/function-call`, {
        id: 'int_test_2',
        name: 'get_current_time',
        arguments: '{"timezone":"America/New_York"}',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('content');
      const parsed = JSON.parse(res.body.content);
      expect(parsed).toHaveProperty('time');
    });

    it('returns error payload for unknown function', async () => {
      const res = await httpPost(`${BASE_URL}/function-call`, {
        id: 'int_test_3',
        name: 'unknown_function_xyz',
        arguments: '{}',
      });
      expect([200, 400, 404, 500]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error.length).toBeGreaterThan(0);
    });

    it('returns 400 or error for missing required fields', async () => {
      const res = await httpPost(`${BASE_URL}/function-call`, {
        name: 'get_current_time',
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body?.error != null || res.statusCode === 400).toBe(true);
    });

    it('accepts X-Trace-Id and X-Request-Id', async () => {
      const traceId = 'backend-int-trace-' + Date.now();
      const res = await httpPost(
        `${BASE_URL}/function-call`,
        { id: 'int_trace_1', name: 'get_current_time', arguments: '{}' },
        { 'X-Trace-Id': traceId }
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('content');
      const res2 = await httpPost(
        `${BASE_URL}/function-call`,
        { id: 'int_trace_2', name: 'get_current_time', arguments: '{}' },
        { 'X-Request-Id': 'backend-int-req-' + Date.now() }
      );
      expect(res2.statusCode).toBe(200);
    });
  });

  describe('3. CORS (browser-like requests)', () => {
    const origin = 'http://localhost:5173';

    it('OPTIONS /function-call with Origin returns 200 and CORS preflight headers', async () => {
      const res = await httpOptions(`${BASE_URL}/function-call`, { Origin: origin });
      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-methods']).toBeDefined();
      expect(res.headers['access-control-allow-methods'].toLowerCase()).toContain('post');
      expect(res.headers['access-control-allow-headers']).toBeDefined();
      expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('content-type');
    });

    it('OPTIONS /function-call without Origin is rejected (403) or has no CORS', async () => {
      const res = await httpOptions(`${BASE_URL}/function-call`);
      // Backend may return 403 when origin missing in OPTIONS, or 200 with no ACAO
      expect([200, 403]).toContain(res.statusCode);
    });

    it('POST /function-call with Origin returns Access-Control-Allow-Origin in response', async () => {
      const res = await httpPost(
        `${BASE_URL}/function-call`,
        { id: 'cors_1', name: 'get_current_time', arguments: '{}' },
        { Origin: origin }
      );
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('content');
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('POST /function-call without Origin returns Access-Control-Allow-Origin: * or valid header', async () => {
      const res = await httpPost(`${BASE_URL}/function-call`, {
        id: 'cors_2',
        name: 'get_current_time',
        arguments: '{}',
      });
      expect(res.statusCode).toBe(200);
      const acao = res.headers['access-control-allow-origin'];
      expect(acao).toBeDefined();
      expect(acao === '*' || acao === 'http://localhost:5173' || acao.length > 0).toBe(true);
    });
  });
});
