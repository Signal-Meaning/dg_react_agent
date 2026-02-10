/**
 * Issue #423: Integration tests for voice-agent-backend mounted routes.
 * Asserts that Deepgram proxy, OpenAI proxy, and function-call paths are mounted and return defined responses.
 * @see docs/issues/ISSUE-423/TDD-PLAN.md Phase 2
 *
 * @jest-environment node
 */

import http from 'http';
import path from 'path';

const backendPath = path.resolve(__dirname, '../../packages/voice-agent-backend/src/index.js');
const { createServer: createVoiceAgentServer } = require(backendPath);

function request(
  port: number,
  pathName: string,
  method: string = 'GET'
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port,
        path: pathName,
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('error', reject);
    if (method === 'POST') req.write('{}');
    req.end();
  });
}

describe('voice-agent-backend mounted routes (Issue #423 Phase 2)', () => {
  let server: http.Server | null = null;
  let port: number = 0;

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

  it('starts server and responds on /api/deepgram/proxy with defined shape', async () => {
    const app = createVoiceAgentServer({
      deepgramProxy: { enabled: true },
      openaiProxy: { enabled: true },
      functionCall: { path: '/api/function-call' },
    });
    server = app.listen(0) as http.Server;
    port = (server.address() as { port: number }).port;

    const { statusCode, body } = await request(port, '/api/deepgram/proxy');
    expect(statusCode).toBe(501);
    const data = JSON.parse(body);
    expect(data).toHaveProperty('route', 'deepgram');
    expect(data).toHaveProperty('error');
  });

  it('responds on /api/openai/proxy with defined shape', async () => {
    const app = createVoiceAgentServer({
      deepgramProxy: { enabled: true },
      openaiProxy: { enabled: true },
      functionCall: { path: '/api/function-call' },
    });
    server = app.listen(0) as http.Server;
    port = (server.address() as { port: number }).port;

    const { statusCode, body } = await request(port, '/api/openai/proxy');
    expect(statusCode).toBe(501);
    const data = JSON.parse(body);
    expect(data).toHaveProperty('route', 'openai');
  });

  it('responds on custom function-call path with defined shape', async () => {
    const app = createVoiceAgentServer({
      functionCall: { path: '/api/function-call' },
    });
    server = app.listen(0) as http.Server;
    port = (server.address() as { port: number }).port;

    const { statusCode, body } = await request(port, '/api/function-call', 'POST');
    expect(statusCode).toBe(501);
    const data = JSON.parse(body);
    expect(data).toHaveProperty('route', 'function-call');
  });
});
