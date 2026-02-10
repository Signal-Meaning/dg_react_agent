/**
 * Issue #423: CLI tests for voice-agent-backend.
 * Asserts that the CLI starts a server and the same routes are available.
 * @see docs/issues/ISSUE-423/TDD-PLAN.md Phase 3
 *
 * @jest-environment node
 */

import http from 'http';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

const packageDir = path.resolve(__dirname, '../../packages/voice-agent-backend');
const cliPath = path.join(packageDir, 'src/cli.js');

function request(port: number, pathName: string): Promise<{ statusCode: number }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: 'localhost', port, path: pathName, method: 'GET' },
      (res) => {
        res.resume();
        resolve({ statusCode: res.statusCode ?? 0 });
      }
    );
    req.on('error', reject);
    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error('request timeout'));
    });
    req.end();
  });
}

function waitForPort(port: number, timeoutMs: number = 5000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = http.request(
        { host: 'localhost', port, path: '/api/deepgram/proxy', method: 'GET' },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout waiting for port'));
        setTimeout(tryConnect, 100);
      });
      req.end();
    };
    tryConnect();
  });
}

describe('voice-agent-backend CLI (Issue #423 Phase 3)', () => {
  let child: ChildProcess | null = null;
  const testPort = 3942;

  afterEach(() => {
    if (child?.pid) {
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch {
        // ignore
      }
      child = null;
    }
  });

  it('serve command starts server and responds on proxy path', async () => {
    child = spawn('node', [cliPath, 'serve'], {
      cwd: packageDir,
      env: { ...process.env, PORT: String(testPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await waitForPort(testPort);

    const { statusCode } = await request(testPort, '/api/deepgram/proxy');
    expect(statusCode).toBe(501);
  }, 10000);
});
