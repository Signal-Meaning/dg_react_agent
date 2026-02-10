/**
 * Issue #423: Thin-wrapper consumer scenario.
 * Asserts that a minimal app (config, auth, logging only) can mount the package and serve requests.
 * @see docs/issues/ISSUE-423/TDD-PLAN.md Phase 4
 *
 * @jest-environment node
 */

import http from 'http';
import path from 'path';

const backendPath = path.resolve(__dirname, '../../packages/voice-agent-backend/src/index.js');
const express = require(path.join(path.dirname(backendPath), '../node_modules/express'));
const { mountVoiceAgentBackend } = require(backendPath);

function request(port: number, pathName: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: 'localhost', port, path: pathName, method: 'GET' },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('voice-agent-backend thin-wrapper (Issue #423 Phase 4)', () => {
  let server: http.Server | null = null;

  afterEach((done) => {
    if (server) {
      server.close(() => {
        server = null;
        done();
      });
    } else {
      done();
    }
  });

  it('minimal app with auth and logging middleware mounts package and handles request', async () => {
    const app = express();
    app.use((_req: unknown, _res: unknown, next: () => void) => next()); // logging stub
    app.use((_req: unknown, _res: unknown, next: () => void) => next()); // auth stub
    mountVoiceAgentBackend(app, {
      deepgramProxy: { enabled: true },
      openaiProxy: { enabled: true },
      functionCall: { path: '/api/function-call' },
    });
    server = app.listen(0) as http.Server;
    const port = (server.address() as { port: number }).port;

    const { statusCode, body } = await request(port, '/api/openai/proxy');
    expect(statusCode).toBe(501);
    const data = JSON.parse(body);
    expect(data.route).toBe('openai');
  });
});
