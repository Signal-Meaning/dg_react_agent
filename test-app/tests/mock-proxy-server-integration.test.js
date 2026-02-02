/**
 * Integration tests for Mock Backend Proxy Server (mock-proxy-server.js).
 *
 * Exercises requirements:
 * - At least one of DEEPGRAM_API_KEY or OPENAI_API_KEY is required (server exits 1 when neither set).
 *
 * Run: npm test -- mock-proxy-server-integration
 * (from repo root; Jest picks up test-app/tests/**)
 */

const path = require('path');
const { spawn } = require('child_process');

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'mock-proxy-server.js');
const testAppDir = path.resolve(__dirname, '..');

function runProxyServer(env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      cwd: testAppDir,
      env: {
        ...process.env,
        SKIP_DOTENV: '1',
        DEEPGRAM_API_KEY: '',
        VITE_DEEPGRAM_API_KEY: '',
        OPENAI_API_KEY: '',
        VITE_OPENAI_API_KEY: '',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code, signal) => resolve({ code, signal, stderr }));
    child.on('error', reject);
  });
}

describe('Mock Proxy Server - Integration', () => {
  it('exits with code 1 when neither DEEPGRAM nor OPENAI API key is set', async () => {
    const { code, stderr } = await runProxyServer();
    expect(code).toBe(1);
    expect(stderr).toMatch(/at least one of DEEPGRAM_API_KEY or OPENAI_API_KEY is required/i);
  });

  it('starts when DEEPGRAM_API_KEY is set (does not exit immediately)', async () => {
    const child = spawn('node', [scriptPath], {
      cwd: testAppDir,
      env: {
        ...process.env,
        SKIP_DOTENV: '1',
        DEEPGRAM_API_KEY: 'test-key-at-least-40-characters-long-for-deepgram',
        VITE_DEEPGRAM_API_KEY: '',
        OPENAI_API_KEY: '',
        VITE_OPENAI_API_KEY: '',
      },
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
      env: {
        ...process.env,
        SKIP_DOTENV: '1',
        DEEPGRAM_API_KEY: '',
        VITE_DEEPGRAM_API_KEY: '',
        OPENAI_API_KEY: 'sk-test-openai-key',
        VITE_OPENAI_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exitPromise = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    child.kill('SIGTERM');
    const { code, signal } = await exitPromise;
    expect(signal).toBe('SIGTERM');
    expect(code).toBeNull();
  });

  it('prints wss:// in startup when HTTPS=true', async () => {
    let stdout = '';
    const child = spawn('node', [scriptPath], {
      cwd: testAppDir,
      env: {
        ...process.env,
        SKIP_DOTENV: '1',
        HTTPS: 'true',
        DEEPGRAM_API_KEY: 'test-key-at-least-40-characters-long-for-deepgram',
        VITE_DEEPGRAM_API_KEY: '',
        OPENAI_API_KEY: '',
        VITE_OPENAI_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stdout += d.toString(); });
    const running = new Promise((resolve) => {
      const check = () => {
        if (stdout.includes('Mock Backend Proxy Server running') || stdout.includes('wss://')) {
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
    expect(stdout).toMatch(/wss:\/\//);
    child.kill('SIGTERM');
  });
});
