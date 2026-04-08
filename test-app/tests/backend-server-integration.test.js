/**
 * Integration tests for test-app `scripts/backend-server.js` (proxy + /function-call).
 *
 * - Requires at least one of DEEPGRAM_API_KEY or OPENAI_API_KEY (exit 1 if neither).
 * - GET /health and GET /ready when the server is up.
 *
 * Run: `cd test-app && npm test -- backend-server-integration`
 */

const path = require('path');
const { spawn } = require('child_process');
const {
  SYNTHETIC_DEEPGRAM_API_KEY,
  SYNTHETIC_OPENAI_API_KEY,
  httpGetJson,
  waitForBackendHealth,
  backendServerTestEnv,
} = require('./helpers/backend-server-test-utils.cjs');

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'backend-server.js');
const testAppDir = path.resolve(__dirname, '..');

function runBackendUntilClose(env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      cwd: testAppDir,
      env: backendServerTestEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', (code, signal) => resolve({ code, signal, stderr }));
    child.on('error', reject);
  });
}

describe('backend-server.js integration', () => {
  it('exits with code 1 when neither DEEPGRAM nor OPENAI API key is set', async () => {
    const { code, stderr } = await runBackendUntilClose();
    expect(code).toBe(1);
    expect(stderr).toMatch(/at least one of DEEPGRAM_API_KEY or OPENAI_API_KEY is required/i);
  });

  it('starts when DEEPGRAM_API_KEY is set (does not exit immediately)', async () => {
    const child = spawn('node', [scriptPath], {
      cwd: testAppDir,
      env: backendServerTestEnv({ DEEPGRAM_API_KEY: SYNTHETIC_DEEPGRAM_API_KEY }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exitPromise = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    child.kill('SIGTERM');
    const { code, signal } = await exitPromise;
    expect(signal).toBe('SIGTERM');
    expect(code).toBeNull();
  });

  it('starts when OPENAI_API_KEY is set (does not exit immediately)', async () => {
    const child = spawn('node', [scriptPath], {
      cwd: testAppDir,
      env: backendServerTestEnv({ OPENAI_API_KEY: SYNTHETIC_OPENAI_API_KEY }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exitPromise = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    child.kill('SIGTERM');
    const { code, signal } = await exitPromise;
    expect(signal).toBe('SIGTERM');
    expect(code).toBeNull();
  });

  it('serves GET /health (liveness) and GET /ready (readiness) on a free port', async () => {
    const port = 18080 + Math.floor(Math.random() * 2000);
    const child = spawn('node', [scriptPath], {
      cwd: testAppDir,
      env: backendServerTestEnv({
        PROXY_PORT: String(port),
        DEEPGRAM_API_KEY: SYNTHETIC_DEEPGRAM_API_KEY,
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exitPromise = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    try {
      await waitForBackendHealth(port, 15000);
      const health = await httpGetJson(port, '/health');
      expect(health.statusCode).toBe(200);
      expect(health.body).toEqual({ status: 'ok' });
      const ready = await httpGetJson(port, '/ready');
      expect(ready.statusCode).toBe(200);
      expect(ready.body.status).toBe('ready');
      expect(ready.body.port).toBe(port);
      expect(ready.body.services.deepgram.enabled).toBe(true);
      expect(ready.body.services.deepgram.path).toBe('/deepgram-proxy');
      expect(ready.body.services.openai.enabled).toBe(false);
      expect(ready.body.services.openai.path).toBeNull();
    } finally {
      child.kill('SIGTERM');
      await exitPromise;
    }
  }, 20000);

  it('prints wss:// in startup when HTTPS=true', async () => {
    let combined = '';
    const child = spawn('node', [scriptPath], {
      cwd: testAppDir,
      env: backendServerTestEnv({
        HTTPS: 'true',
        DEEPGRAM_API_KEY: SYNTHETIC_DEEPGRAM_API_KEY,
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => {
      combined += d.toString();
    });
    child.stderr.on('data', (d) => {
      combined += d.toString();
    });
    const running = new Promise((resolve) => {
      const check = () => {
        if (combined.includes('Backend server running') || combined.includes('wss://')) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
    await Promise.race([
      running,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout waiting for server startup')), 8000)),
    ]);
    expect(combined).toMatch(/wss:\/\//);
    child.kill('SIGTERM');
  });
});
