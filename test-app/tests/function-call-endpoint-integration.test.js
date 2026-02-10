/**
 * Integration tests for POST /function-call (Issue #407, Phase 1.2).
 *
 * TDD: These tests define the contract in BACKEND-FUNCTION-CALL-CONTRACT.md.
 * Run backend implementation to make them pass.
 *
 * Uses Node http (not fetch) so tests run under Jest jsdom.
 *
 * Run: npm test -- function-call-endpoint-integration
 * (from test-app; or from repo root if Jest picks up test-app/tests/**)
 * @jest-environment node
 */

const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'backend-server.js');
const testAppDir = path.resolve(__dirname, '..');
const FUNCTION_CALL_PORT = 18407;
const BASE_URL = `http://localhost:${FUNCTION_CALL_PORT}`;

function spawnBackendServer() {
  return spawn('node', [scriptPath], {
    cwd: testAppDir,
    env: {
      ...process.env,
      SKIP_DOTENV: '1',
      PROXY_PORT: String(FUNCTION_CALL_PORT),
      DEEPGRAM_API_KEY: 'test-key-at-least-40-characters-long-for-deepgram',
      VITE_DEEPGRAM_API_KEY: '',
      OPENAI_API_KEY: '',
      VITE_OPENAI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      { hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'GET' },
      (res) => { resolve(res); }
    );
    req.on('error', reject);
    req.end();
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let buf = '';
        res.on('data', (ch) => { buf += ch; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : {} });
          } catch {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function waitForServerReady(maxWaitMs = 10000) {
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

describe('POST /function-call (Issue #407)', () => {
  let child;

  beforeAll(async () => {
    child = spawnBackendServer();
    await waitForServerReady();
  }, 15000);

  afterAll(() => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  });

  it('returns 200 and { content } for known function get_current_time', async () => {
    const { status, body } = await httpPost(`${BASE_URL}/function-call`, {
      id: 'call_test_1',
      name: 'get_current_time',
      arguments: '{}',
    });
    expect(status).toBe(200);
    expect(body).toHaveProperty('content');
    expect(typeof body.content).toBe('string');
    expect(body.content.length).toBeGreaterThan(0);
    const parsed = JSON.parse(body.content);
    expect(parsed).toBeDefined();
    expect(parsed).toHaveProperty('time');
  });

  it('returns 200 and { content } for get_current_time with timezone argument', async () => {
    const { status, body } = await httpPost(`${BASE_URL}/function-call`, {
      id: 'call_test_2',
      name: 'get_current_time',
      arguments: '{"timezone":"America/New_York"}',
    });
    expect(status).toBe(200);
    expect(body).toHaveProperty('content');
    expect(typeof body.content).toBe('string');
    expect(body.content.length).toBeGreaterThan(0);
    const parsed = JSON.parse(body.content);
    expect(parsed).toHaveProperty('time');
  });

  it('returns error payload for unknown function name', async () => {
    const { status, body } = await httpPost(`${BASE_URL}/function-call`, {
      id: 'call_test_3',
      name: 'unknown_function_xyz',
      arguments: '{}',
    });
    expect([200, 400, 404, 500]).toContain(status);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('returns 400 or error for missing required fields', async () => {
    const { status, body } = await httpPost(`${BASE_URL}/function-call`, {
      name: 'get_current_time',
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body.error != null || status === 400).toBe(true);
  });
});
